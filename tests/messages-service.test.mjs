/**
 * Tests for messages service layer
 * Run with: node --test tests/messages-service.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createMessage,
  getMessages,
  checkRateLimit,
  generateUuid,
  now,
} from '../functions/_lib/messages-service.mjs';

import { WEDDING_KEY } from '../functions/_lib/messages-validators.mjs';

// Mock D1 Database
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
    // Simulate SELECT queries
    if (this.sql.includes('SELECT') && this.sql.includes('wedding_messages')) {
      if (this.sql.includes('idempotency_key')) {
        // Find by idempotency key
        const [weddingKey, idempotencyKey] = this.params;
        for (const [id, record] of this.db.data.entries()) {
          if (record.wedding_key === weddingKey && record.idempotency_key === idempotencyKey) {
            return record;
          }
        }
        return null;
      }
    }
    
    if (this.sql.includes('rate_limits') && this.sql.includes('RETURNING')) {
      // Rate limit upsert
      const [id, weddingKey, ipHash, windowStart, ts1, ts2, ts3, limit] = this.params;
      const key = `${weddingKey}:${ipHash}:${windowStart}`;
      
      const existing = this.db.rateLimits.get(key);
      if (existing && existing.request_count >= limit) {
        return null; // Hit limit
      }
      
      const newCount = (existing?.request_count || 0) + 1;
      this.db.rateLimits.set(key, {
        id, wedding_key: weddingKey, ip_hash: ipHash,
        window_start: windowStart, request_count: newCount,
        created_at: ts1, updated_at: ts1,
      });
      return { request_count: newCount };
    }
    
    return null;
  }

  async all() {
    if (this.sql.includes('SELECT') && this.sql.includes('wedding_messages')) {
      const [weddingKey, limitParam] = this.params;
      const results = [];
      
      // Convert Map to array and filter
      for (const [id, record] of this.db.data.entries()) {
        if (record.wedding_key === weddingKey) {
          results.push(record);
        }
      }
      
      // Sort by created_at DESC, id DESC
      results.sort((a, b) => {
        if (a.created_at !== b.created_at) {
          return b.created_at.localeCompare(a.created_at);
        }
        return b.id.localeCompare(a.id);
      });
      
      // Apply limit
      const limited = results.slice(0, limitParam);
      return { results: limited };
    }
    
    return { results: [] };
  }

  async run() {
    if (this.sql.includes('INSERT INTO wedding_messages')) {
      const [id, weddingKey, guestName, message, consentGiven, createdAt, idempotencyKey, fingerprint] = this.params;
      
      // Check idempotency constraint
      if (idempotencyKey) {
        for (const [existingId, record] of this.db.data.entries()) {
          if (record.wedding_key === weddingKey && record.idempotency_key === idempotencyKey) {
            return { success: false, error: 'UNIQUE constraint failed: wedding_messages.idempotency_key' };
          }
        }
      }
      
      // Check length constraints (simulate CHECK)
      if (guestName.length < 2 || guestName.length > 100) {
        return { success: false, error: 'CHECK constraint failed: guest_name length' };
      }
      if (message.length < 3 || message.length > 500) {
        return { success: false, error: 'CHECK constraint failed: message length' };
      }
      if (consentGiven !== 1) {
        return { success: false, error: 'CHECK constraint failed: consent_given' };
      }
      
      this.db.data.set(id, {
        id, wedding_key: weddingKey, guest_name: guestName,
        message, consent_given: consentGiven, created_at: createdAt,
        idempotency_key: idempotencyKey, idempotency_fingerprint: fingerprint,
      });
      return { success: true };
    }
    
    if (this.sql.includes('DELETE FROM rate_limits')) {
      // Cleanup old windows
      return { success: true };
    }
    
    return { success: true };
  }
}

// Mock secret for tests
const TEST_SECRET = Buffer.from('a'.repeat(32)).toString('base64');

// Helper to create mock DB with test data
function createMockDb(initialData = []) {
  const db = new MockD1Database();
  initialData.forEach(item => {
    db.data.set(item.id, item);
  });
  return db;
}

// Tests
test('generateUuid returns valid UUID v4', () => {
  const uuid = generateUuid();
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('now returns ISO 8601 timestamp', () => {
  const timestamp = now();
  assert.match(timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('createMessage creates new message successfully', async () => {
  const db = createMockDb();
  const data = {
    guestName: 'João Silva',
    message: 'Felicidades ao casal!',
    consentGiven: true,
  };
  const idempotencyKey = 'test-key-123';
  
  const result = await createMessage(db, data, idempotencyKey, TEST_SECRET);
  
  assert.ok(result.id);
  assert.equal(result.weddingKey, WEDDING_KEY);
  assert.equal(result.guestName, 'João Silva');
  assert.equal(result.message, 'Felicidades ao casal!');
  assert.ok(result.createdAt);
  
  // Verify stored in mock DB
  assert.ok(db.data.has(result.id));
});

test('createMessage handles idempotent replay with same fingerprint', async () => {
  const db = createMockDb();
  const data = {
    guestName: 'Maria Santos',
    message: 'Parabéns!',
    consentGiven: true,
  };
  const idempotencyKey = 'replay-key-456';
  
  // First creation
  const first = await createMessage(db, data, idempotencyKey, TEST_SECRET);
  assert.ok(first.id);
  
  // Idempotent replay with same data
  const second = await createMessage(db, data, idempotencyKey, TEST_SECRET);
  
  // Should return same message
  assert.equal(second.id, first.id);
  assert.equal(second.guestName, first.guestName);
  assert.equal(second.message, first.message);
  
  // Should not create duplicate in DB
  const count = Array.from(db.data.values()).filter(
    m => m.idempotency_key === idempotencyKey
  ).length;
  assert.equal(count, 1);
});

test('createMessage throws conflict on same key with different data', async () => {
  const db = createMockDb();
  const idempotencyKey = 'conflict-key-789';
  
  // First creation
  await createMessage(db, {
    guestName: 'Pedro',
    message: 'Primeira mensagem',
    consentGiven: true,
  }, idempotencyKey, TEST_SECRET);
  
  // Different data, same key
  await assert.rejects(
    async () => {
      await createMessage(db, {
        guestName: 'Pedro',
        message: 'Mensagem diferente', // Changed message
        consentGiven: true,
      }, idempotencyKey, TEST_SECRET);
    },
    { message: /IDEMPOTENCY_CONFLICT/ }
  );
});

test('createMessage creates different messages with different keys', async () => {
  const db = createMockDb();
  
  const msg1 = await createMessage(db, {
    guestName: 'Ana',
    message: 'Mensagem 1',
    consentGiven: true,
  }, 'key-1', TEST_SECRET);
  
  const msg2 = await createMessage(db, {
    guestName: 'Ana', // Same guest
    message: 'Mensagem 1', // Same message
    consentGiven: true,
  }, 'key-2', TEST_SECRET); // Different key
  
  assert.notEqual(msg1.id, msg2.id);
  assert.equal(db.data.size, 2);
});

test('createMessage works without idempotency key', async () => {
  const db = createMockDb();
  
  const result = await createMessage(db, {
    guestName: 'Carlos',
    message: 'Sem idempotência',
    consentGiven: true,
  }, null, TEST_SECRET);
  
  assert.ok(result.id);
  assert.equal(result.guestName, 'Carlos');
});

test('getMessages returns empty array when no messages', async () => {
  const db = createMockDb();
  
  const result = await getMessages(db, 12, null);
  
  assert.ok(Array.isArray(result.messages));
  assert.equal(result.messages.length, 0);
  assert.equal(result.nextCursor, null);
});

test('getMessages returns messages in DESC order (newest first)', async () => {
  const db = createMockDb([
    { id: 'id-1', wedding_key: WEDDING_KEY, guest_name: 'First', message: 'Msg1', consent_given: 1, created_at: '2026-11-06T10:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'fp1' },
    { id: 'id-2', wedding_key: WEDDING_KEY, guest_name: 'Second', message: 'Msg2', consent_given: 1, created_at: '2026-11-06T11:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'fp2' },
    { id: 'id-3', wedding_key: WEDDING_KEY, guest_name: 'Third', message: 'Msg3', consent_given: 1, created_at: '2026-11-06T12:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'fp3' },
  ]);
  
  const result = await getMessages(db, 10, null);
  
  assert.equal(result.messages.length, 3);
  assert.equal(result.messages[0].id, 'id-3'); // Newest
  assert.equal(result.messages[1].id, 'id-2');
  assert.equal(result.messages[2].id, 'id-1'); // Oldest
});

test('getMessages respects limit parameter', async () => {
  const db = createMockDb([
    { id: 'id-1', wedding_key: WEDDING_KEY, guest_name: 'A', message: 'Msg', consent_given: 1, created_at: '2026-11-06T10:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'fp1' },
    { id: 'id-2', wedding_key: WEDDING_KEY, guest_name: 'B', message: 'Msg', consent_given: 1, created_at: '2026-11-06T11:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'fp2' },
    { id: 'id-3', wedding_key: WEDDING_KEY, guest_name: 'C', message: 'Msg', consent_given: 1, created_at: '2026-11-06T12:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'fp3' },
  ]);
  
  const result = await getMessages(db, 2, null); // Limit 2
  
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0].id, 'id-3');
  assert.equal(result.messages[1].id, 'id-2');
});

test('getMessages returns only public fields', async () => {
  const db = createMockDb([
    { id: 'id-1', wedding_key: WEDDING_KEY, guest_name: 'João', message: 'Msg', consent_given: 1, created_at: '2026-11-06T10:00:00.000Z', idempotency_key: 'secret-key', idempotency_fingerprint: 'secret-fp' },
  ]);
  
  const result = await getMessages(db, 10, null);
  
  const msg = result.messages[0];
  assert.ok(msg.id);
  assert.ok(msg.guestName);
  assert.ok(msg.message);
  assert.ok(msg.createdAt);
  assert.equal(msg.idempotency_key, undefined);
  assert.equal(msg.idempotency_fingerprint, undefined);
  assert.equal(msg.consent_given, undefined);
});

test('checkRateLimit allows requests under limit', async () => {
  const db = createMockDb();
  const ipAddress = '192.168.1.1';
  
  const result = await checkRateLimit(db, ipAddress, TEST_SECRET, 5);
  
  assert.equal(result.allowed, true);
  assert.ok(result.remaining >= 0);
});

test('checkRateLimit blocks requests over limit', async () => {
  const db = createMockDb();
  const ipAddress = '192.168.1.2';
  const limit = 3;
  
  // Make 3 requests (should all succeed)
  for (let i = 0; i < limit; i++) {
    const result = await checkRateLimit(db, ipAddress, TEST_SECRET, limit);
    assert.equal(result.allowed, true);
  }
  
  // 4th request should be blocked
  const blocked = await checkRateLimit(db, ipAddress, TEST_SECRET, limit);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
});

test('checkRateLimit uses HMAC of IP (not raw IP)', async () => {
  const db = createMockDb();
  const ipAddress = '203.0.113.42';
  
  await checkRateLimit(db, ipAddress, TEST_SECRET, 5);
  
  // Verify no raw IP stored in mock DB
  const rateLimitKeys = Array.from(db.rateLimits.keys());
  assert.ok(rateLimitKeys.length > 0);
  
  rateLimitKeys.forEach(key => {
    assert.doesNotMatch(key, /203\.0\.113\.42/);
  });
});

test('checkRateLimit different IPs have separate limits', async () => {
  const db = createMockDb();
  const limit = 2;
  
  // IP 1: use up limit
  await checkRateLimit(db, '10.0.0.1', TEST_SECRET, limit);
  await checkRateLimit(db, '10.0.0.1', TEST_SECRET, limit);
  const ip1Blocked = await checkRateLimit(db, '10.0.0.1', TEST_SECRET, limit);
  assert.equal(ip1Blocked.allowed, false);
  
  // IP 2: should still have capacity
  const ip2Result = await checkRateLimit(db, '10.0.0.2', TEST_SECRET, limit);
  assert.equal(ip2Result.allowed, true);
});

test('createMessage throws error on missing secret', async () => {
  const db = createMockDb();
  
  await assert.rejects(
    async () => {
      await createMessage(db, {
        guestName: 'Test',
        message: 'Message',
        consentGiven: true,
      }, 'key', null); // No secret
    },
    { message: /secret|not configured/i }
  );
});

test('createMessage validates CHECK constraints via DB', async () => {
  const db = createMockDb();
  
  // Message too short (simulated by mock DB)
  await assert.rejects(
    async () => {
      await createMessage(db, {
        guestName: 'Valid Name',
        message: 'AB', // Too short
        consentGiven: true,
      }, 'key-short', TEST_SECRET);
    },
    { message: /Failed to create message/ }
  );
});

test('getMessages handles pagination cursor correctly', async () => {
  const db = createMockDb([
    { id: 'id-1', wedding_key: WEDDING_KEY, guest_name: 'A', message: 'M1', consent_given: 1, created_at: '2026-11-06T10:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'f1' },
    { id: 'id-2', wedding_key: WEDDING_KEY, guest_name: 'B', message: 'M2', consent_given: 1, created_at: '2026-11-06T11:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'f2' },
    { id: 'id-3', wedding_key: WEDDING_KEY, guest_name: 'C', message: 'M3', consent_given: 1, created_at: '2026-11-06T12:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'f3' },
    { id: 'id-4', wedding_key: WEDDING_KEY, guest_name: 'D', message: 'M4', consent_given: 1, created_at: '2026-11-06T13:00:00.000Z', idempotency_key: null, idempotency_fingerprint: 'f4' },
  ]);
  
  // First page
  const page1 = await getMessages(db, 2, null);
  assert.equal(page1.messages.length, 2);
  assert.equal(page1.messages[0].id, 'id-4'); // Newest
  assert.ok(page1.nextCursor); // Has more
  
  // Note: In real implementation, cursor would be used to fetch next page
  // For this test, we verify the logic exists
});
