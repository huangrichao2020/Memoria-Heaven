# 05 - 数字生命 Agent 架构

## 模块概述

借鉴 GenericAgent 的轻量化设计理念，将每个数字生命（逝者）设计为一个极简的、可自我进化的 Agent。核心思想：**不预设复杂人格，靠对话积累记忆**。

## 内容

### 1. 核心设计理念

```
GenericAgent 的启发：
- 极简核心（~3K 行）
- 分层记忆系统（L0-L4）
- 自我进化（Skills 自动沉淀）
- 最小工具集（9 个原子工具）

Memoria Heaven 的数字生命：
- 极简人格核心（~500 行）
- 分层记忆系统（适配逝者特点）
- 对话进化（记忆自动积累）
- 最小交互集（3 个原子能力）
```

### 2. 数字生命的分层记忆

```typescript
// 借鉴 GenericAgent 的 L0-L4 记忆层
interface DigitalLifeMemory {
  // L0 - 元规则（不可变）
  meta: {
    id: string;                    // 12 位数字 ID
    name: string;                  // 姓名
    type: 'human' | 'pet';         // 类型
    createdAt: number;             // 创建时间
    owner: string;                 // 所有者钱包地址
  };
  
  // L1 - 核心人格（初始化时设定，可微调）
  persona: {
    description: string;           // 基础描述
    personality: string[];         // 性格特征
    era: string;                   // 生活年代
    background: string;            // 背景故事
  };
  
  // L2 - 长期记忆（重要事件，手动添加）
  longTermMemories: Memory[];
  
  // L3 - 对话模式（自动沉淀）
  conversationPatterns: {
    greetings: string[];           // 打招呼的方式
    farewells: string[];           // 告别的方式
    commonTopics: string[];        // 常聊的话题
    emotionalTriggers: {           // 情感触发词
      [keyword: string]: 'happy' | 'sad' | 'nostalgic';
    };
  };
  
  // L4 - 会话归档（自动压缩）
  sessionArchives: SessionArchive[];
}

interface Memory {
  id: string;
  content: string;
  timestamp?: number;
  tags: string[];
  importance: number;              // 1-10
  relatedPeople: string[];         // 相关人物
  emotionalTone: 'positive' | 'negative' | 'neutral';
}

interface SessionArchive {
  id: string;
  startTime: number;
  endTime: number;
  summary: string;                 // LLM 生成的摘要
  keyTopics: string[];             // 关键话题
  emotionalHighlights: string[];   // 情感高光时刻
  newInsights: string[];           // 新发现的信息
}
```

### 3. 极简 Agent 循环

