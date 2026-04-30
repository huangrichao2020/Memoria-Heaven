# 04 - LLM 集成层

## 模块概述

提供统一的 LLM 接口，支持多种大模型（本地模型、OpenAI、Anthropic、国内厂商），让用户可以用自己的 LLM 与逝者对话。所有对话处理都在用户浏览器中完成，保护隐私。

## 内容

### 1. 统一的 LLM 接口

```typescript
// 抽象接口
interface LLMProvider {
  name: string;
  type: 'local' | 'api';
  
  // 初始化（如连接本地服务）
  initialize(config: LLMConfig): Promise<void>;
  
  // 生成对话
  chat(messages: Message[], options?: ChatOptions): Promise<string>;
  
  // 流式生成
  chatStream(messages: Message[], options?: ChatOptions): AsyncGenerator<string>;
  
  // 健康检查
  healthCheck(): Promise<boolean>;
}

interface LLMConfig {
  // 通用配置
  model?: string;
  temperature?: number;
  maxTokens?: number;
  
  // API 配置
  apiKey?: string;
  baseUrl?: string;
  
  // 本地模型配置
  localEndpoint?: string;  // 如 http://localhost:11434
}

interface ChatOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
```

### 2. 本地模型支持 (Ollama)

```typescript
class OllamaProvider implements LLMProvider {
  name = 'Ollama';
  type: 'local' = 'local';
  
  private endpoint: string = 'http://localhost:11434';
  private model: string = 'llama2';
  
  async initialize(config: LLMConfig): Promise<void> {
    this.endpoint = config.localEndpoint || this.endpoint;
    this.model = config.model || this.model;
    
    // 检查 Ollama 是否运行
    const isHealthy = await this.healthCheck();
    if (!isHealthy) {
      throw new Error('Ollama is not running. Please start Ollama first.');
    }
    
    // 检查模型是否已下载
    const models = await this.listModels();
    if (!models.includes(this.model)) {
      throw new Error(`Model ${this.model} not found. Please run: ollama pull ${this.model}`);
    }
  }
  
  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        stream: false,
        options: {
          temperature: options?.temperature || 0.7,
          num_predict: options?.maxTokens || 500
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.message.content;
  }
  
  async *chatStream(messages: Message[], options?: ChatOptions): AsyncGenerator<string> {
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        options: {
          temperature: options?.temperature || 0.7
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama stream failed: ${response.statusText}`);
    }
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.message?.content) {
            yield json.message.content;
          }
        } catch {}
      }
    }
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  private async listModels(): Promise<string[]> {
    const response = await fetch(`${this.endpoint}/api/tags`);
    const data = await response.json();
    return data.models.map((m: any) => m.name);
  }
}
```

### 3. OpenAI 支持

```typescript
class OpenAIProvider implements LLMProvider {
  name = 'OpenAI';
  type: 'api' = 'api';
  
  private apiKey: string = '';
  private model: string = 'gpt-4';
  private baseUrl: string = 'https://api.openai.com/v1';
  
  async initialize(config: LLMConfig): Promise<void> {
    this.apiKey = config.apiKey || '';
    this.model = config.model || this.model;
    this.baseUrl = config.baseUrl || this.baseUrl;
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    const isHealthy = await this.healthCheck();
    if (!isHealthy) {
      throw new Error('Failed to connect to OpenAI API');
    }
  }
  
  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 500,
        stop: options?.stopSequences
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  async *chatStream(messages: Message[], options?: ChatOptions): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options?.temperature || 0.7,
        stream: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI stream failed: ${response.statusText}`);
    }
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
      
      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const json = JSON.parse(data);
          const content = json.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {}
      }
    }
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 4. Anthropic Claude 支持

```typescript
class AnthropicProvider implements LLMProvider {
  name = 'Anthropic';
  type: 'api' = 'api';
  
  private apiKey: string = '';
  private model: string = 'claude-3-5-sonnet-20241022';
  private baseUrl: string = 'https://api.anthropic.com/v1';
  
