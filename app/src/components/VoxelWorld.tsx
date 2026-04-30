// ============================================================
// VoxelWorld - Three.js Minecraft-style 3D renderer
// 增强版：粒子效果、互动系统、季节渲染
// ============================================================
import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { MapData, Block, BlockType, Position, MapMessage } from '../lib/types';
import { BLOCK_COLORS, SEASON_COLORS } from '../lib/types';
import { useStore } from '../lib/store';
import { WishingFountain, LanternRelease, MemoryTree, ButterflyRelease } from './Interactions';

// Instanced block renderer for performance
function BlockMesh({ blocks, type }: { blocks: Block[]; type: BlockType }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const color = BLOCK_COLORS[type];
  if (color === 'transparent' || blocks.length === 0) return null;

  const count = blocks.length;

  useMemo(() => {
    if (!meshRef.current) return;
    const matrix = new THREE.Matrix4();
    blocks.forEach((block, i) => {
      matrix.setPosition(block.position.x, block.position.y, block.position.z);
      meshRef.current!.setMatrixAt(i, matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [blocks, meshRef.current]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow>
      <boxGeometry args={[0.98, 0.98, 0.98]} />
      <meshLambertMaterial color={color} flatShading />
    </instancedMesh>
  );
}

// Candle glow effect
function CandleLight({ position }: { position: Position }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.intensity = 1.5 + Math.sin(clock.elapsedTime * 3 + position.x) * 0.5;
    }
  });
  return <pointLight ref={ref} position={[position.x, position.y + 1.5, position.z]} color="#fde68a" intensity={1.5} distance={5} />;
}

// 粒子效果：樱花飘落
function CherryBlossoms({ season }: { season?: string }) {
  const particles = useRef<THREE.Points>(null);
  const count = 50;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * 32;
      pos[i * 3 + 1] = Math.random() * 10 + 5;
      pos[i * 3 + 2] = Math.random() * 32;
    }
    return pos;
  }, []);

  useFrame((_, delta) => {
    if (!particles.current) return;
    const pos = particles.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      pos.array[i * 3 + 1] -= delta * 0.5; // 下落
      pos.array[i * 3] += Math.sin(Date.now() * 0.001 + i) * delta * 0.3; // 飘动
      if (pos.array[i * 3 + 1] < 0) {
        pos.array[i * 3 + 1] = 10 + Math.random() * 5;
        pos.array[i * 3] = Math.random() * 32;
        pos.array[i * 3 + 2] = Math.random() * 32;
      }
    }
    pos.needsUpdate = true;
  });

  // 只在春天显示
  if (season !== 'spring' && season !== undefined) return null;

  return (
    <points ref={particles}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.15} color="#f9a8d4" transparent opacity={0.8} />
    </points>
  );
}

// 粒子效果：萤火虫
function Fireflies() {
  const particles = useRef<THREE.Points>(null);
  const count = 30;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * 32;
      pos[i * 3 + 1] = Math.random() * 3 + 1;
      pos[i * 3 + 2] = Math.random() * 32;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (!particles.current) return;
    const pos = particles.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      pos.array[i * 3] += Math.sin(clock.elapsedTime + i * 0.5) * 0.01;
      pos.array[i * 3 + 1] += Math.cos(clock.elapsedTime * 0.5 + i) * 0.005;
      pos.array[i * 3 + 2] += Math.sin(clock.elapsedTime * 0.7 + i * 0.3) * 0.01;
    }
    pos.needsUpdate = true;
    // 闪烁效果
    const mat = particles.current.material as THREE.PointsMaterial;
    mat.opacity = 0.5 + Math.sin(clock.elapsedTime * 2) * 0.3;
  });

  return (
    <points ref={particles}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.1} color="#fde68a" transparent opacity={0.6} />
    </points>
  );
}

