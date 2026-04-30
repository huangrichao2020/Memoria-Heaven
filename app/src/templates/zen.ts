// ============================================================
// Zen Garden - 日式禅意花园模板
// ============================================================
import type { MapData, Block } from '../lib/types';

export function createZenTemplate(name: string): MapData {
  const blocks: Block[] = [];
  const W = 32, H = 16, D = 32;

  // 沙地地面
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      // 中央区域用沙子，边缘用草地
      const distFromCenter = Math.sqrt((x - 16) ** 2 + (z - 16) ** 2);
      if (distFromCenter < 14) {
        blocks.push({ position: { x, y: 0, z }, type: 'sand' });
      } else {
        blocks.push({ position: { x, y: 0, z }, type: 'grass' });
      }
    }
  }

  // 枯山水石组（禅意石头排列）
  const stoneGroups = [
    // 主石组
    { cx: 16, cz: 16, stones: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] },
    // 副石组 1
    { cx: 8, cz: 8, stones: [[0, 0], [1, 0], [0, 1]] },
    // 副石组 2
    { cx: 24, cz: 24, stones: [[0, 0], [-1, 0], [0, -1]] },
  ];
  stoneGroups.forEach((group) => {
    group.stones.forEach(([dx, dz], i) => {
      const height = i === 0 ? 2 : 1; // 主石更高
      for (let y = 1; y <= height; y++) {
        blocks.push({ position: { x: group.cx + dx, y, z: group.cz + dz }, type: 'stone' });
      }
    });
  });

  // 苔藓点缀
  const mossPositions = [
    [10, 10], [12, 10], [10, 12],
    [22, 22], [20, 22], [22, 20],
    [14, 18], [18, 14],
  ];
  mossPositions.forEach(([mx, mz]) => {
    blocks.push({ position: { x: mx, y: 1, z: mz }, type: 'moss' });
  });

  // 竹林（用 wood 模拟）
  const bambooPositions = [
    [2, 2], [2, 4], [4, 2], [4, 4], [3, 3],
    [2, 28], [2, 26], [4, 28], [4, 26], [3, 27],
  ];
  bambooPositions.forEach(([bx, bz]) => {
    for (let y = 1; y <= 5; y++) {
      blocks.push({ position: { x: bx, y, z: bz }, type: 'wood' });
    }
    // 竹叶
    blocks.push({ position: { x: bx, y: 6, z: bz }, type: 'leaves' });
  });

  // 小桥（拱形石头）
  for (let i = -2; i <= 2; i++) {
    const bridgeY = Math.abs(i) === 2 ? 1 : 2;
    blocks.push({ position: { x: 16 + i, y: bridgeY, z: 8 }, type: 'stone' });
  }

  // 锦鲤池（水池）
  for (let x = 12; x <= 20; x++) {
    for (let z = 4; z <= 8; z++) {
      const dist = Math.sqrt((x - 16) ** 2 + (z - 6) ** 2);
      if (dist <= 4) {
        // 移除沙地
        const idx = blocks.findIndex((b) => b.position.x === x && b.position.y === 0 && b.position.z === z);
        if (idx !== -1) blocks.splice(idx, 1);
        blocks.push({ position: { x, y: 0, z }, type: 'water' });
      }
    }
  }

  // 灯笼
  blocks.push({ position: { x: 10, y: 1, z: 10 }, type: 'lantern' });
  blocks.push({ position: { x: 22, y: 1, z: 22 }, type: 'lantern' });
  blocks.push({ position: { x: 10, y: 1, z: 22 }, type: 'lantern' });
  blocks.push({ position: { x: 22, y: 1, z: 10 }, type: 'lantern' });

  // 长椅
  blocks.push({ position: { x: 6, y: 1, z: 16 }, type: 'bench' });
  blocks.push({ position: { x: 26, y: 1, z: 16 }, type: 'bench' });

  // 纪念石碑
  blocks.push({ position: { x: 16, y: 1, z: 16 }, type: 'memorial_stone', metadata: { interactive: true } });

  return {
    id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    version: '1.0.0',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name,
    templateId: 'zen',
    season: 'spring',
    dimensions: { width: W, height: H, depth: D },
    blocks,
    inhabitants: [],
    neighbors: [],
    isPublic: true,
    messages: [],
  };
}