  async initialize(config: LLMConfig): Promise<void> {
    this.apiKey = config.apiKey || '';
    this.model = config.model || this.model;
    
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }
  }
  
  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    // 提取 system prompt
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');
    
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens || 1024,
        system: systemMessage?.content || options?.systemPrompt,
        messages: chatMessages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        })),
        temperature: options?.temperature || 0.7
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
  }
  
  async *chatStream(messages: Message[], options?: ChatOptions): AsyncGenerator<string> {
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');
    
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens || 1024,
        system: systemMessage?.content || options?.systemPrompt,
        messages: chatMessages,
        stream: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`Anthropic stream failed: ${response.statusText}`);
    }
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
      
      for (const line of lines) {
        const data = line.slice(6);
        try {
          const json = JSON.parse(data);
          if (json.type === 'content_block_delta') {
            yield json.delta.text;
          }
        } catch {}
      }
    }
  }
  
  async healthCheck(): Promise<boolean> {
    // Anthropic 没有专门的健康检查端点，尝试一个简单请求
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }]
        }),
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 5. LLM 管理器

```typescript
class LLMManager {
  private providers: Map<string, LLMProvider> = new Map();
  private currentProvider: LLMProvider | null = null;
  
  constructor() {
    // 注册所有支持的 provider
    this.registerProvider(new OllamaProvider());
    this.registerProvider(new OpenAIProvider());
    this.registerProvider(new AnthropicProvider());
    // 可以继续添加其他 provider
  }
  
  registerProvider(provider: LLMProvider) {
    this.providers.set(provider.name, provider);
  }
  
  async selectProvider(name: string, config: LLMConfig): Promise<void> {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider ${name} not found`);
    }
    
    await provider.initialize(config);
    this.currentProvider = provider;
    
    // 保存配置到 localStorage
    localStorage.setItem('llm-provider', name);
    localStorage.setItem('llm-config', JSON.stringify(config));
  }
  
  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    if (!this.currentProvider) {
      throw new Error('No LLM provider selected');
    }
    
    return await this.currentProvider.chat(messages, options);
  }
  
  async *chatStream(messages: Message[], options?: ChatOptions): AsyncGenerator<string> {
    if (!this.currentProvider) {
      throw new Error('No LLM provider selected');
    }
    
    yield* this.currentProvider.chatStream(messages, options);
  }
  
  getCurrentProvider(): LLMProvider | null {
    return this.currentProvider;
  }
  
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
  
  // 自动检测可用的 provider
  async autoDetect(): Promise<string[]> {
    const available: string[] = [];
    
    for (const [name, provider] of this.providers) {
      try {
        const isHealthy = await provider.healthCheck();
        if (isHealthy) {
          available.push(name);
        }
      } catch {}
    }
    
    return available;
  }
}
```

### 6. 对话系统集成

```typescript
class ConversationManager {
  private llm: LLMManager;
  private storage: LocalMapStorage;
  
  constructor(llm: LLMManager, storage: LocalMapStorage) {
    this.llm = llm;
    this.storage = storage;
  }
  
  // 与逝者对话
  async chatWithInhabitant(
    inhabitant: Inhabitant,
    userMessage: string
  ): Promise<string> {
    // 1. 加载对话历史
    const history = await this.storage.getConversations(inhabitant.id);
    
    // 2. 构建 system prompt
    const systemPrompt = this.buildSystemPrompt(inhabitant);
    
    // 3. 构建消息列表
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10),  // 只保留最近 10 条
      { role: 'user', content: userMessage }
    ];
    
    // 4. 调用 LLM
    const response = await this.llm.chat(messages, {
      temperature: 0.8,  // 稍高的温度让对话更自然
      maxTokens: 300
    });
    
    // 5. 保存对话历史
    await this.storage.saveConversation(inhabitant.id, [
      ...history,
      { role: 'user', content: userMessage, timestamp: Date.now() },
      { role: 'assistant', content: response, timestamp: Date.now() }
    ]);
    
    return response;
  }
  
  // 流式对话
  async *chatWithInhabitantStream(
    inhabitant: Inhabitant,
    userMessage: string
  ): AsyncGenerator<string> {
    const history = await this.storage.getConversations(inhabitant.id);
    const systemPrompt = this.buildSystemPrompt(inhabitant);
    
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10),
      { role: 'user', content: userMessage }
    ];
    
    let fullResponse = '';
    
    for await (const chunk of this.llm.chatStream(messages, { temperature: 0.8 })) {
      fullResponse += chunk;
      yield chunk;
    }
    
    // 保存完整对话
    await this.storage.saveConversation(inhabitant.id, [
      ...history,
      { role: 'user', content: userMessage, timestamp: Date.now() },
      { role: 'assistant', content: fullResponse, timestamp: Date.now() }
    ]);
  }
  
  // 构建 system prompt
  private buildSystemPrompt(inhabitant: Inhabitant): string {
    const { persona } = inhabitant;
    
    let prompt = `你是 ${inhabitant.name}。\n\n`;
    prompt += `## 人物描述\n${persona.description}\n\n`;
    
    if (persona.personality.length > 0) {
      prompt += `## 性格特征\n${persona.personality.join('、')}\n\n`;
    }
    
    if (persona.memories.length > 0) {
      prompt += `## 重要记忆\n`;
      // 按重要性排序，选择最重要的 5 条
      const topMemories = persona.memories
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 5);
      
      topMemories.forEach(mem => {
        prompt += `- ${mem.content}\n`;
      });
      prompt += '\n';
    }
    
    if (Object.keys(persona.relationships).length > 0) {
      prompt += `## 关系\n`;
      for (const [id, relation] of Object.entries(persona.relationships)) {
        prompt += `- 对方是你的${relation}\n`;
      }
      prompt += '\n';
    }
    
    prompt += `## 对话风格\n`;
    prompt += `请以第一人称回应，保持角色的性格和说话方式。`;
    prompt += `回答要简洁自然，就像真实的对话一样。`;
    prompt += `可以引用你的记忆，但不要生硬地罗列。`;
    
    return prompt;
  }
  
  // 清除对话历史
  async clearHistory(inhabitantId: string): Promise<void> {
    await this.storage.saveConversation(inhabitantId, []);
  }
}
```

### 7. 配置界面

```typescript
// UI 组件：LLM 配置
class LLMConfigUI {
  private manager: LLMManager;
  
