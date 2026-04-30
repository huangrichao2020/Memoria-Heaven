# Memoria Heaven 零成本/低成本部署手册

> 目标：全部使用免费层资源部署 Memoria Heaven，个人用户零成本运行，小团队月费 < $5。

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────────┐
│                      用户浏览器                          │
│  React + Three.js + IndexedDB (本地优先)                │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
               ▼                      ▼
┌──────────────────────┐  ┌───────────────────────────────┐
│  Cloudflare Pages    │  │  LLM 服务                     │
│  静态前端托管 (免费)  │  │  方案A: Ollama 本地 (免费)     │
│  *.pages.dev         │  │  方案B: Groq 免费层            │
└──────────────────────┘  │  方案C: Gemini 免费层          │
               │          │  方案D: Workers AI (免费层)    │
               ▼          └───────────────────────────────┘
┌──────────────────────┐
│  Cloudflare Workers  │
│  API 网关 (免费层)   │
│  10万请求/天          │
└──────┬───────┬───────┘
       │       │
       ▼       ▼
┌──────────┐ ┌──────────┐
│ D1 数据库│ │ R2 存储  │
│ 500MB    │ │ 10GB     │
│ (免费)   │ │ (免费)   │
└──────────┘ └──────────┘
```

---

## 二、免费资源清单

### 2.1 前端托管：Cloudflare Pages

| 资源 | 免费额度 | 够不够？ |
|------|----------|----------|
| 构建次数 | 500次/月 | 完全够用 |
| 自定义域名 | 100个/项目 | 够用 |
| 预览部署 | 无限 | 够用 |
| 带宽 | 未标明上限 | 个人项目足够 |
| 文件数 | 20,000/站点 | 够用 |

**部署方式：**
```bash
# 1. 推送代码到 GitHub
# 2. Cloudflare Dashboard → Pages → Connect to Git
# 3. 选择仓库，设置构建命令：
#    Build command: cd app && npm install && npm run build
#    Build output: app/dist
# 4. 自动部署，每次 push 触发
```

**免费获得：** `https://你的项目.pages.dev` 域名 + 全球 CDN

---

### 2.2 后端 API：Cloudflare Workers

| 资源 | 免费额度 | 够不够？ |
|------|----------|----------|
| 请求数 | 100,000次/天 | 个人使用足够 |
| CPU 时间 | 10ms/请求 | 简单 API 够用 |
| 内存 | 128MB/实例 | 够用 |
| Worker 数量 | 100个 | 够用 |
| 环境变量 | 64个/Worker | 够用 |

**用途：**
- 代理 LLM API 请求（隐藏 API Key）
- 地图索引服务（发现其他用户的地图）
- 简单的用户认证

**示例 Worker（LLM 代理）：**
```javascript
// wrangler.toml
// name = "memoria-heaven-api"
// main = "src/index.js"
// compatibility_date = "2024-01-01"

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 代理 LLM 请求
    if (url.pathname === '/api/chat') {
      const { messages, model } = await request.json();
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.LLM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'llama-3.3-70b-versatile',
          messages,
          stream: true,
        }),
      });
      return response;
    }

    return new Response('Not Found', { status: 404 });
  },
};
```

---

### 2.3 数据库：Cloudflare D1 (SQLite)

| 资源 | 免费额度 | 够不够？ |
|------|----------|----------|
| 数据库大小 | 500MB | 约存 10,000 个地图 |
| 数据库数量 | 10个 | 够用 |
| 读写操作 | 无明确限制 | 够用 |
| 查询/请求 | 50次 | 够用 |

**用途：**
- 存储地图索引（地图 ID、名称、创建者、公开状态）
- 存储用户配置
- 存储对话历史摘要

