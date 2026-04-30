# 06 - 区块链部署完整指南

## 模块概述

从零到一部署整个"Memoria Heaven"项目的区块链基础设施，包括智能合约部署、前端集成、The Graph 索引、以及用户引导流程。

## 内容

### 1. 技术栈选择

```typescript
// 最终技术栈
const TECH_STACK = {
  // 区块链层
  blockchain: {
    network: 'Base L2',              // 以太坊 L2
    reason: '低 gas、高速度、生态成熟',
    alternatives: ['Arbitrum', 'Optimism', 'Polygon zkEVM']
  },
  
  // 智能合约
  contracts: {
    language: 'Solidity 0.8.20',
    framework: 'Foundry',             // 快速、现代
    testing: 'Forge',
    deployment: 'Forge Script'
  },
  
  // 前端
  frontend: {
    framework: 'React + TypeScript',
    web3: 'wagmi + viem',             // 现代 Web3 库
    wallet: 'RainbowKit',             // 钱包连接 UI
    rendering: 'Three.js',            // 3D 渲染
    state: 'Zustand'                  // 轻量状态管理
  },
  
  // 索引
  indexing: {
    service: 'The Graph',
    subgraph: 'GraphQL API'
  },
  
  // 存储
  storage: {
    static: 'Cloudflare Pages',      // 地图数据
    metadata: 'IPFS (可选)',          // 永久存储
    local: 'IndexedDB'                // 本地缓存
  },
  
  // 网络层
  network: {
    nodes: 'Cloudflare Workers',     // 去中心化节点
    rpc: 'Alchemy / Infura'          // RPC 提供商
  }
};
```

### 2. 项目结构

```
memoria-heaven/
├── contracts/                    # 智能合约
│   ├── src/
│   │   ├── MemoriaHeavenRegistry.sol
│   │   ├── Marketplace.sol
│   │   └── interfaces/
│   ├── test/
│   ├── script/
│   │   └── Deploy.s.sol
│   └── foundry.toml
│
├── frontend/                     # 前端应用
│   ├── src/
│   │   ├── components/
│   │   │   ├── WalletConnect.tsx
│   │   │   ├── MapViewer.tsx
│   │   │   ├── ChatInterface.tsx
│   │   │   └── Marketplace.tsx
│   │   ├── hooks/
│   │   │   ├── useContract.ts
│   │   │   ├── useDigitalLife.ts
│   │   │   └── useLLM.ts
│   │   ├── lib/
│   │   │   ├── agent.ts           # 数字生命 Agent
│   │   │   ├── llm.ts             # LLM 集成
│   │   │   ├── storage.ts         # IndexedDB
│   │   │   └── blockchain.ts      # 区块链交互
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   └── package.json
│
├── worker/                       # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts              # Worker 入口
│   │   ├── network.ts            # 网络协议
│   │   └── cache.ts              # 缓存策略
│   └── wrangler.toml
│
├── subgraph/                     # The Graph 索引
│   ├── schema.graphql
│   ├── subgraph.yaml
│   └── src/
│       └── mapping.ts
│
├── docs/                         # 文档
│   ├── DEPLOYMENT.md
│   ├── USER_GUIDE.md
│   └── API.md
│
└── README.md
```

### 3. 智能合约部署

#### 3.1 安装 Foundry

```bash
# 安装 Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 创建项目
forge init memoria-heaven-contracts
cd memoria-heaven-contracts
```

#### 3.2 编写合约

