# 02 - Worker 网络协议

## 模块概述

定义 Cloudflare Workers 之间的通信协议，实现去中心化的地图发现、路由和缓存。每个用户的 Worker 既是服务端（提供自己的地图），也是客户端（访问他人的地图），还是网络节点（帮助路由和缓存）。

## 内容

### 1. Worker 的三重角色

```typescript
// Worker 入口点
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 角色1：服务自己的地图
    if (path.startsWith('/maps/')) {
      return handleOwnMaps(request, env);
    }
    
    // 角色2：网络节点 - 发现和路由
    if (path.startsWith('/network/')) {
      return handleNetworkProtocol(request, env);
    }
    
    // 角色3：代理和缓存其他地图
    if (path.startsWith('/proxy/')) {
      return handleProxy(request, env);
    }
    
    // 健康检查
    if (path === '/ping') {
      return new Response('pong', { status: 200 });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
```

### 2. 网络协议 API

#### 2.1 注册到网络

```typescript
// POST /network/register
// 用户首次部署时，向种子节点注册
interface RegisterRequest {
  workerId: string;
  workerUrl: string;
  publicKey: string;
  maps: {
    mapId: string;
    pagesUrl: string;
    isPublic: boolean;
  }[];
}

interface RegisterResponse {
  success: boolean;
  assignedPeers: {
    workerId: string;
    workerUrl: string;
  }[];  // 分配的初始邻居节点
}

// 实现示例
async function handleRegister(request: Request, env: Env): Promise<Response> {
  const body: RegisterRequest = await request.json();
  
  // 1. 验证请求
  if (!body.workerId || !body.workerUrl) {
    return Response.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
  
  // 2. 存储到 KV
  await env.NETWORK_KV.put(
    `worker:${body.workerId}`,
    JSON.stringify({
      ...body,
      registeredAt: Date.now(),
      lastSeen: Date.now()
    }),
    { expirationTtl: 86400 * 30 }  // 30天过期
  );
  
  // 3. 选择 3-5 个活跃的 peer 作为邻居
  const allPeers = await listActivePeers(env);
  const assignedPeers = selectPeersByLatency(allPeers, 5);
  
  // 4. 通知被选中的 peer 添加新邻居
  await Promise.all(
    assignedPeers.map(peer =>
      fetch(`${peer.workerUrl}/network/add-peer`, {
        method: 'POST',
        body: JSON.stringify({
          workerId: body.workerId,
          workerUrl: body.workerUrl
        })
      }).catch(() => {}) // 忽略失败
    )
  );
  
  return Response.json({ success: true, assignedPeers });
}
```

#### 2.2 发现地图

```typescript
// GET /network/discover?query=<mapId|keyword>&hops=<number>
// 在网络中搜索地图
interface DiscoverRequest {
  query?: string;      // 可选：搜索关键词或 mapId
  hops?: number;       // 搜索深度（默认 2）
  excludeWorkers?: string[];  // 已访问的 Worker，避免循环
}

interface DiscoverResponse {
  maps: {
    mapId: string;
    pagesUrl: string;
    ownerWorker: string;
    distance: number;  // 跳数
    latency?: number;  // 延迟（毫秒）
  }[];
  nextHops: string[];  // 可以继续探索的 Worker
}

// 实现示例（Gossip 协议）
async function handleDiscover(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';
  const hops = parseInt(url.searchParams.get('hops') || '2');
  const excludeWorkers = url.searchParams.get('exclude')?.split(',') || [];
  
  const results: DiscoverResponse['maps'] = [];
  
  // 1. 搜索自己的地图
  const ownMaps = await getOwnMaps(env);
  results.push(...ownMaps
    .filter(m => !query || m.mapId.includes(query))
    .map(m => ({
      mapId: m.mapId,
      pagesUrl: m.pagesUrl,
      ownerWorker: env.WORKER_ID,
      distance: 0
    }))
  );
  
  // 2. 如果还有跳数，询问邻居
  if (hops > 0) {
    const peers = await getKnownPeers(env);
    const validPeers = peers.filter(p => !excludeWorkers.includes(p.workerId));
    
    const peerResults = await Promise.allSettled(
      validPeers.slice(0, 3).map(async peer => {
        const start = Date.now();
        const response = await fetch(
          `${peer.workerUrl}/network/discover?` +
          `query=${query}&hops=${hops - 1}&exclude=${[...excludeWorkers, env.WORKER_ID].join(',')}`,
          { signal: AbortSignal.timeout(3000) }
        );
        const data: DiscoverResponse = await response.json();
        const latency = Date.now() - start;
        
        return data.maps.map(m => ({
          ...m,
          distance: m.distance + 1,
          latency: (m.latency || 0) + latency
        }));
      })
    );
    
    peerResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      }
    });
  }
  
  // 3. 去重和排序
  const uniqueMaps = deduplicateByMapId(results);
  uniqueMaps.sort((a, b) => a.distance - b.distance || (a.latency || 0) - (b.latency || 0));
  
  return Response.json({
    maps: uniqueMaps.slice(0, 20),  // 最多返回 20 个
    nextHops: validPeers.slice(0, 5).map(p => p.workerUrl)
  });
}
```

