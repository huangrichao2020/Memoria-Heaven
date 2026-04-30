// ============================================================
// LLM Provider - 支持 Ollama、Groq、OpenAI 兼容 API
// ============================================================
import type { LLMConfig, Message } from './types';

export interface LLMProvider {
  chat(messages: Message[]): Promise<string>;
  chatStream(messages: Message[]): AsyncGenerator<string>;
  healthCheck(): Promise<boolean>;
}

// --- Ollama Provider ---
class OllamaProvider implements LLMProvider {
  private endpoint: string;
  private model: string;

  constructor(config: LLMConfig) {
    this.endpoint = config.baseUrl || 'http://localhost:11434';
    this.model = config.model || 'qwen2.5:7b';
  }

  async chat(messages: Message[]): Promise<string> {
    const res = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
        options: { temperature: 0.8, num_predict: 500 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
    const data = await res.json();
    return data.message?.content ?? '';
  }

  async *chatStream(messages: Message[]): AsyncGenerator<string> {
    const res = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        options: { temperature: 0.8 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama stream error: ${res.statusText}`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n').filter(Boolean)) {
        try {
          const json = JSON.parse(line);
          if (json.message?.content) yield json.message.content;
        } catch { /* skip malformed lines */ }
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// --- Groq Provider (通过 Worker 代理或直连) ---
class GroqProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'llama-3.1-8b-instant';
    // 如果配置了 Worker URL，走代理；否则直连 Groq
    this.baseUrl = config.baseUrl || 'https://api.groq.com/openai/v1';
  }

  async chat(messages: Message[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.8,
        max_tokens: 1024,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Groq error: ${res.statusText}`);
    }
    const data = await res.json();
    return data.choices[0]?.message?.content ?? '';
  }

  async *chatStream(messages: Message[]): AsyncGenerator<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.8,
        max_tokens: 1024,
        stream: true,
      }),
    });
    if (!res.ok) throw new Error(`Groq stream error: ${res.statusText}`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n').filter((l) => l.startsWith('data: '))) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const content = json.choices[0]?.delta?.content;
          if (content) yield content;
        } catch { /* skip */ }
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    // Groq 没有简单的 health 端点，尝试列出模型
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// --- OpenAI-Compatible Provider ---
class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-4o-mini';
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async chat(messages: Message[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.8,
        max_tokens: 500,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error: ${res.statusText}`);
    }
    const data = await res.json();
    return data.choices[0]?.message?.content ?? '';
  }

  async *chatStream(messages: Message[]): AsyncGenerator<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.8,
        stream: true,
      }),
    });
    if (!res.ok) throw new Error(`API stream error: ${res.statusText}`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n').filter((l) => l.startsWith('data: '))) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const content = json.choices[0]?.delta?.content;
          if (content) yield content;
        } catch { /* skip */ }
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// --- Factory ---
export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'ollama':
      return new OllamaProvider(config);
    case 'groq':
      return new GroqProvider(config);
    case 'openai':
    case 'anthropic':
      return new OpenAIProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