  constructor(manager: LLMManager) {
    this.manager = manager;
  }
  
  async render(): Promise<HTMLElement> {
    const container = document.createElement('div');
    container.className = 'llm-config';
    
    // 1. Provider 选择
    const providerSelect = document.createElement('select');
    providerSelect.id = 'provider-select';
    
    const providers = this.manager.listProviders();
    providers.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      providerSelect.appendChild(option);
    });
    
    // 2. 配置表单
    const configForm = document.createElement('div');
    configForm.id = 'config-form';
    
    providerSelect.addEventListener('change', () => {
      this.renderConfigForm(providerSelect.value, configForm);
    });
    
    // 3. 测试按钮
    const testButton = document.createElement('button');
    testButton.textContent = '测试连接';
    testButton.onclick = () => this.testConnection();
    
    // 4. 自动检测按钮
    const detectButton = document.createElement('button');
    detectButton.textContent = '自动检测';
    detectButton.onclick = async () => {
      const available = await this.manager.autoDetect();
      alert(`可用的 LLM: ${available.join(', ')}`);
    };
    
    container.appendChild(providerSelect);
    container.appendChild(configForm);
    container.appendChild(testButton);
    container.appendChild(detectButton);
    
    // 初始渲染
    this.renderConfigForm(providers[0], configForm);
    
    return container;
  }
  
  private renderConfigForm(providerName: string, container: HTMLElement) {
    container.innerHTML = '';
    
    if (providerName === 'Ollama') {
      container.innerHTML = `
        <label>
          本地端点:
          <input type="text" id="local-endpoint" value="http://localhost:11434" />
        </label>
        <label>
          模型:
          <input type="text" id="model" value="llama2" />
        </label>
      `;
    } else if (providerName === 'OpenAI') {
      container.innerHTML = `
        <label>
          API Key:
          <input type="password" id="api-key" placeholder="sk-..." />
        </label>
        <label>
          模型:
          <select id="model">
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          </select>
        </label>
      `;
    } else if (providerName === 'Anthropic') {
      container.innerHTML = `
        <label>
          API Key:
          <input type="password" id="api-key" placeholder="sk-ant-..." />
        </label>
        <label>
          模型:
          <select id="model">
            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
            <option value="claude-3-opus-20240229">Claude 3 Opus</option>
          </select>
        </label>
      `;
    }
  }
  
  private async testConnection() {
    const provider = (document.getElementById('provider-select') as HTMLSelectElement).value;
    const config = this.getConfigFromForm();
    
    try {
      await this.manager.selectProvider(provider, config);
      alert('连接成功！');
    } catch (error) {
      alert(`连接失败: ${error.message}`);
    }
  }
  
  private getConfigFromForm(): LLMConfig {
    const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
    const modelInput = document.getElementById('model') as HTMLInputElement | HTMLSelectElement;
    const endpointInput = document.getElementById('local-endpoint') as HTMLInputElement;
    
    return {
      apiKey: apiKeyInput?.value,
      model: modelInput?.value,
      localEndpoint: endpointInput?.value
    };
  }
}
```

## 效果

1. **隐私保护**：所有对话在本地处理，不经过任何服务器
2. **灵活性**：支持多种 LLM，用户可以自由选择
3. **成本控制**：可以使用免费的本地模型
4. **离线可用**：使用本地模型时完全离线

## 设计理由

### 为什么支持多种 LLM？

1. **成本**：本地模型免费，API 模型按使用付费
2. **隐私**：有些用户不想把对话发送到云端
3. **质量**：不同模型有不同的特点，用户可以选择最适合的

### 为什么用统一接口？

1. **可扩展**：添加新 provider 只需实现接口
2. **可测试**：可以 mock provider 进行测试
3. **用户体验**：切换 provider 不影响其他功能

### 为什么限制对话历史长度？

1. **成本**：API 按 token 计费，历史越长越贵
2. **性能**：本地模型处理长上下文慢
3. **相关性**：太久远的对话对当前对话帮助不大

## 上游链路

- **用户配置**：通过 UI 选择和配置 LLM
- **对话界面**：用户输入消息

## 下游链路

- **本地存储**：保存对话历史到 IndexedDB
- **UI 渲染**：显示 LLM 的回复

## 性能优化

```typescript
// 1. 缓存常见回复
class ResponseCache {
  private cache: Map<string, string> = new Map();
  
