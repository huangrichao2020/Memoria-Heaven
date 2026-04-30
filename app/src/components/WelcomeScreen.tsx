// ============================================================
// WelcomeScreen - First-time user onboarding
// 增强版：模板预览卡片
// ============================================================
import { useState } from 'react';
import { useStore } from '../lib/store';
import { TEMPLATES } from '../templates';

export function WelcomeScreen() {
  const createMap = useStore((s) => s.createMap);
  const setLLMConfig = useStore((s) => s.setLLMConfig);
  const [step, setStep] = useState(0);
  const [mapName, setMapName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('garden');

  const handleCreate = async () => {
    if (!mapName.trim()) return;
    await createMap(mapName.trim(), selectedTemplate);
    setStep(2);
  };

  const handleQuickSetup = async () => {
    await setLLMConfig({ provider: 'ollama', model: 'qwen2.5:7b' });
    setStep(1);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {step === 0 && (
          <>
            <div style={styles.icon}>✦</div>
            <h1 style={styles.title}>Memoria Heaven</h1>
            <p style={styles.subtitle}>让记忆永存天堂</p>
            <p style={styles.desc}>
              在这里，为逝去的亲人创建一个永恒的数字空间。<br />
              通过 AI 与他们再次对话，在 3D 世界中漫步记忆花园。
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button style={styles.primaryBtn} onClick={() => setStep(1)}>
                开始创建
              </button>
              <button style={styles.secondaryBtn} onClick={handleQuickSetup}>
                快速配置
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 style={styles.stepTitle}>创建你的记忆空间</h2>
            <p style={styles.desc}>选择一个模板，为你的亲人命名</p>

            {/* 模板选择 */}
            <div style={styles.templateGrid}>
              {TEMPLATES.map((t) => (
                <div
                  key={t.id}
                  style={{
                    ...styles.templateCard,
                    ...(selectedTemplate === t.id ? styles.templateCardActive : {}),
                  }}
                  onClick={() => setSelectedTemplate(t.id)}
                >
                  <div style={{ fontSize: 32 }}>{t.icon}</div>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{t.name}</div>
                  <div style={{ color: '#888', fontSize: 12, lineHeight: 1.4 }}>{t.description}</div>
                </div>
              ))}
            </div>

            <input
              style={styles.input}
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              placeholder="例如：奶奶的花园"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button style={styles.primaryBtn} onClick={handleCreate}>
              创建
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 48 }}>
              {TEMPLATES.find((t) => t.id === selectedTemplate)?.icon || '🌸'}
            </div>
            <h2 style={styles.stepTitle}>空间已创建！</h2>
            <p style={styles.desc}>
              现在你可以：<br />
              ✏️ 编辑地图，添加方块和装饰<br />
              👤 添加数字生命<br />
              💬 与他们对话<br />
              🏮 放飞天灯、许愿、挂记忆牌
            </p>
            <p style={{ color: '#888', fontSize: 13, marginTop: 12 }}>
              提示：先在左侧面板配置 LLM，然后添加数字生命即可开始对话
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f0c29 0%, #1a1730 50%, #24243e 100%)',
  },
  card: {
    background: 'rgba(30, 27, 46, 0.9)', borderRadius: 24, padding: '48px 40px',
    maxWidth: 520, width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    border: '1px solid rgba(192, 132, 252, 0.15)',
  },
  icon: { fontSize: 48, color: '#c084fc', marginBottom: 12 },
  title: { margin: 0, fontSize: 32, fontWeight: 700, color: '#fff' },
  subtitle: { color: '#c084fc', fontSize: 16, margin: '8px 0 20px' },
  desc: { color: '#aaa', fontSize: 14, lineHeight: 1.8, margin: '0 0 24px' },
  stepTitle: { margin: '0 0 12px', fontSize: 22, color: '#fff' },
  primaryBtn: {
    background: 'linear-gradient(135deg, #6366f1, #c084fc)', color: '#fff',
    border: 'none', borderRadius: 12, padding: '12px 32px', fontSize: 16,
    cursor: 'pointer', fontWeight: 600, marginTop: 8,
  },
  secondaryBtn: {
    background: 'transparent', color: '#c084fc',
    border: '1px solid #c084fc', borderRadius: 12, padding: '12px 32px', fontSize: 16,
    cursor: 'pointer', fontWeight: 500, marginTop: 8,
  },
  input: {
    width: '100%', padding: '12px 16px', background: '#252236', border: '1px solid #444',
    borderRadius: 12, color: '#fff', fontSize: 16, outline: 'none', marginBottom: 16,
    boxSizing: 'border-box' as const, textAlign: 'center' as const,
  },
  templateGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20,
  },
  templateCard: {
    background: '#252236', border: '2px solid #444', borderRadius: 12,
    padding: '16px 12px', cursor: 'pointer', display: 'flex',
    flexDirection: 'column' as const, alignItems: 'center', gap: 6,
    transition: 'border-color 0.2s',
  },
  templateCardActive: {
    borderColor: '#c084fc', background: '#2d2a45',
  },
};
