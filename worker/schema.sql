-- Memoria Heaven D1 Schema

-- 地图索引
CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT DEFAULT 'anonymous',
  template_id TEXT DEFAULT 'garden',
  block_count INTEGER DEFAULT 0,
  inhabitant_count INTEGER DEFAULT 0,
  is_public INTEGER DEFAULT 1,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- 对话摘要（详细数据存 R2）
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  inhabitant_id TEXT NOT NULL,
  map_id TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  last_message_at INTEGER,
  summary TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- 用户统计
CREATE TABLE IF NOT EXISTS user_stats (
  user_id TEXT PRIMARY KEY,
  map_count INTEGER DEFAULT 0,
  chat_count INTEGER DEFAULT 0,
  last_active_at INTEGER DEFAULT (unixepoch()),
  created_at INTEGER DEFAULT (unixepoch())
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_maps_owner ON maps(owner_id);
CREATE INDEX IF NOT EXISTS idx_maps_public ON maps(is_public);
CREATE INDEX IF NOT EXISTS idx_maps_updated ON maps(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_map ON conversations(map_id);
CREATE INDEX IF NOT EXISTS idx_conv_inhabitant ON conversations(inhabitant_id);
