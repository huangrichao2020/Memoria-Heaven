# 07 - 地图编辑器与 3D 渲染

## 模块概述

基于 Three.js 实现 Minecraft 风格的 3D 地图编辑器，让用户可以直观地创建和编辑数字生命的居住空间。设计理念：**简单易用，性能优先**。

## 内容

### 1. 核心架构

```typescript
// 地图编辑器的三层架构
interface MapEditorArchitecture {
  // 渲染层（Three.js）
  renderer: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
  };
  
  // 数据层（地图状态）
  data: {
    blocks: Map<string, Block>;     // 方块数据
    inhabitants: Inhabitant[];      // 数字生命
    metadata: MapMetadata;          // 元数据
  };
  
  // 交互层（用户操作）
  interaction: {
    mode: 'view' | 'edit' | 'chat';
    selectedBlock: Block | null;
    selectedInhabitant: Inhabitant | null;
    tool: 'place' | 'remove' | 'paint';
  };
}
```

### 2. 方块渲染系统

```typescript
// 使用 InstancedMesh 优化性能
class BlockRenderer {
  private scene: THREE.Scene;
  private instancedMeshes: Map<BlockType, THREE.InstancedMesh>;
  private blockPositions: Map<string, number>; // position key -> instance index
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.instancedMeshes = new Map();
    this.blockPositions = new Map();
    
    this.initializeInstancedMeshes();
  }
  
  // 初始化 InstancedMesh（每种方块类型一个）
  private initializeInstancedMeshes() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const maxBlocks = 10000; // 每种类型最多 10000 个方块
    
    // 为每种方块类型创建 InstancedMesh
    Object.values(BlockType).forEach(type => {
      const material = this.getMaterialForBlockType(type);
      const mesh = new THREE.InstancedMesh(geometry, material, maxBlocks);
      mesh.count = 0; // 初始为 0
      
      this.instancedMeshes.set(type, mesh);
      this.scene.add(mesh);
    });
  }
  
  // 获取方块材质
  private getMaterialForBlockType(type: BlockType): THREE.Material {
    const materials: Record<BlockType, THREE.MeshLambertMaterial> = {
      [BlockType.GRASS]: new THREE.MeshLambertMaterial({ 
        color: 0x7cfc00,
        flatShading: true 
      }),
      [BlockType.STONE]: new THREE.MeshLambertMaterial({ 
        color: 0x808080,
        flatShading: true 
      }),
      [BlockType.WOOD]: new THREE.MeshLambertMaterial({ 
        color: 0x8b4513,
        flatShading: true 
      }),
      [BlockType.WATER]: new THREE.MeshLambertMaterial({ 
        color: 0x1e90ff,
        transparent: true,
        opacity: 0.7 
      }),
      [BlockType.MEMORIAL_STONE]: new THREE.MeshLambertMaterial({ 
        color: 0x2f4f4f,
        flatShading: true 
      }),
      // ... 其他类型
    };
    
    return materials[type];
  }
  
  // 添加方块
  addBlock(block: Block) {
    const mesh = this.instancedMeshes.get(block.type);
    if (!mesh) return;
    
    const index = mesh.count;
    const matrix = new THREE.Matrix4();
    matrix.setPosition(block.position.x, block.position.y, block.position.z);
    mesh.setMatrixAt(index, matrix);
    mesh.count++;
    mesh.instanceMatrix.needsUpdate = true;
    
    // 记录位置
    const key = this.getPositionKey(block.position);
    this.blockPositions.set(key, index);
  }
  
  // 移除方块
  removeBlock(position: { x: number; y: number; z: number }, type: BlockType) {
    const key = this.getPositionKey(position);
    const index = this.blockPositions.get(key);
    
    if (index === undefined) return;
    
    const mesh = this.instancedMeshes.get(type);
    if (!mesh) return;
    
    // 将最后一个方块移到被删除的位置
    const lastIndex = mesh.count - 1;
    if (index !== lastIndex) {
      const matrix = new THREE.Matrix4();
      mesh.getMatrixAt(lastIndex, matrix);
      mesh.setMatrixAt(index, matrix);
    }
    
    mesh.count--;
    mesh.instanceMatrix.needsUpdate = true;
    this.blockPositions.delete(key);
  }
  
  // 批量加载地图
  loadMap(blocks: Block[]) {
    // 清空现有方块
    this.clear();
    
    // 按类型分组
    const blocksByType = new Map<BlockType, Block[]>();
    blocks.forEach(block => {
      if (!blocksByType.has(block.type)) {
        blocksByType.set(block.type, []);
      }
      blocksByType.get(block.type)!.push(block);
    });
    
    // 批量添加
    blocksByType.forEach((blocks, type) => {
      blocks.forEach(block => this.addBlock(block));
    });
  }
  
  // 清空所有方块
  clear() {
    this.instancedMeshes.forEach(mesh => {
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
    });
    this.blockPositions.clear();
  }
  
  private getPositionKey(pos: { x: number; y: number; z: number }): string {
    return `${pos.x},${pos.y},${pos.z}`;
  }
}
```