**Schema 示例：**
```sql
-- 地图索引
CREATE TABLE maps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT,
  template_id TEXT,
  block_count INTEGER DEFAULT 0,
  inhabitant_count INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- 对话摘要（详细数据存 IndexedDB）
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  inhabitant_id TEXT NOT NULL,
  map_id TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  last_message_at INTEGER,
  summary TEXT
);

-- 创建索引
CREATE INDEX idx_maps_owner ON maps(owner_id);
CREATE INDEX idx_maps_public ON maps(is_public);
CREATE INDEX idx_conv_map ON conversations(map_id);
```

**为什么不用 D1 存完整地图数据？**
- D1 单行最大 2MB，但地图数据可能更大
- 完整地图数据存 R2（JSON 文件），D1 只存索引
- 这样 D1 的 500MB 可以存很多索引

---

### 2.4 文件存储：Cloudflare R2

| 资源 | 免费额度 | 够不够？ |
|------|----------|----------|
| 存储空间 | 10GB | 约存 100,000 个地图 |
| Class A 操作 (写) | 1,000,000次/月 | 够用 |
| Class B 操作 (读) | 10,000,000次/月 | 够用 |
| 出口带宽 | **免费（零费用）** | 无限 |

**用途：**
- 存储完整地图数据（JSON）
- 存储对话历史
- 存储用户上传的图片（未来）

**R2 的杀手级优势：零出口费用。** AWS S3 收 $0.09/GB 出口费，R2 完全免费。

**存储结构：**
```
memoria-heaven-data/
├── maps/
│   ├── {map-id}.json          # 完整地图数据
│   └── {map-id}/
│       └── conversations/
│           └── {inhabitant-id}.json  # 对话历史
└── public/
    └── templates/              # 预设模板（只读）
```

---

### 2.5 KV 缓存：Cloudflare KV

| 资源 | 免费额度 | 够不够？ |
|------|----------|----------|
| 读取 | 100,000次/天 | 够用 |
| 写入 | 1,000次/天 | 够用 |
| 存储 | 1GB | 够用 |

**用途：**
- 缓存热门地图索引
- 存储在线用户状态
- 限流计数器

---

### 2.6 LLM 服务：多种免费方案

#### 方案 A：Ollama 本地运行（推荐，完全免费）

```bash
# 安装
curl -fsSL https://ollama.com/install.sh | sh

# 下载模型（推荐）
ollama pull qwen2.5:7b        # 中文优秀，7B 参数
ollama pull llama3.1:8b        # 英文优秀
ollama pull phi3:mini           # 轻量级，适合低配机器

# 启动服务（默认 localhost:11434）
ollama serve
```

**优势：** 完全免费，无限制，隐私
**劣势：** 需要本地有 GPU 或足够 RAM

| 模型 | 大小 | 最低 RAM | 中文能力 | 推荐度 |
|------|------|----------|----------|--------|
| qwen2.5:7b | 4.7GB | 8GB | ★★★★★ | 首选 |
| llama3.1:8b | 4.7GB | 8GB | ★★★☆ | 英文场景 |
| phi3:mini | 2.3GB | 4GB | ★★☆ | 低配机器 |
| gemma2:2b | 1.6GB | 3GB | ★★☆ | 极低配 |

#### 方案 B：Groq 免费层（推荐，云端免费）

| 资源 | 免费额度 |
|------|----------|
| 请求/分钟 | 30 |
| 请求/天 | 14,400 |
| Tokens/分钟 | 6,000 |
| 模型 | Llama 3.3 70B, Mixtral, Gemma |

**注册：** https://console.groq.com
**优势：** 极快推理（LPU 芯片），免费，无需信用卡
**劣势：** 限流，不支持中文微调模型

#### 方案 C：Google Gemini 免费层

| 资源 | 免费额度 |
|------|----------|
| Gemini 1.5 Flash | 15 RPM, 1M tokens/天 |
| Gemini 1.5 Pro | 2 RPM, 32K tokens/天 |

**注册：** https://aistudio.google.com
**优势：** 多模态（支持图片），免费
**劣势：** 限流较严

#### 方案 D：Cloudflare Workers AI

| 资源 | 免费额度 |
|------|----------|
| Neuron 请求 | 10,000/天 |
| 模型 | Llama 3, Phi, Gemma, Mistral |

