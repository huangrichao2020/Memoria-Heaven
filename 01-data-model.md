# 01 - 数据模型设计

## 模块概述

定义Memoria Heaven 的核心数据结构，包括地图、地块、逝者信息、对话历史等。所有数据设计遵循"浏览器可解析、静态可托管、易于分发"的原则。

## 内容

### 1. 地图 (Map)

一个地图代表一个独立的空间单元，由一个用户创建和维护。

```typescript
interface Map {
  // 元数据
  id: string;                    // 唯一标识，如 "user123-map1"
  version: string;               // 数据格式版本，如 "1.0.0"
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 最后更新时间戳
  
  // 所有权
  owner: {
    workerId: string;            // 所有者的 Worker ID
    workerUrl: string;           // Worker 访问地址
    publicKey: string;           // 用于验证数据签名
  };
  
  // 空间信息
  dimensions: {
    width: number;               // 地图宽度（方块数）
    height: number;              // 地图高度（方块数）
    depth: number;               // 地图深度（方块数）
  };
  
  // 地块数据
  blocks: Block[];               // 所有方块的数组
  
  // 逝者信息
  inhabitants: Inhabitant[];     // 居住在此地图的逝者
  
  // 网络拓扑
  neighbors: string[];           // 相邻地图的 ID 列表
  
  // 签名（防篡改）
  signature: string;             // 对整个地图数据的签名
}
```

**示例数据：**

```json
{
  "id": "alice-memorial-garden",
  "version": "1.0.0",
  "createdAt": 1735000000000,
  "updatedAt": 1735086400000,
  "owner": {
    "workerId": "alice-worker-2024",
    "workerUrl": "https://alice-worker-2024.workers.dev",
    "publicKey": "0x1234...abcd"
  },
  "dimensions": {
    "width": 32,
    "height": 16,
    "depth": 32
  },
  "blocks": [],
  "inhabitants": [],
  "neighbors": [
    "bob-peaceful-valley",
    "carol-sunset-hill"
  ],
  "signature": "0xabcd...5678"
}
```

### 2. 地块 (Block)

Minecraft 风格的方块，构成地图的基本单元。

```typescript
interface Block {
  // 位置
  position: {
    x: number;
    y: number;
    z: number;
  };
  
  // 类型
  type: BlockType;               // 方块类型枚举
  
  // 可选：特殊属性
  metadata?: {
    color?: string;              // 自定义颜色
    texture?: string;            // 纹理 URL
    interactive?: boolean;       // 是否可交互
    linkedInhabitant?: string;   // 关联的逝者 ID
  };
}

enum BlockType {
  AIR = 'air',
  GRASS = 'grass',
  STONE = 'stone',
  WOOD = 'wood',
  FLOWER = 'flower',
  WATER = 'water',
  MEMORIAL_STONE = 'memorial_stone',  // 纪念碑
  PORTAL = 'portal'                    // 传送门（到邻居地图）
}
```

**示例数据：**

```json
{
  "position": { "x": 16, "y": 0, "z": 16 },
  "type": "memorial_stone",
  "metadata": {
    "interactive": true,
    "linkedInhabitant": "grandma-chen"
  }
}
```

### 3. 逝者 (Inhabitant)

代表一个逝去的人或宠物，包含其人设和记忆数据。

```typescript
interface Inhabitant {
  // 基本信息
  id: string;                    // 唯一标识
  name: string;                  // 姓名
  type: 'human' | 'pet';         // 类型
  
  // 外观
  avatar?: {
    modelUrl?: string;           // 3D 模型 URL
    textureUrl?: string;         // 纹理贴图
    defaultSkin?: string;        // 默认皮肤代码
  };
  
  // 人设（用于 LLM）
  persona: {
    description: string;         // 人物描述
    personality: string[];       // 性格特征
    memories: Memory[];          // 记忆片段
    relationships: {             // 与其他人的关系
      [inhabitantId: string]: string;
    };
  };
  
  // 对话历史（本地存储，不上传）
  conversationHistory?: Message[];
  
  // 位置
  homePosition: {
    x: number;
    y: number;
    z: number;
  };
}

interface Memory {
  id: string;
  content: string;               // 记忆内容
  timestamp?: number;            // 时间（如果有）
  tags: string[];                // 标签，如 ["童年", "家庭"]
  importance: number;            // 重要性 (1-10)
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
```