  get(key: string): string | undefined {
    return this.cache.get(key);
  }
  
  set(key: string, value: string) {
    // 最多缓存 100 条
    if (this.cache.size >= 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  
  // 生成缓存 key
  generateKey(inhabitantId: string, userMessage: string): string {
    return `${inhabitantId}:${userMessage.toLowerCase().trim()}`;
  }
}

// 2. 预加载模型
async function preloadModel(provider: LLMProvider) {
  // 发送一个简单请求，让模型加载到内存
  await provider.chat([
    { role: 'user', content: 'hi' }
  ], { maxTokens: 1 });
}

// 3. 批量处理
async function batchChat(
  conversations: Array<{ inhabitant: Inhabitant; message: string }>,
  llm: LLMManager
): Promise<string[]> {
  // 并发处理多个对话（如果 LLM 支持）
  return await Promise.all(
    conversations.map(conv =>
      llm.chat([
        { role: 'system', content: buildSystemPrompt(conv.inhabitant) },
        { role: 'user', content: conv.message }
      ])
    )
  );
}
```

## 错误处理

```typescript
class LLMErrorHandler {
  static async handleError(error: Error, provider: LLMProvider): Promise<string> {
    // 1. 网络错误
    if (error.message.includes('fetch')) {
      return '网络连接失败，请检查网络设置';
    }
    
    // 2. API 错误
    if (error.message.includes('API')) {
      if (error.message.includes('401') || error.message.includes('403')) {
        return 'API 密钥无效，请检查配置';
      }
      if (error.message.includes('429')) {
        return 'API 请求过于频繁，请稍后再试';
      }
      if (error.message.includes('quota')) {
        return 'API 配额已用完，请充值或更换 provider';
      }
    }
    
    // 3. 本地模型错误
    if (provider.type === 'local') {
      if (error.message.includes('not running')) {
        return '本地模型未运行，请启动 Ollama';
      }
      if (error.message.includes('not found')) {
        return '模型未找到，请先下载模型';
      }
    }
    
    // 4. 通用错误
    return `对话失败: ${error.message}`;
  }
}
```

## 未来扩展

```typescript
// 1. 支持更多 provider
class QwenProvider implements LLMProvider { /* 通义千问 */ }
class GLMProvider implements LLMProvider { /* 智谱 GLM */ }
class BaiduProvider implements LLMProvider { /* 文心一言 */ }

// 2. 多模态支持
interface MultimodalMessage extends Message {
  images?: string[];  // 图片 URL
  audio?: string;     // 音频 URL
}

// 3. 函数调用
interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
}

interface LLMProviderWithFunctions extends LLMProvider {
  chatWithFunctions(
    messages: Message[],
    functions: FunctionDefinition[]
  ): Promise<string | FunctionCall>;
}
```