### 3. 地图编辑器组件

```typescript
// React + Three.js 集成
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, Grid } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';

interface MapEditorProps {
  map: Map;
  onMapChange: (map: Map) => void;
  mode: 'view' | 'edit';
}

export function MapEditor({ map, onMapChange, mode }: MapEditorProps) {
  const [selectedTool, setSelectedTool] = useState<BlockType>(BlockType.GRASS);
  const [hoveredPosition, setHoveredPosition] = useState<Vector3 | null>(null);
  
  return (
    <div className="map-editor">
      {/* 工具栏 */}
      {mode === 'edit' && (
        <Toolbar 
          selectedTool={selectedTool}
          onToolChange={setSelectedTool}
        />
      )}
      
      {/* 3D 场景 */}
      <Canvas
        camera={{ position: [20, 20, 20], fov: 60 }}
        shadows
      >
        {/* 光照 */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        
        {/* 天空 */}
        <Sky sunPosition={[100, 20, 100]} />
        
        {/* 地面网格 */}
        <Grid
          args={[map.dimensions.width, map.dimensions.depth]}
          cellSize={1}
          cellColor="#6f6f6f"
          sectionSize={5}
          sectionColor="#9d4b4b"
        />
        
        {/* 方块 */}
        <BlockMesh
          blocks={map.blocks}
          hoveredPosition={hoveredPosition}
          onBlockClick={(pos) => handleBlockClick(pos, selectedTool)}
        />
        
        {/* 数字生命 */}
        {map.inhabitants.map(inhabitant => (
          <InhabitantMesh
            key={inhabitant.id}
            inhabitant={inhabitant}
            onClick={() => handleInhabitantClick(inhabitant)}
          />
        ))}
        
        {/* 相机控制 */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={50}
        />
        
        {/* 交互层 */}
        {mode === 'edit' && (
          <EditInteraction
            onHover={setHoveredPosition}
            selectedTool={selectedTool}
          />
        )}
      </Canvas>
      
      {/* 信息面板 */}
      <InfoPanel map={map} />
    </div>
  );
}

// 方块网格组件
function BlockMesh({ 
  blocks, 
  hoveredPosition,
  onBlockClick 
}: {
  blocks: Block[];
  hoveredPosition: Vector3 | null;
  onBlockClick: (pos: Vector3) => void;
}) {
  const rendererRef = useRef<BlockRenderer>();
  const { scene } = useThree();
  
  useEffect(() => {
    if (!rendererRef.current) {
      rendererRef.current = new BlockRenderer(scene);
    }
    
    rendererRef.current.loadMap(blocks);
  }, [blocks, scene]);
  
  return (
    <>
      {/* 悬停高亮 */}
      {hoveredPosition && (
        <mesh position={hoveredPosition}>
          <boxGeometry args={[1.05, 1.05, 1.05]} />
          <meshBasicMaterial
            color="yellow"
            transparent
            opacity={0.3}
            wireframe
          />
        </mesh>
      )}
    </>
  );
}

// 数字生命网格
function InhabitantMesh({ 
  inhabitant, 
  onClick 
}: { 
  inhabitant: Inhabitant;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // 简单的呼吸动画
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = 
        inhabitant.homePosition.y + Math.sin(state.clock.elapsedTime) * 0.1;
    }
  });
  
  return (
    <mesh
      ref={meshRef}
      position={[
        inhabitant.homePosition.x,
        inhabitant.homePosition.y,
        inhabitant.homePosition.z
      ]}
      onClick={onClick}
    >
      {/* 简单的人形 */}
      <group>
        {/* 头 */}
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshLambertMaterial color="#ffdbac" />
        </mesh>
        
        {/* 身体 */}
        <mesh position={[0, 0.75, 0]}>
          <boxGeometry args={[0.6, 1, 0.4]} />
          <meshLambertMaterial color="#4169e1" />
        </mesh>
        
        {/* 名字标签 */}
        <Html position={[0, 2.2, 0]} center>
          <div className="inhabitant-label">
            {inhabitant.name}
          </div>
        </Html>
      </group>
    </mesh>
  );
}

// 编辑交互
function EditInteraction({
  onHover,
  selectedTool
}: {
  onHover: (pos: Vector3 | null) => void;
  selectedTool: BlockType;
}) {
  const { camera, raycaster, scene } = useThree();
  
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      // 计算鼠标位置
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // 射线检测
      raycaster.setFromCamera({ x, y }, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        const point = intersects[0].point;
        const snapped = new THREE.Vector3(
          Math.floor(point.x) + 0.5,
          Math.floor(point.y) + 0.5,
          Math.floor(point.z) + 0.5
        );
        onHover(snapped);
      } else {
        onHover(null);
      }
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [camera, raycaster, scene, onHover]);
  
  return null;
}
```

