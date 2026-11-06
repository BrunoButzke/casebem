import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

describe('RSVP Security Tests', () => {
  const TEST_SECRET = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

  class MockD1 {
    constructor() {
      this.data = { rsvps: [], rate_limits: [] };
    }

    async batch(statements) {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    }

    prepare(sql) {
      const mock = this;
      return {
        sql,
        bindings: [],
        bind(...args) {
          this.bindings = args;
          return this;
        },
        async run() {
          if (this.sql.includes('INSERT INTO rsvps')) {
            const [id, weddingKey, guestName, attending, adultsCount, childrenCount, observations, consentGiven, tokenHash, createdAt, updatedAt, idemKey, idemFingerprint] = this.bindings;
            
            // Check UNIQUE constraint
            const existing = mock.data.rsvps.find(r => r.wedding_key === weddingKey && r.idempotency_key === idemKey);
            if (existing) {
              throw new Error('UNIQUE constraint failed: rsvps.idempotency_key');
            }
            
            mock.data.rsvps.push({
              id, wedding_key: weddingKey, guest_name: guestName, attending,
              adults_count: adultsCount, children_count: childrenCount, observations,
              consent_given: consentGiven, manage_token_hash: tokenHash,
              created_at: createdAt, updated_at: updatedAt,
              idempotency_key: idemKey,
              idempotency_fingerprint: idemFingerprint
            });
            return { success: true };
          }
          if (this.sql.includes('INSERT INTO rate_limits')) {
            const [id, weddingKey, ipHash, windowStart, timestamp1, timestamp2, timestamp3, limit] = this.bindings;
            const existing = mock.data.rate_limits.find(l => l.id === id);
            if (existing) {
              if (Number(existing.request_count) >= limit) {
                return { success: false };
              }
              existing.request_count = Number(existing.request_count) + 1;
              existing.updated_at = timestamp3;
              return { success: true };
            } else {
              mock.data.rate_limits.push({
                id, wedding_key: weddingKey, ip_hash: ipHash, window_start: windowStart,
                request_count: 1, created_at: timestamp1, updated_at: timestamp2
              });
              return { success: true };
            }
          }
          if (this.sql.includes('DELETE FROM rate_limits')) {
            mock.data.rate_limits = [];
            return { success: true };
          }
          return { success: false };
        },
        async first() {
          if (this.sql.includes('FROM rsvps')) {
            if (this.bindings.length === 2 && this.sql.includes('idempotency_key')) {
              const [weddingKey, idemKey] = this.bindings;
              return mock.data.rsvps.find(r => r.wedding_key === weddingKey && r.idempotency_key === idemKey) || null;
            } else {
              const [tokenHash, weddingKey] = this.bindings;
              return mock.data.rsvps.find(r => r.manage_token_hash === tokenHash && r.wedding_key === weddingKey) || null;
            }
          }
          if (this.sql.includes('RETURNING request_count')) {
            const runResult = await this.run();
            if (!runResult.success) {
              return null; // Hit limit
            }
            const [id] = this.bindings;
            const limit = mock.data.rate_limits.find(l => l.id === id);
            return limit ? { request_count: limit.request_count } : null;
          }
          if (this.sql.includes('FROM rate_limits')) {
            const [id] = this.bindings;
            return mock.data.rate_limits.find(l => l.id === id) || null;
          }
          return null;
        }
      };
    }
  }

  describe('CORS', () => {
    it('should reject evil Origin with 403', async () => {
      const { onRequest } = await import('../functions/api/rsvp.js');
      const db = new MockD1();

      const request = new Request('https://casebem.pages.dev/api/rsvp', {
        method: 'POST',
        headers: {
          'Origin': 'https://evil.com',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'test-key'
        },
        body: JSON.stringify({
          guestName: 'Evil',
          attending: true,
          adultsCount: 0,
          childrenCount: 0,
          consentGiven: true
        })
      });

      const response = await onRequest({ request, env: { DB: db, RSVP_SECRET: TEST_SECRET } });
      assert.equal(response.status, 403);
    });

    it('should allow preview URL Origin', async () => {
      const { onRequest } = await import('../functions/api/rsvp.js');
      const db = new MockD1();

      const request = new Request('https://casebem.pages.dev/api/rsvp', {
        method: 'POST',
        headers: {
          'Origin': 'https://preview-abc.casebem.pages.dev',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'test-key-preview',
          'CF-Connecting-IP': '1.1.1.1'
        },
        body: JSON.stringify({
          guestName: 'Preview',
          attending: true,
          adultsCount: 0,
          childrenCount: 0,
          consentGiven: true
        })
      });

      const response = await onRequest({ request, env: { DB: db, RSVP_SECRET: TEST_SECRET } });
      assert.notEqual(response.status, 403); // Should be 201 or other valid status
    });

    it('should reject evil Origin on OPTIONS', async () => {
      const { onRequest } = await import('../functions/api/rsvp.js');
      const db = new MockD1();

      const request = new Request('https://casebem.pages.dev/api/rsvp', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://attacker.com'
        }
      });

      const response = await onRequest({ request, env: { DB: db, RSVP_SECRET: TEST_SECRET } });
      assert.equal(response.status, 403);
    });
  });

  describe('Rate Limiting', () => {
    it('should return 429 when rate limit hit (null first() result)', async () => {
      const { onRequest } = await import('../functions/api/rsvp.js');
      const db = new MockD1();

      // Make 10 requests to hit the limit
      for (let i = 0; i < 10; i++) {
        const request = new Request('https://casebem.pages.dev/api/rsvp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': `test-rate-${i}`,
            'CF-Connecting-IP': '1.1.1.1'
          },
          body: JSON.stringify({
            guestName: `Guest ${i}`,
            attending: true,
            adultsCount: 0,
            childrenCount: 0,
            consentGiven: true
          })
        });
        await onRequest({ request, env: { DB: db, RSVP_SECRET: TEST_SECRET } });
      }

      // 11th request should be rate limited
      const request = new Request('https://casebem.pages.dev/api/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'test-rate-11',
          'CF-Connecting-IP': '1.1.1.1'
        },
        body: JSON.stringify({
          guestName: 'Rate Limited',
          attending: true,
          adultsCount: 0,
          childrenCount: 0,
          consentGiven: true
        })
      });

      const response = await onRequest({ request, env: { DB: db, RSVP_SECRET: TEST_SECRET } });
      assert.equal(response.status, 429);
    });
  });

  describe('Batch UNIQUE Replay', () => {
    it('valid bearer + correct fingerprint returns 201 with same token', async () => {
      const { createRsvp } = await import('../functions/_lib/rsvp-service.mjs');
      const db = new MockD1();

      const data = {
        guestName: 'First',
        attending: true,
        adultsCount: 0,
        childrenCount: 0,
        observations: null,
        consentGiven: true
      };

      const idemKey = 'replay-valid';
      const result1 = await createRsvp(db, data, idemKey, TEST_SECRET, null);
      
      // Replay with same bearer
      const result2 = await createRsvp(db, data, idemKey, TEST_SECRET, result1.manageToken);
      
      assert.equal(result2.id, result1.id);
      assert.equal(result2.manageToken, result1.manageToken);
      assert.equal(db.data.rsvps.length, 1); // Only one record
    });

    it('wrong bearer returns UNAUTHORIZED', async () => {
      const { createRsvp } = await import('../functions/_lib/rsvp-service.mjs');
      const db = new MockD1();

      const data = {
        guestName: 'Second',
        attending: true,
        adultsCount: 0,
        childrenCount: 0,
        observations: null,
        consentGiven: true
      };

      const idemKey = 'replay-wrong-bearer';
      const result1 = await createRsvp(db, data, idemKey, TEST_SECRET, null);
      
      // Replay with wrong bearer should throw UNAUTHORIZED
      try {
        await createRsvp(db, data, idemKey, TEST_SECRET, 'wrong-token');
        assert.fail('Should have thrown UNAUTHORIZED');
      } catch (error) {
        assert.equal(error.message, 'UNAUTHORIZED');
      }
    });

    it('no bearer returns IDEMPOTENCY_CONFLICT', async () => {
      const { createRsvp } = await import('../functions/_lib/rsvp-service.mjs');
      const db = new MockD1();

      const data = {
        guestName: 'Third',
        attending: true,
        adultsCount: 0,
        childrenCount: 0,
        observations: null,
        consentGiven: true
      };

      const idemKey = 'replay-no-bearer';
      await createRsvp(db, data, idemKey, TEST_SECRET, null);
      
      // Replay without bearer
      try {
        await createRsvp(db, data, idemKey, TEST_SECRET, null);
        assert.fail('Should have thrown IDEMPOTENCY_CONFLICT');
      } catch (error) {
        assert.equal(error.message, 'IDEMPOTENCY_CONFLICT');
      }
    });

    it('different fingerprint returns IDEMPOTENCY_CONFLICT', async () => {
      const { createRsvp } = await import('../functions/_lib/rsvp-service.mjs');
      const db = new MockD1();

      const data1 = {
        guestName: 'Fourth',
        attending: true,
        adultsCount: 0,
        childrenCount: 0,
        observations: null,
        consentGiven: true
      };

      const idemKey = 'replay-diff-fingerprint';
      const result1 = await createRsvp(db, data1, idemKey, TEST_SECRET, null);
      
      // Replay with same bearer but different payload
      const data2 = { ...data1, adultsCount: 2 };
      try {
        await createRsvp(db, data2, idemKey, TEST_SECRET, result1.manageToken);
        assert.fail('Should have thrown IDEMPOTENCY_CONFLICT');
      } catch (error) {
        assert.equal(error.message, 'IDEMPOTENCY_CONFLICT');
      }
    });
  });
});
