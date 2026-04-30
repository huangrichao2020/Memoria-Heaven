// ============================================================
// App - Main entry point
// ============================================================
import { useEffect } from 'react';
import { useStore } from './lib/store';
import { VoxelWorld } from './components/VoxelWorld';
import { ChatPanel } from './components/ChatPanel';
import { Sidebar } from './components/Sidebar';
import { WelcomeScreen } from './components/WelcomeScreen';

export default function App() {
  const isLoading = useStore((s) => s.isLoading);
  const currentMap = useStore((s) => s.currentMap);
  const init = useStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  if (isLoading) {
    return (
      <div style={styles.loading}>
        <div style={{ fontSize: 32, color: '#c084fc' }}>✦</div>
        <div style={{ color: '#888', marginTop: 12 }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <Sidebar />
      <div style={styles.main}>
        {currentMap ? (
          <VoxelWorld map={currentMap} />
        ) : (
          <WelcomeScreen />
        )}
      </div>
      <ChatPanel />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#0f0c29',
  },
  main: {
    flex: 1,
    height: '100vh',
    position: 'relative',
  },
  loading: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f0c29',
  },
};
