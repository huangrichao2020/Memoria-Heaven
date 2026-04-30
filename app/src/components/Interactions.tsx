// ============================================================
// Interactions - 互动装饰物系统
// 许愿池、记忆树、天灯放飞、蝴蝶放飞
// ============================================================
import { useState, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Position } from '../lib/types';
import { playWaterDrop, playLanternRise, playButterflyFlutter } from '../lib/audio';

// 许愿池互动
export function WishingFountain({ position, wishes, onWish }: {
  position: Position;
  wishes: string[];
  onWish: (wish: string) => void;
}) {
  const [showInput, setShowInput] = useState(false);
  const [wishText, setWishText] = useState('');

  const handleSubmit = () => {
    if (wishText.trim()) {
      onWish(wishText.trim());
      playWaterDrop();
      setWishText('');
      setShowInput(false);
    }
  };

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* 可点击区域 */}
      <mesh onClick={() => setShowInput(true)}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshLambertMaterial transparent opacity={0} />
      </mesh>

      {/* 许愿输入框 */}
      {showInput && (
        <Html position={[0, 2, 0]} center>
          <div style={{
            background: 'rgba(30, 27, 46, 0.95)',
            borderRadius: 12,
            padding: '16px',
            width: 220,
            border: '1px solid #7dd3fc',
            boxShadow: '0 4px 20px rgba(125, 211, 252, 0.3)',
          }}>
            <div style={{ color: '#7dd3fc', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
              许一个愿望
            </div>
            <input
              style={{
                width: '100%', padding: '8px 10px', background: '#252236',
                border: '1px solid #444', borderRadius: 8, color: '#fff',
                fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
              value={wishText}
              onChange={(e) => setWishText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="写下你的愿望..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                style={{
                  flex: 1, padding: '6px', background: '#7dd3fc', color: '#000',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                }}
                onClick={handleSubmit}
              >
                许愿
              </button>
              <button
                style={{
                  flex: 1, padding: '6px', background: '#333', color: '#aaa',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                }}
                onClick={() => setShowInput(false)}
              >
                关闭
              </button>
            </div>
            {wishes.length > 0 && (
              <div style={{ marginTop: 8, maxHeight: 80, overflowY: 'auto' }}>
                {wishes.slice(-3).map((w, i) => (
                  <div key={i} style={{ color: '#7dd3fc', fontSize: 11, padding: '2px 0', opacity: 0.7 }}>
                    {w}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// 天灯放飞
export function LanternRelease({ position, onRelease }: {
  position: Position;
  onRelease: (message: string) => void;
}) {
  const [showInput, setShowInput] = useState(false);
  const [message, setMessage] = useState('');
  const [lanterns, setLanterns] = useState<Array<{ id: number; y: number; opacity: number }>>([]);

  const handleRelease = () => {
    if (message.trim()) {
      onRelease(message.trim());
      playLanternRise();
      const id = Date.now();
      setLanterns((prev) => [...prev, { id, y: 0, opacity: 1 }]);
      setMessage('');
      setShowInput(false);
    }
  };

  // 天灯上升动画
  useFrame((_, delta) => {
    setLanterns((prev) =>
      prev
        .map((l) => ({ ...l, y: l.y + delta * 2, opacity: l.opacity - delta * 0.3 }))
        .filter((l) => l.opacity > 0)
    );
  });

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh onClick={() => setShowInput(true)}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshLambertMaterial transparent opacity={0} />
      </mesh>

      {/* 天灯粒子 */}
      {lanterns.map((lantern) => (
        <mesh key={lantern.id} position={[0, lantern.y, 0]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial
            color="#fb923c"
            transparent
            opacity={lantern.opacity}
          />
        </mesh>
      ))}

      {showInput && (
        <Html position={[0, 2, 0]} center>
          <div style={{
            background: 'rgba(30, 27, 46, 0.95)',
            borderRadius: 12,
            padding: '16px',
            width: 200,
            border: '1px solid #fb923c',
            boxShadow: '0 4px 20px rgba(251, 146, 60, 0.3)',
          }}>
            <div style={{ color: '#fb923c', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
              放飞一盏天灯
            </div>
            <input
              style={{
                width: '100%', padding: '8px 10px', background: '#252236',
                border: '1px solid #444', borderRadius: 8, color: '#fff',
                fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRelease()}
              placeholder="写下你的寄语..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                style={{
                  flex: 1, padding: '6px', background: '#fb923c', color: '#000',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                }}
                onClick={handleRelease}
              >
                放飞
              </button>
              <button
                style={{
                  flex: 1, padding: '6px', background: '#333', color: '#aaa',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                }}
                onClick={() => setShowInput(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// 记忆树
export function MemoryTree({ position, tags, onTag }: {
  position: Position;
  tags: string[];
  onTag: (tag: string) => void;
}) {
  const [showInput, setShowInput] = useState(false);
  const [tagText, setTagText] = useState('');

  const handleSubmit = () => {
    if (tagText.trim()) {
      onTag(tagText.trim());
      setTagText('');
      setShowInput(false);
    }
  };

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh onClick={() => setShowInput(true)}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshLambertMaterial transparent opacity={0} />
      </mesh>

      {/* 记忆牌子 */}
      {tags.map((tag, i) => {
        const angle = (i / Math.max(tags.length, 1)) * Math.PI * 2;
        const radius = 1.5;
        return (
          <Html
            key={i}
            position={[Math.cos(angle) * radius, 2 + i * 0.3, Math.sin(angle) * radius]}
            center
          >
            <div style={{
              background: 'rgba(251, 191, 36, 0.9)',
              color: '#000',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 10,
              whiteSpace: 'nowrap',
              maxWidth: 80,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {tag}
            </div>
          </Html>
        );
      })}

      {showInput && (
        <Html position={[0, 3, 0]} center>
          <div style={{
            background: 'rgba(30, 27, 46, 0.95)',
            borderRadius: 12,
            padding: '16px',
            width: 200,
            border: '1px solid #fbbf24',
          }}>
            <div style={{ color: '#fbbf24', fontSize: 13, marginBottom: 8, textAlign: 'center' }}>
              挂上记忆牌
            </div>
            <input
              style={{
                width: '100%', padding: '8px 10px', background: '#252236',
                border: '1px solid #444', borderRadius: 8, color: '#fff',
                fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="写下一段记忆..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                style={{
                  flex: 1, padding: '6px', background: '#fbbf24', color: '#000',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                }}
                onClick={handleSubmit}
              >
                挂上
              </button>
              <button
                style={{
                  flex: 1, padding: '6px', background: '#333', color: '#aaa',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                }}
                onClick={() => setShowInput(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// 蝴蝶放飞粒子
export function ButterflyRelease({ position }: { position: Position }) {
  const butterflies = useRef<Array<{
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    life: number;
    wingPhase: number;
  }>>([]);
  const handleClick = useCallback(() => {
    playButterflyFlutter();
    // 生成 5-8 只蝴蝶
    const count = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      butterflies.current.push({
        pos: new THREE.Vector3(0, 0, 0),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          Math.random() * 2 + 1,
          (Math.random() - 0.5) * 2
        ),
        life: 3 + Math.random() * 2,
        wingPhase: Math.random() * Math.PI * 2,
      });
    }
  }, []);

  useFrame((_, delta) => {
    butterflies.current = butterflies.current
      .map((b) => ({
        ...b,
        pos: b.pos.clone().add(b.vel.clone().multiplyScalar(delta)),
        vel: b.vel.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * delta * 2,
          -delta * 0.5,
          (Math.random() - 0.5) * delta * 2
        )),
        life: b.life - delta,
        wingPhase: b.wingPhase + delta * 10,
      }))
      .filter((b) => b.life > 0);
  });

  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh onClick={handleClick}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshLambertMaterial transparent opacity={0} />
      </mesh>

      {butterflies.current.map((b, i) => (
        <mesh key={i} position={[b.pos.x, b.pos.y, b.pos.z]}>
          <planeGeometry args={[0.3 * Math.sin(b.wingPhase), 0.2]} />
          <meshBasicMaterial color="#e879f9" side={THREE.DoubleSide} transparent opacity={b.life / 3} />
        </mesh>
      ))}
    </group>
  );
}
