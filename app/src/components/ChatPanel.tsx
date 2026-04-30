// ============================================================
// ChatPanel - Conversation interface with Digital Life
// ============================================================
import { useState, useRef, useEffect } from 'react';
import { useStore } from '../lib/store';
import type { Message } from '../lib/types';

export function ChatPanel() {
  const activeAgent = useStore((s) => s.activeAgent);
  const chatOpen = useStore((s) => s.chatOpen);
  const setChatOpen = useStore((s) => s.setChatOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history when agent changes
  useEffect(() => {
    if (activeAgent) {
      setMessages(activeAgent.getHistory());
    }
  }, [activeAgent]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (chatOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [chatOpen]);

  const sendMessage = async () => {
    if (!input.trim() || !activeAgent || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMsg, timestamp: Date.now() },
    ]);
    setIsTyping(true);

    try {
      // Use streaming for better UX
      let response = '';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', timestamp: Date.now() },
      ]);

      for await (const chunk of activeAgent.chatStream(userMsg)) {
        response += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: response,
          };
          return updated;
        });
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `错误: ${err.message}`, timestamp: Date.now() },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!chatOpen || !activeAgent) return null;

  const inhabitant = activeAgent.getInhabitant();

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.avatar}>{inhabitant.type === 'pet' ? '🐾' : '👤'}</div>
          <div>
            <div style={styles.name}>{inhabitant.name}</div>
            <div style={styles.status}>在线</div>
          </div>
        </div>
        <button style={styles.closeBtn} onClick={() => setChatOpen(false)}>✕</button>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            <div style={{ fontSize: 32 }}>💬</div>
            <div>开始与 {inhabitant.name} 对话吧</div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            ...styles.messageRow,
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              ...styles.bubble,
              ...(msg.role === 'user' ? styles.userBubble : styles.assistantBubble),
            }}>
              {msg.content || <span style={{ opacity: 0.5 }}>思考中...</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputRow}>
        <input
          ref={inputRef}
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={`对 ${inhabitant.name} 说些什么...`}
          disabled={isTyping}
        />
        <button style={styles.sendBtn} onClick={sendMessage} disabled={isTyping}>
          {isTyping ? '...' : '发送'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed', right: 0, top: 0, bottom: 0, width: 380,
    background: '#1e1b2e', borderLeft: '1px solid #333',
    display: 'flex', flexDirection: 'column', zIndex: 100,
    boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: '1px solid #333', background: '#252236',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  name: { fontWeight: 600, color: '#fff', fontSize: 15 },
  status: { fontSize: 12, color: '#4ade80' },
  closeBtn: { background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer', padding: 4 },
  messages: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', gap: 8, textAlign: 'center' },
  messageRow: { display: 'flex' },
  bubble: { maxWidth: '80%', padding: '10px 14px', borderRadius: 16, fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' },
  userBubble: { background: '#6366f1', color: '#fff', borderBottomRightRadius: 4 },
  assistantBubble: { background: '#2a2740', color: '#e2e0f0', borderBottomLeftRadius: 4 },
  inputRow: { display: 'flex', padding: '12px 16px', borderTop: '1px solid #333', gap: 8, background: '#252236' },
  input: {
    flex: 1, background: '#1e1b2e', border: '1px solid #444', borderRadius: 12,
    padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none',
  },
  sendBtn: {
    background: '#6366f1', color: '#fff', border: 'none', borderRadius: 12,
    padding: '10px 18px', fontSize: 14, cursor: 'pointer', fontWeight: 600,
  },
};
