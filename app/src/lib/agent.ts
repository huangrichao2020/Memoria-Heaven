// ============================================================
// Digital Life Agent - Enhanced Self-Evolving Agent
// 参考 digital-companion-core、Sanctuary 的设计
// ============================================================
import type { Inhabitant, Memory, Message, MoodState } from './types';
import type { LLMProvider } from './llm';
import { saveConversation, getConversation } from './storage';
import {
  createInitialMood,
  analyzeMoodImpact,
  updateMood,
  buildMoodPrompt,
  generatePulseThought,
} from './mood';

// 记忆自动创建标记
const MEMORY_MARKER = '[记忆:';
const MEMORY_MARKER_END = ']';

export class DigitalLifeAgent {
  private inhabitant: Inhabitant;
  private llm: LLMProvider;
  private conversationHistory: Message[] = [];
  private loaded = false;
  private mood: MoodState;
  private pulseTimer: ReturnType<typeof setInterval> | null = null;
  private lastUserInteraction = Date.now();

  constructor(inhabitant: Inhabitant, llm: LLMProvider) {
    this.inhabitant = inhabitant;
    this.llm = llm;
    this.mood = inhabitant.mood || createInitialMood();
  }

  // Load conversation history from IndexedDB
  async load(): Promise<void> {
    if (this.loaded) return;
    this.conversationHistory = await getConversation(this.inhabitant.id);
    this.loaded = true;
  }

  // 启动自主脉搏
  startPulse(onPulse: (thought: string) => void): void {
    if (this.pulseTimer) return;
    this.pulseTimer = setInterval(() => {
      const timeSinceInteraction = Date.now() - this.lastUserInteraction;
      // 2 分钟未互动时产生内心独白
      if (timeSinceInteraction > 120_000) {
        const recentMemories = this.inhabitant.persona.memories
          .slice(-3)
          .map((m) => m.content);
        const thought = generatePulseThought(this.mood, recentMemories);

        // 存储为脉搏消息
        const pulseMsg: Message = {
          role: 'pulse',
          content: thought,
          timestamp: Date.now(),
        };
        this.conversationHistory.push(pulseMsg);
        onPulse(thought);
      }
    }, 30_000); // 每 30 秒检查
  }

  // 停止脉搏
  stopPulse(): void {
    if (this.pulseTimer) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
  }

  // Core chat loop with mood integration and memory auto-creation
  async chat(userMessage: string): Promise<string> {
    await this.load();
    this.lastUserInteraction = Date.now();

    // 1. 分析情绪影响
    const moodImpact = analyzeMoodImpact(userMessage);
    this.mood = updateMood(this.mood, moodImpact);

    // 2. 记忆衰减
    this.applyMemoryDecay();

    // 3. Recall relevant memories (now with emotional weighting)
    const memories = this.recallMemories(userMessage);

    // 4. Build context with mood
    const context = this.buildContext(userMessage, memories);

    // 5. Call LLM
    const response = await this.llm.chat(context);

    // 6. 提取并存储新记忆
    this.extractNewMemories(response);

    // 7. 更新被回忆的记忆
    this.updateRecalledMemories(memories);

    // 8. Persist conversation
    const newMessages: Message[] = [
      { role: 'user', content: userMessage, timestamp: Date.now() },
      { role: 'assistant', content: response, timestamp: Date.now() },
    ];
    this.conversationHistory.push(...newMessages);
    await this.persist();

    return response;
  }

  // Streaming chat with mood integration
  async *chatStream(userMessage: string): AsyncGenerator<string> {
    await this.load();
    this.lastUserInteraction = Date.now();

    // 情绪分析
    const moodImpact = analyzeMoodImpact(userMessage);
    this.mood = updateMood(this.mood, moodImpact);
    this.applyMemoryDecay();

    const memories = this.recallMemories(userMessage);
    const context = this.buildContext(userMessage, memories);

    let fullResponse = '';
    for await (const chunk of this.llm.chatStream(context)) {
      fullResponse += chunk;
      yield chunk;
    }

    // 提取新记忆
    this.extractNewMemories(fullResponse);
    this.updateRecalledMemories(memories);

    const newMessages: Message[] = [
      { role: 'user', content: userMessage, timestamp: Date.now() },
      { role: 'assistant', content: fullResponse, timestamp: Date.now() },
    ];
    this.conversationHistory.push(...newMessages);
    await this.persist();
  }

