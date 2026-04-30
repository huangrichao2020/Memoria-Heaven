# Memoria Heaven - 设计手册

## 项目愿景

一个去中心化的数字纪念空间，让全世界的人民能够与逝去的亲朋好友、宠物对话。每个用户通过部署自己的 Cloudflare 基础设施（Pages + Worker）成为网络的一部分，共同构建一个不断扩展的虚拟世界。

## 核心原则

1. **伪去中心化架构**：每个用户既是消费者也是基础设施提供者
2. **隐私优先**：对话数据只在用户本地处理，使用用户自己的 LLM
3. **资源共享**：用户的 Worker 互相协作，形成分布式网络
4. **渐进式体验**：从单用户到多用户，从本地到全球网络

## 技术栈

- **前端渲染**：Three.js (Minecraft 风格的方块世界)
- **静态托管**：Cloudflare Pages (地图数据)
- **网络节点**：Cloudflare Workers (路由、索引、缓存)
- **本地存储**：IndexedDB (即时编辑)
- **LLM 集成**：支持本地模型 (Ollama) 和 API (OpenAI/Anthropic/国内厂商)

## 设计手册目录

### 核心模块
- [01-数据模型设计](./01-data-model.md) - 地图、地块、逝者数据结构
- [02-Worker网络协议](./02-worker-network.md) - Worker 之间的通信和发现
- [03-本地优先架构](./03-local-first.md) - 本地数据与 CDN 同步策略
- [04-LLM集成层](./04-llm-integration.md) - 多 LLM 支持和对话管理

### 用户体验
- [05-初始化流程](./05-initialization.md) - 用户首次使用的引导
- [06-地图编辑器](./06-map-editor.md) - 创建和编辑地图的界面
- [07-散步系统](./07-walking-system.md) - 探索其他用户地图的机制
- [08-对话系统](./08-conversation.md) - 与逝者交互的界面

### 网络层
- [09-种子节点](./09-seed-nodes.md) - 网络引导和冷启动
- [10-缓存策略](./10-caching-strategy.md) - 多层缓存和资源共享
- [11-路由算法](./11-routing.md) - 如何找到目标地图
- [12-邻居发现](./12-neighbor-discovery.md) - Gossip 协议实现

### 安全与治理
- [13-数据签名](./13-data-signing.md) - 防止恶意篡改
- [14-内容审核](./14-content-moderation.md) - 用户自主的黑名单机制
- [15-隐私保护](./15-privacy.md) - 数据加密和访问控制

### 部署与运维
- [16-自动化部署](./16-deployment.md) - 一键部署到 Cloudflare
- [17-监控与诊断](./17-monitoring.md) - Worker 健康检查
- [18-版本升级](./18-upgrades.md) - 网络协议的向后兼容

## 快速开始

```bash
# 克隆项目
git clone https://github.com/memoria-heaven/core.git

# 安装依赖
npm install

# 本地开发
npm run dev

# 部署到 Cloudflare
npm run deploy
```

## 贡献指南

本项目欢迎所有形式的贡献。在提交 PR 前，请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证

MIT License - 让每个人都能自由使用和修改
