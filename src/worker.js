/**
 * CloudContext - Secure Cloudflare Worker API
 * Manages AI contexts with authentication, encryption, and versioning
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Context-ID, X-Session-ID',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const authResult = await authenticateRequest(request, env);
      if (!authResult.success) {
        return jsonResponse({ error: authResult.message }, 401, corsHeaders);
      }

      const userId = authResult.userId;

      switch (path) {
        case '/api/context':
          return await handleContext(request, env, userId, corsHeaders);
        case '/api/context/list':
          return await listContexts(env, userId, corsHeaders);
        case '/api/context/sync':
          return await syncContext(request, env, userId, corsHeaders);
        case '/api/context/version':
          return await getVersions(request, env, userId, corsHeaders);
        case '/api/context/restore':
          return await restoreVersion(request, env, userId, corsHeaders);
        case '/api/health':
          return jsonResponse({ status: 'healthy', timestamp: new Date().toISOString() }, 200, corsHeaders);
        default:
          return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
      }
    } catch (error) {
      return handleError(error, 'Worker error', corsHeaders);
    }
  }
};

async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, message: 'Missing authorization' };
  }

  const token = authHeader.substring(7);
  
  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    return { success: true, userId: payload.userId };
  } catch {
    const storedKey = await env.KV_AUTH.get(`apikey:${token}`);
    if (storedKey) {
      return { success: true, userId: storedKey };
    }
    return { success: false, message: 'Invalid token' };
  }
}

async function handleContext(request, env, userId, corsHeaders) {
  const contextId = request.headers.get('X-Context-ID') || 'default';
  const sessionId = request.headers.get('X-Session-ID') || crypto.randomUUID();
  
  switch (request.method) {
    case 'GET':
      return await getContext(env, userId, contextId, corsHeaders);
    case 'POST':
    case 'PUT':
      return await saveContext(request, env, userId, contextId, sessionId, corsHeaders);
    case 'DELETE':
      return await deleteContext(env, userId, contextId, corsHeaders);
    default:
      return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }
}

async function getContext(env, userId, contextId, corsHeaders) {
  const key = `contexts/${userId}/${contextId}/current.json`;
  const object = await env.R2_BUCKET.get(key);
  
  if (!object) {
    return jsonResponse({ error: 'Context not found' }, 404, corsHeaders);
  }
  
  const encryptedData = await object.text();
  const decryptedData = await decrypt(encryptedData, env.ENCRYPTION_KEY);
  const context = JSON.parse(decryptedData);
  
  await env.KV_METADATA.put(
    `access:${userId}:${contextId}`,
    JSON.stringify({
      lastAccessed: new Date().toISOString(),
      accessCount: (context.metadata?.accessCount || 0) + 1
    }),
    { expirationTtl: 86400 * 30 }
  );
  
  return jsonResponse(context, 200, corsHeaders);
}

async function saveContext(request, env, userId, contextId, sessionId, corsHeaders) {
  const data = await validateContextData(request);
  if (data.error) {
    return jsonResponse(data, 400, corsHeaders);
  }
  
  const context = await buildContextWithMetadata(data, userId, contextId, sessionId);
  const encryptedData = await encrypt(JSON.stringify(context), env.ENCRYPTION_KEY);
  
  await Promise.all([
    storeCurrentContext(env, userId, contextId, encryptedData, context.metadata),
    storeVersionedContext(env, userId, contextId, context.metadata.version, encryptedData),
    updateContextIndex(env, userId, contextId, context.metadata)
  ]);
  
  return jsonResponse({
    success: true,
    contextId,
    version: context.metadata.version,
    timestamp: context.metadata.timestamp
  }, 200, corsHeaders);
}

async function validateContextData(request) {
  try {
    const data = await request.json();
    if (!data.content || typeof data.content !== 'object') {
      return { error: 'Invalid context structure' };
    }
    return data;
  } catch {
    return { error: 'Invalid JSON payload' };
  }
}

async function buildContextWithMetadata(data, userId, contextId, sessionId) {
  return {
    ...data,
    metadata: {
      ...data.metadata,
      userId,
      contextId,
      sessionId,
      timestamp: new Date().toISOString(),
      version: Date.now(),
      checksum: await generateChecksum(JSON.stringify(data.content))
    }
  };
}

async function storeCurrentContext(env, userId, contextId, encryptedData, metadata) {
  const key = `contexts/${userId}/${contextId}/current.json`;
  return env.R2_BUCKET.put(key, encryptedData, {
    httpMetadata: {
      contentType: 'application/json',
      cacheControl: 'no-cache'
    },
    customMetadata: {
      userId,
      contextId,
      sessionId: metadata.sessionId,
      timestamp: metadata.timestamp
    }
  });
}

async function storeVersionedContext(env, userId, contextId, version, encryptedData) {
  const key = `contexts/${userId}/${contextId}/versions/${version}.json`;
  return env.R2_BUCKET.put(key, encryptedData);
}

async function listContexts(env, userId, corsHeaders) {
  const prefix = `contexts/${userId}/`;
  const objects = await env.R2_BUCKET.list({ prefix, delimiter: '/' });
  
  const contexts = [];
  for (const prefix of objects.delimitedPrefixes || []) {
    const contextId = prefix.split('/')[2];
    const metadata = await env.KV_METADATA.get(`context:${userId}:${contextId}`);
    contexts.push({
      contextId,
      ...(metadata ? JSON.parse(metadata) : {})
    });
  }
  
  return jsonResponse({ contexts }, 200, corsHeaders);
}

async function syncContext(request, env, userId, corsHeaders) {
  const { contextId, lastSync } = await request.json();
  
  const key = `contexts/${userId}/${contextId}/current.json`;
  const object = await env.R2_BUCKET.get(key);
  
  if (!object) {
    return jsonResponse({ error: 'Context not found' }, 404, corsHeaders);
  }
  
  const metadata = object.customMetadata;
  const serverTimestamp = new Date(metadata.timestamp).getTime();
  const clientTimestamp = new Date(lastSync).getTime();
  
  if (serverTimestamp > clientTimestamp) {
    const encryptedData = await object.text();
    const decryptedData = await decrypt(encryptedData, env.ENCRYPTION_KEY);
    return jsonResponse({
      action: 'pull',
      context: JSON.parse(decryptedData),
      timestamp: metadata.timestamp
    }, 200, corsHeaders);
  } else {
    return jsonResponse({
      action: 'push',
      timestamp: metadata.timestamp
    }, 200, corsHeaders);
  }
}

async function getVersions(request, env, userId, corsHeaders) {
  const { contextId } = await request.json();
  const prefix = `contexts/${userId}/${contextId}/versions/`;
  
  const objects = await env.R2_BUCKET.list({ prefix, limit: 50 });
  
  const versions = objects.objects.map(obj => ({
    version: obj.key.split('/').pop().replace('.json', ''),
    size: obj.size,
    uploaded: obj.uploaded,
    metadata: obj.customMetadata
  }));
  
  return jsonResponse({ versions }, 200, corsHeaders);
}

async function restoreVersion(request, env, userId, corsHeaders) {
  const { contextId, version } = await request.json();
  
  const versionKey = `contexts/${userId}/${contextId}/versions/${version}.json`;
  const versionObject = await env.R2_BUCKET.get(versionKey);
  
  if (!versionObject) {
    return jsonResponse({ error: 'Version not found' }, 404, corsHeaders);
  }
  
  const currentKey = `contexts/${userId}/${contextId}/current.json`;
  const data = await versionObject.arrayBuffer();
  
  await env.R2_BUCKET.put(currentKey, data, {
    httpMetadata: versionObject.httpMetadata,
    customMetadata: {
      ...versionObject.customMetadata,
      restoredFrom: version,
      restoredAt: new Date().toISOString()
    }
  });
  
  return jsonResponse({
    success: true,
    restoredVersion: version
  }, 200, corsHeaders);
}

async function deleteContext(env, userId, contextId, corsHeaders) {
  const prefix = `contexts/${userId}/${contextId}/`;
  const objects = await env.R2_BUCKET.list({ prefix });
  
  const deletePromises = objects.objects.map(obj => 
    env.R2_BUCKET.delete(obj.key)
  );
  await Promise.all(deletePromises);
  
  await env.KV_METADATA.delete(`context:${userId}:${contextId}`);
  await env.KV_METADATA.delete(`access:${userId}:${contextId}`);
  
  return jsonResponse({ success: true, deleted: objects.objects.length }, 200, corsHeaders);
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

async function generateChecksum(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function updateContextIndex(env, userId, contextId, metadata) {
  await env.KV_METADATA.put(
    `context:${userId}:${contextId}`,
    JSON.stringify({
      lastModified: metadata.timestamp,
      version: metadata.version,
      size: JSON.stringify(metadata).length
    }),
    { expirationTtl: 86400 * 90 }
  );
}

async function encrypt(text, key) {
  const cryptoKey = await deriveCryptoKey(key, ['encrypt']);
  const plaintext = new TextEncoder().encode(text);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    plaintext
  );
  
  return encodeEncryptedData(iv, ciphertext);
}

async function decrypt(encryptedText, key) {
  const { iv, ciphertext } = decodeEncryptedData(encryptedText);
  const cryptoKey = await deriveCryptoKey(key, ['decrypt']);
  
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertext
  );
  
  return new TextDecoder().decode(plaintext);
}

async function deriveCryptoKey(key, keyUsages) {
  const normalizedKey = normalizeKey(key);
  const keyBytes = new TextEncoder().encode(normalizedKey);
  
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    keyUsages
  );
}

function normalizeKey(key) {
  // Ensure key is exactly 32 bytes for AES-256
  return key.padEnd(32, '0').slice(0, 32);
}

function encodeEncryptedData(iv, ciphertext) {
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

function decodeEncryptedData(encryptedText) {
  const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  return { iv, ciphertext };
}

function handleError(error, context, corsHeaders) {
  const timestamp = new Date().toISOString();
  const errorId = crypto.randomUUID();
  
  // Log error with proper structure for monitoring
  const logEntry = {
    errorId,
    timestamp,
    context,
    message: error.message,
    stack: error.stack
  };
  
  // In production, this would be sent to a logging service
  console.error(JSON.stringify(logEntry));
  
  return jsonResponse({
    error: 'Internal server error',
    errorId,
    timestamp
  }, 500, corsHeaders);
}

async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  
  const payload = JSON.parse(atob(parts[1]));
  
  if (payload.exp && payload.exp < Date.now() / 1000) {
    throw new Error('Token expired');
  }
  
  return payload;
}