### 4. 工具栏

```typescript
// 方块选择工具栏
function Toolbar({ 
  selectedTool, 
  onToolChange 
}: {
  selectedTool: BlockType;
  onToolChange: (tool: BlockType) => void;
}) {
  const tools = [
    { type: BlockType.GRASS, icon: '🌱', name: '草地' },
    { type: BlockType.STONE, icon: '🪨', name: '石头' },
    { type: BlockType.WOOD, icon: '🪵', name: '木头' },
    { type: BlockType.FLOWER, icon: '🌸', name: '花' },
    { type: BlockType.WATER, icon: '💧', name: '水' },
    { type: BlockType.MEMORIAL_STONE, icon: '🗿', name: '纪念碑' },
  ];
  
  return (
    <div className="toolbar">
      <h3>方块工具</h3>
      <div className="tool-grid">
        {tools.map(tool => (
          <button
            key={tool.type}
            className={selectedTool === tool.type ? 'active' : ''}
            onClick={() => onToolChange(tool.type)}
            title={tool.name}
          >
            <span className="tool-icon">{tool.icon}</span>
            <span className="tool-name">{tool.name}</span>
          </button>
        ))}
      </div>
      
      <div className="tool-actions">
        <button onClick={() => onToolChange('remove' as any)}>
          🗑️ 删除
        </button>
        <button onClick={() => onToolChange('paint' as any)}>
          🎨 上色
        </button>
      </div>
    </div>
  );
}
```

### 5. 预设模板

