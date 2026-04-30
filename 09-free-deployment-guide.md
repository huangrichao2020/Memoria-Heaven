# Memoria Heaven 零成本部署手册

> **核心方案：Cloudflare 全家桶 + Groq 免费 LLM**
> 个人用户零成本运行，无需信用卡。

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
│  Cloudflare Pages    │  │  Groq 免费 API                │
│  前端托管 (免费)      │  │  LLM 推理 (免费)              │
│  *.pages.dev         │  │  30请求/分钟, 14,400/天        │
└──────────────────────┘  └───────────────────────────────┘
               │
               ▼
┌──────────────────────┐
│  Cloudflare Workers  │
│  API 网关 (免费)     │
│  10万请求/天          │
│  代理 Groq 隐藏 Key  │
└──────┬───────┬───────┘
       │       │
       ▼       ▼
┌──────────┐ ┌──────────┐
│ D1 数据库│ │ R2 存储  │
│ 500MB    │ │ 10GB     │
│ 地图索引 │ │ 完整数据 │
│ (免费)   │ │ 零出口费 │
└──────────┘ └──────────┘
```

**为什么选这个组合？**
- Cloudflare 免费层额度充足，不休眠
- R2 零出口费（3D 地图数据较大，这是关键）
- Groq 推理速度极快（LPU 芯片），免费无需信用卡
- Worker 代理隐藏 Groq API Key，安全

---

## 二、资源清单

| 组件 | 服务 | 免费额度 | 用途 |
|------|------|----------|------|
| 前端 | Cloudflare Pages | 无限带宽, 500构建/月 | 托管 React 应用 |
| API | Cloudflare Workers | 10万请求/天 | LLM 代理 + 地图索引 |
| 数据库 | Cloudflare D1 | 500MB SQLite | 地图索引、用户配置 |
| 存储 | Cloudflare R2 | 10GB, 零出口费 | 完整地图数据、对话历史 |
| 缓存 | Cloudflare KV | 10万读/天 | 热门地图缓存 |
| LLM | Groq | 14,400请求/天 | AI 对话推理 |
| **总计** | | | **$0/月** |

---

## 三、Groq 免费模型推荐

| 模型 | 速度 | 每天请求 | 中文能力 | 推荐场景 |
|------|------|----------|----------|----------|
| llama-3.1-8b-instant | 840 TPS | 14,400 | ★★★ | 日常对话（默认） |
| qwen3-32b | 662 TPS | 1,000 | ★★★★★ | 中文深度对话 |
| llama-3.3-70b-versatile | 394 TPS | 1,000 | ★★★★ | 复杂推理 |

**注册获取 API Key：** https://console.groq.com/keys

---

## 四、部署步骤

### 4.1 准备工作

```bash
# 1. 注册 Cloudflare（免费）
#    https://dash.cloudflare.com

# 2. 注册 Groq（免费）
#    https://console.groq.com
#    创建 API Key（格式：gsk_...）

# 3. 安装 Wrangler CLI
npm install -g wrangler

# 4. 登录 Cloudflare
wrangler login
```

### 4.2 创建 Cloudflare 资源

```bash
# 创建 D1 数据库
wrangler d1 create memoria-heaven-db
# 记下输出的 database_id

# 创建 R2 存储桶
wrangler r2 bucket create memoria-heaven-data

# 创建 KV 命名空间
wrangler kv namespace create CACHE
# 记下输出的 id
```

### 4.3 配置 Worker

```bash
cd worker/

# 编辑 wrangler.toml，填入：
# - database_id（D1 创建时输出的）
# - KV namespace id

# 设置 Groq API Key（加密存储）
wrangler secret put GROQ_API_KEY
# 输入你的 Groq API Key（gsk_...）

# 初始化数据库
npm run db:init

# 部署 Worker
npm run deploy
# 记下输出的 Worker URL：https://memoria-heaven-api.你的子域.workers.dev
```

### 4.4 部署前端

```bash
cd app/

# 方式一：Git 自动部署（推荐）
# 1. 推送代码到 GitHub
# 2. Cloudflare Dashboard → Pages → Create a project → Connect to Git
# 3. 选择仓库
# 4. 设置：
#    - Build command: cd app && npm install && npm run build
#    - Build output directory: app/dist
# 5. 保存并部署

# 方式二：手动部署
npm install && npm run build
wrangler pages deploy dist --project-name=memoria-heaven
```

### 4.5 配置应用

打开 https://memoria-heaven.pages.dev：

1. 点击"快速配置"（自动设置 Groq）
2. 或手动配置：
   - 提供商：Groq (免费推荐)
   - API Key：你的 Groq Key
   - 模型：llama-3.1-8b-instant
3. 创建地图，添加数字生命，开始对话

---

## 五、Worker 代码说明

Worker 提供以下 API：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/chat` | POST | LLM 对话（代理 Groq） |
| `/api/chat/stream` | POST | LLM 流式对话 |
| `/api/maps` | GET | 获取公开地图列表 |
| `/api/maps` | POST | 发布地图索引 |
| `/api/maps/:id` | GET | 获取完整地图数据 |
| `/api/config` | GET/POST | 用户配置 |
| `/api/health` | GET | 健康检查 |