```solidity
// contracts/src/MemoriaHeavenRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MemoriaHeavenRegistry {
    struct DigitalLife {
        address owner;
        uint96 id;
        uint40 createdAt;
    }
    
    mapping(uint96 => DigitalLife) public registry;
    mapping(uint32 => uint32) public regionCounters;
    mapping(uint96 => bytes32) public mapUrlHashes;
    
    event Created(uint96 indexed id, address indexed owner, bytes32 mapUrlHash);
    event Transfer(uint96 indexed id, address indexed from, address indexed to);
    event MapUrlUpdated(uint96 indexed id, bytes32 newHash);
    
    error InvalidRegion();
    error RegionFull();
    error IDExists();
    error NotOwner();
    error InvalidRecipient();
    error IDNotExists();
    
    function register(uint32 regionCode, bytes32 mapUrlHash) 
        external 
        returns (uint96) 
    {
        if (regionCode >= 1000000) revert InvalidRegion();
        
        uint32 counter = regionCounters[regionCode];
        if (counter >= 1000000) revert RegionFull();
        
        uint96 id = uint96(regionCode) * 1000000 + uint96(counter);
        if (registry[id].owner != address(0)) revert IDExists();
        
        registry[id] = DigitalLife({
            owner: msg.sender,
            id: id,
            createdAt: uint40(block.timestamp)
        });
        
        mapUrlHashes[id] = mapUrlHash;
        regionCounters[regionCode] = counter + 1;
        
        emit Created(id, msg.sender, mapUrlHash);
        return id;
    }
    
    function batchRegister(uint32 regionCode, bytes32[] calldata hashes) 
        external 
        returns (uint96[] memory) 
    {
        if (hashes.length > 10) revert("Max 10 per batch");
        
        uint96[] memory ids = new uint96[](hashes.length);
        uint32 counter = regionCounters[regionCode];
        
        for (uint256 i = 0; i < hashes.length; i++) {
            uint96 id = uint96(regionCode) * 1000000 + uint96(counter + i);
            
            registry[id] = DigitalLife({
                owner: msg.sender,
                id: id,
                createdAt: uint40(block.timestamp)
            });
            
            mapUrlHashes[id] = hashes[i];
            ids[i] = id;
            
            emit Created(id, msg.sender, hashes[i]);
        }
        
        regionCounters[regionCode] = counter + uint32(hashes.length);
        return ids;
    }
    
    function transfer(uint96 id, address to) external {
        if (registry[id].owner != msg.sender) revert NotOwner();
        if (to == address(0)) revert InvalidRecipient();
        
        address from = msg.sender;
        registry[id].owner = to;
        emit Transfer(id, from, to);
    }
    
    function updateMapUrl(uint96 id, bytes32 newHash) external {
        if (registry[id].owner != msg.sender) revert NotOwner();
        mapUrlHashes[id] = newHash;
        emit MapUrlUpdated(id, newHash);
    }
    
    function ownerOf(uint96 id) external view returns (address) {
        address owner = registry[id].owner;
        if (owner == address(0)) revert IDNotExists();
        return owner;
    }
    
    function batchOwnerOf(uint96[] calldata ids) 
        external 
        view 
        returns (address[] memory) 
    {
        address[] memory owners = new address[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            owners[i] = registry[ids[i]].owner;
        }
        return owners;
    }
}
```

#### 3.3 编写测试

```solidity
// contracts/test/MemoriaHeavenRegistry.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MemoriaHeavenRegistry.sol";

contract MemoriaHeavenRegistryTest is Test {
    MemoriaHeavenRegistry public registry;
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    
    function setUp() public {
        registry = new MemoriaHeavenRegistry();
    }
    
    function testRegister() public {
        vm.prank(user1);
        uint96 id = registry.register(10001, bytes32("hash1"));
        
        assertEq(id, 10001000000);
        assertEq(registry.ownerOf(id), user1);
    }
    
    function testBatchRegister() public {
        bytes32[] memory hashes = new bytes32[](3);
        hashes[0] = bytes32("hash1");
        hashes[1] = bytes32("hash2");
        hashes[2] = bytes32("hash3");
        
        vm.prank(user1);
        uint96[] memory ids = registry.batchRegister(10001, hashes);
        
        assertEq(ids.length, 3);
        assertEq(ids[0], 10001000000);
        assertEq(ids[1], 10001000001);
        assertEq(ids[2], 10001000002);
    }
    
    function testTransfer() public {
        vm.prank(user1);
        uint96 id = registry.register(10001, bytes32("hash1"));
        
        vm.prank(user1);
        registry.transfer(id, user2);
        
        assertEq(registry.ownerOf(id), user2);
    }
    
    function testCannotTransferNotOwned() public {
        vm.prank(user1);
        uint96 id = registry.register(10001, bytes32("hash1"));
        
        vm.prank(user2);
        vm.expectRevert(MemoriaHeavenRegistry.NotOwner.selector);
        registry.transfer(id, user2);
    }
}
```

