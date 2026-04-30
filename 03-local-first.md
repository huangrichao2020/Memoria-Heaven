# 03 - 本地优先架构

## 模块概述

实现"本地优先"的数据同步策略，确保用户编辑地图时获得即时响应，同时在后台自动同步到 Cloudflare Pages。这是用户体验的核心：编辑操作必须是即时的，不能等待网络请求。

## 内容

### 1. 数据流向

```
用户编辑
   ↓
IndexedDB (即时写入，0-10ms)
   ↓
Service Worker (后台同步)
   ↓
Cloudflare Worker API (推送更新)
   ↓
Cloudflare Pages (静态部署，1-5分钟)
   ↓
全球 CDN (其他用户可见)
```

### 2. 本地存储层

```typescript
// 使用 IndexedDB 存储地图数据
class LocalMapStorage {
  private db: IDBDatabase;
  
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('memoria-heaven', 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 地图数据表
        if (!db.objectStoreNames.contains('maps')) {
          const mapStore = db.createObjectStore('maps', { keyPath: 'id' });
          mapStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        
        // 对话历史表
        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convStore.createIndex('inhabitantId', 'inhabitantId', { unique: false });
          convStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        // 同步队列表
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('status', 'status', { unique: false });
        }
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  // 保存地图（即时）
  async saveMap(map: Map): Promise<void> {
    const tx = this.db.transaction(['maps', 'syncQueue'], 'readwrite');
    
    // 1. 更新本地数据
    map.updatedAt = Date.now();
    await tx.objectStore('maps').put(map);
    
    // 2. 添加到同步队列
    await tx.objectStore('syncQueue').add({
      type: 'map-update',
      mapId: map.id,
      data: map,
      status: 'pending',
      createdAt: Date.now(),
      retries: 0
    });
    
    await tx.done;
  }
  
  // 读取地图（优先本地）
  async getMap(mapId: string): Promise<Map | null> {
    const tx = this.db.transaction('maps', 'readonly');
    const map = await tx.objectStore('maps').get(mapId);
    return map || null;
  }
  
  // 保存对话历史（仅本地，不同步）
  async saveConversation(inhabitantId: string, messages: Message[]): Promise<void> {
    const tx = this.db.transaction('conversations', 'readwrite');
    await tx.objectStore('conversations').put({
      id: `${inhabitantId}-${Date.now()}`,
      inhabitantId,
      messages,
      timestamp: Date.now()
    });
  }
  
  // 获取对话历史
  async getConversations(inhabitantId: string): Promise<Message[]> {
    const tx = this.db.transaction('conversations', 'readonly');
    const index = tx.objectStore('conversations').index('inhabitantId');
    const conversations = await index.getAll(inhabitantId);
    
    // 合并所有对话
    return conversations.flatMap(c => c.messages);
  }
}
```

### 3. Service Worker 同步

```typescript
// service-worker.ts
// 后台同步地图数据到 Cloudflare

// 注册后台同步
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-maps') {
    event.waitUntil(syncPendingMaps());
  }
});

async function syncPendingMaps() {
  const db = await openDB();
  const tx = db.transaction('syncQueue', 'readonly');
  const pending = await tx.objectStore('syncQueue')
    .index('status')
    .getAll('pending');
  
  for (const item of pending) {
    try {
      await syncSingleMap(item);
      
      // 标记为已完成
      const updateTx = db.transaction('syncQueue', 'readwrite');
      await updateTx.objectStore('syncQueue').put({
        ...item,
        status: 'completed',
        completedAt: Date.now()
      });
    } catch (error) {
      // 重试逻辑
      if (item.retries < 3) {
        const updateTx = db.transaction('syncQueue', 'readwrite');
        await updateTx.objectStore('syncQueue').put({
          ...item,
          retries: item.retries + 1,
          lastError: error.message
        });
      } else {
        // 标记为失败
        const updateTx = db.transaction('syncQueue', 'readwrite');
        await updateTx.objectStore('syncQueue').put({
          ...item,
          status: 'failed',
          failedAt: Date.now()
        });
      }
    }
  }
}

async function syncSingleMap(item: SyncQueueItem) {
  const map = item.data;
  
  // 1. 签名地图数据
  const signature = await signMapData(map);
  map.signature = signature;
  
  // 2. 推送到 Worker
  const response = await fetch(`${WORKER_URL}/maps/${map.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(map)
  });
  
  if (!response.ok) {
    throw new Error(`Sync failed: ${response.statusText}`);
  }
  
  // 3. Worker 会自动触发 Pages 部署
  console.log(`Map ${map.id} synced successfully`);
}