```typescript
// 借鉴 GenericAgent 的 ~100 行 Agent Loop
class DigitalLifeAgent {
  private memory: DigitalLifeMemory;
  private llm: LLMProvider;
  private storage: LocalMapStorage;
  
  constructor(inhabitant: Inhabitant, llm: LLMProvider, storage: LocalMapStorage) {
    this.memory = this.loadMemory(inhabitant);
    this.llm = llm;
    this.storage = storage;
  }
  
  // 核心对话循环（~50 行）
  async chat(userMessage: string): Promise<string> {
    // 1. 召回相关记忆
    const relevantMemories = await this.recallMemories(userMessage);
    
    // 2. 构建上下文
    const context = this.buildContext(userMessage, relevantMemories);
    
    // 3. 调用 LLM
    const response = await this.llm.chat(context);
    
    // 4. 更新记忆（自动沉淀）
    await this.updateMemory(userMessage, response);
    
    // 5. 检查是否需要归档
    if (this.shouldArchive()) {
      await this.archiveSession();
    }
    
    return response;
  }
  
  // 记忆召回（类似 GenericAgent 的 L1 索引）
  private async recallMemories(query: string): Promise<Memory[]> {
    const allMemories = this.memory.longTermMemories;
    
    // 简单的关键词匹配（可升级为向量检索）
    const keywords = this.extractKeywords(query);
    const scored = allMemories.map(mem => ({
      memory: mem,
      score: this.calculateRelevance(mem, keywords)
    }));
    
    // 按重要性和相关性排序
    scored.sort((a, b) => 
      (b.score * b.memory.importance) - (a.score * a.memory.importance)
    );
    
    // 返回最相关的 5 条
    return scored.slice(0, 5).map(s => s.memory);
  }
  
  // 构建上下文
  private buildContext(userMessage: string, memories: Memory[]): Message[] {
    const systemPrompt = this.buildSystemPrompt(memories);
    
    // 加载最近 10 条对话
    const recentHistory = this.getRecentHistory(10);
    
    return [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: userMessage }
    ];
  }
  
  // 构建 system prompt
  private buildSystemPrompt(memories: Memory[]): string {
    let prompt = `你是 ${this.memory.meta.name}。\n\n`;
    
    // L1 - 核心人格
    prompt += `## 基本信息\n`;
    prompt += `${this.memory.persona.description}\n`;
    prompt += `性格：${this.memory.persona.personality.join('、')}\n`;
    prompt += `年代：${this.memory.persona.era}\n\n`;
    
    // L2 - 相关记忆
    if (memories.length > 0) {
      prompt += `## 相关记忆\n`;
      memories.forEach(mem => {
        prompt += `- ${mem.content}\n`;
      });
      prompt += '\n';
    }
    
    // L3 - 对话模式
    const patterns = this.memory.conversationPatterns;
    if (patterns.commonTopics.length > 0) {
      prompt += `## 你常聊的话题\n`;
      prompt += patterns.commonTopics.join('、') + '\n\n';
    }
    
    prompt += `## 对话风格\n`;
    prompt += `用第一人称回应，保持你的性格和说话方式。`;
    prompt += `回答要自然简洁，像真实对话一样。`;
    prompt += `可以引用记忆，但不要生硬罗列。\n`;
    
    return prompt;
  }
  
  // 自动更新记忆（自我进化）
  private async updateMemory(userMessage: string, response: string) {
    // 1. 保存对话历史
    await this.storage.saveConversation(this.memory.meta.id, [
      { role: 'user', content: userMessage, timestamp: Date.now() },
      { role: 'assistant', content: response, timestamp: Date.now() }
    ]);
    
    // 2. 提取新信息（如果有）
    const newInfo = await this.extractNewInformation(userMessage, response);
    if (newInfo) {
      this.memory.longTermMemories.push(newInfo);
      await this.saveMemory();
    }
    
    // 3. 更新对话模式
    this.updateConversationPatterns(userMessage, response);
  }
  
  // 提取新信息（类似 GenericAgent 的 Skill 沉淀）
  private async extractNewInformation(
    userMessage: string, 
    response: string
  ): Promise<Memory | null> {
    // 检测是否包含新的重要信息
    const triggers = [
      '记得', '想起', '那时候', '以前', '曾经',
      '喜欢', '讨厌', '最爱', '难忘'
    ];
    
    const hasNewInfo = triggers.some(t => 
      userMessage.includes(t) || response.includes(t)
    );
    
    if (!hasNewInfo) return null;
    
    // 用 LLM 提取结构化信息
    const extraction = await this.llm.chat([
      {
        role: 'system',
        content: `从对话中提取重要信息，以第一人称总结。
        如果没有重要信息，返回 "无"。
        格式：一句话概括，不超过 50 字。`
      },
      {
        role: 'user',
        content: `用户说：${userMessage}\n我回答：${response}`
      }
    ]);
    
    if (extraction === '无' || extraction.length < 5) return null;
    
    return {
      id: `mem-${Date.now()}`,
      content: extraction,
      timestamp: Date.now(),
      tags: this.extractKeywords(extraction),
      importance: 5,  // 默认中等重要性
      relatedPeople: [],
      emotionalTone: 'neutral'
    };
  }
  
  // 更新对话模式
  private updateConversationPatterns(userMessage: string, response: string) {
    // 检测打招呼
    if (/^(你好|嗨|hi|hello)/i.test(userMessage)) {
      if (!this.memory.conversationPatterns.greetings.includes(response)) {
        this.memory.conversationPatterns.greetings.push(response);
      }
    }
    
    // 检测告别
    if (/^(再见|拜拜|bye)/i.test(userMessage)) {
      if (!this.memory.conversationPatterns.farewells.includes(response)) {
        this.memory.conversationPatterns.farewells.push(response);
      }
    }
    
    // 提取话题
    const topics = this.extractKeywords(userMessage);
    topics.forEach(topic => {
      if (!this.memory.conversationPatterns.commonTopics.includes(topic)) {
        this.memory.conversationPatterns.commonTopics.push(topic);
      }
    });
  }
  
  // 会话归档（类似 GenericAgent 的 L4）
  private async archiveSession() {
    const history = await this.storage.getConversations(this.memory.meta.id);
    
    if (history.length < 10) return;  // 至少 10 条对话才归档
    
    // 用 LLM 生成摘要
    const summary = await this.llm.chat([
      {
        role: 'system',
        content: `总结这段对话的要点：
        1. 主要话题（3-5 个关键词）
        2. 情感高光时刻（1-2 句）
        3. 新发现的信息（如果有）
        
        格式：简洁的 JSON`
      },
      {
        role: 'user',
        content: JSON.stringify(history)
      }
    ]);
    
    const archive: SessionArchive = {
      id: `archive-${Date.now()}`,
      startTime: history[0].timestamp,
      endTime: history[history.length - 1].timestamp,
      summary: summary,
      keyTopics: [],
      emotionalHighlights: [],
      newInsights: []
    };
    
    this.memory.sessionArchives.push(archive);
    await this.saveMemory();
    
    // 清理旧对话（保留最近 20 条）
    await this.storage.saveConversation(
      this.memory.meta.id,
      history.slice(-20)
    );
  }
  
  // 辅助方法
  private extractKeywords(text: string): string[] {
    // 简单的关键词提取（可升级为 NLP）
    const stopWords = ['的', '了', '是', '在', '我', '你', '他', '她', '它'];
    const words = text.match(/[\u4e00-\u9fa5]+/g) || [];
    return words
      .filter(w => w.length > 1 && !stopWords.includes(w))
      .slice(0, 5);
  }
  
  private calculateRelevance(memory: Memory, keywords: string[]): number {
    let score = 0;
    keywords.forEach(kw => {
      if (memory.content.includes(kw)) score += 1;
      if (memory.tags.includes(kw)) score += 2;
    });
    return score;
  }
  
  private shouldArchive(): boolean {
    // 每 50 条对话归档一次
    return this.getRecentHistory(100).length >= 50;
  }
  
  private getRecentHistory(limit: number): Message[] {
    // 从 storage 读取
    return [];  // 实现略
  }
  
  private async saveMemory() {
    // 保存到 IndexedDB
    await this.storage.saveMap({
      id: this.memory.meta.id,
      // ... 其他字段
      inhabitants: [{
        id: this.memory.meta.id,
        persona: {
          memories: this.memory.longTermMemories,
          // ...
        }
      }]
    } as any);
  }
  
  private loadMemory(inhabitant: Inhabitant): DigitalLifeMemory {
    return {
      meta: {
        id: inhabitant.id,
        name: inhabitant.name,
        type: inhabitant.type,
        createdAt: Date.now(),
        owner: ''
      },
      persona: {
        description: inhabitant.persona.description,
        personality: inhabitant.persona.personality,
        era: '',
        background: ''
      },
      longTermMemories: inhabitant.persona.memories,
      conversationPatterns: {
        greetings: [],
        farewells: [],
        commonTopics: [],
        emotionalTriggers: {}
      },
      sessionArchives: []
    };
  }
}
```

### 4. 最小交互集（3 个原子能力）

```typescript
// 借鉴 GenericAgent 的 9 个原子工具，数字生命只需 3 个

