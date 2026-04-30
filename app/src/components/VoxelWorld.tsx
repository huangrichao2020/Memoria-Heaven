// ============================================================
// VoxelWorld - Three.js Minecraft-style 3D renderer
// ============================================================
import { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { MapData, Block, BlockType, Position } from '../lib/types';
import { BLOCK_COLORS } from '../lib/types';
import { useStore } from '../lib/store';

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

// Main scene
function Scene({ map }: { map: MapData }) {
  const candlePositions = useMemo(
    () => map.blocks.filter((b) => b.type === 'candle').map((b) => b.position),
    [map.blocks]
  );

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[20, 30, 10]} intensity={1} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <Sky sunPosition={[50, 30, 50]} />
      <fog attach="fog" args={['#c8d6e5', 40, 80]} />

      <BlockLayer blocks={map.blocks} />

      {candlePositions.map((pos, i) => (
        <CandleLight key={i} position={pos} />
      ))}

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
  return (
    <Canvas
      camera={{ position: [30, 25, 30], fov: 50 }}
      shadows
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <Scene map={map} />
    </Canvas>
  );
}