```typescript
// 地图模板系统
class MapTemplates {
  // 空地图
  static empty(width: number, height: number, depth: number): Map {
    return {
      id: `map-${Date.now()}`,
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      owner: { workerId: '', workerUrl: '', publicKey: '' },
      dimensions: { width, height, depth },
      blocks: [],
      inhabitants: [],
      neighbors: [],
      signature: ''
    };
  }
  
  // 花园模板
  static garden(): Map {
    const map = this.empty(32, 16, 32);
    const blocks: Block[] = [];
    
    // 草地底层
    for (let x = 0; x < 32; x++) {
      for (let z = 0; z < 32; z++) {
        blocks.push({
          position: { x, y: 0, z },
          type: BlockType.GRASS
        });
      }
    }
    
    // 中央纪念碑
    blocks.push({
      position: { x: 16, y: 1, z: 16 },
      type: BlockType.MEMORIAL_STONE,
      metadata: { interactive: true }
    });
    
    // 周围的花
    const flowerPositions = [
      [15, 1, 15], [17, 1, 15], [15, 1, 17], [17, 1, 17],
      [14, 1, 16], [18, 1, 16], [16, 1, 14], [16, 1, 18]
    ];
    
    flowerPositions.forEach(([x, y, z]) => {
      blocks.push({
        position: { x, y, z },
        type: BlockType.FLOWER
      });
    });
    
    map.blocks = blocks;
    return map;
  }
  
  // 小屋模板
  static cottage(): Map {
    const map = this.empty(32, 16, 32);
    const blocks: Block[] = [];
    
    // 草地
    for (let x = 0; x < 32; x++) {
      for (let z = 0; z < 32; z++) {
        blocks.push({
          position: { x, y: 0, z },
          type: BlockType.GRASS
        });
      }
    }
    
    // 小屋墙壁（5x5）
    for (let x = 14; x <= 18; x++) {
      for (let z = 14; z <= 18; z++) {
        // 墙壁
        if (x === 14 || x === 18 || z === 14 || z === 18) {
          blocks.push({
            position: { x, y: 1, z },
            type: BlockType.WOOD
          });
          blocks.push({
            position: { x, y: 2, z },
            type: BlockType.WOOD
          });
        }
      }
    }
    
    // 门口（留空）
    blocks = blocks.filter(b => 
      !(b.position.x === 16 && b.position.z === 14 && b.position.y <= 2)
    );
    
    map.blocks = blocks;
    return map;
  }
  
  // 水池模板
  static pond(): Map {
    const map = this.empty(32, 16, 32);
    const blocks: Block[] = [];
    
    // 草地
    for (let x = 0; x < 32; x++) {
      for (let z = 0; z < 32; z++) {
        blocks.push({
          position: { x, y: 0, z },
          type: BlockType.GRASS
        });
      }
    }
    
    // 中央水池（圆形）
    const centerX = 16, centerZ = 16, radius = 5;
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      for (let z = centerZ - radius; z <= centerZ + radius; z++) {
        const distance = Math.sqrt(
          Math.pow(x - centerX, 2) + Math.pow(z - centerZ, 2)
        );
        
        if (distance <= radius) {
          // 移除草地
          const grassIndex = blocks.findIndex(b =>
            b.position.x === x && b.position.y === 0 && b.position.z === z
          );
          if (grassIndex !== -1) {
            blocks.splice(grassIndex, 1);
          }
          
          // 添加水
          blocks.push({
            position: { x, y: 0, z },
            type: BlockType.WATER
          });
        }
      }
    }
    
    map.blocks = blocks;
    return map;
  }
}
```

### 6. 地图导入导出

