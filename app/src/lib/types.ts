// ============================================================
// Memoria Heaven - Core Data Types
// ============================================================

export interface Position {
  x: number;
  y: number;
  z: number;
}

export type BlockType =
  | 'air'
  | 'grass'
  | 'stone'
  | 'wood'
  | 'flower'
  | 'water'
  | 'memorial_stone'
  | 'portal'
  | 'sand'
  | 'leaves'
  | 'candle'
  // 新增纪念主题方块
  | 'bench'
  | 'fountain'
  | 'arch'
  | 'lantern'
  | 'butterfly'
  | 'book'
  | 'crystal'
  | 'moss';

export interface Block {
  position: Position;
  type: BlockType;
  metadata?: {
    color?: string;
    interactive?: boolean;
    linkedInhabitant?: string;
    // 互动系统扩展
    wish?: string;
    memoryTag?: string;
    message?: string;
  };
}

export interface Memory {
  id: string;
  content: string;
  timestamp?: number;
  tags: string[];
  importance: number; // 1-10
  // 情感记忆层
  emotionalWeight?: number; // 0-100
  lastRecalled?: number; // 上次被回忆的时间戳
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'pulse';
  content: string;
  timestamp: number;
}

// 情绪状态
export type MoodPrimary =
  | 'joyful'
  | 'content'
  | 'neutral'
  | 'melancholic'
  | 'anxious'
  | 'excited'
  | 'calm'
  | 'curious';

export interface MoodState {
  primary: MoodPrimary;
  energy: number;   // 0-100，社交电量
  warmth: number;   // 0-100，对用户的情感温度
  lastInteraction: number; // 上次互动时间
}

export interface Inhabitant {
  id: string;
  name: string;
  type: 'human' | 'pet';
  persona: {
    description: string;
    personality: string[];
    memories: Memory[];
    relationships: Record<string, string>;
  };
  homePosition: Position;
  mood?: MoodState;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface MapMessage {
  id: string;
  type: 'wish' | 'lantern' | 'memory_tag' | 'time_capsule';
  content: string;
  author?: string;
  position?: Position;
  createdAt: number;
  unlockAt?: number; // 时间胶囊解锁时间
}

export interface MapData {
  id: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  name: string;
  templateId?: string;
  season?: Season;
  dimensions: { width: number; height: number; depth: number };
  blocks: Block[];
  inhabitants: Inhabitant[];
  neighbors: string[];
  isPublic: boolean;
  messages: MapMessage[];
}

export interface LLMConfig {
  provider: 'ollama' | 'openai' | 'anthropic';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

// 模板注册
export interface MapTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  create: (name: string) => MapData;
}

// Block color mapping for rendering
export const BLOCK_COLORS: Record<BlockType, string> = {
  air: 'transparent',
  grass: '#4ade80',
  stone: '#9ca3af',
  wood: '#a16207',
  flower: '#f472b6',
  water: '#38bdf8',
  memorial_stone: '#475569',
  portal: '#c084fc',
  sand: '#fbbf24',
  leaves: '#22c55e',
  candle: '#fde68a',
  // 新增方块颜色
  bench: '#8B6914',
  fountain: '#7dd3fc',
  arch: '#d4d4d8',
  lantern: '#fb923c',
  butterfly: '#e879f9',
  book: '#fbbf24',
  crystal: '#a78bfa',
  moss: '#86efac',
};

// 季节配色
export const SEASON_COLORS: Record<Season, { sky: string; fog: string; leaves: string; ambient: number }> = {
  spring: { sky: '#87ceeb', fog: '#e8f5e9', leaves: '#22c55e', ambient: 0.5 },
  summer: { sky: '#4da6ff', fog: '#c8d6e5', leaves: '#16a34a', ambient: 0.6 },
  autumn: { sky: '#d4a574', fog: '#f5e6d3', leaves: '#d97706', ambient: 0.4 },
  winter: { sky: '#b0c4de', fog: '#e2e8f0', leaves: '#94a3b8', ambient: 0.3 },
};
