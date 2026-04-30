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
  | 'candle';

export interface Block {
  position: Position;
  type: BlockType;
  metadata?: {
    color?: string;
    interactive?: boolean;
    linkedInhabitant?: string;
  };
}

export interface Memory {
  id: string;
  content: string;
  timestamp?: number;
  tags: string[];
  importance: number; // 1-10
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
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
}

export interface MapData {
  id: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  name: string;
  dimensions: { width: number; height: number; depth: number };
  blocks: Block[];
  inhabitants: Inhabitant[];
  neighbors: string[];
  isPublic: boolean;
}

export interface LLMConfig {
  provider: 'ollama' | 'openai' | 'anthropic';
  model?: string;
  apiKey?: string;
  baseUrl?: string;
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
};
