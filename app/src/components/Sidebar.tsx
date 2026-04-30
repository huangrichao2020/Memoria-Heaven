// ============================================================
// Sidebar - Map list, editor toolbar, inhabitant management
// 增强版：模板选择、方块分类、删除功能、情绪显示
// ============================================================
import { useState } from 'react';
import { useStore } from '../lib/store';
import type { BlockType, Inhabitant } from '../lib/types';
import { BLOCK_COLORS } from '../lib/types';
import { TEMPLATES } from '../templates';
import { MOOD_EMOJI, MOOD_LABELS } from '../lib/mood';

// 方块分类
const BLOCK_CATEGORIES = {
  '地面': [
    { type: 'grass' as BlockType, label: '草地', icon: '🌿' },
    { type: 'stone' as BlockType, label: '石头', icon: '🪨' },
    { type: 'sand' as BlockType, label: '沙子', icon: '🏖️' },
    { type: 'moss' as BlockType, label: '苔藓', icon: '🍀' },
  ],
  '植物': [
    { type: 'wood' as BlockType, label: '木头', icon: '🪵' },
    { type: 'leaves' as BlockType, label: '树叶', icon: '🍃' },
    { type: 'flower' as BlockType, label: '花', icon: '🌸' },
  ],
  '水': [
    { type: 'water' as BlockType, label: '水', icon: '💧' },
    { type: 'fountain' as BlockType, label: '喷泉', icon: '⛲' },
  ],
  '纪念': [
    { type: 'memorial_stone' as BlockType, label: '纪念碑', icon: '🗿' },
    { type: 'candle' as BlockType, label: '蜡烛', icon: '🕯️' },
    { type: 'lantern' as BlockType, label: '灯笼', icon: '🏮' },
    { type: 'book' as BlockType, label: '记忆之书', icon: '📖' },
  ],
  '装饰': [
    { type: 'bench' as BlockType, label: '长椅', icon: '💺' },
    { type: 'arch' as BlockType, label: '拱门', icon: '🏛️' },
    { type: 'butterfly' as BlockType, label: '蝴蝶', icon: '🦋' },
    { type: 'crystal' as BlockType, label: '水晶', icon: '💎' },
    { type: 'portal' as BlockType, label: '传送门', icon: '🌀' },
  ],
};

