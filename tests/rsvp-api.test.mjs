/**
 * Tests for RSVP API Handler
 * Tests the onRequest function with mock requests
 */

import { strict as assert } from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import { onRequest } from '../functions/api/rsvp.js';

// Test fixture: valid base64 secret
const TEST_SECRET = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

class MockD1 {
  constructor() {
    this.data = {
      rsvps: [],
      rate_limits: [],
    };
  }

  async batch(statements) {
    const results = [];
    for (const stmt of statements) {
      const result = await stmt.run();
      results.push(result);
    }
    return results;
  }

  prepare(sql) {
    const mock = this;
    return {
      bindings: [],
      bind(...args) {
        this.bindings = args;
        return this;
      },
      async run() {
        const sql = this.sql;
        const bindings = this.bindings;

        if (sql.includes('INSERT INTO rsvps')) {
          const [id, weddingKey, guestName, attending, adultsCount, childrenCount, observations, consentGiven, tokenHash, createdAt, updatedAt, idemKey, idemFingerprint] = bindings;
          mock.data.rsvps.push({
            id,
            wedding_key: weddingKey,
            guest_name: guestName,
            attending,
            adults_count: adultsCount,
            children_count: childrenCount,
            observations,
            consent_given: consentGiven,
            manage_token_hash: tokenHash,
            created_at: createdAt,
            updated_at: updatedAt,
            idempotency_key: idemKey,
            idempotency_fingerprint: idemFingerprint
          });
          return { success: true };
        }

        if (sql.includes('UPDATE rsvps')) {
          const tokenHash = bindings[bindings.length - 2];
          const weddingKey = bindings[bindings.length - 1];
          const rsvp = mock.data.rsvps.find(
            r => r.manage_token_hash === tokenHash && r.wedding_key === weddingKey
          );
          if (rsvp) {
            let bindIndex = 0;
            if (sql.includes('attending =')) rsvp.attending = bindings[bindIndex++];
            if (sql.includes('adults_count =')) rsvp.adults_count = bindings[bindIndex++];
            if (sql.includes('children_count =')) rsvp.children_count = bindings[bindIndex++];
            if (sql.includes('observations =')) rsvp.observations = bindings[bindIndex++];
            if (sql.includes('updated_at =')) rsvp.updated_at = bindings[bindIndex++];
            return { success: true };
          }
          return { success: false };
        }

        if (sql.includes('INSERT INTO rate_limits')) {
          // UPSERT with RETURNING
          const [id, weddingKey, ipHash, windowStart, timestamp1, timestamp2, timestamp3, limit] = bindings;
          
          const existing = mock.data.rate_limits.find(l => l.id === id);
          
          if (existing) {
            // ON CONFLICT - check if under limit
            if (Number(existing.request_count) >= limit) {
              // Hit limit, no update
              return { success: false };
            }
            existing.request_count = Number(existing.request_count) + 1;
            existing.updated_at = timestamp3;
            return { success: true };
          } else {
            // New insert
            mock.data.rate_limits.push({
              id,
              wedding_key: weddingKey,
              ip_hash: ipHash,
              window_start: windowStart,
              request_count: 1,
              created_at: timestamp1,
              updated_at: timestamp2,
            });
            return { success: true };
          }
        }

        return { success: false };
      },
      async first() {
        const sql = this.sql;
        const bindings = this.bindings;

        if (sql.includes('FROM rsvps')) {
          // Check if it's idempotency lookup or token lookup
          if (bindings.length === 2 && sql.includes('idempotency_key')) {
            const [weddingKey, idemKey] = bindings;
            return mock.data.rsvps.find(
              r => r.wedding_key === weddingKey && r.idempotency_key === idemKey
            ) || null;
          } else {
            const [tokenHash, weddingKey] = bindings;
            return mock.data.rsvps.find(
              r => r.manage_token_hash === tokenHash && r.wedding_key === weddingKey
            ) || null;
          }
        }

        if (sql.includes('RETURNING request_count')) {
          // Rate limit UPSERT with RETURNING
          const runResult = await this.run();
          if (!runResult.success) {
            return null; // Hit limit
          }
          // Return the count from the upserted/updated row
          const [id] = bindings;
          const limit = mock.data.rate_limits.find(l => l.id === id);
          return limit ? { request_count: limit.request_count } : null;
        }

        if (sql.includes('FROM rate_limits')) {
          const [id] = bindings;
          return mock.data.rate_limits.find(l => l.id === id) || null;
        }

        return null;
      },
      sql,
    };
  }
}

