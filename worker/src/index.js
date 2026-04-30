// ============================================================
// Memoria Heaven - Cloudflare Worker API
// 纯 Cloudflare 全家桶 + Groq 免费 LLM
// ============================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return corsResponse(null, env);
    }

    try {
      // 路由
      if (path === '/api/health') {
        return corsResponse({ status: 'ok', time: Date.now() }, env);
      }

      // LLM 代理（Groq 免费 API）
      if (path === '/api/chat' && request.method === 'POST') {
        return await handleChat(request, env);
      }

      if (path === '/api/chat/stream' && request.method === 'POST') {
        return await handleChatStream(request, env);
      }

      // 地图索引
      if (path === '/api/maps' && request.method === 'GET') {
        return await handleListMaps(request, env);
      }

      if (path === '/api/maps' && request.method === 'POST') {
        return await handlePublishMap(request, env);
      }

      if (path.startsWith('/api/maps/') && request.method === 'GET') {
        const mapId = path.split('/api/maps/')[1];
        return await handleGetMap(mapId, env);
      }

      // 用户配置
      if (path === '/api/config' && request.method === 'GET') {
        return await handleGetConfig(request, env);
      }

      if (path === '/api/config' && request.method === 'POST') {
        return await handleSaveConfig(request, env);
      }

      return corsResponse({ error: 'Not Found' }, env, 404);
    } catch (err) {
      return corsResponse({ error: err.message }, env, 500);
    }
  },
};

// ============================================================
// LLM 代理 - Groq 免费 API
// ============================================================

async function handleChat(request, env) {
  const { messages, model } = await request.json();

  const response = await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'llama-3.1-8b-instant',
      messages,
      temperature: 0.8,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return corsResponse({ error: `Groq API error: ${err}` }, env, response.status);
  }

  const data = await response.json();
  return corsResponse({
    content: data.choices[0].message.content,
    model: data.model,
    usage: data.usage,
  }, env);
}

async function handleChatStream(request, env) {
  const { messages, model } = await request.json();

  const response = await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'llama-3.1-8b-instant',
      messages,
      temperature: 0.8,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return corsResponse({ error: `Groq API error: ${err}` }, env, response.status);
  }

  // 直接透传 SSE 流
  return new Response(response.body, {
    headers: {
      ...corsHeaders(env),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ============================================================
// 地图索引 - D1 数据库
// ============================================================

async function handleListMaps(request, env) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
  const offset = (page - 1) * limit;

  // 检查缓存
  const cacheKey = `maps:list:${page}:${limit}`;
  const cached = await env.CACHE.get(cacheKey, 'json');
  if (cached) {
    return corsResponse(cached, env);
  }

  const { results } = await env.DB.prepare(
    'SELECT id, name, template_id, block_count, inhabitant_count, created_at FROM maps WHERE is_public = 1 ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  ).bind(limit, offset).all();

  const { total } = await env.DB.prepare(
    'SELECT COUNT(*) as total FROM maps WHERE is_public = 1'
  ).first();

  const data = {
    maps: results,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };

  // 缓存 60 秒
  await env.CACHE.put(cacheKey, JSON.stringify(data), { expirationTtl: 60 });

  return corsResponse(data, env);
}

async function handleGetMap(mapId, env) {
  // 先查索引
  const map = await env.DB.prepare(
    'SELECT * FROM maps WHERE id = ?'
  ).bind(mapId).first();

  if (!map) {
    return corsResponse({ error: 'Map not found' }, env, 404);
  }

  // 从 R2 获取完整数据
  const key = `maps/${mapId}.json`;
  const object = await env.STORAGE.get(key);

  if (!object) {
    return corsResponse({ error: 'Map data not found' }, env, 404);
  }

  const mapData = await object.json();
  return corsResponse(mapData, env);
}

async function handlePublishMap(request, env) {
  const mapData = await request.json();

  if (!mapData.id || !mapData.name) {
    return corsResponse({ error: 'Missing required fields' }, env, 400);
  }

  // 存储完整数据到 R2
  await env.STORAGE.put(`maps/${mapData.id}.json`, JSON.stringify(mapData), {
    httpMetadata: { contentType: 'application/json' },
  });

  // 存储索引到 D1
  await env.DB.prepare(
    `INSERT OR REPLACE INTO maps (id, name, owner_id, template_id, block_count, inhabitant_count, is_public, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    mapData.id,
    mapData.name,
    mapData.ownerId || 'anonymous',
    mapData.templateId || 'garden',
    mapData.blocks?.length || 0,
    mapData.inhabitants?.length || 0,
    mapData.isPublic ? 1 : 0,
    mapData.createdAt || Date.now(),
    Date.now()
  ).run();

  // 清除列表缓存
  await clearMapListCache(env);

  return corsResponse({ success: true, id: mapData.id }, env);
}

// ============================================================
// 用户配置 - R2 存储
// ============================================================

async function handleGetConfig(request, env) {
  const userId = getUserId(request);

  const key = `users/${userId}/config.json`;
  const object = await env.STORAGE.get(key);

  if (!object) {
    return corsResponse({ llm: { provider: 'groq', model: 'llama-3.1-8b-instant' } }, env);
  }

  const config = await object.json();
  return corsResponse(config, env);
}

async function handleSaveConfig(request, env) {
  const userId = getUserId(request);
  const config = await request.json();

  const key = `users/${userId}/config.json`;
  await env.STORAGE.put(key, JSON.stringify(config), {
    httpMetadata: { contentType: 'application/json' },
  });

  return corsResponse({ success: true }, env);
}

// ============================================================
// 工具函数
// ============================================================

function getUserId(request) {
  // 简单的用户标识：使用 IP + User-Agent 哈希
  // 生产环境应该用更好的认证方案
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ua = request.headers.get('User-Agent') || '';
  return simpleHash(ip + ua);
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

async function clearMapListCache(env) {
  // 清除前几页的缓存
  for (let i = 1; i <= 5; i++) {
    for (const limit of [10, 20, 50]) {
      await env.CACHE.delete(`maps:list:${i}:${limit}`);
    }
  }
}

function corsHeaders(env) {
  const origins = (env.ALLOWED_ORIGINS || '').split(',');
  return {
    'Access-Control-Allow-Origin': origins[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function corsResponse(data, env, status = 200) {
  return new Response(data ? JSON.stringify(data) : null, {
    status,
    headers: {
      ...corsHeaders(env),
      'Content-Type': 'application/json',
    },
  });
}
