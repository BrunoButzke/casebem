/**
 * Tests for messages API handler (GET/POST /api/messages)
 * Run with: node --test tests/messages-api.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mock D1 Database (simplified for API tests)
class MockD1Database {
  constructor() {
    this.data = new Map();
    this.rateLimits = new Map();
  }

  prepare(sql) {
    return new MockD1Statement(this, sql);
  }

  batch(statements) {
    return Promise.all(statements.map(stmt => stmt.run()));
  }
}

class MockD1Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async first() {
    // Idempotency lookup
    if (this.sql.includes('idempotency_key')) {
      const [weddingKey, idempotencyKey] = this.params;
      for (const record of this.db.data.values()) {
        if (record.wedding_key === weddingKey && record.idempotency_key === idempotencyKey) {
          return record;
        }
      }
      return null;
    }

    // Rate limit upsert
    if (this.sql.includes('rate_limits') && this.sql.includes('RETURNING')) {
      const [id, weddingKey, ipHash, windowStart, ts1, ts2, ts3, limit] = this.params;
      const key = `${weddingKey}:${ipHash}:${windowStart}`;
      
      const existing = this.db.rateLimits.get(key);
      if (existing && existing.request_count >= limit) {
        return null;
      }
      
      const newCount = (existing?.request_count || 0) + 1;
      this.db.rateLimits.set(key, {
        id, request_count: newCount,
        wedding_key: weddingKey, ip_hash: ipHash,
        window_start: windowStart, created_at: ts1, updated_at: ts1,
      });
      return { request_count: newCount };
    }

    return null;
  }

  async all() {
    if (this.sql.includes('SELECT') && this.sql.includes('wedding_messages')) {
      const [weddingKey, limitParam] = this.params;
      const results = [];
      
      for (const record of this.db.data.values()) {
        if (record.wedding_key === weddingKey) {
          results.push(record);
        }
      }
      
      results.sort((a, b) => {
        if (a.created_at !== b.created_at) {
          return b.created_at.localeCompare(a.created_at);
        }
        return b.id.localeCompare(a.id);
      });
      
      return { results: results.slice(0, limitParam) };
    }
    
    return { results: [] };
  }

  async run() {
    if (this.sql.includes('INSERT INTO wedding_messages')) {
      const [id, weddingKey, guestName, message, consentGiven, createdAt, idempotencyKey, fingerprint] = this.params;
      
      // Check idempotency
      if (idempotencyKey) {
        for (const record of this.db.data.values()) {
          if (record.wedding_key === weddingKey && record.idempotency_key === idempotencyKey) {
            return { success: false, error: 'UNIQUE constraint' };
          }
        }
      }
      
      // Validate constraints
      if (guestName.length < 2 || guestName.length > 100) {
        return { success: false, error: 'CHECK constraint: guest_name' };
      }
      if (message.length < 3 || message.length > 500) {
        return { success: false, error: 'CHECK constraint: message' };
      }
      if (consentGiven !== 1) {
        return { success: false, error: 'CHECK constraint: consent_given' };
      }
      
      this.db.data.set(id, {
        id, wedding_key: weddingKey, guest_name: guestName,
        message, consent_given: consentGiven, created_at: createdAt,
        idempotency_key: idempotencyKey, idempotency_fingerprint: fingerprint,
      });
      return { success: true };
    }
    
    if (this.sql.includes('DELETE FROM rate_limits')) {
      return { success: true };
    }
    
    return { success: true };
  }
}

// Mock environment
function createMockEnv(dbData = []) {
  const db = new MockD1Database();
  dbData.forEach(item => db.data.set(item.id, item));
  
  return {
    DB: db,
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
}

// Helper to create Request
function createRequest(method, body = null, headers = {}) {
  const defaultHeaders = {
    'Origin': 'https://casebem.pages.dev',
    'Content-Type': 'application/json',
    ...headers,
  };
  
  const init = {
    method,
    headers: defaultHeaders,
  };
  
  if (body) {
    init.body = JSON.stringify(body);
    if (!defaultHeaders['Content-Length']) {
      init.headers['Content-Length'] = String(init.body.length);
    }
  }
  
  return new Request('https://casebem.pages.dev/api/messages', init);
}

// Import handler
let onRequest;

test('setup: import handler', async () => {
  const module = await import('../functions/api/messages.js');
  onRequest = module.onRequest;
  assert.ok(onRequest);
});

// OPTIONS tests
test('OPTIONS returns 204 with CORS headers', async () => {
  const env = createMockEnv();
  const request = new Request('https://casebem.pages.dev/api/messages', {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://casebem.pages.dev' },
  });
  
  const response = await onRequest({ request, env });
  
  assert.equal(response.status, 204);
  assert.ok(response.headers.get('Access-Control-Allow-Origin'));
  assert.ok(response.headers.get('Access-Control-Allow-Methods'));
  assert.ok(response.headers.get('Access-Control-Allow-Headers'));
});

test('OPTIONS validates Origin and rejects invalid', async () => {
  const env = createMockEnv();
  const request = new Request('https://casebem.pages.dev/api/messages', {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://evil.com' },
  });
  
  const response = await onRequest({ request, env });
  assert.equal(response.status, 403);
});

test('OPTIONS does not hit DB (fast fail on invalid Origin)', async () => {
  const envWithoutDb = { RSVP_SECRET: 'fake' }; // No DB
  const request = new Request('https://casebem.pages.dev/api/messages', {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://evil.com' },
  });
  
  // Should return 403 without checking DB
  const response = await onRequest({ request, env: envWithoutDb });
  assert.equal(response.status, 403);
});

// POST tests
test('POST creates message successfully', async () => {
  const env = createMockEnv();
  const request = createRequest('POST', {
    guestName: 'João Silva',
    message: 'Felicidades ao casal!',
    consentGiven: true,
  }, {
    'Idempotency-Key': 'test-key-123',
  });
  
  const response = await onRequest({ request, env });
  
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.ok(data.id);
  assert.equal(data.guestName, 'João Silva');
  assert.equal(data.message, 'Felicidades ao casal!');
  assert.ok(data.createdAt);
  
  // Should NOT return private fields
  assert.equal(data.idempotency_key, undefined);
  assert.equal(data.idempotency_fingerprint, undefined);
  assert.equal(data.consent_given, undefined);
});

test('POST requires Idempotency-Key header', async () => {
  const env = createMockEnv();
  const request = createRequest('POST', {
    guestName: 'Test',
    message: 'Message',
    consentGiven: true,
  }); // No Idempotency-Key
  
  const response = await onRequest({ request, env });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.match(data.error, /Idempotency-Key.*obrigatório/i);
});

test('POST validates Content-Type', async () => {
  const env = createMockEnv();
  const request = new Request('https://casebem.pages.dev/api/messages', {
    method: 'POST',
    headers: {
      'Origin': 'https://casebem.pages.dev',
      'Content-Type': 'text/plain', // Wrong
      'Idempotency-Key': 'key',
    },
    body: 'not json',
  });
  
  const response = await onRequest({ request, env });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.match(data.error, /Content-Type.*application\/json/i);
});

test('POST validates Content-Length', async () => {
  const env = createMockEnv();
  const largeBody = 'x'.repeat(9000);
  const request = new Request('https://casebem.pages.dev/api/messages', {
    method: 'POST',
    headers: {
      'Origin': 'https://casebem.pages.dev',
      'Content-Type': 'application/json',
      'Content-Length': String(largeBody.length),
      'Idempotency-Key': 'key',
    },
    body: largeBody,
  });
  
  const response = await onRequest({ request, env });
  assert.equal(response.status, 413);
  const data = await response.json();
  assert.match(data.error, /muito grande/i);
});

test('POST rejects malformed JSON', async () => {
  const env = createMockEnv();
  const request = new Request('https://casebem.pages.dev/api/messages', {
    method: 'POST',
    headers: {
      'Origin': 'https://casebem.pages.dev',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'key',
    },
    body: '{invalid json}',
  });
  
  const response = await onRequest({ request, env });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.match(data.error, /JSON inválido/i);
});

test('POST validates guestName', async () => {
  const env = createMockEnv();
  const request = createRequest('POST', {
    guestName: 'A', // Too short
    message: 'Valid message',
    consentGiven: true,
  }, { 'Idempotency-Key': 'key' });
  
  const response = await onRequest({ request, env });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(data.error, 'Dados inválidos');
  assert.ok(data.details.guestName);
});

test('POST validates message', async () => {
  const env = createMockEnv();
  const request = createRequest('POST', {
    guestName: 'Valid Name',
    message: 'AB', // Too short
    consentGiven: true,
  }, { 'Idempotency-Key': 'key' });
  
  const response = await onRequest({ request, env });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.ok(data.details.message);
});

test('POST validates consentGiven', async () => {
  const env = createMockEnv();
  const request = createRequest('POST', {
    guestName: 'Name',
    message: 'Message text',
    consentGiven: false, // Invalid
  }, { 'Idempotency-Key': 'key' });
  
  const response = await onRequest({ request, env });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.ok(data.details.consentGiven);
});

test('POST rejects unknown fields', async () => {
  const env = createMockEnv();
  const request = createRequest('POST', {
    guestName: 'Name',
    message: 'Message',
    consentGiven: true,
    giftId: 'not-allowed', // Unknown field
  }, { 'Idempotency-Key': 'key' });
  
  const response = await onRequest({ request, env });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.match(data.details._, /não permitidos.*giftId/);
});

test('POST enforces rate limit', async () => {
  const env = createMockEnv();
  
  // Make 5 requests (limit)
  for (let i = 0; i < 5; i++) {
    const request = createRequest('POST', {
      guestName: 'Test User',
      message: `Message ${i}`,
      consentGiven: true,
    }, { 
      'Idempotency-Key': `key-${i}`,
      'CF-Connecting-IP': '203.0.113.42',
    });
    
    const response = await onRequest({ request, env });
    assert.equal(response.status, 201);
  }
  
  // 6th request should be rate limited
  const blockedRequest = createRequest('POST', {
    guestName: 'Blocked',
    message: 'Should fail',
    consentGiven: true,
  }, { 
    'Idempotency-Key': 'blocked-key',
    'CF-Connecting-IP': '203.0.113.42', // Same IP
  });
  
  const blockedResponse = await onRequest({ request: blockedRequest, env });
  assert.equal(blockedResponse.status, 429);
  const data = await blockedResponse.json();
  assert.match(data.error, /Muitas requisições/i);
});

test('POST returns 503 when DB not configured', async () => {
  const envNoDb = { RSVP_SECRET: 'test' }; // No DB
  const request = createRequest('POST', {
    guestName: 'Test',
    message: 'Message',
    consentGiven: true,
  }, { 'Idempotency-Key': 'key' });
  
  const response = await onRequest({ request, env: envNoDb });
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.match(data.error, /temporariamente indisponível/i);
});

test('POST returns 503 when RSVP_SECRET not configured', async () => {
  const envNoSecret = { DB: new MockD1Database() }; // No secret
  const request = createRequest('POST', {
    guestName: 'Test',
    message: 'Message',
    consentGiven: true,
  }, { 'Idempotency-Key': 'key' });
  
  const response = await onRequest({ request, env: envNoSecret });
  assert.equal(response.status, 503);
});

test('POST handles idempotent replay correctly', async () => {
  const env = createMockEnv();
  const body = {
    guestName: 'João',
    message: 'Mensagem',
    consentGiven: true,
  };
  
  // First request
  const request1 = createRequest('POST', body, { 'Idempotency-Key': 'replay-123' });
  const response1 = await onRequest({ request: request1, env });
  assert.equal(response1.status, 201);
  const data1 = await response1.json();
  
  // Replay with same key and data
  const request2 = createRequest('POST', body, { 'Idempotency-Key': 'replay-123' });
  const response2 = await onRequest({ request: request2, env });
  assert.equal(response2.status, 201); // Should succeed
  const data2 = await response2.json();
  
  // Should return same message
  assert.equal(data2.id, data1.id);
  assert.equal(data2.guestName, data1.guestName);
});

test('POST returns 409 on idempotency conflict (different data)', async () => {
  const env = createMockEnv();
  
  // First request
  const request1 = createRequest('POST', {
    guestName: 'João',
    message: 'Primeira mensagem',
    consentGiven: true,
  }, { 'Idempotency-Key': 'conflict-key' });
  await onRequest({ request: request1, env });
  
  // Replay with different message
  const request2 = createRequest('POST', {
    guestName: 'João',
    message: 'Mensagem diferente', // Changed
    consentGiven: true,
  }, { 'Idempotency-Key': 'conflict-key' });
  const response2 = await onRequest({ request: request2, env });
  
  assert.equal(response2.status, 409);
  const data = await response2.json();
  assert.match(data.error, /Conflito.*idempotência/i);
});

// GET tests
test('GET returns empty list when no messages', async () => {
  const env = createMockEnv();
  const request = createRequest('GET');
  
  const response = await onRequest({ request, env });
  
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(Array.isArray(data.messages));
  assert.equal(data.messages.length, 0);
  assert.equal(data.nextCursor, null);
});

test('GET returns messages in DESC order', async () => {
  const env = createMockEnv([
    { id: 'id-1', wedding_key: 'dani-carine', guest_name: 'First', message: 'Msg1', consent_given: 1, created_at: '2026-11-06T10:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'fp1' },
    { id: 'id-2', wedding_key: 'dani-carine', guest_name: 'Second', message: 'Msg2', consent_given: 1, created_at: '2026-11-06T11:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'fp2' },
  ]);
  const request = createRequest('GET');
  
  const response = await onRequest({ request, env });
  assert.equal(response.status, 200);
  const data = await response.json();
  
  assert.equal(data.messages.length, 2);
  assert.equal(data.messages[0].id, 'id-2'); // Newest first
  assert.equal(data.messages[1].id, 'id-1');
});

test('GET returns only public fields', async () => {
  const env = createMockEnv([
    { id: 'id-1', wedding_key: 'dani-carine', guest_name: 'João', message: 'Msg', consent_given: 1, created_at: '2026-11-06T10:00:00.000Z', idempotency_key: 'secret-key', idempotency_fingerprint: 'secret-fp' },
  ]);
  const request = createRequest('GET');
  
  const response = await onRequest({ request, env });
  const data = await response.json();
  const msg = data.messages[0];
  
  assert.ok(msg.id);
  assert.ok(msg.guestName);
  assert.ok(msg.message);
  assert.ok(msg.createdAt);
  assert.equal(msg.idempotency_key, undefined);
  assert.equal(msg.idempotency_fingerprint, undefined);
  assert.equal(msg.consent_given, undefined);
});

test('GET respects limit parameter', async () => {
  const env = createMockEnv([
    { id: 'id-1', wedding_key: 'dani-carine', guest_name: 'A', message: 'M', consent_given: 1, created_at: '2026-11-06T10:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'f1' },
    { id: 'id-2', wedding_key: 'dani-carine', guest_name: 'B', message: 'M', consent_given: 1, created_at: '2026-11-06T11:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'f2' },
    { id: 'id-3', wedding_key: 'dani-carine', guest_name: 'C', message: 'M', consent_given: 1, created_at: '2026-11-06T12:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'f3' },
  ]);
  const request = new Request('https://casebem.pages.dev/api/messages?limit=2', {
    headers: { 'Origin': 'https://casebem.pages.dev' },
  });
  
  const response = await onRequest({ request, env });
  const data = await response.json();
  assert.equal(data.messages.length, 2);
});

test('GET validates limit parameter', async () => {
  const env = createMockEnv();
  
  // Limit too low
  const requestLow = new Request('https://casebem.pages.dev/api/messages?limit=2', {
    headers: { 'Origin': 'https://casebem.pages.dev' },
  });
  const responseLow = await onRequest({ request: requestLow, env });
  assert.equal(responseLow.status, 400);
  
  // Limit too high
  const requestHigh = new Request('https://casebem.pages.dev/api/messages?limit=51', {
    headers: { 'Origin': 'https://casebem.pages.dev' },
  });
  const responseHigh = await onRequest({ request: requestHigh, env });
  assert.equal(responseHigh.status, 400);
});

test('GET returns 503 when DB not configured', async () => {
  const envNoDb = { RSVP_SECRET: 'test' };
  const request = createRequest('GET');
  
  const response = await onRequest({ request, env: envNoDb });
  assert.equal(response.status, 503);
});

test('unsupported method returns 405', async () => {
  const env = createMockEnv();
  const request = new Request('https://casebem.pages.dev/api/messages', {
    method: 'DELETE',
    headers: { 'Origin': 'https://casebem.pages.dev' },
  });
  
  const response = await onRequest({ request, env });
  assert.equal(response.status, 405);
  const data = await response.json();
  assert.match(data.error, /não suportado/i);
});

test('POST validates Origin header', async () => {
  const env = createMockEnv();
  const request = createRequest('POST', {
    guestName: 'Test',
    message: 'Message',
    consentGiven: true,
  }, { 
    'Origin': 'https://evil.com', // Invalid origin
    'Idempotency-Key': 'key',
  });
  
  const response = await onRequest({ request, env });
  assert.equal(response.status, 403);
  const data = await response.json();
  assert.match(data.error, /Origin não permitido/i);
});

test('GET validates Origin header', async () => {
  const env = createMockEnv();
  const request = new Request('https://casebem.pages.dev/api/messages', {
    headers: { 'Origin': 'https://evil.com' },
  });
  
  const response = await onRequest({ request, env });
  assert.equal(response.status, 403);
});