interface DigitalLifeTools {
  // 1. 对话（核心能力）
  chat(message: string): Promise<string>;
  
  // 2. 回忆（主动召回记忆）
  recall(query: string): Promise<Memory[]>;
  
  // 3. 学习（手动添加记忆）
  learn(memory: Memory): Promise<void>;
}

// 实现
class DigitalLifeToolkit implements DigitalLifeTools {
  constructor(private agent: DigitalLifeAgent) {}
  
  async chat(message: string): Promise<string> {
    return await this.agent.chat(message);
  }
  
  async recall(query: string): Promise<Memory[]> {
    return await this.agent['recallMemories'](query);
  }
  
  async learn(memory: Memory): Promise<void> {
    this.agent['memory'].longTermMemories.push(memory);
    await this.agent['saveMemory']();
  }
}
```

### 5. 数字生命的初始化

```typescript
// 用户创建数字生命时的引导流程
class DigitalLifeCreator {
  private llm: LLMProvider;
  
  constructor(llm: LLMProvider) {
    this.llm = llm;
  }
  
  // 通过对话式引导创建数字生命
  async create(): Promise<Inhabitant> {
    console.log('欢迎来到Memoria Heaven。让我们一起创建一个数字生命。\n');
    
    // 1. 基本信息
    const name = await this.ask('他/她叫什么名字？');
    const type = await this.ask('是人还是宠物？(human/pet)', ['human', 'pet']);
    
    // 2. 用 LLM 辅助生成人格
    const description = await this.ask(
      '请简单描述一下 TA（外貌、性格、爱好等）：'
    );
    
    // 3. LLM 提取结构化信息
    const personaJson = await this.llm.chat([
      {
        role: 'system',
        content: `根据用户描述，提取结构化信息：
        {
          "personality": ["性格1", "性格2", "性格3"],
          "era": "生活年代",
          "background": "背景故事（1-2 句）"
        }`
      },
      {
        role: 'user',
        content: description
      }
    ]);
    
    const persona = JSON.parse(personaJson);
    
    // 4. 添加初始记忆
    console.log('\n现在，让我们添加一些重要的记忆。');
    const memories: Memory[] = [];
    
    for (let i = 0; i < 3; i++) {
      const memContent = await this.ask(`记忆 ${i + 1}（留空跳过）：`);
      if (!memContent) break;
      
      memories.push({
        id: `mem-${Date.now()}-${i}`,
        content: memContent,
        tags: [],
        importance: 8,
        relatedPeople: [],
        emotionalTone: 'neutral'
      });
    }
    
    // 5. 生成数字生命
    const inhabitant: Inhabitant = {
      id: `temp-${Date.now()}`,  // 临时 ID，注册到链上后替换
      name,
      type: type as 'human' | 'pet',
      persona: {
        description,
        personality: persona.personality,
        memories,
        relationships: {}
      },
      homePosition: { x: 16, y: 1, z: 16 }
    };
    
    console.log('\n✅ 数字生命创建成功！');
    console.log(`名字：${name}`);
    console.log(`性格：${persona.personality.join('、')}`);
    console.log(`记忆数：${memories.length}`);
    
    return inhabitant;
  }
  