**优势：** 与 Workers 无缝集成，无需外部 API
**劣势：** 模型选择较少，中文能力一般

#### 方案 E：OpenRouter 免费模型

提供多个免费模型（Llama, Gemma 等），注册即送 $1 信用。

---

## 三、完整部署步骤

### 第一步：准备 Cloudflare 账号

1. 注册 https://dash.cloudflare.com （免费）
2. 获取 Account ID：Dashboard → 右侧栏

### 第二步：创建 D1 数据库

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录
wrangler login

# 创建 D1 数据库
wrangler d1 create memoria-heaven-db
# 记下输出的 database_id

# 执行 Schema
wrangler d1 execute memoria-heaven-db --file=./schema.sql
```

### 第三步：创建 R2 存储桶

```bash
# 创建 R2 Bucket
wrangler r2 bucket create memoria-heaven-data
```

### 第四步：部署 Worker

```bash
cd worker/
wrangler secret put LLM_API_KEY  # 输入 Groq API Key
wrangler deploy
```

### 第五步：部署前端

```bash
cd app/
npm install
npm run build

# 方式1：通过 Git 自动部署（推荐）
# 在 Cloudflare Dashboard → Pages → Connect to Git

# 方式2：手动部署
wrangler pages deploy dist --project-name=memoria-heaven
```

### 第六步：配置自定义域名（可选）

```
Cloudflare Dashboard → Pages → 你的项目 → Custom domains
添加域名，按提示配置 DNS
```

---

## 四、成本对比

### 方案一：零成本（本地 LLM）

| 组件 | 服务 | 费用 |
|------|------|------|
| 前端 | Cloudflare Pages | $0 |
| API | Cloudflare Workers | $0 |
| 数据库 | Cloudflare D1 | $0 |
| 存储 | Cloudflare R2 | $0 |
| 缓存 | Cloudflare KV | $0 |
| LLM | Ollama 本地 | $0 |
| **总计** | | **$0/月** |

**要求：** 本地有 8GB+ RAM 的电脑

### 方案二：极低成本（云端 LLM）

| 组件 | 服务 | 费用 |
|------|------|------|
| 前端 | Cloudflare Pages | $0 |
| API | Cloudflare Workers | $0 |
| 数据库 | Cloudflare D1 | $0 |
| 存储 | Cloudflare R2 | $0 |
| 缓存 | Cloudflare KV | $0 |
| LLM | Groq 免费层 | $0 |
| **总计** | | **$0/月** |

**限制：** 每天约 14,400 次对话请求

### 方案三：低成本扩展

| 组件 | 服务 | 费用 |
|------|------|------|
| 前端 | Cloudflare Pages | $0 |
| API | Cloudflare Workers Paid | $5/月 |
| 数据库 | Cloudflare D1 | $0 |
| 存储 | Cloudflare R2 | $0 |
| LLM | Groq 付费 | ~$2-5/月 |
| **总计** | | **~$7-10/月** |

**解锁：** 无限请求，更高 LLM 限额

---

## 五、与 Supabase 对比

| 维度 | Cloudflare 全家桶 | Supabase 免费层 |
|------|-------------------|-----------------|
| 数据库 | D1: 500MB | PostgreSQL: 500MB |
| 存储 | R2: 10GB, 零出口费 | Storage: 1GB |
| API | Workers: 10万/天 | 无限 API 请求 |
| 带宽 | 未标明上限 | 5GB/月 |
| CDN | 全球边缘网络 | 基础 CDN |
| 项目数 | 100个 Worker | 2个项目 |
| 休眠 | 不休眠 | 1周不活跃休眠 |
| **推荐度** | ★★★★★ | ★★★☆ |

**结论：Cloudflare 全家桶更适合 Memoria Heaven**
- R2 零出口费是杀手级优势（3D 地图数据较大）
- 不会休眠（Supabase 免费层 1 周不活跃会暂停）
- 项目数量更多
- 全球 CDN 更快

---

## 六、用户自带资源模式

Memoria Heaven 的核心理念：**用户自带资源，平台只提供索引。**

```
用户 A 的资源：
├── 自己的 Cloudflare 账号（部署 Worker + Pages）
├── 自己的 LLM API Key（Groq/Ollama/OpenAI）
└── 自己的域名（可选）