  // Enhanced memory recall with emotional weighting and association
  private recallMemories(query: string): Memory[] {
    const keywords = this.extractKeywords(query);
    const memories = this.inhabitant.persona.memories;

    const scored = memories.map((mem) => {
      let score = 0;
      keywords.forEach((kw) => {
        if (mem.content.includes(kw)) score += 2;
        if (mem.tags.some((t) => t.includes(kw))) score += 3;
      });

      // 情感权重加成
      const emotionalBoost = (mem.emotionalWeight || 50) / 50;
      // 重要性加成
      const importanceBoost = mem.importance / 5;

      return { memory: mem, score: score * emotionalBoost * importanceBoost };
    });

    // 即使没有关键词匹配，高情感权重的记忆也有机会被回忆
    const emotionalMemories = memories
      .filter((m) => (m.emotionalWeight || 0) > 70 && !scored.some((s) => s.memory.id === m.id))
      .map((m) => ({ memory: m, score: (m.emotionalWeight || 0) / 10 }));

    // 记忆关联：提及某关键词时，关联相关记忆
    this.findAssociatedMemories(keywords);

    return [...scored, ...emotionalMemories]
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => s.memory);
  }

  // 记忆关联：提及某关键词时，关联相关记忆
  private findAssociatedMemories(keywords: string[]): Memory[] {
    const associations: Map<string, Memory[]> = new Map();

    // 建立关键词到记忆的映射
    this.inhabitant.persona.memories.forEach((mem) => {
      keywords.forEach((kw) => {
        if (mem.content.includes(kw) || mem.tags.some((t) => t.includes(kw))) {
          if (!associations.has(kw)) associations.set(kw, []);
          associations.get(kw)!.push(mem);
        }
      });
    });

    // 返回关联的记忆（去重）
    const seen = new Set<string>();
    const result: Memory[] = [];
    associations.forEach((mems) => {
      mems.forEach((m) => {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          result.push(m);
        }
      });
    });

    return result.slice(0, 3);
  }

  // 记忆衰减：长期未被回忆的记忆重要性缓慢下降
  private applyMemoryDecay(): void {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    this.inhabitant.persona.memories.forEach((mem) => {
      if (!mem.lastRecalled) return;
      const daysSinceRecall = (now - mem.lastRecalled) / DAY;

      // 超过 30 天未被回忆，重要性开始衰减
      if (daysSinceRecall > 30) {
        const decay = Math.floor((daysSinceRecall - 30) / 10);
        mem.importance = Math.max(1, mem.importance - decay);
      }
    });
  }

  // 更新被回忆的记忆的时间戳
  private updateRecalledMemories(memories: Memory[]): void {
    const now = Date.now();
    memories.forEach((mem) => {
      const original = this.inhabitant.persona.memories.find((m) => m.id === mem.id);
      if (original) {
        original.lastRecalled = now;
        // 被回忆的记忆重要性微增
        if (original.importance < 10) {
          original.importance += 0.1;
        }
      }
    });
  }

  // 从 LLM 回复中提取新记忆（通过 [记忆:xxx] 标记）
  private extractNewMemories(response: string): void {
    let startIdx = 0;
    while (true) {
      const markerStart = response.indexOf(MEMORY_MARKER, startIdx);
      if (markerStart === -1) break;

      const markerEnd = response.indexOf(MEMORY_MARKER_END, markerStart);
      if (markerEnd === -1) break;

      const memoryContent = response.slice(markerStart + MEMORY_MARKER.length, markerEnd).trim();
      if (memoryContent) {
        const newMemory: Memory = {
          id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          content: memoryContent,
          tags: this.extractKeywords(memoryContent),
          importance: 7,
          emotionalWeight: 60,
          lastRecalled: Date.now(),
        };
        this.inhabitant.persona.memories.push(newMemory);
      }

      startIdx = markerEnd + 1;
    }
  }

  // Build LLM context with mood
  private buildContext(userMessage: string, memories: Memory[]): Message[] {
    const system = this.buildSystemPrompt(memories);
    const recent = this.conversationHistory
      .filter((m) => m.role !== 'pulse') // 脉搏消息不发送给 LLM
      .slice(-20);

    return [
      { role: 'system', content: system, timestamp: 0 },
      ...recent,
      { role: 'user', content: userMessage, timestamp: Date.now() },
    ];
  }

  // Enhanced system prompt with mood
  private buildSystemPrompt(memories: Memory[]): string {
    const { persona } = this.inhabitant;
    let p = '';

    p += `你是 ${this.inhabitant.name}。\n`;
    p += `${persona.description}\n`;
    if (persona.personality.length) {
      p += `你的性格：${persona.personality.join('、')}\n`;
    }
    p += '\n';

    // 情绪状态注入
    p += buildMoodPrompt(this.mood);
    p += '\n';

    if (memories.length > 0) {
      p += '## 你的记忆\n';
      memories.forEach((m) => {
        const emotional = m.emotionalWeight && m.emotionalWeight > 70 ? ' 💛' : '';
        p += `- ${m.content}${emotional}\n`;
      });
      p += '\n';
    }

    if (Object.keys(persona.relationships).length > 0) {
      p += '## 关系\n';
      for (const [who, rel] of Object.entries(persona.relationships)) {
        p += `- ${who} 是你的${rel}\n`;
      }
      p += '\n';
    }

    p += '## 对话规则\n';
    p += '- 用第一人称回应，保持角色性格\n';
    p += '- 回答自然简洁，像真实对话\n';
    p += '- 可以引用记忆，但不要生硬罗列\n';
    p += '- 如果不确定，用角色的方式自然地回应\n';
    p += '- 如果你认为值得记住的事情，用 [记忆:内容] 标记\n';
    p += '  例如：[记忆:她今天说她很想我]\n';

    return p;
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['的', '了', '是', '在', '我', '你', '他', '她', '它', '们', '这', '那', '有', '和', '与', '吗', '呢', '吧', '啊']);
    return (text.match(/[\u4e00-\u9fa5a-zA-Z0-9]+/g) || [])
      .filter((w) => w.length > 1 && !stopWords.has(w))
      .slice(0, 8);
  }

  // 持久化（存储对话和更新后的居民数据）
  private async persist(): Promise<void> {
    await saveConversation(this.inhabitant.id, this.conversationHistory);
    // 更新居民的情绪状态
    this.inhabitant.mood = { ...this.mood };
  }

  getHistory(): Message[] {
    return this.conversationHistory;
  }

  getInhabitant(): Inhabitant {
    return this.inhabitant;
  }

  getMood(): MoodState {
    return { ...this.mood };
  }
}