// 粒子效果：水面涟漪
function WaterRipple({ positions }: { positions: Position[] }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      const scale = 1 + Math.sin(clock.elapsedTime * 2 + i) * 0.3;
      mesh.scale.set(scale, 1, scale);
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.3 - Math.sin(clock.elapsedTime * 2 + i) * 0.2;
    });
  });

  if (positions.length === 0) return null;

  return (
    <group ref={ref}>
      {positions.slice(0, 5).map((pos, i) => (
        <mesh key={i} position={[pos.x, pos.y + 0.1, pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.5, 16]} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// Inhabitant marker
function InhabitantMarker({ inhabitant }: { inhabitant: MapData['inhabitants'][0] }) {
  const setAgent = useStore((s) => s.setActiveAgent);
  const pos = inhabitant.homePosition;

  return (
    <group position={[pos.x, pos.y + 1, pos.z]}>
      {/* Body */}
      <mesh position={[0, 0.5, 0]} onClick={() => setAgent(inhabitant)}>
        <boxGeometry args={[0.6, 1, 0.4]} />
        <meshLambertMaterial color="#6366f1" />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.3, 0]} onClick={() => setAgent(inhabitant)}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshLambertMaterial color="#fde68a" />
      </mesh>
      {/* Name tag */}
      <Html position={[0, 2.2, 0]} center distanceFactor={15}>
        <div style={{
          background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px',
          borderRadius: 4, fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer',
          userSelect: 'none',
        }} onClick={() => setAgent(inhabitant)}>
          {inhabitant.name}
        </div>
      </Html>
    </group>
  );
}

// Click handler for placing/removing blocks
function EditControls({ map }: { map: MapData }) {
  const { camera, raycaster, gl } = useThree();
  const editorMode = useStore((s) => s.editorMode);
  const selectedBlock = useStore((s) => s.selectedBlock);
  const addBlock = useStore((s) => s.addBlock);
  const removeBlock = useStore((s) => s.removeBlock);

  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (editorMode !== 'edit') return;

      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      // Build a simple ground plane for intersection
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersect = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersect);

      if (intersect) {
        const bx = Math.floor(intersect.x + 0.5);
        const bz = Math.floor(intersect.z + 0.5);

        if (event.button === 0) {
          // Left click: place block
          addBlock(map.id, { position: { x: bx, y: 1, z: bz }, type: selectedBlock });
        } else if (event.button === 2) {
          // Right click: remove block
          removeBlock(map.id, { x: bx, y: 1, z: bz });
        }
      }
    },
    [editorMode, selectedBlock, map.id, camera, raycaster, gl, addBlock, removeBlock]
  );

  // Attach event listener
  useMemo(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('mousedown', handleClick);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    return () => {
      canvas.removeEventListener('mousedown', handleClick);
    };
  }, [gl, handleClick]);

  return null;
}

// Group blocks by type for instanced rendering
function BlockLayer({ blocks }: { blocks: Block[] }) {
  const byType = useMemo(() => {
    const map = new Map<BlockType, Block[]>();
    blocks.forEach((b) => {
      if (!map.has(b.type)) map.set(b.type, []);
      map.get(b.type)!.push(b);
    });
    return map;
  }, [blocks]);

  return (
    <>
      {Array.from(byType.entries()).map(([type, typeBlocks]) => (
        <BlockMesh key={type} blocks={typeBlocks} type={type} />
      ))}
    </>
  );
}