**安全设计：**
- Groq API Key 存储在 Worker 的加密 secrets 中
- 前端不暴露任何 API Key
- CORS 限制允许的域名
- D1 存索引，R2 存完整数据（分离）

---

## 六、数据存储策略

```
IndexedDB（浏览器本地）
├── 完整地图数据（即时读写，离线可用）
├── 对话历史
└── LLM 配置

Cloudflare D1（索引服务）
├── 地图 ID、名称、模板、方块数
├── 公开/私有状态
└── 创建/更新时间

Cloudflare R2（完整数据备份）
├── maps/{id}.json（完整地图）
├── users/{id}/config.json（用户配置）
└── conversations/{id}.json（对话备份）
```

**为什么这样分层？**
- IndexedDB 保证即时响应和离线使用
- D1 轻量索引支持快速搜索和分页
- R2 存完整数据，支持跨设备同步
- R2 零出口费，适合大量数据读取

---

## 七、扩展方案

### 当免费额度不够时

| 瓶颈 | 解决方案 | 费用 |
|------|----------|------|
| Workers 请求超 10万/天 | Workers Paid | $5/月 |
| Groq 请求超限 | 多个免费账号轮换 | $0 |
| D1 超 500MB | 清理旧数据 | $0 |
| R2 超 10GB | 删除旧备份 | $0 |
| 需要更智能的 LLM | Groq qwen3-32b | $0 |

### 多区域部署（未来）

```
用户 A (美国) → Cloudflare 边缘 → Worker (美国) → D1 (美国)
用户 B (中国) → Cloudflare 边缘 → Worker (亚太) → D1 (亚太)
```

Cloudflare 全球边缘网络自动路由到最近的节点。

---

## 八、与 Supabase 对比

| 维度 | Cloudflare 全家桶 | Supabase 免费层 |
|------|-------------------|-----------------|
| 数据库 | D1: 500MB | PostgreSQL: 500MB |
| 存储 | R2: 10GB, **零出口费** | Storage: 1GB, 5GB出口 |
| API | Workers: 10万/天 | 无限请求 |
| 休眠 | **不休眠** | 1周不活跃暂停 |
| 项目数 | 100个 | 2个 |
| CDN | 全球边缘 | 基础 CDN |
| **推荐度** | ★★★★★ | ★★★ |

**结论：Cloudflare 全家桶更适合 Memoria Heaven**
- R2 零出口费是关键优势
- 不会休眠
- 与 Workers 深度集成

---

## 九、一键部署脚本

```bash
#!/bin/bash
# Memoria Heaven 一键部署

set -e
echo "✦ Memoria Heaven 部署向导"
echo ""

# 检查依赖
command -v node >/dev/null || { echo "❌ 请先安装 Node.js"; exit 1; }
command -v wrangler >/dev/null || npm install -g wrangler

# 登录
echo "1/5 登录 Cloudflare..."
wrangler login

# 创建资源
echo "2/5 创建 Cloudflare 资源..."
wrangler d1 create memoria-heaven-db 2>&1 | tee /tmp/d1-output.txt
D1_ID=$(grep -o 'database_id = "[^"]*"' /tmp/d1-output.txt | cut -d'"' -f2)

wrangler r2 bucket create memoria-heaven-data 2>/dev/null || true

wrangler kv namespace create CACHE 2>&1 | tee /tmp/kv-output.txt
KV_ID=$(grep -o 'id = "[^"]*"' /tmp/kv-output.txt | cut -d'"' -f2)

# 更新配置
echo "3/5 配置 Worker..."
sed -i '' "s/YOUR_D1_DATABASE_ID/$D1_ID/" worker/wrangler.toml
sed -i '' "s/YOUR_KV_NAMESPACE_ID/$KV_ID/" worker/wrangler.toml

echo "请输入你的 Groq API Key (gsk_...):"
read -s GROQ_KEY
cd worker && echo "$GROQ_KEY" | wrangler secret put GROQ_API_KEY

# 部署
echo "4/5 部署 Worker..."
npm run db:init
npm run deploy

echo "5/5 部署前端..."
cd ../app && npm install && npm run build
wrangler pages deploy dist --project-name=memoria-heaven

echo ""
echo "✦ 部署完成！"
echo "访问: https://memoria-heaven.pages.dev"
```

---

## 十、常见问题

**Q: Groq 免费层够用吗？**
A: 个人使用完全够。每天 14,400 次请求，即使每分钟都在聊天也只用 30 请求/分钟。

**Q: 数据存在哪里？**
A: 主要存在浏览器 IndexedDB（即时读写），备份在 Cloudflare R2（跨设备同步）。

**Q: 需要自己的域名吗？**
A: 不需要。免费获得 `*.pages.dev` 和 `*.workers.dev` 域名。

**Q: 能用 Ollama 替代 Groq 吗？**
A: 可以。在设置中切换到 Ollama，需要本地运行 Ollama 服务。

**Q: Worker 的 10ms CPU 够用吗？**
A: 够用。Worker 主要是代理请求（透传），不做复杂计算。

**Q: 如何更新部署？**
A: 推送代码到 GitHub，Pages 自动重新部署。Worker 需要 `wrangler deploy`。