#### 3.4 部署脚本

```solidity
// contracts/script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MemoriaHeavenRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        MemoriaHeavenRegistry registry = new MemoriaHeavenRegistry();
        
        console.log("MemoriaHeavenRegistry deployed at:", address(registry));
        
        vm.stopBroadcast();
    }
}
```

#### 3.5 执行部署

```bash
# 1. 运行测试
forge test -vvv

# 2. 部署到 Base Sepolia（测试网）
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY

# 3. 部署到 Base Mainnet（主网）
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY

# 输出示例：
# MemoriaHeavenRegistry deployed at: 0x1234567890abcdef...
```

### 4. 前端集成

#### 4.1 安装依赖

```bash
# 创建前端项目
npm create vite@latest memoria-heaven-frontend -- --template react-ts
cd memoria-heaven-frontend

# 安装依赖
npm install \
  wagmi viem @tanstack/react-query \
  @rainbow-me/rainbowkit \
  three @react-three/fiber @react-three/drei \
  zustand \
  ethers
```

#### 4.2 配置 Wagmi

```typescript
// frontend/src/lib/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Memoria Heaven',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID',
  chains: [base, baseSepolia],
  ssr: false,
});

export const CONTRACT_ADDRESS = {
  [base.id]: '0x1234...abcd',           // 主网合约地址
  [baseSepolia.id]: '0x5678...efgh'     // 测试网合约地址
} as const;

export const CONTRACT_ABI = [
  {
    "type": "function",
    "name": "register",
    "inputs": [
      { "name": "regionCode", "type": "uint32" },
      { "name": "mapUrlHash", "type": "bytes32" }
    ],
    "outputs": [{ "name": "", "type": "uint96" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ownerOf",
    "inputs": [{ "name": "id", "type": "uint96" }],
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Created",
    "inputs": [
      { "name": "id", "type": "uint96", "indexed": true },
      { "name": "owner", "type": "address", "indexed": true },
      { "name": "mapUrlHash", "type": "bytes32", "indexed": false }
    ]
  }
] as const;
```

#### 4.3 钱包连接组件

```typescript
// frontend/src/components/WalletConnect.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance } from 'wagmi';

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  
  return (
    <div className="wallet-connect">
      <ConnectButton />
      
      {isConnected && (
        <div className="wallet-info">
          <p>地址: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
          <p>余额: {balance?.formatted} {balance?.symbol}</p>
        </div>
      )}
    </div>
  );
}
```

#### 4.4 注册数字生命

```typescript
// frontend/src/hooks/useRegisterDigitalLife.ts
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { keccak256, toBytes } from 'viem';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/wagmi';

export function useRegisterDigitalLife() {
  const { data: hash, writeContract, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  
  const register = async (regionCode: number, mapUrl: string) => {
    // 计算 mapUrl 的 hash
    const mapUrlHash = keccak256(toBytes(mapUrl));
    
    writeContract({
      address: CONTRACT_ADDRESS[8453], // Base mainnet
      abi: CONTRACT_ABI,
      functionName: 'register',
      args: [regionCode, mapUrlHash],
    });
  };
  
  return {
    register,
    isPending,
    isConfirming,
    isSuccess,
    hash
  };
}

// 使用示例
function RegisterButton() {
  const { register, isPending, isSuccess } = useRegisterDigitalLife();
  
  const handleRegister = async () => {
    await register(10001, 'https://my-map.pages.dev');
  };
  
  return (
    <button onClick={handleRegister} disabled={isPending}>
      {isPending ? '注册中...' : '注册数字生命'}
    </button>
  );
}
```

### 5. The Graph 索引

#### 5.1 创建 Subgraph

```bash
# 安装 Graph CLI
npm install -g @graphprotocol/graph-cli

# 初始化 subgraph
graph init --product hosted-service memoria-heaven/registry
```

