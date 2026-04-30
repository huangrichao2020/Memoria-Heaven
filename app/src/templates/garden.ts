// ============================================================
// Garden Template - 记忆花园模板（增强版）
// ============================================================
import type { MapData, Block } from '../lib/types';

export function createGardenTemplate(name: string): MapData {
  const blocks: Block[] = [];
  const W = 32, H = 16, D = 32;

  // Ground layer
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      blocks.push({ position: { x, y: 0, z }, type: 'grass' });
    }
  }

  // Central memorial stone
  blocks.push({ position: { x: 16, y: 1, z: 16 }, type: 'memorial_stone', metadata: { interactive: true } });

  // Surrounding flowers
  const flowerOffsets = [
    [-2, 0], [-1, -1], [-1, 1], [0, -2], [0, 2], [1, -1], [1, 1], [2, 0],
    [-3, 0], [0, -3], [0, 3], [3, 0],
  ];
  flowerOffsets.forEach(([dx, dz]) => {
    blocks.push({ position: { x: 16 + dx, y: 1, z: 16 + dz }, type: 'flower' });
  });

  // Corner trees (wood + leaves)
  const treePositions = [[4, 4], [4, 27], [27, 4], [27, 27], [10, 10], [22, 22]];
  treePositions.forEach(([tx, tz]) => {
    for (let y = 1; y <= 3; y++) {
      blocks.push({ position: { x: tx, y, z: tz }, type: 'wood' });
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        blocks.push({ position: { x: tx + dx, y: 4, z: tz + dz }, type: 'leaves' });
        if (Math.abs(dx) + Math.abs(dz) <= 1) {
          blocks.push({ position: { x: tx + dx, y: 5, z: tz + dz }, type: 'leaves' });
        }
      }
    }
  });

  // Small pond
  for (let x = 22; x <= 26; x++) {
    for (let z = 8; z <= 12; z++) {
      const dist = Math.sqrt((x - 24) ** 2 + (z - 10) ** 2);
      if (dist <= 2.5) {
        const idx = blocks.findIndex((b) => b.position.x === x && b.position.y === 0 && b.position.z === z);
        if (idx !== -1) blocks.splice(idx, 1);
        blocks.push({ position: { x, y: 0, z }, type: 'water' });
      }
    }
  }

  // 许愿池（喷泉）
  blocks.push({ position: { x: 24, y: 1, z: 10 }, type: 'fountain', metadata: { interactive: true } });

  // Stone path
  for (let z = 0; z < D; z++) {
    if (z % 2 === 0) {
      blocks.push({ position: { x: 15, y: 1, z }, type: 'stone' });
      blocks.push({ position: { x: 17, y: 1, z }, type: 'stone' });
    }
  }

  // Candles near memorial
  [[14, 14], [18, 14], [14, 18], [18, 18]].forEach(([cx, cz]) => {
    blocks.push({ position: { x: cx, y: 1, z: cz }, type: 'candle' });
  });

  // 新增：长椅
  blocks.push({ position: { x: 12, y: 1, z: 16 }, type: 'bench' });
  blocks.push({ position: { x: 20, y: 1, z: 16 }, type: 'bench' });

  // 新增：拱门入口
  blocks.push({ position: { x: 16, y: 1, z: 31 }, type: 'arch' });
  blocks.push({ position: { x: 16, y: 2, z: 31 }, type: 'arch' });
  blocks.push({ position: { x: 16, y: 3, z: 31 }, type: 'arch' });

  // 新增：灯笼
  blocks.push({ position: { x: 14, y: 1, z: 31 }, type: 'lantern' });
  blocks.push({ position: { x: 18, y: 1, z: 31 }, type: 'lantern' });

  // 新增：蝴蝶装饰
  blocks.push({ position: { x: 8, y: 2, z: 16 }, type: 'butterfly' });
  blocks.push({ position: { x: 24, y: 2, z: 16 }, type: 'butterfly' });

  // 新增：苔藓
  blocks.push({ position: { x: 3, y: 1, z: 3 }, type: 'moss' });
  blocks.push({ position: { x: 28, y: 1, z: 28 }, type: 'moss' });

  return {
    id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    version: '1.0.0',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name,
    templateId: 'garden',
    season: 'spring',
    dimensions: { width: W, height: H, depth: D },
    blocks,
    inhabitants: [],
    neighbors: [],
    isPublic: true,
    messages: [],
  };
}