#### 2.3 添加邻居

```typescript
// POST /network/add-peer
// 其他 Worker 请求成为邻居
interface AddPeerRequest {
  workerId: string;
  workerUrl: string;
  publicKey?: string;
}

async function handleAddPeer(request: Request, env: Env): Promise<Response> {
  const body: AddPeerRequest = await request.json();
  
  // 1. 验证 peer（可选：检查签名）
  const isValid = await verifyPeer(body, env);
  if (!isValid) {
    return Response.json({ success: false, error: 'Invalid peer' }, { status: 403 });
  }
  
  // 2. 添加到本地 peer 列表
  const peers = await getKnownPeers(env);
  if (!peers.find(p => p.workerId === body.workerId)) {
    peers.push({
      workerId: body.workerId,
      workerUrl: body.workerUrl,
      addedAt: Date.now(),
      lastSeen: Date.now(),
      reliability: 1.0
    });
    
    await env.NETWORK_KV.put('known-peers', JSON.stringify(peers));
  }
  
  return Response.json({ success: true });
}
```

#### 2.4 心跳和健康检查

```typescript
// POST /network/heartbeat
// 定期向邻居发送心跳，维护网络拓扑
interface HeartbeatRequest {
  workerId: string;
  timestamp: number;
  stats: {
    ownMapsCount: number;
    cachedMapsCount: number;
    peersCount: number;
  };
}

async function handleHeartbeat(request: Request, env: Env): Promise<Response> {
  const body: HeartbeatRequest = await request.json();
  
  // 更新 peer 的 lastSeen 时间
  const peers = await getKnownPeers(env);
  const peer = peers.find(p => p.workerId === body.workerId);
  
  if (peer) {
    peer.lastSeen = Date.now();
    peer.stats = body.stats;
    await env.NETWORK_KV.put('known-peers', JSON.stringify(peers));
  }
  
  return Response.json({ success: true, timestamp: Date.now() });
}

// 定期清理失效的 peer（通过 Cron Trigger）
export async function scheduled(event: ScheduledEvent, env: Env) {
  const peers = await getKnownPeers(env);
  const now = Date.now();
  const activePeers = peers.filter(p => now - p.lastSeen < 86400000); // 24小时内活跃
  
  await env.NETWORK_KV.put('known-peers', JSON.stringify(activePeers));
}
```

### 3. 代理和缓存

```typescript
// GET /proxy/<mapId>
// 代理访问其他 Worker 的地图，并缓存热门内容
async function handleProxy(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const mapId = url.pathname.split('/proxy/')[1];
  
  // 1. 检查本地缓存
  const cached = await env.MAP_CACHE.get(mapId);
  if (cached) {
    const cacheData = JSON.parse(cached);
    if (Date.now() - cacheData.cachedAt < 3600000) { // 1小时内有效
      return new Response(cacheData.content, {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-Cached-At': new Date(cacheData.cachedAt).toISOString()
        }
      });
    }
  }
  
  // 2. 查找地图的所有者
  const owner = await findMapOwner(mapId, env);
  if (!owner) {
    return new Response('Map not found', { status: 404 });
  }
  
  // 3. 从源 Worker 获取
  const response = await fetch(`${owner.workerUrl}/maps/${mapId}`);
  if (!response.ok) {
    return response;
  }
  
  const content = await response.text();
  
  // 4. 验证签名
  const mapData = JSON.parse(content);
  const isValid = await verifyMapSignature(mapData, owner.publicKey);
  if (!isValid) {
    return new Response('Invalid signature', { status: 403 });
  }
  
  // 5. 缓存到本地
  await env.MAP_CACHE.put(mapId, JSON.stringify({
    content,
    cachedAt: Date.now(),
    sourceWorker: owner.workerId
  }), { expirationTtl: 3600 });
  
  // 6. 更新访问统计
  await incrementAccessCount(mapId, env);
  
  return new Response(content, {
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
      'X-Source-Worker': owner.workerId
    }
  });
}

// 查找地图所有者（多策略）
async function findMapOwner(mapId: string, env: Env): Promise<{workerId: string, workerUrl: string, publicKey: string} | null> {
  // 策略1：检查本地索引
  const localIndex = await env.NETWORK_KV.get('local-map-index');
  if (localIndex) {
    const index = JSON.parse(localIndex);
    const local = index.find((m: any) => m.mapId === mapId);
    if (local) return local.owner;
  }
  
  // 策略2：询问邻居
  const peers = await getKnownPeers(env);
  for (const peer of peers.slice(0, 5)) {
    try {
      const response = await fetch(`${peer.workerUrl}/network/lookup/${mapId}`, {
        signal: AbortSignal.timeout(2000)
      });
      if (response.ok) {
        return await response.json();
      }
    } catch {}
  }
  
  // 策略3：广播查询（最后手段）
  const discoverResponse = await fetch(`${env.SEED_NODE_URL}/network/discover?query=${mapId}&hops=3`);
  if (discoverResponse.ok) {
    const data: DiscoverResponse = await discoverResponse.json();
    if (data.maps.length > 0) {
      return {
        workerId: data.maps[0].ownerWorker,
        workerUrl: data.maps[0].ownerWorker, // 需要从 workerId 解析
        publicKey: '' // 需要额外查询
      };
    }
  }
  
  return null;
}
```