**示例数据：**

```json
{
  "id": "grandma-chen",
  "name": "陈奶奶",
  "type": "human",
  "avatar": {
    "defaultSkin": "elderly-woman-01"
  },
  "persona": {
    "description": "一位慈祥的老人，喜欢讲故事和做饭",
    "personality": ["温柔", "幽默", "智慧"],
    "memories": [
      {
        "id": "mem-001",
        "content": "我记得你小时候最爱吃我做的红烧肉",
        "tags": ["美食", "童年"],
        "importance": 8
      }
    ],
    "relationships": {
      "user-tingchim": "孙子"
    }
  },
  "homePosition": { "x": 16, "y": 1, "z": 16 }
}
```

### 4. 地图索引 (MapIndex)

Worker 维护的轻量级索引，用于网络发现。

```typescript
interface MapIndex {
  // 本地地图
  ownMaps: {
    mapId: string;
    pagesUrl: string;            // Cloudflare Pages URL
    lastUpdated: number;
    inhabitantCount: number;
    isPublic: boolean;           // 是否公开可访问
  }[];
  
  // 已知的其他 Worker
  knownPeers: {
    workerId: string;
    workerUrl: string;
    lastSeen: number;
    reliability: number;         // 可靠性评分 (0-1)
  }[];
  
  // 缓存的地图
  cachedMaps: {
    mapId: string;
    sourceWorker: string;
    cachedAt: number;
    expiresAt: number;
    accessCount: number;         // 访问次数（热度）
  }[];
}
```

## 效果

1. **轻量级**：单个地图 JSON 文件通常 < 100KB，适合 CDN 分发
2. **可扩展**：通过 `neighbors` 字段连接无限多的地图
3. **离线友好**：所有数据都是静态 JSON，可以完全离线浏览
4. **隐私保护**：`conversationHistory` 只存本地，不上传到 CDN

## 设计理由

### 为什么用方块而不是自由建模？

1. **降低复杂度**：方块数据结构简单，易于序列化和传输
2. **文化共识**：Minecraft 风格被广泛接受，降低学习成本
3. **性能优化**：方块渲染可以用 instanced rendering，性能好

### 为什么 `conversationHistory` 不上传？

1. **隐私**：对话内容可能非常私密
2. **成本**：对话历史会快速增长，存储成本高
3. **个性化**：每个用户与同一个逝者的对话应该是独立的

### 为什么需要 `signature` 字段？

防止恶意 Worker 篡改其他用户的地图数据。用户用私钥签名，其他人用公钥验证。

## 上游链路

- **用户输入**：通过地图编辑器创建和修改数据
- **LLM 输出**：生成逝者的 `persona` 和 `memories`

## 下游链路

- **Cloudflare Pages**：将 Map 对象序列化为 JSON 文件托管
- **Cloudflare Worker**：读取 Map 对象，提供给其他用户
- **Three.js 渲染器**：解析 `blocks` 数组，渲染 3D 场景
- **对话系统**：使用 `Inhabitant.persona` 构建 LLM prompt

## 文件组织

```
user-map-001/
├── map.json              # 主地图文件
├── inhabitants/          # 逝者数据（可选：拆分以减小主文件大小）
│   ├── grandma-chen.json
│   └── dog-lucky.json
└── assets/               # 自定义资源
    ├── textures/
    └── models/
```

## 版本演进

**v1.0.0**（当前）：基础数据结构  
**v1.1.0**（计划）：支持动态元素（如天气、时间）  
**v2.0.0**（未来）：支持脚本化交互（如触发事件）
