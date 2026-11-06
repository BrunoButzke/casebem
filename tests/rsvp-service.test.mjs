/**
 * Tests for RSVP service
 * Uses mock D1 database
 */

import { strict as assert } from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import {
  generateToken,
  hashToken,
  generateUuid,
  now,
  createRsvp,
  getRsvpByToken,
  updateRsvpByToken,
  checkRateLimit,
} from '../functions/_lib/rsvp-service.mjs';
import { WEDDING_KEY } from '../functions/_lib/rsvp-validators.mjs';

/**
 * Simple in-memory D1 mock
 */
class MockD1 {
  constructor() {
    this.data = {
      rsvps: [],
      rate_limits: [],
    };
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
          const [id, weddingKey, guestName, attending, adultsCount, childrenCount, observations, consentGiven, tokenHash, createdAt, updatedAt] = bindings;
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
            if (sql.includes('attending =')) {
              rsvp.attending = bindings[bindIndex++];
            }
            if (sql.includes('adults_count =')) {
              rsvp.adults_count = bindings[bindIndex++];
            }
            if (sql.includes('children_count =')) {
              rsvp.children_count = bindings[bindIndex++];
            }
            if (sql.includes('observations =')) {
              rsvp.observations = bindings[bindIndex++];
            }
            if (sql.includes('updated_at =')) {
              rsvp.updated_at = bindings[bindIndex++];
            }
            return { success: true };
          }
          return { success: false };
        }

        if (sql.includes('INSERT INTO rate_limits')) {
          const [id, weddingKey, ipHash, windowStart, createdAt, updatedAt] = bindings;
          mock.data.rate_limits.push({
            id,
            wedding_key: weddingKey,
            ip_hash: ipHash,
            window_start: windowStart,
            request_count: 1,
            created_at: createdAt,
            updated_at: updatedAt,
          });
          return { success: true };
        }

        if (sql.includes('UPDATE rate_limits')) {
          const id = bindings[bindings.length - 1];
          const updatedAt = bindings[0];
          const limit = mock.data.rate_limits.find(l => l.id === id);
          if (limit) {
            limit.request_count = Number(limit.request_count) + 1;
            limit.updated_at = updatedAt;
            return { success: true };
          }
          return { success: false };
        }

        return { success: false };
      },
      async first() {
        const sql = this.sql;
        const bindings = this.bindings;

        if (sql.includes('FROM rsvps')) {
          const [tokenHash, weddingKey] = bindings;
          return mock.data.rsvps.find(
            r => r.manage_token_hash === tokenHash && r.wedding_key === weddingKey
          ) || null;
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

describe('Token utilities', () => {
  it('generateToken should create base64url string', async () => {
    const token = await generateToken();
    assert.ok(token.length > 40);
    assert.ok(/^[A-Za-z0-9_-]+$/.test(token));
    assert.ok(!token.includes('+'));
    assert.ok(!token.includes('/'));
    assert.ok(!token.includes('='));
  });

  it('generateToken should create unique tokens', async () => {
    const token1 = await generateToken();
    const token2 = await generateToken();
    assert.notEqual(token1, token2);
  });

  it('hashToken should create consistent hash', async () => {
    const token = 'test-token-123';
    const hash1 = await hashToken(token);
    const hash2 = await hashToken(token);
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64);
    assert.ok(/^[a-f0-9]+$/.test(hash1));
  });

  it('hashToken should create different hashes for different tokens', async () => {
    const hash1 = await hashToken('token-1');
    const hash2 = await hashToken('token-2');
    assert.notEqual(hash1, hash2);
  });

  it('generateUuid should create valid UUID', () => {
    const uuid = generateUuid();
    assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid));
  });

  it('now should return ISO timestamp', () => {
    const timestamp = now();
    assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp));
    assert.ok(!isNaN(Date.parse(timestamp)));
  });
});

describe('createRsvp', () => {
  let db;

  beforeEach(() => {
    db = new MockD1();
  });

  it('should create RSVP with attending=true', async () => {
    const data = {
      guestName: 'Maria Silva',
      attending: true,
      adultsCount: 2,
      childrenCount: 1,
      observations: 'Alergia a frutos do mar',
    };

    const result = await createRsvp(db, data);

    assert.ok(result.id);
    assert.equal(result.weddingKey, WEDDING_KEY);
    assert.equal(result.guestName, 'Maria Silva');
    assert.equal(result.attending, true);
    assert.equal(result.adultsCount, 2);
    assert.equal(result.childrenCount, 1);
    assert.equal(result.observations, 'Alergia a frutos do mar');
    assert.ok(result.manageToken);
    assert.ok(result.createdAt);
    assert.ok(result.updatedAt);

    assert.equal(db.data.rsvps.length, 1);
    assert.equal(db.data.rsvps[0].guest_name, 'Maria Silva');
  });

  it('should create RSVP with attending=false', async () => {
    const data = {
      guestName: 'João Pedro',
      attending: false,
      adultsCount: 0,
      childrenCount: 0,
      observations: null,
    };

    const result = await createRsvp(db, data);

    assert.equal(result.attending, false);
    assert.equal(db.data.rsvps[0].attending, 0);
  });

  it('should store token as hash', async () => {
    const data = {
      guestName: 'Test User',
      attending: true,
      adultsCount: 0,
      childrenCount: 0,
      observations: null,
    };

    const result = await createRsvp(db, data);
    const storedTokenHash = db.data.rsvps[0].manage_token_hash;

    assert.notEqual(storedTokenHash, result.manageToken);
    assert.equal(storedTokenHash.length, 64);
  });

  it('should generate unique IDs', async () => {
    const data = {
      guestName: 'User 1',
      attending: true,
      adultsCount: 0,
      childrenCount: 0,
      observations: null,
    };

    const result1 = await createRsvp(db, data);
    const result2 = await createRsvp(db, { ...data, guestName: 'User 2' });

    assert.notEqual(result1.id, result2.id);
    assert.notEqual(result1.manageToken, result2.manageToken);
  });
});

