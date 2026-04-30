// ============================================================
// Memory Library - 记忆图书馆模板
// ============================================================
import type { MapData, Block } from '../lib/types';

export function createLibraryTemplate(name: string): MapData {
  const blocks: Block[] = [];
  const W = 32, H = 16, D = 32;

  // 石头地板
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      blocks.push({ position: { x, y: 0, z }, type: 'stone' });
    }
  }

  // 图书馆墙壁（石头围成 U 形）
  // 后墙
  for (let x = 0; x < W; x++) {
    for (let y = 1; y <= 4; y++) {
      blocks.push({ position: { x, y, z: 0 }, type: 'stone' });
    }
  }
  // 左墙
  for (let z = 0; z < D; z++) {
    for (let y = 1; y <= 4; y++) {
      blocks.push({ position: { x: 0, y, z }, type: 'stone' });
    }
  }
  // 右墙
  for (let z = 0; z < D; z++) {
    for (let y = 1; y <= 4; y++) {
      blocks.push({ position: { x: 31, y, z }, type: 'stone' });
    }
  }

  // 书架（book 方块排列成排）
  const shelfRows = [6, 12, 18, 24];
  shelfRows.forEach((z) => {
    // 左侧书架
    for (let x = 3; x <= 10; x++) {
      blocks.push({ position: { x, y: 1, z }, type: 'book' });
      blocks.push({ position: { x, y: 2, z }, type: 'book' });
    }
    // 右侧书架
    for (let x = 21; x <= 28; x++) {
      blocks.push({ position: { x, y: 1, z }, type: 'book' });
      blocks.push({ position: { x, y: 2, z }, type: 'book' });
    }
  });

  // 中央阅读区
  // 纪念碑
  blocks.push({ position: { x: 16, y: 1, z: 16 }, type: 'memorial_stone', metadata: { interactive: true } });

  // 阅读长椅
  blocks.push({ position: { x: 14, y: 1, z: 14 }, type: 'bench' });
  blocks.push({ position: { x: 18, y: 1, z: 14 }, type: 'bench' });
  blocks.push({ position: { x: 14, y: 1, z: 18 }, type: 'bench' });
  blocks.push({ position: { x: 18, y: 1, z: 18 }, type: 'bench' });

  // 烛台
  const candlePositions = [
    [12, 12], [20, 12], [12, 20], [20, 20],
    [5, 5], [26, 5], [5, 26], [26, 26],
    [16, 12], [16, 20],
  ];
  candlePositions.forEach(([cx, cz]) => {
    blocks.push({ position: { x: cx, y: 1, z: cz }, type: 'candle' });
  });

  // 水晶吊灯（中央上方）
  blocks.push({ position: { x: 16, y: 5, z: 16 }, type: 'crystal' });
  blocks.push({ position: { x: 15, y: 5, z: 16 }, type: 'crystal' });
  blocks.push({ position: { x: 17, y: 5, z: 16 }, type: 'crystal' });
  blocks.push({ position: { x: 16, y: 5, z: 15 }, type: 'crystal' });
  blocks.push({ position: { x: 16, y: 5, z: 17 }, type: 'crystal' });

  // 记忆之书（特殊位置）
  blocks.push({ position: { x: 15, y: 1, z: 16 }, type: 'book', metadata: { interactive: true, memoryTag: '珍贵记忆' } });
  blocks.push({ position: { x: 17, y: 1, z: 16 }, type: 'book', metadata: { interactive: true, memoryTag: '温暖回忆' } });

  // 蝴蝶装饰
  blocks.push({ position: { x: 8, y: 3, z: 16 }, type: 'butterfly' });
  blocks.push({ position: { x: 24, y: 3, z: 16 }, type: 'butterfly' });

  // 苔藓（角落装饰）
  blocks.push({ position: { x: 1, y: 1, z: 1 }, type: 'moss' });
  blocks.push({ position: { x: 30, y: 1, z: 1 }, type: 'moss' });
  blocks.push({ position: { x: 1, y: 1, z: 30 }, type: 'moss' });
  blocks.push({ position: { x: 30, y: 1, z: 30 }, type: 'moss' });

  return {
    id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    version: '1.0.0',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name,
    templateId: 'library',
    season: 'autumn',
    dimensions: { width: W, height: H, depth: D },
    blocks,
    inhabitants: [],
    neighbors: [],
    isPublic: true,
    messages: [],
  };
}