平台只维护：
├── GitHub 仓库（开源代码）
├── Twitter 账号（社区）
└── 全局索引服务（发现其他用户的地图）
```

**这样做的好处：**
1. 平台零运营成本
2. 用户数据完全自主
3. 没有单点故障
4. 符合去中心化精神

---

## 七、快速启动脚本

```bash
#!/bin/bash
# Memoria Heaven 一键部署脚本

echo "✦ Memoria Heaven 部署向导"

# 1. 检查依赖
command -v node >/dev/null || { echo "请先安装 Node.js"; exit 1; }
command -v wrangler >/dev/null || npm install -g wrangler

# 2. 登录 Cloudflare
wrangler login

# 3. 创建资源
echo "创建 D1 数据库..."
wrangler d1 create memoria-heaven-db

echo "创建 R2 存储桶..."
wrangler r2 bucket create memoria-heaven-data

# 4. 部署 Worker
echo "部署 API Worker..."
cd worker && npm install && wrangler deploy

# 5. 部署前端
echo "构建前端..."
cd ../app && npm install && npm run build

echo "部署到 Cloudflare Pages..."
wrangler pages deploy dist --project-name=memoria-heaven

echo "✦ 部署完成！"
echo "前端地址: https://memoria-heaven.pages.dev"
```

---

## 八、免费 LLM 配置指南

### Groq（推荐云端方案）

1. 访问 https://console.groq.com 注册
2. 创建 API Key
3. 在 Memoria Heaven 设置中：
   - 提供商：OpenAI 兼容
   - API Base URL：`https://api.groq.com/openai/v1`
   - API Key：你的 Groq Key
   - 模型：`llama-3.3-70b-versatile`

### Ollama（推荐本地方案）

1. 安装 Ollama：`curl -fsSL https://ollama.com/install.sh | sh`
2. 下载模型：`ollama pull qwen2.5:7b`
3. 在 Memoria Heaven 设置中：
   - 提供商：Ollama
   - 地址：`http://localhost:11434`
   - 模型：`qwen2.5:7b`

### Cloudflare Workers AI

1. 在 Worker 中使用：
```javascript
const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
  messages: [{ role: 'user', content: '你好' }],
});
```
2. 免费 10,000 请求/天

---

## 九、监控与运维

### Cloudflare Analytics（免费）

```
Dashboard → Workers & Pages → 你的项目 → Analytics
查看：请求数、错误率、CPU 时间、带宽
```

### 限流策略

```javascript
// Worker 限流示例
const RATE_LIMIT = {
  window: 60,      // 60 秒窗口
  maxRequests: 10,  // 最多 10 次请求
};

async function checkRateLimit(env, ip) {
  const key = `rate:${ip}`;
  const current = await env.KV.get(key);
  if (current && parseInt(current) >= RATE_LIMIT.maxRequests) {
    return false;
  }
  await env.KV.put(key, (parseInt(current || '0') + 1).toString(), {
    expirationTtl: RATE_LIMIT.window,
  });
  return true;
}
```

---

## 十、总结

| 场景 | 推荐方案 | 月费 |
|------|----------|------|
| 个人使用，有本地 GPU | Cloudflare + Ollama | $0 |
| 个人使用，无 GPU | Cloudflare + Groq | $0 |
| 小团队，需要稳定 | Cloudflare Paid + Groq | ~$10 |
| 大量用户 | Cloudflare Paid + OpenAI | ~$50+ |

**核心原则：**
1. 数据存在用户侧（IndexedDB + R2）
2. LLM 用户自带（Ollama/Groq/自选）
3. 平台只提供索引和发现
4. 全部使用免费层即可运行