## 效果

1. **自动发现**：用户无需手动配置，Worker 自动找到其他节点
2. **负载均衡**：热门地图被多个 Worker 缓存，分担流量
3. **容错性**：单个 Worker 下线不影响网络，其他节点自动路由
4. **低延迟**：通过缓存和就近访问，减少跨区域请求

## 设计理由

### 为什么用 Gossip 协议而不是 DHT？

1. **简单性**：Gossip 实现简单，适合 Worker 的无状态特性
2. **最终一致性**：地图发现不需要强一致性，延迟几秒可接受
3. **浏览器友好**：Gossip 只需 HTTP，不需要 WebRTC 等复杂协议

### 为什么限制搜索深度（hops）？

1. **防止风暴**：无限递归会导致指数级请求
2. **延迟控制**：每跳增加延迟，2-3 跳是体验和覆盖的平衡点
3. **成本控制**：Worker 有请求数限制，需要避免滥用

### 为什么需要心跳机制？

1. **拓扑维护**：及时发现失效节点，避免路由到死链接
2. **信誉系统**：根据响应速度和可靠性调整 peer 优先级
3. **网络统计**：收集全网数据，用于优化算法

## 上游链路

- **种子节点**：提供初始 peer 列表
- **用户部署脚本**：调用 `/network/register` 加入网络

## 下游链路

- **浏览器前端**：通过 Worker 访问地图数据
- **散步系统**：使用 `/network/discover` 查找邻近地图
- **监控面板**：展示网络拓扑和健康状态

## 性能优化

### 1. 缓存分层

```
L1: 浏览器 localStorage (即时)
L2: Worker KV Cache (< 100ms)
L3: 源 Worker (< 500ms)
L4: Cloudflare Pages (< 1s)
```

### 2. 请求合并

```typescript
// 批量查询多个地图，减少往返次数
// GET /network/batch-lookup?mapIds=map1,map2,map3
async function handleBatchLookup(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const mapIds = url.searchParams.get('mapIds')?.split(',') || [];
  
  const results = await Promise.all(
    mapIds.map(id => findMapOwner(id, env))
  );
  
  return Response.json(results);
}
```

### 3. 预取策略

```typescript
// 用户访问地图 A 时，预取其邻居地图的元数据
async function prefetchNeighbors(mapId: string, env: Env) {
  const map = await getMap(mapId, env);
  const neighbors = map.neighbors || [];
  
  // 后台预取（不阻塞主请求）
  ctx.waitUntil(
    Promise.all(
      neighbors.map(neighborId =>
        fetch(`${env.WORKER_URL}/proxy/${neighborId}`, {
          headers: { 'X-Prefetch': 'true' }
        })
      )
    )
  );
}
```

## 安全考虑

### 1. 防止 DDoS

```typescript
// 限流：每个 IP 每分钟最多 60 次请求
async function rateLimit(request: Request, env: Env): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `ratelimit:${ip}`;
  
  const count = await env.RATE_LIMIT_KV.get(key);
  if (count && parseInt(count) > 60) {
    return false;
  }
  
  await env.RATE_LIMIT_KV.put(key, String((parseInt(count || '0') + 1)), {
    expirationTtl: 60
  });
  
  return true;
}
```

### 2. 防止恶意节点

```typescript
// 信誉评分：根据行为调整 peer 的可信度
interface PeerReputation {
  workerId: string;
  score: number;  // 0-1
  violations: {
    type: 'timeout' | 'invalid_data' | 'rate_limit';
    timestamp: number;
  }[];
}

async function updatePeerReputation(workerId: string, violation: string, env: Env) {
  const rep = await getPeerReputation(workerId, env);
  rep.violations.push({ type: violation as any, timestamp: Date.now() });
  
  // 计算新评分
  const recentViolations = rep.violations.filter(v => Date.now() - v.timestamp < 86400000);
  rep.score = Math.max(0, 1 - recentViolations.length * 0.1);
  
  // 评分过低则移除 peer
  if (rep.score < 0.3) {
    await removePeer(workerId, env);
  }
}
```

## 监控指标

```typescript
interface NetworkMetrics {
  // 节点统计
  totalPeers: number;
  activePeers: number;
  avgPeerLatency: number;
  
  // 地图统计
  totalMaps: number;
  cachedMaps: number;
  cacheHitRate: number;
  
  // 请求统计
  requestsPerMinute: number;
  avgResponseTime: number;
  errorRate: number;
}

// GET /network/metrics
async function handleMetrics(env: Env): Promise<Response> {
  const metrics = await calculateMetrics(env);
  return Response.json(metrics);
}
```