#### 5.2 定义 Schema

```graphql
# subgraph/schema.graphql
type DigitalLife @entity {
  id: ID!                          # 12 位数字 ID
  owner: Bytes!                    # 当前所有者
  mapUrlHash: Bytes!               # 地图 URL hash
  createdAt: BigInt!               # 创建时间
  regionCode: BigInt!              # 地区编码
  
  transfers: [Transfer!]! @derivedFrom(field: "digitalLife")
  
  transferCount: Int!
  lastTransferAt: BigInt
}

type Transfer @entity {
  id: ID!
  digitalLife: DigitalLife!
  from: Bytes!
  to: Bytes!
  timestamp: BigInt!
  transactionHash: Bytes!
}

type RegionStats @entity {
  id: ID!                          # regionCode
  totalRegistered: Int!
  lastRegisteredAt: BigInt!
}
```

#### 5.3 编写 Mapping

```typescript
// subgraph/src/mapping.ts
import { Created, Transfer as TransferEvent } from '../generated/MemoriaHeavenRegistry/MemoriaHeavenRegistry';
import { DigitalLife, Transfer, RegionStats } from '../generated/schema';

export function handleCreated(event: Created): void {
  let id = event.params.id.toString();
  let digitalLife = new DigitalLife(id);
  
  digitalLife.owner = event.params.owner;
  digitalLife.mapUrlHash = event.params.mapUrlHash;
  digitalLife.createdAt = event.block.timestamp;
  digitalLife.regionCode = event.params.id.div(BigInt.fromI32(1000000));
  digitalLife.transferCount = 0;
  
  digitalLife.save();
  
  // 更新地区统计
  let regionId = digitalLife.regionCode.toString();
  let region = RegionStats.load(regionId);
  
  if (region == null) {
    region = new RegionStats(regionId);
    region.totalRegistered = 0;
  }
  
  region.totalRegistered += 1;
  region.lastRegisteredAt = event.block.timestamp;
  region.save();
}

export function handleTransfer(event: TransferEvent): void {
  let digitalLife = DigitalLife.load(event.params.id.toString());
  
  if (digitalLife != null) {
    digitalLife.owner = event.params.to;
    digitalLife.transferCount += 1;
    digitalLife.lastTransferAt = event.block.timestamp;
    digitalLife.save();
    
    // 记录转让历史
    let transferId = event.transaction.hash.toHex() + '-' + event.logIndex.toString();
    let transfer = new Transfer(transferId);
    
    transfer.digitalLife = digitalLife.id;
    transfer.from = event.params.from;
    transfer.to = event.params.to;
    transfer.timestamp = event.block.timestamp;
    transfer.transactionHash = event.transaction.hash;
    
    transfer.save();
  }
}
```

#### 5.4 部署 Subgraph

```bash
# 1. 认证
graph auth --product hosted-service <ACCESS_TOKEN>

# 2. 部署
graph deploy --product hosted-service memoria-heaven/registry

# 3. 查询示例
# GraphQL endpoint: https://api.thegraph.com/subgraphs/name/memoria-heaven/registry
```

#### 5.5 前端查询

```typescript
// frontend/src/hooks/useDigitalLives.ts
import { useQuery } from '@tanstack/react-query';

const SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/memoria-heaven/registry';

export function useDigitalLives(owner?: string) {
  return useQuery({
    queryKey: ['digitalLives', owner],
    queryFn: async () => {
      const query = `
        query GetDigitalLives($owner: Bytes) {
          digitalLives(
            where: { owner: $owner }
            orderBy: createdAt
            orderDirection: desc
          ) {
            id
            owner
            mapUrlHash
            createdAt
            transferCount
          }
        }
      `;
      
      const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { owner }
        })
      });
      
      const { data } = await response.json();
      return data.digitalLives;
    }
  });
}

// 使用示例
function MyDigitalLives() {
  const { address } = useAccount();
  const { data: lives, isLoading } = useDigitalLives(address);
  
  if (isLoading) return <div>加载中...</div>;
  
  return (
    <div>
      <h2>我的数字生命 ({lives?.length})</h2>
      {lives?.map(life => (
        <div key={life.id}>
          <p>ID: {life.id}</p>
          <p>创建时间: {new Date(life.createdAt * 1000).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
```

