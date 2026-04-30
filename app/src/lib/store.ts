// ============================================================
// Zustand Store - Global State Management
// ============================================================
import { create } from 'zustand';
import type { MapData, LLMConfig, Inhabitant, BlockType } from './types';
import type { LLMProvider } from './llm';
import { createLLMProvider } from './llm';
import { DigitalLifeAgent } from './agent';
import { getAllMaps, saveMap, getLLMConfig, saveLLMConfig } from './storage';
import { createGardenTemplate } from '../templates/garden';

interface AppState {
  // Maps
  maps: MapData[];
  currentMap: MapData | null;
  isLoading: boolean;

  // LLM
  llmConfig: LLMConfig | null;
  llmProvider: LLMProvider | null;

  // Agent
  agents: Map<string, DigitalLifeAgent>;
  activeAgent: DigitalLifeAgent | null;

  // Editor
  editorMode: 'view' | 'edit';
  selectedBlock: BlockType;

  // Chat
  chatOpen: boolean;

  // Actions
  init: () => Promise<void>;
  createMap: (name: string, regionCode?: number) => Promise<MapData>;
  selectMap: (id: string) => Promise<void>;
  updateMap: (map: MapData) => Promise<void>;
  addBlock: (mapId: string, block: MapData['blocks'][0]) => Promise<void>;
  removeBlock: (mapId: string, pos: { x: number; y: number; z: number }) => Promise<void>;
  addInhabitant: (mapId: string, inhabitant: Inhabitant) => Promise<void>;
  setLLMConfig: (config: LLMConfig) => Promise<void>;
  setActiveAgent: (inhabitant: Inhabitant) => void;
  setEditorMode: (mode: 'view' | 'edit') => void;
  setSelectedBlock: (type: BlockType) => void;
  setChatOpen: (open: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  maps: [],
  currentMap: null,
  isLoading: true,
  llmConfig: null,
  llmProvider: null,
  agents: new Map(),
  activeAgent: null,
  editorMode: 'view',
  selectedBlock: 'grass',
  chatOpen: false,

  init: async () => {
    const [maps, config] = await Promise.all([getAllMaps(), getLLMConfig()]);
    let provider: LLMProvider | null = null;
    if (config) {
      try { provider = createLLMProvider(config); } catch { /* ignore */ }
    }
    set({ maps, llmConfig: config, llmProvider: provider, isLoading: false });
  },

  createMap: async (name) => {
    const map = createGardenTemplate(name);
    await saveMap(map);
    set((s) => ({ maps: [map, ...s.maps], currentMap: map }));
    return map;
  },

  selectMap: async (id) => {
    const { maps } = get();
    const map = maps.find((m) => m.id === id) ?? null;
    set({ currentMap: map });
  },

  updateMap: async (map) => {
    await saveMap(map);
    set((s) => ({
      currentMap: map,
      maps: s.maps.map((m) => (m.id === map.id ? map : m)),
    }));
  },

  addBlock: async (mapId, block) => {
    const { maps } = get();
    const map = maps.find((m) => m.id === mapId);
    if (!map) return;

    // Remove existing block at same position (except air)
    const filtered = map.blocks.filter(
      (b) => !(b.position.x === block.position.x && b.position.y === block.position.y && b.position.z === block.position.z)
    );
    if (block.type !== 'air') filtered.push(block);

    const updated = { ...map, blocks: filtered };
    await get().updateMap(updated);
  },

  removeBlock: async (mapId, pos) => {
    const { maps } = get();
    const map = maps.find((m) => m.id === mapId);
    if (!map) return;
    const filtered = map.blocks.filter(
      (b) => !(b.position.x === pos.x && b.position.y === pos.y && b.position.z === pos.z)
    );
    await get().updateMap({ ...map, blocks: filtered });
  },

  addInhabitant: async (mapId, inhabitant) => {
    const { maps } = get();
    const map = maps.find((m) => m.id === mapId);
    if (!map) return;
    const updated = { ...map, inhabitants: [...map.inhabitants, inhabitant] };
    await get().updateMap(updated);
  },

  setLLMConfig: async (config) => {
    await saveLLMConfig(config);
    const provider = createLLMProvider(config);
    set({ llmConfig: config, llmProvider: provider });
  },

  setActiveAgent: (inhabitant) => {
    const { llmProvider, agents } = get();
    if (!llmProvider) return;

    let agent = agents.get(inhabitant.id);
    if (!agent) {
      agent = new DigitalLifeAgent(inhabitant, llmProvider);
      agents.set(inhabitant.id, agent);
    }
    set({ activeAgent: agent, chatOpen: true });
  },

  setEditorMode: (mode) => set({ editorMode: mode }),
  setSelectedBlock: (type) => set({ selectedBlock: type }),
  setChatOpen: (open) => set({ chatOpen: open }),
}));