function createMockRequest(method, body = null, headers = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'CF-Connecting-IP': '192.168.1.1',
    'Idempotency-Key': 'test-idem-' + Math.random().toString(36).slice(2),
    ...headers,
  };

  const url = 'https://casebem.pages.dev/api/rsvp';

  // Use real Request constructor from Node
  const init = {
    method,
    headers: defaultHeaders,
  };

  if (body !== null) {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}

async function parseResponse(response) {
  const text = await response.text();
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: text ? JSON.parse(text) : null,
  };
}

describe('RSVP API - POST /api/rsvp', () => {
  let db;

  beforeEach(() => {
    db = new MockD1();
  });

  it('should create RSVP with valid data', async () => {
    const payload = {
      guestName: 'Maria Silva',
      attending: true,
      adultsCount: 2,
      childrenCount: 1,
      observations: 'Alergia a frutos do mar',
      consentGiven: true,
    };

    const request = createMockRequest('POST', payload);
    const context = { request, env: { DB: db, RSVP_SECRET: TEST_SECRET } };

    const response = await onRequest(context);
    const parsed = await parseResponse(response);

    assert.equal(parsed.status, 201);
    assert.ok(parsed.body.id);
    assert.equal(parsed.body.guestName, 'Maria Silva');
    assert.equal(parsed.body.attending, true);
    assert.ok(parsed.body.manageToken);
  });

  it('should reject invalid JSON', async () => {
    const request = createMockRequest('POST', null);
    const context = { request, env: { DB: db, RSVP_SECRET: TEST_SECRET } };

    const response = await onRequest(context);
    const parsed = await parseResponse(response);

    assert.equal(parsed.status, 400);
    assert.match(parsed.body.error, /JSON inválido/i);
  });

  it('should reject missing name', async () => {
    const payload = {
      guestName: '',
      attending: true,
      adultsCount: 0,
      childrenCount: 0,
      consentGiven: true,
    };

    const request = createMockRequest('POST', payload);
    const context = { request, env: { DB: db, RSVP_SECRET: TEST_SECRET } };

    const response = await onRequest(context);
    const parsed = await parseResponse(response);

    assert.equal(parsed.status, 400);
    assert.ok(parsed.body.details.guestName);
  });

  it('should reject without consent', async () => {
    const payload = {
      guestName: 'Test User',
      attending: true,
      adultsCount: 0,
      childrenCount: 0,
      consentGiven: false,
    };

    const request = createMockRequest('POST', payload);
    const context = { request, env: { DB: db, RSVP_SECRET: TEST_SECRET } };

    const response = await onRequest(context);
    const parsed = await parseResponse(response);

    assert.equal(parsed.status, 400);
    assert.ok(parsed.body.details.consentGiven);
  });

  it('should reject invalid Content-Type', async () => {
    const request = createMockRequest('POST', {}, { 'Content-Type': 'text/plain' });
    const context = { request, env: { DB: db, RSVP_SECRET: TEST_SECRET } };

    const response = await onRequest(context);
    const parsed = await parseResponse(response);

    assert.equal(parsed.status, 400);
    assert.match(parsed.body.error, /Content-Type/);
  });

  it('should include CORS headers', async () => {
    const payload = {
      guestName: 'Test',
      attending: true,
      adultsCount: 0,
      childrenCount: 0,
      consentGiven: true,
    };

    const request = createMockRequest('POST', payload);
    const context = { request, env: { DB: db, RSVP_SECRET: TEST_SECRET } };

    const response = await onRequest(context);

    assert.ok(response.headers.get('Access-Control-Allow-Origin'));
  });
});

