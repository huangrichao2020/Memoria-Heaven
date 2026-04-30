// ============================================================
// Local Storage Layer (IndexedDB via idb-keyval)
// ============================================================
import { get, set, del, keys } from 'idb-keyval';
import type { MapData, Message, LLMConfig } from './types';

const MAP_PREFIX = 'mh:map:';
const CONV_PREFIX = 'mh:conv:';
const CONFIG_KEY = 'mh:llm-config';

// --- Maps ---
export async function saveMap(map: MapData): Promise<void> {
  map.updatedAt = Date.now();
  await set(MAP_PREFIX + map.id, map);
}

export async function getMap(id: string): Promise<MapData | null> {
  return (await get(MAP_PREFIX + id)) ?? null;
}

export async function getAllMaps(): Promise<MapData[]> {
  const allKeys = await keys();
  const mapKeys = allKeys.filter((k) => String(k).startsWith(MAP_PREFIX));
  const maps: MapData[] = [];
  for (const k of mapKeys) {
    const m = await get(k);
    if (m) maps.push(m);
  }
  return maps.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteMap(id: string): Promise<void> {
  await del(MAP_PREFIX + id);
}

// --- Conversations ---
export async function saveConversation(
  inhabitantId: string,
  messages: Message[]
): Promise<void> {
  await set(CONV_PREFIX + inhabitantId, messages);
}

export async function getConversation(
  inhabitantId: string
): Promise<Message[]> {
  return (await get(CONV_PREFIX + inhabitantId)) ?? [];
}

// --- LLM Config ---
export async function saveLLMConfig(config: LLMConfig): Promise<void> {
  await set(CONFIG_KEY, config);
}

export async function getLLMConfig(): Promise<LLMConfig | null> {
  return (await get(CONFIG_KEY)) ?? null;
}