// 拦截地图请求，优先返回本地数据
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);
  
  // 拦截自己的地图请求
  if (url.pathname.startsWith('/maps/') && url.hostname === self.location.hostname) {
    event.respondWith(handleMapRequest(event.request));
  }
});

async function handleMapRequest(request: Request): Promise<Response> {
  const mapId = new URL(request.url).pathname.split('/maps/')[1];
  
  // 1. 尝试从 IndexedDB 读取
  const db = await openDB();
  const tx = db.transaction('maps', 'readonly');
  const localMap = await tx.objectStore('maps').get(mapId);
  
  if (localMap) {
    // 检查是否是自己的地图
    if (localMap.owner.workerId === CURRENT_WORKER_ID) {
      return new Response(JSON.stringify(localMap), {
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'local',
          'X-Updated-At': new Date(localMap.updatedAt).toISOString()
        }
      });
    }
  }
  
  // 2. 不是自己的地图，或本地没有，走网络
  try {
    const response = await fetch(request);
    
    // 缓存到本地（如果是公开地图）
    if (response.ok) {
      const mapData = await response.clone().json();
      if (mapData.isPublic !== false) {
        const cacheTx = db.transaction('maps', 'readwrite');
        await cacheTx.objectStore('maps').put(mapData);
      }
    }
    
    return response;
  } catch (error) {
    // 3. 网络失败，返回本地缓存（如果有）
    if (localMap) {
      return new Response(JSON.stringify(localMap), {
        headers: {
          'Content-Type': 'application/json',
          'X-Source': 'local-fallback',
          'X-Warning': 'Network unavailable, serving cached version'
        }
      });
    }
    
    return new Response('Map not found', { status: 404 });
  }
}
```

### 4. Worker 端接收更新

```typescript
// Cloudflare Worker
// PUT /maps/:mapId
async function handleMapUpdate(request: Request, env: Env): Promise<Response> {
  const mapId = request.url.split('/maps/')[1];
  const mapData: Map = await request.json();
  
  // 1. 验证所有权
  const auth = request.headers.get('Authorization');
  const isOwner = await verifyOwnership(auth, mapData.owner.workerId, env);
  if (!isOwner) {
    return new Response('Unauthorized', { status: 403 });
  }
  
  // 2. 验证签名
  const isValidSignature = await verifyMapSignature(mapData, mapData.owner.publicKey);
  if (!isValidSignature) {
    return new Response('Invalid signature', { status: 400 });
  }
  
  // 3. 保存到 KV（临时存储）
  await env.MAPS_KV.put(
    `map:${mapId}`,
    JSON.stringify(mapData),
    { expirationTtl: 86400 }  // 24小时
  );
  
  // 4. 触发 Pages 部署
  await triggerPagesDeployment(mapId, mapData, env);
  
  // 5. 通知邻居节点刷新缓存
  await notifyPeersToInvalidateCache(mapId, env);
  
  return Response.json({
    success: true,
    mapId,
    updatedAt: mapData.updatedAt,
    deploymentStatus: 'pending'
  });
}