```typescript
// 地图序列化
class MapSerializer {
  // 导出为 JSON
  static toJSON(map: Map): string {
    return JSON.stringify(map, null, 2);
  }
  
  // 从 JSON 导入
  static fromJSON(json: string): Map {
    return JSON.parse(json);
  }
  
  // 导出为压缩格式（减少文件大小）
  static toCompressed(map: Map): string {
    // 使用游程编码压缩连续的相同方块
    const compressed = {
      ...map,
      blocks: this.compressBlocks(map.blocks)
    };
    
    return JSON.stringify(compressed);
  }
  
  // 压缩方块数据
  private static compressBlocks(blocks: Block[]): any[] {
    const compressed: any[] = [];
    let current: Block | null = null;
    let count = 0;
    
    // 按 y, z, x 排序
    const sorted = [...blocks].sort((a, b) => {
      if (a.position.y !== b.position.y) return a.position.y - b.position.y;
      if (a.position.z !== b.position.z) return a.position.z - b.position.z;
      return a.position.x - b.position.x;
    });
    
    sorted.forEach(block => {
      if (current && 
          current.type === block.type && 
          !block.metadata &&
          block.position.x === current.position.x + count) {
        count++;
      } else {
        if (current) {
          compressed.push({
            p: [current.position.x, current.position.y, current.position.z],
            t: current.type,
            c: count,
            m: current.metadata
          });
        }
        current = block;
        count = 1;
      }
    });
    
    if (current) {
      compressed.push({
        p: [current.position.x, current.position.y, current.position.z],
        t: current.type,
        c: count,
        m: current.metadata
      });
    }
    
    return compressed;
  }
  
  // 解压方块数据
  static decompressBlocks(compressed: any[]): Block[] {
    const blocks: Block[] = [];
    
    compressed.forEach(item => {
      for (let i = 0; i < item.c; i++) {
        blocks.push({
          position: {
            x: item.p[0] + i,
            y: item.p[1],
            z: item.p[2]
          },
          type: item.t,
          metadata: item.m
        });
      }
    });
    
    return blocks;
  }
}
```

### 7. 性能优化

```typescript
// 性能监控
class PerformanceMonitor {
  private fps: number = 0;
  private frameCount: number = 0;
  private lastTime: number = performance.now();
  
  update() {
    this.frameCount++;
    const now = performance.now();
    
    if (now - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = now;
    }
  }
  
  getFPS(): number {
    return this.fps;
  }
}

// LOD（细节层次）系统
class LODSystem {
  // 根据距离调整方块细节
  static getBlockGeometry(distance: number): THREE.BoxGeometry {
    if (distance < 20) {
      // 近距离：高细节
      return new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
    } else if (distance < 40) {
      // 中距离：中等细节
      return new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
    } else {
      // 远距离：低细节（简化为单个面）
      return new THREE.BoxGeometry(1, 1, 1);
    }
  }
  
  // 视锥剔除
  static cullBlocks(
    blocks: Block[],
    camera: THREE.Camera,
    frustum: THREE.Frustum
  ): Block[] {
    return blocks.filter(block => {
      const box = new THREE.Box3(
        new THREE.Vector3(
          block.position.x - 0.5,
          block.position.y - 0.5,
          block.position.z - 0.5
        ),
        new THREE.Vector3(
          block.position.x + 0.5,
          block.position.y + 0.5,
          block.position.z + 0.5
        )
      );
      
      return frustum.intersectsBox(box);
    });
  }
}
```

## 效果

1. **流畅渲染**：使用 InstancedMesh，可以渲染 10000+ 方块，保持 60 FPS
2. **直观编辑**：Minecraft 风格，用户容易上手
3. **实时预览**：编辑即时生效，所见即所得
4. **模板丰富**：提供多种预设模板，快速开始

## 设计理由

### 为什么用 InstancedMesh？

1. **性能**：单次 draw call 渲染数千个方块
2. **内存**：共享几何体和材质，节省内存
3. **标准**：Three.js 官方推荐的优化方案

### 为什么用 Minecraft 风格？

1. **简单**：方块比自由建模简单得多
2. **熟悉**：用户容易理解和使用
3. **性能**：方块渲染效率高

### 为什么需要压缩？

1. **带宽**：减少网络传输量
2. **存储**：节省 Cloudflare Pages 空间
3. **速度**：加快加载速度

## 上游链路

- **地图模板**：提供初始地图
- **用户操作**：编辑地图

## 下游链路

- **本地存储**：保存到 IndexedDB
- **Cloudflare Pages**：部署静态资源
- **区块链**：记录地图 URL hash

## 性能指标

```typescript
interface RenderingMetrics {
  fps: number;                    // 目标: 60 FPS
  drawCalls: number;              // 目标: < 50
  triangles: number;              // 目标: < 100K
  memoryUsage: number;            // 目标: < 200MB
  loadTime: number;               // 目标: < 2s
}
```