describe('getRsvpByToken', () => {
  let db, token, rsvp;

  beforeEach(async () => {
    db = new MockD1();
    const data = {
      guestName: 'Maria Silva',
      attending: true,
      adultsCount: 2,
      childrenCount: 1,
      observations: 'Test observation',
    };
    rsvp = await createRsvp(db, data);
    token = rsvp.manageToken;
  });

  it('should retrieve RSVP with valid token', async () => {
    const result = await getRsvpByToken(db, token);

    assert.ok(result);
    assert.equal(result.id, rsvp.id);
    assert.equal(result.guestName, 'Maria Silva');
    assert.equal(result.attending, true);
    assert.equal(result.adultsCount, 2);
    assert.equal(result.childrenCount, 1);
  });

  it('should not return token in result', async () => {
    const result = await getRsvpByToken(db, token);
    assert.ok(!result.manageToken);
  });

  it('should return null for invalid token', async () => {
    const result = await getRsvpByToken(db, 'invalid-token-xyz');
    assert.equal(result, null);
  });

  it('should convert attending bit to boolean', async () => {
    const result = await getRsvpByToken(db, token);
    assert.strictEqual(result.attending, true);
    assert.strictEqual(typeof result.attending, 'boolean');
  });
});

describe('updateRsvpByToken', () => {
  let db, token, rsvp;

  beforeEach(async () => {
    db = new MockD1();
    const data = {
      guestName: 'Maria Silva',
      attending: true,
      adultsCount: 2,
      childrenCount: 1,
      observations: 'Original observation',
    };
    rsvp = await createRsvp(db, data);
    token = rsvp.manageToken;
  });

  it('should update attending status', async () => {
    const originalUpdatedAt = rsvp.updatedAt;
    
    await new Promise(resolve => setTimeout(resolve, 2));
    
    const update = { attending: false };
    const result = await updateRsvpByToken(db, token, update);

    assert.ok(result);
    assert.equal(result.attending, false);
    assert.ok(result.updatedAt >= originalUpdatedAt);
  });

  it('should update multiple fields', async () => {
    const update = {
      attending: false,
      adultsCount: 0,
      childrenCount: 0,
      observations: 'Não poderei comparecer',
    };
    const result = await updateRsvpByToken(db, token, update);

    assert.equal(result.attending, false);
    assert.equal(result.adultsCount, 0);
    assert.equal(result.childrenCount, 0);
    assert.equal(result.observations, 'Não poderei comparecer');
  });

  it('should update only specified fields', async () => {
    const update = { observations: 'Nova observação' };
    const result = await updateRsvpByToken(db, token, update);

    assert.equal(result.observations, 'Nova observação');
    assert.equal(result.attending, true);
    assert.equal(result.adultsCount, 2);
  });

  it('should preserve createdAt but update updatedAt', async () => {
    const originalCreatedAt = rsvp.createdAt;
    const originalUpdatedAt = rsvp.updatedAt;
    
    await new Promise(resolve => setTimeout(resolve, 2));
    
    const update = { attending: false };
    const result = await updateRsvpByToken(db, token, update);

    assert.equal(result.createdAt, originalCreatedAt);
    assert.ok(result.updatedAt >= originalUpdatedAt);
  });

  it('should return null for invalid token', async () => {
    const result = await updateRsvpByToken(db, 'invalid-token', { attending: false });
    assert.equal(result, null);
  });
});

describe('checkRateLimit', () => {
  let db;

  beforeEach(() => {
    db = new MockD1();
  });

  it('should allow first request', async () => {
    const result = await checkRateLimit(db, '192.168.1.1', 10);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 9);
    
    assert.equal(db.data.rate_limits.length, 1);
  });

  it('should create rate limit record', async () => {
    await checkRateLimit(db, '192.168.1.1', 10);
    
    const stored = db.data.rate_limits[0];
    assert.ok(stored.id);
    assert.equal(stored.wedding_key, WEDDING_KEY);
    assert.equal(stored.request_count, 1);
  });

  it('should track IPs separately', async () => {
    await checkRateLimit(db, '192.168.1.1', 10);
    await checkRateLimit(db, '192.168.1.2', 10);

    assert.equal(db.data.rate_limits.length, 2);
  });

  it('should not store IP in plain text', async () => {
    await checkRateLimit(db, '192.168.1.100', 10);

    const stored = db.data.rate_limits[0];
    assert.notEqual(stored.ip_hash, '192.168.1.100');
    assert.equal(stored.ip_hash.length, 64);
    assert.ok(/^[a-f0-9]+$/.test(stored.ip_hash));
  });
});