export function Sidebar() {
  const maps = useStore((s) => s.maps);
  const currentMap = useStore((s) => s.currentMap);
  const editorMode = useStore((s) => s.editorMode);
  const selectedBlock = useStore((s) => s.selectedBlock);
  const createMap = useStore((s) => s.createMap);
  const selectMap = useStore((s) => s.selectMap);
  const setEditorMode = useStore((s) => s.setEditorMode);
  const setSelectedBlock = useStore((s) => s.setSelectedBlock);
  const addInhabitant = useStore((s) => s.addInhabitant);
  const deleteMap = useStore((s) => s.deleteMap);
  const removeInhabitant = useStore((s) => s.removeInhabitant);
  const activeAgent = useStore((s) => s.activeAgent);

  const [showCreate, setShowCreate] = useState(false);
  const [showAddInhabitant, setShowAddInhabitant] = useState(false);
  const [mapName, setMapName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('garden');
  const [tab, setTab] = useState<'maps' | 'edit' | 'settings'>('maps');
  const [blockCategory, setBlockCategory] = useState('地面');

  const handleCreateMap = async () => {
    if (!mapName.trim()) return;
    await createMap(mapName.trim(), selectedTemplate);
    setMapName('');
    setShowCreate(false);
  };

  const handleDeleteMap = async (mapId: string) => {
    if (confirm('确定要删除这个地图吗？')) {
      await deleteMap(mapId);
    }
  };

  const handleAddInhabitant = async (data: { name: string; description: string; personality: string; memories: string[] }) => {
    if (!currentMap) return;
    const inhabitant: Inhabitant = {
      id: `inh-${Date.now()}`,
      name: data.name,
      type: 'human',
      persona: {
        description: data.description,
        personality: data.personality.split(/[,，、]/).map((s) => s.trim()).filter(Boolean),
        memories: data.memories.filter(Boolean).map((content, i) => ({
          id: `mem-${Date.now()}-${i}`,
          content,
          tags: [],
          importance: 7,
        })),
        relationships: {},
      },
      homePosition: { x: 16, y: 1, z: 16 },
    };
    await addInhabitant(currentMap.id, inhabitant);
    setShowAddInhabitant(false);
  };

  // 获取当前活跃 agent 的情绪
  const currentMood = activeAgent?.getMood();

  return (
    <div style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logo}>
        <span style={{ fontSize: 24 }}>✦</span>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Memoria Heaven</span>
      </div>

      {/* 情绪状态显示 */}
      {currentMood && (
        <div style={styles.moodBar}>
          <span style={{ fontSize: 16 }}>{MOOD_EMOJI[currentMood.primary]}</span>
          <span style={{ color: '#aaa', fontSize: 12 }}>{MOOD_LABELS[currentMood.primary]}</span>
          <div style={styles.moodBarInner}>
            <div style={{ ...styles.moodBarFill, width: `${currentMood.energy}%`, background: '#6366f1' }} />
          </div>
          <span style={{ color: '#666', fontSize: 10 }}>能量</span>
          <div style={styles.moodBarInner}>
            <div style={{ ...styles.moodBarFill, width: `${currentMood.warmth}%`, background: '#f472b6' }} />
          </div>
          <span style={{ color: '#666', fontSize: 10 }}>温暖</span>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        {(['maps', 'edit', 'settings'] as const).map((t) => (
          <button key={t} style={{
            ...styles.tab,
            ...(tab === t ? styles.tabActive : {}),
          }} onClick={() => setTab(t)}>
            {t === 'maps' ? '地图' : t === 'edit' ? '编辑' : '设置'}
          </button>
        ))}
      </div>

      {/* Map List */}
      {tab === 'maps' && (
        <div style={styles.content}>
          <button style={styles.createBtn} onClick={() => setShowCreate(true)}>
            + 创建新地图
          </button>

          {showCreate && (
            <div style={styles.createForm}>
              <input
                style={styles.input}
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
                placeholder="地图名称"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateMap()}
                autoFocus
              />

              {/* 模板选择 */}
              <label style={styles.label}>选择模板</label>
              <div style={styles.templateGrid}>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    style={{
                      ...styles.templateBtn,
                      ...(selectedTemplate === t.id ? styles.templateBtnActive : {}),
                    }}
                    onClick={() => setSelectedTemplate(t.id)}
                  >
                    <span style={{ fontSize: 20 }}>{t.icon}</span>
                    <span style={{ fontSize: 11, color: '#aaa' }}>{t.name}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button style={styles.confirmBtn} onClick={handleCreateMap}>创建</button>
                <button style={styles.cancelBtn} onClick={() => setShowCreate(false)}>取消</button>
              </div>
            </div>
          )}

          <div style={styles.mapList}>
            {maps.length === 0 && (
              <div style={{ color: '#666', textAlign: 'center', padding: 20 }}>
                还没有地图，创建一个吧
              </div>
            )}
            {maps.map((m) => (
              <div
                key={m.id}
                style={{
                  ...styles.mapItem,
                  ...(currentMap?.id === m.id ? styles.mapItemActive : {}),
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div onClick={() => selectMap(m.id)} style={{ flex: 1, cursor: 'pointer' }}>
                    <div style={styles.mapName}>
                      {TEMPLATES.find((t) => t.id === m.templateId)?.icon || '🗺️'} {m.name}
                    </div>
                    <div style={styles.mapMeta}>
                      {m.blocks.length} 方块 · {m.inhabitants.length} 生命 · {m.messages.length} 留言
                    </div>
                  </div>
                  <button
                    style={styles.deleteBtn}
                    onClick={(e) => { e.stopPropagation(); handleDeleteMap(m.id); }}
                    title="删除地图"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Inhabitants */}
          {currentMap && (
            <div style={{ marginTop: 16 }}>
              <div style={styles.sectionTitle}>数字生命</div>
              {currentMap.inhabitants.map((inh) => (
                <div key={inh.id} style={styles.inhabitantItem}>
                  <span>{inh.type === 'pet' ? '🐾' : '👤'}</span>
                  <span style={{ flex: 1 }}>{inh.name}</span>
                  {inh.mood && (
                    <span style={{ fontSize: 14 }}>{MOOD_EMOJI[inh.mood.primary]}</span>
                  )}
                  <button
                    style={styles.deleteBtn}
                    onClick={() => removeInhabitant(currentMap.id, inh.id)}
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                style={styles.addBtn}
                onClick={() => setShowAddInhabitant(true)}
              >
                + 添加数字生命
              </button>
            </div>
          )}
        </div>
      )}

      {/* Editor Toolbar */}
      {tab === 'edit' && (
        <div style={styles.content}>
          <div style={styles.sectionTitle}>模式</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              style={{ ...styles.modeBtn, ...(editorMode === 'view' ? styles.modeBtnActive : {}) }}
              onClick={() => setEditorMode('view')}
            >
              👁 浏览
            </button>
            <button
              style={{ ...styles.modeBtn, ...(editorMode === 'edit' ? styles.modeBtnActive : {}) }}
              onClick={() => setEditorMode('edit')}
            >
              ✏️ 编辑
            </button>
          </div>

          {editorMode === 'edit' && (
            <>
              {/* 方块分类标签 */}
              <div style={styles.categoryTabs}>
                {Object.keys(BLOCK_CATEGORIES).map((cat) => (
                  <button
                    key={cat}
                    style={{
                      ...styles.categoryTab,
                      ...(blockCategory === cat ? styles.categoryTabActive : {}),
                    }}
                    onClick={() => setBlockCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div style={styles.blockGrid}>
                {(BLOCK_CATEGORIES[blockCategory as keyof typeof BLOCK_CATEGORIES] || []).map((b) => (
                  <button
                    key={b.type}
                    style={{
                      ...styles.blockBtn,
                      background: selectedBlock === b.type ? BLOCK_COLORS[b.type] : 'transparent',
                      border: `2px solid ${BLOCK_COLORS[b.type]}`,
                      color: selectedBlock === b.type ? '#000' : '#ccc',
                    }}
                    onClick={() => setSelectedBlock(b.type)}
                    title={b.label}
                  >
                    {b.icon}
                  </button>
                ))}
              </div>
              <div style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
                左键放置 · 右键删除
              </div>
            </>
          )}
        </div>
      )}

      {/* Settings */}
      {tab === 'settings' && (
        <div style={styles.content}>
          <LLMConfigPanel />
        </div>
      )}

      {/* Add Inhabitant Modal */}
      {showAddInhabitant && currentMap && (
        <AddInhabitantModal
          onClose={() => setShowAddInhabitant(false)}
          onSubmit={handleAddInhabitant}
        />
      )}
    </div>
  );
}

// LLM Config sub-panel
function LLMConfigPanel() {
  const llmConfig = useStore((s) => s.llmConfig);
  const setLLMConfig = useStore((s) => s.setLLMConfig);

  const [provider, setProvider] = useState(llmConfig?.provider || 'ollama');
  const [model, setModel] = useState(llmConfig?.model || '');
  const [apiKey, setApiKey] = useState(llmConfig?.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(llmConfig?.baseUrl || '');
  const [status, setStatus] = useState('');

  const handleSave = async () => {
    const config = {
      provider: provider as any,
      model: model || undefined,
      apiKey: apiKey || undefined,
      baseUrl: baseUrl || undefined,
    };
    await setLLMConfig(config);
    setStatus('已保存');
    setTimeout(() => setStatus(''), 2000);
  };

  const handleTest = async () => {
    setStatus('测试中...');
    try {
      const { createLLMProvider } = await import('../lib/llm');
      const p = createLLMProvider({ provider: provider as any, model, apiKey, baseUrl });
      const ok = await p.healthCheck();
      setStatus(ok ? '✅ 连接成功' : '❌ 连接失败');
    } catch (e: any) {
      setStatus(`❌ ${e.message}`);
    }
  };

  return (
    <div>
      <div style={styles.sectionTitle}>LLM 配置</div>

      <label style={styles.label}>提供商</label>
      <select style={styles.select} value={provider} onChange={(e) => setProvider(e.target.value as 'ollama' | 'groq' | 'openai' | 'anthropic')}>
        <option value="groq">Groq (免费推荐)</option>
        <option value="ollama">Ollama (本地)</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic / OpenAI 兼容</option>
      </select>

      <label style={styles.label}>模型</label>
      <input
        style={styles.input}
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder={
          provider === 'ollama' ? 'qwen2.5:7b' :
          provider === 'groq' ? 'llama-3.1-8b-instant' :
          'gpt-4o-mini'
        }
      />

      {provider === 'groq' && (
        <div style={{ color: '#4ade80', fontSize: 12, marginBottom: 8, lineHeight: 1.5 }}>
          免费额度：30请求/分钟，14,400请求/天<br />
          推荐模型：llama-3.1-8b-instant（快速）<br />
          中文场景：qwen3-32b（更智能）
        </div>
      )}

      {provider !== 'ollama' && (
        <>
          <label style={styles.label}>API Key</label>
          <input
            style={styles.input}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === 'groq' ? 'gsk_...' : 'sk-...'}
          />
          {provider === 'groq' && (
            <div style={{ color: '#666', fontSize: 11, marginBottom: 8 }}>
              免费获取：console.groq.com/keys
            </div>
          )}
        </>
      )}

      <label style={styles.label}>
        {provider === 'ollama' ? 'Ollama 地址' : provider === 'groq' ? 'Worker 代理地址（可选）' : 'API Base URL'}
      </label>
      <input
        style={styles.input}
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        placeholder={
          provider === 'ollama' ? 'http://localhost:11434' :
          provider === 'groq' ? 'https://你的Worker.workers.dev/api' :
          'https://api.openai.com/v1'
        }
      />
      {provider === 'groq' && !baseUrl && (
        <div style={{ color: '#666', fontSize: 11, marginBottom: 8 }}>
          留空则直连 Groq API，填写 Worker 地址可隐藏 Key
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button style={styles.confirmBtn} onClick={handleSave}>保存</button>
        <button style={styles.cancelBtn} onClick={handleTest}>测试连接</button>
      </div>

      {status && <div style={{ color: '#4ade80', marginTop: 8, fontSize: 13 }}>{status}</div>}

      <div style={{ color: '#666', fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
        {provider === 'groq' ? (
          <>
            <strong>Groq 免费配置：</strong><br />
            1. 注册 console.groq.com<br />
            2. 创建 API Key<br />
            3. 粘贴到上方 API Key 输入框<br />
            4. 推荐模型: llama-3.1-8b-instant
          </>
        ) : provider === 'ollama' ? (
          <>
            <strong>Ollama 本地配置：</strong><br />
            1. 安装 Ollama: ollama.com<br />
            2. 下载模型: ollama pull qwen2.5:7b<br />
            3. 默认地址: localhost:11434
          </>
        ) : (
          <>
            <strong>OpenAI 兼容配置：</strong><br />
            1. 填写 API Key<br />
            2. 填写 API Base URL<br />
            3. 选择模型名称
          </>
        )}
      </div>
    </div>
  );
}

// Add Inhabitant Modal
function AddInhabitantModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; personality: string; memories: string[] }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [personality, setPersonality] = useState('');
  const [mem1, setMem1] = useState('');
  const [mem2, setMem2] = useState('');
  const [mem3, setMem3] = useState('');

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <h3 style={{ margin: '0 0 16px', color: '#fff' }}>创建数字生命</h3>

        <label style={styles.label}>姓名</label>
        <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：奶奶" autoFocus />

        <label style={styles.label}>描述 TA</label>
        <textarea
          style={{ ...styles.input, minHeight: 60, resize: 'vertical' as const }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="外貌、性格、爱好..."
        />

        <label style={styles.label}>性格特征（逗号分隔）</label>
        <input style={styles.input} value={personality} onChange={(e) => setPersonality(e.target.value)} placeholder="温柔, 幽默, 智慧" />

        <label style={styles.label}>重要记忆（可选）</label>
        <input style={styles.input} value={mem1} onChange={(e) => setMem1(e.target.value)} placeholder="记忆 1" />
        <input style={{ ...styles.input, marginTop: 6 }} value={mem2} onChange={(e) => setMem2(e.target.value)} placeholder="记忆 2" />
        <input style={{ ...styles.input, marginTop: 6 }} value={mem3} onChange={(e) => setMem3(e.target.value)} placeholder="记忆 3" />

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button style={styles.confirmBtn} onClick={() => {
            if (!name.trim()) return;
            onSubmit({ name: name.trim(), description, personality, memories: [mem1, mem2, mem3] });
          }}>创建</button>
          <button style={styles.cancelBtn} onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 280, height: '100vh', background: '#1a1730',
    borderRight: '1px solid #333', display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '16px 20px', borderBottom: '1px solid #333', color: '#c084fc',
  },
  moodBar: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 20px', borderBottom: '1px solid #333',
  },
  moodBarInner: {
    flex: 1, height: 4, background: '#252236', borderRadius: 2, overflow: 'hidden',
  },
  moodBarFill: {
    height: '100%', borderRadius: 2, transition: 'width 0.5s ease',
  },
  tabs: { display: 'flex', borderBottom: '1px solid #333' },
  tab: {
    flex: 1, padding: '10px 0', background: 'none', border: 'none',
    color: '#888', fontSize: 13, cursor: 'pointer', borderBottom: '2px solid transparent',
  },
  tabActive: { color: '#c084fc', borderBottomColor: '#c084fc' },
  content: { flex: 1, overflowY: 'auto', padding: '16px 20px' },
  sectionTitle: { color: '#999', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 10 },
  createBtn: {
    width: '100%', padding: '10px', background: '#6366f1', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, marginBottom: 12,
  },
  createForm: { marginBottom: 12, display: 'flex', flexDirection: 'column' as const, gap: 8 },
  input: {
    width: '100%', padding: '8px 12px', background: '#252236', border: '1px solid #444',
    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%', padding: '8px 12px', background: '#252236', border: '1px solid #444',
    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', marginBottom: 8,
  },
  label: { color: '#aaa', fontSize: 12, marginBottom: 4, display: 'block', marginTop: 8 },
  confirmBtn: {
    flex: 1, padding: '8px', background: '#6366f1', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  cancelBtn: {
    flex: 1, padding: '8px', background: '#333', color: '#aaa',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  mapList: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  mapItem: {
    padding: '10px 12px', background: '#252236', borderRadius: 8,
    border: '1px solid transparent',
  },
  mapItemActive: { borderColor: '#6366f1', background: '#2d2a45' },
  mapName: { color: '#fff', fontSize: 14, fontWeight: 500 },
  mapMeta: { color: '#666', fontSize: 12, marginTop: 2 },
  deleteBtn: {
    background: 'none', border: 'none', color: '#666', cursor: 'pointer',
    fontSize: 12, padding: '2px 6px', borderRadius: 4,
  },
  inhabitantItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px', background: '#252236', borderRadius: 8, marginBottom: 4,
    color: '#ddd', fontSize: 14,
  },
  addBtn: {
    width: '100%', padding: '8px', background: 'none', color: '#c084fc',
    border: '1px dashed #c084fc', borderRadius: 8, cursor: 'pointer', fontSize: 13, marginTop: 8,
  },
  templateGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 8,
  },
  templateBtn: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4,
    padding: '10px 8px', background: '#252236', border: '2px solid #444',
    borderRadius: 8, cursor: 'pointer',
  },
  templateBtnActive: {
    borderColor: '#c084fc', background: '#2d2a45',
  },
  categoryTabs: {
    display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' as const,
  },
  categoryTab: {
    padding: '4px 8px', background: '#252236', border: '1px solid #444',
    borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#888',
  },
  categoryTabActive: {
    background: '#6366f1', color: '#fff', borderColor: '#6366f1',
  },
  blockGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 },
  blockBtn: {
    padding: '10px', borderRadius: 8, cursor: 'pointer', fontSize: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modeBtn: {
    flex: 1, padding: '8px', background: '#252236', color: '#888',
    border: '1px solid #444', borderRadius: 8, cursor: 'pointer', fontSize: 13,
  },
  modeBtnActive: { background: '#6366f1', color: '#fff', borderColor: '#6366f1' },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  },
  modal: {
    background: '#1e1b2e', borderRadius: 16, padding: 24, width: 360,
    maxHeight: '80vh', overflowY: 'auto',
  },
};