// 互动方块处理
function InteractiveBlocks({ map, onMapUpdate }: { map: MapData; onMapUpdate: (map: MapData) => void }) {
  const wishes = map.messages
    .filter((m) => m.type === 'wish')
    .map((m) => m.content);

  const memoryTags = map.messages
    .filter((m) => m.type === 'memory_tag')
    .map((m) => m.content);

  const handleWish = (wish: string) => {
    const newMsg: MapMessage = {
      id: `msg-${Date.now()}`,
      type: 'wish',
      content: wish,
      createdAt: Date.now(),
    };
    onMapUpdate({
      ...map,
      messages: [...map.messages, newMsg],
    });
  };

  const handleLantern = (message: string) => {
    const newMsg: MapMessage = {
      id: `msg-${Date.now()}`,
      type: 'lantern',
      content: message,
      createdAt: Date.now(),
    };
    onMapUpdate({
      ...map,
      messages: [...map.messages, newMsg],
    });
  };

  const handleMemoryTag = (tag: string) => {
    const newMsg: MapMessage = {
      id: `msg-${Date.now()}`,
      type: 'memory_tag',
      content: tag,
      createdAt: Date.now(),
    };
    onMapUpdate({
      ...map,
      messages: [...map.messages, newMsg],
    });
  };

  return (
    <>
      {/* 许愿池 */}
      {map.blocks
        .filter((b) => b.type === 'fountain')
        .map((b, i) => (
          <WishingFountain
            key={`fountain-${i}`}
            position={b.position}
            wishes={wishes}
            onWish={handleWish}
          />
        ))}

      {/* 天灯 */}
      {map.blocks
        .filter((b) => b.type === 'lantern')
        .map((b, i) => (
          <LanternRelease
            key={`lantern-${i}`}
            position={b.position}
            onRelease={handleLantern}
          />
        ))}

      {/* 记忆树（使用 wood 方块） */}
      {map.blocks
        .filter((b) => b.type === 'wood' && b.metadata?.interactive)
        .map((b, i) => (
          <MemoryTree
            key={`tree-${i}`}
            position={b.position}
            tags={memoryTags}
            onTag={handleMemoryTag}
          />
        ))}

      {/* 蝴蝶 */}
      {map.blocks
        .filter((b) => b.type === 'butterfly')
        .map((b, i) => (
          <ButterflyRelease key={`butterfly-${i}`} position={b.position} />
        ))}
    </>
  );
}

// Main scene
function Scene({ map, onMapUpdate }: { map: MapData; onMapUpdate: (map: MapData) => void }) {
  const candlePositions = useMemo(
    () => map.blocks.filter((b) => b.type === 'candle' || b.type === 'lantern').map((b) => b.position),
    [map.blocks]
  );

  const waterPositions = useMemo(
    () => map.blocks.filter((b) => b.type === 'water').map((b) => b.position),
    [map.blocks]
  );

  // 季节配色
  const seasonColors = map.season ? SEASON_COLORS[map.season] : SEASON_COLORS.spring;

  return (
    <>
      <ambientLight intensity={seasonColors.ambient} />
      <directionalLight position={[20, 30, 10]} intensity={1} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <Sky sunPosition={[50, 30, 50]} />
      <fog attach="fog" args={[seasonColors.fog, 40, 80]} />

      <BlockLayer blocks={map.blocks} />

      {candlePositions.map((pos, i) => (
        <CandleLight key={i} position={pos} />
      ))}

      {/* 粒子效果 */}
      <CherryBlossoms season={map.season} />
      <Fireflies />
      <WaterRipple positions={waterPositions} />

      {/* 互动系统 */}
      <InteractiveBlocks map={map} onMapUpdate={onMapUpdate} />

      {map.inhabitants.map((inh) => (
        <InhabitantMarker key={inh.id} inhabitant={inh} />
      ))}

      <EditControls map={map} />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={5}
        maxDistance={60}
        maxPolarAngle={Math.PI / 2.1}
        target={[16, 0, 16]}
      />
    </>
  );
}

export function VoxelWorld({ map }: { map: MapData }) {
  const updateMap = useStore((s) => s.updateMap);

  const handleMapUpdate = useCallback((updatedMap: MapData) => {
    updateMap(updatedMap);
  }, [updateMap]);

  return (
    <Canvas
      camera={{ position: [30, 25, 30], fov: 50 }}
      shadows
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <Scene map={map} onMapUpdate={handleMapUpdate} />
    </Canvas>
  );
}