// 触发 Cloudflare Pages 部署
async function triggerPagesDeployment(mapId: string, mapData: Map, env: Env) {
  // 方案1：使用 Cloudflare API 直接部署
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/pages/projects/${env.PAGES_PROJECT_NAME}/deployments`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch: 'main',
        // 直接上传文件内容
        files: {
          [`maps/${mapId}.json`]: JSON.stringify(mapData, null, 2)
        }
      })
    }
  );
  
  if (!response.ok) {
    throw new Error(`Pages deployment failed: ${await response.text()}`);
  }
  
  const result = await response.json();
  console.log(`Pages deployment triggered: ${result.id}`);
  
  // 方案2：通过 GitHub Actions（如果使用 Git 集成）
  // await triggerGitHubAction(mapId, mapData, env);
}
```

### 5. 冲突解决

```typescript
// 处理离线编辑后的冲突
interface ConflictResolution {
  strategy: 'local-wins' | 'remote-wins' | 'merge' | 'manual';
}

async function resolveConflict(
  localMap: Map,
  remoteMap: Map,
  strategy: ConflictResolution['strategy']
): Promise<Map> {
  
  if (strategy === 'local-wins') {
    // 本地版本优先（默认策略）
    return localMap;
  }
  
  if (strategy === 'remote-wins') {
    // 远程版本优先
    return remoteMap;
  }
  
  if (strategy === 'merge') {
    // 智能合并（基于时间戳）
    const merged: Map = { ...remoteMap };
    
    // 合并 blocks：保留最新的修改
    const blockMap = new Map<string, Block>();
    
    remoteMap.blocks.forEach(block => {
      const key = `${block.position.x},${block.position.y},${block.position.z}`;
      blockMap.set(key, block);
    });
    
    localMap.blocks.forEach(block => {
      const key = `${block.position.x},${block.position.y},${block.position.z}`;
      // 如果本地版本更新，覆盖远程版本
      if (localMap.updatedAt > remoteMap.updatedAt) {
        blockMap.set(key, block);
      }
    });
    
    merged.blocks = Array.from(blockMap.values());
    merged.updatedAt = Math.max(localMap.updatedAt, remoteMap.updatedAt);
    
    return merged;
  }
  
  // manual: 返回两个版本，让用户选择
  throw new Error('Manual conflict resolution required');
}

// 在 Service Worker 中检测冲突
async function syncWithConflictDetection(localMap: Map) {
  // 1. 获取远程版本
  const response = await fetch(`${WORKER_URL}/maps/${localMap.id}`);
  const remoteMap: Map = await response.json();
  
  // 2. 检查是否有冲突
  if (remoteMap.updatedAt > localMap.updatedAt) {
    console.warn('Conflict detected:', {
      local: new Date(localMap.updatedAt),
      remote: new Date(remoteMap.updatedAt)
    });
    
    // 3. 自动合并
    const merged = await resolveConflict(localMap, remoteMap, 'merge');
    
    // 4. 保存合并结果
    const db = await openDB();
    const tx = db.transaction('maps', 'readwrite');
    await tx.objectStore('maps').put(merged);
    
    // 5. 推送合并结果
    await syncSingleMap({ data: merged, type: 'map-update', mapId: merged.id });
  } else {
    // 无冲突，直接推送
    await syncSingleMap({ data: localMap, type: 'map-update', mapId: localMap.id });
  }
}
```

### 6. 离线支持

```typescript
// 检测网络状态
class NetworkMonitor {
  private isOnline: boolean = navigator.onLine;
  private listeners: ((online: boolean) => void)[] = [];
  
  constructor() {
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () => this.setOnline(false));
  }
  
  private setOnline(online: boolean) {
    this.isOnline = online;
    this.listeners.forEach(fn => fn(online));
    
    if (online) {
      // 网络恢复，触发同步
      this.triggerSync();
    }
  }
  
  private async triggerSync() {
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-maps');
    }
  }
  
  onStatusChange(callback: (online: boolean) => void) {
    this.listeners.push(callback);
  }
  
  getStatus(): boolean {
    return this.isOnline;
  }
}

// 在 UI 中显示同步状态
class SyncStatusIndicator {
  private element: HTMLElement;
  
  constructor() {
    this.element = document.getElementById('sync-status')!;
    this.updateUI('synced');
  }
  
  async checkSyncStatus() {
    const db = await openDB();
    const tx = db.transaction('syncQueue', 'readonly');
    const pending = await tx.objectStore('syncQueue')
      .index('status')
      .count('pending');
    
    if (pending > 0) {
      this.updateUI('pending', pending);
    } else {
      this.updateUI('synced');
    }
  }
  
  private updateUI(status: 'synced' | 'pending' | 'offline', count?: number) {
    switch (status) {
      case 'synced':
        this.element.textContent = '✓ 已同步';
        this.element.className = 'status-synced';
        break;
      case 'pending':
        this.element.textContent = `⟳ 同步中 (${count} 项)`;
        this.element.className = 'status-pending';
        break;
      case 'offline':
        this.element.textContent = '⚠ 离线模式';
        this.element.className = 'status-offline';
        break;
    }
  }
}
```

## 效果

1. **即时响应**：用户编辑地图时，UI 立即更新（< 10ms）
2. **离线可用**：没有网络时仍可编辑，恢复后自动同步
3. **数据安全**：本地有完整副本，不依赖云端
4. **渐进增强**：网络好时自动同步，网络差时降级到本地

## 设计理由

### 为什么用 IndexedDB 而不是 localStorage？

1. **容量**：localStorage 只有 5-10MB，IndexedDB 可达数百 MB
2. **性能**：IndexedDB 支持索引和事务，查询更快
3. **异步**：localStorage 是同步 API，会阻塞主线程

### 为什么需要同步队列？

1. **可靠性**：网络失败时不丢失操作，可以重试
2. **顺序性**：保证操作按顺序执行
3. **可观测**：用户可以看到哪些操作还未同步

### 为什么对话历史不同步？

1. **隐私**：对话内容非常私密，不应上传
2. **个性化**：每个用户与同一逝者的对话应该独立
3. **成本**：对话历史增长快，存储成本高

## 上游链路

- **地图编辑器**：调用 `LocalMapStorage.saveMap()` 保存编辑
- **对话系统**：调用 `LocalMapStorage.saveConversation()` 保存对话

## 下游链路

- **Service Worker**：从同步队列读取待同步项
- **Cloudflare Worker**：接收同步请求，触发 Pages 部署
- **Three.js 渲染器**：从 IndexedDB 读取地图数据渲染

## 性能指标

```typescript
interface PerformanceMetrics {
  // 本地操作
  localWriteLatency: number;      // 目标: < 10ms
  localReadLatency: number;       // 目标: < 5ms
  
  // 同步操作
  syncLatency: number;            // 目标: < 2s
  syncSuccessRate: number;        // 目标: > 99%
  
  // 存储
  indexedDBSize: number;          // 当前使用量
  syncQueueLength: number;        // 待同步项数量
}

// 监控和上报
async function collectMetrics(): Promise<PerformanceMetrics> {
  const db = await openDB();
  
  // 测量写入延迟
  const writeStart = performance.now();
  await db.transaction('maps', 'readwrite')
    .objectStore('maps')
    .put({ id: 'test', data: 'test' });
  const localWriteLatency = performance.now() - writeStart;
  
  // 统计同步队列
  const tx = db.transaction('syncQueue', 'readonly');
  const syncQueueLength = await tx.objectStore('syncQueue').count();
  
  return {
    localWriteLatency,
    localReadLatency: 0, // 类似测量
    syncLatency: 0,
    syncSuccessRate: 0,
    indexedDBSize: 0,
    syncQueueLength
  };
}
```

## 故障恢复

```typescript
// 处理各种异常情况
class SyncRecovery {
  // 场景1：IndexedDB 损坏
  async recoverFromCorruptedDB() {
    try {
      await indexedDB.deleteDatabase('memoria-heaven');
      console.log('Corrupted DB deleted, reinitializing...');
      
      // 从 CDN 重新下载自己的地图
      const maps = await this.fetchOwnMapsFromCDN();
      const storage = new LocalMapStorage();
      await storage.init();
      
      for (const map of maps) {
        await storage.saveMap(map);
      }
    } catch (error) {
      console.error('Recovery failed:', error);
      alert('数据恢复失败，请联系支持');
    }
  }
  
  // 场景2：同步队列堆积
  async clearStaleSyncQueue() {
    const db = await openDB();
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    
    // 删除超过 7 天的失败项
    const cursor = await store.openCursor();
    while (cursor) {
      const item = cursor.value;
      if (item.status === 'failed' && Date.now() - item.createdAt > 7 * 86400000) {
        await cursor.delete();
      }
      await cursor.continue();
    }
  }
  
  // 场景3：版本不兼容
  async migrateDataFormat(oldVersion: string, newVersion: string) {
    console.log(`Migrating data from ${oldVersion} to ${newVersion}`);
    
    const db = await openDB();
    const tx = db.transaction('maps', 'readwrite');
    const store = tx.objectStore('maps');
    
    const cursor = await store.openCursor();
    while (cursor) {
      const map = cursor.value;
      const migrated = await this.migrateMap(map, oldVersion, newVersion);
      await cursor.update(migrated);
      await cursor.continue();
    }
  }
}
```