describe('RSVP API - GET /api/rsvp', () => {
  let db, token;

  beforeEach(async () => {
    db = new MockD1();
    
    const createPayload = {
      guestName: 'Maria Silva',
      attending: true,
      adultsCount: 2,
      childrenCount: 1,
      observations: 'Test',
      consentGiven: true,
    };

    const createRequest = createMockRequest('POST', createPayload);
    const createContext = { request: createRequest, env: { DB: db, RSVP_SECRET: TEST_SECRET } };
    const createResponse = await onRequest(createContext);
    const createParsed = await parseResponse(createResponse);
    token = createParsed.body.manageToken;
  });

  it('should retrieve RSVP with valid token', async () => {
    const request = createMockRequest('GET', null, {
      'Authorization': `Bearer ${token}`,
    });
    const context = { request, env: { DB: db, RSVP_SECRET: TEST_SECRET } };

    const response = await onRequest(context);
    const parsed = await parseResponse(response);

    assert.equal(parsed.status, 200);
    assert.equal(parsed.body.guestName, 'Maria Silva');
    assert.ok(!parsed.body.manageToken);
  });

  it('should reject without token', async () => {
    const request = createMockRequest('GET', null);
    const context = { request, env: { DB: db, RSVP_SECRET: TEST_SECRET } };

    const response = await onRequest(context);
    const parsed = await parseResponse(response);

    assert.equal(parsed.status, 401);
  });

  it('should reject invalid token', async () => {
    const request = createMockRequest('GET', null, {
      'Authorization': 'Bearer invalid-token-xyz',
    });
    const context = { request, env: { DB: db, RSVP_SECRET: TEST_SECRET } };

    const response = await onRequest(context);
    const parsed = await parseResponse(response);

    assert.equal(parsed.status, 401);
  });
});

describe('RSVP API - PUT /api/rsvp', () => {
  let db, token;

  beforeEach(async () => {
    db = new MockD1();
    
    const createPayload = {
      guestName: 'Maria Silva',
      attending: true,
      adultsCount: 2,
      childrenCount: 1,
      observations: 'Test',
      consentGiven: true,
    };

    const createRequest = createMockRequest('POST', createPayload);
    const createContext = { request: createRequest, env: { DB: db, RSVP_SECRET: TEST_SECRET } };
    const createResponse = await onRequest(createContext);
    const createParsed = await parseResponse(createResponse);
    token = createParsed.body.manageToken;
  });

  it('should update RSVP with valid token', async () => {
    const updatePayload = {
      attending: false,
      adultsCount: 0,
      childrenCount: 0,
      observations: 'Não poderei comparecer',
    };

    const request = createMockRequest('PUT', updatePayload, {
      'Authorization': `Bearer ${token}`,
    });
    const context = { request, env: { DB: db, RSVP_SECRET: TEST_SECRET } };

    const response = await onRequest(context);
    const parsed = await parseResponse(response);

    assert.equal(parsed.status, 200);
    assert.equal(parsed.body.attending, false);
    assert.equal(parsed.body.adultsCount, 0);
    assert.equal(parsed.body.observations, 'Não poderei comparecer');
  });

  it('should reject without token', async () => {
    const request = createMockRequest('PUT', { attending: false });
    const context = { request, env: { DB: db, RSVP_SECRET: TEST_SECRET } };

    const response = await onRequest(context);
    const parsed = await parseResponse(response);

    assert.equal(parsed.status, 401);
  });

  it('should reject invalid data', async () => {
    const request = createMockRequest('PUT', { adultsCount: -1 }, {
      'Authorization': `Bearer ${token}`,
    });
    const context = { request, env: { DB: db, RSVP_SECRET: TEST_SECRET } };

    const response = await onRequest(context);
    const parsed = await parseResponse(response);

    assert.equal(parsed.status, 400);
  });
});

describe('RSVP API - OPTIONS /api/rsvp', () => {
  it('should handle OPTIONS request', async () => {
    const request = createMockRequest('OPTIONS');
    const context = { request, env: { DB: new MockD1() } };

    const response = await onRequest(context);

    assert.equal(response.status, 204);
    assert.ok(response.headers.get('Access-Control-Allow-Methods'));
  });
});

describe('RSVP API - Unsupported methods', () => {
  it('should reject DELETE', async () => {
    const request = createMockRequest('DELETE');
    const context = { request, env: { DB: new MockD1(), RSVP_SECRET: TEST_SECRET } };

    const response = await onRequest(context);
    const parsed = await parseResponse(response);

    assert.equal(parsed.status, 405);
  });
});

describe('RSVP API - Missing DB binding', () => {
  it('should return 503 if DB not configured', async () => {
    const request = createMockRequest('POST', {
      guestName: 'Test',
      attending: true,
      adultsCount: 0,
      childrenCount: 0,
      consentGiven: true,
    });
    const context = { request, env: {} };

    const response = await onRequest(context);
    const parsed = await parseResponse(response);

    assert.equal(parsed.status, 503);
  });
});
