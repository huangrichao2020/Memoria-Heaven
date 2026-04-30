// ============================================================
// Digital Life Agent - Minimal Self-Evolving Agent
// Inspired by GenericAgent's layered memory architecture
// ============================================================
import type { Inhabitant, Memory, Message } from './types';
import type { LLMProvider } from './llm';
import { saveConversation, getConversation } from './storage';

export class DigitalLifeAgent {
  private inhabitant: Inhabitant;
  private llm: LLMProvider;
  private conversationHistory: Message[] = [];
  private loaded = false;

  constructor(inhabitant: Inhabitant, llm: LLMProvider) {
    this.inhabitant = inhabitant;
    this.llm = llm;
  }

  // Load conversation history from IndexedDB
  async load(): Promise<void> {
    if (this.loaded) return;
    this.conversationHistory = await getConversation(this.inhabitant.id);
    this.loaded = true;
  }

  // Core chat loop (~30 lines)
  async chat(userMessage: string): Promise<string> {
    await this.load();

    // 1. Recall relevant memories
    const memories = this.recallMemories(userMessage);

    // 2. Build context
    const context = this.buildContext(userMessage, memories);

    // 3. Call LLM
    const response = await this.llm.chat(context);

    // 4. Persist conversation
    const newMessages: Message[] = [
      { role: 'user', content: userMessage, timestamp: Date.now() },
      { role: 'assistant', content: response, timestamp: Date.now() },
    ];
    this.conversationHistory.push(...newMessages);
    await saveConversation(this.inhabitant.id, this.conversationHistory);

    return response;
  }

  // Streaming chat
  async *chatStream(userMessage: string): AsyncGenerator<string> {
    await this.load();
    const memories = this.recallMemories(userMessage);
    const context = this.buildContext(userMessage, memories);

    let fullResponse = '';
    for await (const chunk of this.llm.chatStream(context)) {
      fullResponse += chunk;
      yield chunk;
    }

    const newMessages: Message[] = [
      { role: 'user', content: userMessage, timestamp: Date.now() },
      { role: 'assistant', content: fullResponse, timestamp: Date.now() },
    ];
    this.conversationHistory.push(...newMessages);
    await saveConversation(this.inhabitant.id, this.conversationHistory);
  }

  // Memory recall (keyword matching)
  private recallMemories(query: string): Memory[] {
    const keywords = this.extractKeywords(query);
    const memories = this.inhabitant.persona.memories;

    const scored = memories.map((mem) => {
      let score = 0;
      keywords.forEach((kw) => {
        if (mem.content.includes(kw)) score += 2;
        if (mem.tags.some((t) => t.includes(kw))) score += 3;
      });
      return { memory: mem, score: score * mem.importance };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => s.memory);
  }

  // Build LLM context
  private buildContext(userMessage: string, memories: Memory[]): Message[] {
    const system = this.buildSystemPrompt(memories);
    const recent = this.conversationHistory.slice(-20);

    return [
      { role: 'system', content: system, timestamp: 0 },
      ...recent,
      { role: 'user', content: userMessage, timestamp: Date.now() },
    ];
  }

  // Build system prompt from persona + memories
  private buildSystemPrompt(memories: Memory[]): string {
    const { persona } = this.inhabitant;
    let p = '';

    p += `你是 ${this.inhabitant.name}。\n`;
    p += `${persona.description}\n`;
    if (persona.personality.length) {
      p += `你的性格：${persona.personality.join('、')}\n`;
    }
    p += '\n';

    if (memories.length > 0) {
      p += '## 你的记忆\n';
      memories.forEach((m) => { p += `- ${m.content}\n`; });
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

    return p;
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['的', '了', '是', '在', '我', '你', '他', '她', '它', '们', '这', '那', '有', '和', '与', '吗', '呢', '吧', '啊']);
    return (text.match(/[\u4e00-\u9fa5a-zA-Z0-9]+/g) || [])
      .filter((w) => w.length > 1 && !stopWords.has(w))
      .slice(0, 8);
  }

  getHistory(): Message[] {
    return this.conversationHistory;
  }

  getInhabitant(): Inhabitant {
    return this.inhabitant;
  }
}
