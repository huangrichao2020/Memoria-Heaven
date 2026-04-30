// ============================================================
// Starfield Memorial - 星空纪念堂模板
// ============================================================
import type { MapData, Block } from '../lib/types';

export function createStarfieldTemplate(name: string): MapData {
  const blocks: Block[] = [];
  const W = 32, H = 16, D = 32;

  // 深色地面（石头）
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      blocks.push({ position: { x, y: 0, z }, type: 'stone' });
    }
  }

  // 中央纪念碑
  blocks.push({ position: { x: 16, y: 1, z: 16 }, type: 'memorial_stone', metadata: { interactive: true } });

  // 水晶柱阵列（4x4 网格）
  const crystalPositions = [
    [8, 8], [8, 16], [8, 24],
    [16, 8], [16, 24],
    [24, 8], [24, 16], [24, 24],
  ];
  crystalPositions.forEach(([cx, cz]) => {
    for (let y = 1; y <= 3; y++) {
      blocks.push({ position: { x: cx, y, z: cz }, type: 'crystal' });
    }
  });

  // 星座连线（用蜡烛模拟星星）
  const stars = [
    [4, 4], [6, 6], [8, 4], [10, 6], [12, 4], // 北斗七星
    [20, 4], [22, 6], [24, 4], [26, 6],
    [4, 24], [6, 26], [8, 24], [10, 26],
    [20, 24], [22, 26], [24, 24], [26, 26],
  ];
  stars.forEach(([sx, sz]) => {
    blocks.push({ position: { x: sx, y: 1, z: sz }, type: 'candle' });
  });

  // 天灯环绕纪念碑
  const lanternOffsets = [
    [-3, 0], [3, 0], [0, -3], [0, 3],
    [-2, -2], [2, -2], [-2, 2], [2, 2],
  ];
  lanternOffsets.forEach(([dx, dz]) => {
    blocks.push({ position: { x: 16 + dx, y: 1, z: 16 + dz }, type: 'lantern' });
  });

  // 外围拱门
  const archPositions = [
    { x: 0, z: 16 }, { x: 31, z: 16 },
    { x: 16, z: 0 }, { x: 16, z: 31 },
  ];
  archPositions.forEach((pos) => {
    blocks.push({ position: { ...pos, y: 1 }, type: 'arch' });
    blocks.push({ position: { ...pos, y: 2 }, type: 'arch' });
    blocks.push({ position: { ...pos, y: 3 }, type: 'arch' });
  });

  // 蝴蝶装饰
  const butterflyPositions = [
    [10, 12], [22, 12], [10, 20], [22, 20],
  ];
  butterflyPositions.forEach(([bx, bz]) => {
    blocks.push({ position: { x: bx, y: 1, z: bz }, type: 'butterfly' });
  });

  return {
    id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    version: '1.0.0',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name,
    templateId: 'starfield',
    season: 'winter',
    dimensions: { width: W, height: H, depth: D },
    blocks,
    inhabitants: [],
    neighbors: [],
    isPublic: true,
    messages: [],
  };
}