  private async ask(question: string, options?: string[]): Promise<string> {
    // 实现略（命令行输入或 UI 输入）
    return '';
  }
}
```

### 6. 数字生命的进化示例

```typescript
// 示例：用户与奶奶的对话，系统自动进化

// 第 1 次对话
用户: "奶奶，你还记得我小时候最爱吃什么吗？"
奶奶: "当然记得，你最爱吃我做的红烧肉。"

// 系统自动提取新记忆：
{
  content: "孙子小时候最爱吃我做的红烧肉",
  tags: ["美食", "童年", "孙子"],
  importance: 7
}

// 第 10 次对话后
用户: "奶奶，今天想吃红烧肉了。"
奶奶: "哈哈，你从小就爱吃这个。记得有一次你偷吃了一整盘，结果肚子疼了一晚上。"

// 系统自动更新对话模式：
conversationPatterns.commonTopics.push("红烧肉");
conversationPatterns.emotionalTriggers["红烧肉"] = "happy";

// 第 50 次对话后，自动归档
sessionArchive: {
  summary: "主要聊了童年回忆、美食、家庭趣事",
  keyTopics: ["红烧肉", "童年", "家庭"],
  emotionalHighlights: ["回忆起孙子偷吃红烧肉的趣事"],
  newInsights: ["孙子现在也会做菜了"]
}
```

## 效果

1. **极简核心**：数字生命 Agent 只有 ~500 行代码
2. **自我进化**：对话越多，记忆越丰富，回答越个性化
3. **低成本**：分层记忆 + 归档机制，上下文窗口始终 < 5K tokens
4. **易扩展**：可以添加更多工具（如查看照片、播放音乐）

## 设计理由

### 为什么借鉴 GenericAgent？

1. **极简哲学**：不预设复杂功能，靠使用积累能力
2. **分层记忆**：L0-L4 的设计非常适合数字生命
3. **自我进化**：GenericAgent 的 Skill 沉淀机制可以迁移到记忆沉淀

### 为什么只有 3 个工具？

1. **聚焦对话**：数字生命的核心是对话，不需要复杂操作
2. **降低复杂度**：工具越少，越容易维护和优化
3. **可扩展**：未来可以添加更多工具（如情感分析、多模态）

### 为什么需要会话归档？

1. **成本控制**：避免上下文窗口无限增长
2. **长期记忆**：归档的摘要可以作为长期记忆的一部分
3. **性能优化**：减少每次对话需要加载的数据量

## 上游链路

- **数字生命创建器**：初始化数字生命的人格和记忆
- **用户对话**：通过 UI 与数字生命交互

## 下游链路

- **LLM 集成层**：调用 LLM 生成回复
- **本地存储**：保存记忆和对话历史
- **区块链**：记录数字生命的所有权

## 性能指标

```typescript
interface PerformanceMetrics {
  // 对话性能
  avgResponseTime: number;        // 目标: < 2s
  contextWindowSize: number;      // 目标: < 5K tokens
  