### 6. Cloudflare Worker 部署

```bash
# 1. 安装 Wrangler
npm install -g wrangler

# 2. 登录
wrangler login

# 3. 创建 Worker
wrangler init memoria-heaven-worker

# 4. 部署
wrangler deploy
```

```typescript
// worker/src/index.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    // 路由
    if (url.pathname.startsWith('/maps/')) {
      return handleMaps(request, env);
    }
    
    if (url.pathname.startsWith('/network/')) {
      return handleNetwork(request, env);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};
```

### 7. 用户完整流程

```typescript
// 用户从零开始的完整流程

// Step 1: 连接钱包
const { address } = useAccount();

// Step 2: 检查余额
const { data: balance } = useBalance({ address });
if (balance.value < parseEther('0.001')) {
  alert('余额不足，请充值');
}

// Step 3: 创建数字生命
const inhabitant = await createDigitalLife();

// Step 4: 部署到 Cloudflare Pages
const mapUrl = await deployToCloudflare(inhabitant);

// Step 5: 注册到区块链
const { register } = useRegisterDigitalLife();
await register(10001, mapUrl);

// Step 6: 等待确认
// ... 交易确认后，获得 12 位 ID

// Step 7: 开始对话
const agent = new DigitalLifeAgent(inhabitant, llm, storage);
const response = await agent.chat('你好');
```

## 效果

1. **一键部署**：用户只需运行几个命令即可部署整个系统
2. **低成本**：合约部署 ~$50，用户注册 ~$0.24
3. **高性能**：The Graph 提供快速查询，Cloudflare 提供全球 CDN
4. **易维护**：项目方只需维护 GitHub 和 Twitter

## 设计理由

### 为什么选择 Base L2？

1. **成本低**：gas 费只有以太坊主网的 1/100
2. **速度快**：1-2 秒确认
3. **生态好**：Coinbase 支持，钱包集成好

### 为什么用 Foundry？

1. **快速**：编译和测试速度是 Hardhat 的 10 倍
2. **现代**：Solidity 原生，不需要 JavaScript
3. **强大**：内置 fuzzing、gas 分析等工具

### 为什么用 The Graph？

1. **去中心化**：不依赖中心化数据库
2. **实时**：自动索引链上事件
3. **高效**：GraphQL 查询比 RPC 快 100 倍

## 上游链路

- **智能合约**：提供链上数据
- **前端应用**：用户交互界面

## 下游链路

- **The Graph**：索引链上数据
- **Cloudflare Worker**：提供去中心化服务

## 成本分析

```typescript
// 一次性成本
const ONE_TIME_COSTS = {
  contractDeployment: 50,          // $50 (一次性)
  domain: 10,                      // $10/年
  total: 60
};

// 用户成本
const USER_COSTS = {
  register: 0.24,                  // $0.24 (Base L2)
  transfer: 0.15,                  // $0.15
  updateMapUrl: 0.09,              // $0.09
  cloudflare: 0,                   // 免费额度
  llm: 'varies'                    // 用户自己的
};

// 项目方年度成本
const ANNUAL_COSTS = {
  domain: 10,
  seedNodes: 0,                    // Cloudflare Workers 免费
  theGraph: 0,                     // 社区计划免费
  twitter: 0,
  github: 0,
  total: 10                        // $10/年
};
```

## 监控和维护

```typescript
// 监控指标
interface Metrics {
  // 链上指标
  totalRegistered: number;
  dailyRegistrations: number;
  totalTransfers: number;
  
  // 网络指标
  activeWorkers: number;
  totalMaps: number;
  avgLatency: number;
  
  // 用户指标
  dailyActiveUsers: number;
  avgConversationsPerUser: number;
}

// 告警规则
const ALERTS = {
  gasPrice: { threshold: 10, unit: 'gwei' },
  workerDowntime: { threshold: 5, unit: 'minutes' },
  subgraphDelay: { threshold: 100, unit: 'blocks' }
};
```