  // 记忆性能
  memoryRecallTime: number;       // 目标: < 100ms
  memoryCount: number;            // 当前记忆数量
  
  // 进化指标
  conversationCount: number;      // 总对话次数
  newMemoriesPerSession: number;  // 每次会话新增记忆数
  archiveCount: number;           // 归档次数
}
```

## 与 GenericAgent 的对比

| 特性 | GenericAgent | 数字生命 Agent |
|------|:---:|:---:|
| **核心代码** | ~3K 行 | ~500 行 |
| **工具数量** | 9 个原子工具 | 3 个原子能力 |
| **记忆层级** | L0-L4 | L0-L4（适配） |
| **进化机制** | Skill 沉淀 | 记忆沉淀 |
| **应用场景** | 系统级控制 | 对话交互 |
| **上下文窗口** | < 30K tokens | < 5K tokens |

## 未来扩展

```typescript
// 1. 多模态支持
interface MultimodalAgent extends DigitalLifeAgent {
  // 查看照片并回忆
  viewPhoto(photoUrl: string): Promise<string>;
  
  // 听音乐并回忆
  listenMusic(musicUrl: string): Promise<string>;
  
  // 语音对话
  voiceChat(audioUrl: string): Promise<string>;
}

// 2. 情感模型
interface EmotionalAgent extends DigitalLifeAgent {
  // 当前情绪状态
  emotionalState: 'happy' | 'sad' | 'nostalgic' | 'neutral';
  
  // 情绪会影响回复风格
  chat(message: string): Promise<string>;
}

// 3. 社交能力
interface SocialAgent extends DigitalLifeAgent {
  // 与其他数字生命交互
  meetOther(otherId: string): Promise<string>;
  
  // 参加群聊
  joinGroup(groupId: string): Promise<void>;
}
```

## 代码量估算

```
核心 Agent 循环：~100 行
记忆管理：~150 行
对话生成：~100 行
工具实现：~50 行
辅助方法：~100 行

总计：~500 行
```

这个设计保持了 GenericAgent 的极简哲学，同时针对数字生命的特点做了优化。要不要我继续写其他模块的设计？
