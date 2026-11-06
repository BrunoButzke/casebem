/**
 * Testes de Concurrent Lease Acquisition - Bug 3
 * Valida que apenas 1 request adquire lease e processa pagamento
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCheckoutPayment } from '../functions/_lib/gifts-service.mjs';

// Mock D1 Database com suporte a lease_until e WHERE conditions
class MockD1Database {
  constructor() {
    this.data = new Map();
  }

  prepare(sql) {
    return new MockD1Statement(this, sql);
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
    if (this.sql.includes('SELECT') && this.sql.includes('checkout_intents')) {
      const [intentKey] = this.params;
      return this.db.data.get(intentKey) || null;
    }
    if (this.sql.includes('rate_limits')) {
      // Rate limit mock: sempre permitir
      return { request_count: 1 };
    }
    return null;
  }

  async run() {
    // INSERT checkout_intents (8 params: intentKey, fingerprint, amountCents, gifterName, canonicalItems, paymentMethod, created_at, updated_at)
    if (this.sql.includes('INSERT INTO checkout_intents')) {
      const [intentKey, fingerprint, amountCents, gifterName, canonicalItems, paymentMethod, createdAt, updatedAt] = this.params;
      
      if (this.db.data.has(intentKey)) {
        throw new Error('UNIQUE constraint failed: checkout_intents.intent_key');
      }
      
      this.db.data.set(intentKey, {
        intent_key: intentKey,
        fingerprint,
        provider: 'mercadopago',
        provider_reference: null,
        amount_cents: amountCents,
        gifter_name: gifterName,
        canonical_items: canonicalItems,
        payment_method: paymentMethod,
        status: 'creating',
        qr_code: null,
        qr_code_base64: null,
        created_at: createdAt,
        updated_at: updatedAt,
        lease_until: null,
      });
      
      return { success: true };
    }
    
    // UPDATE lease_until (acquire lease)
    if (this.sql.includes('UPDATE checkout_intents') && this.sql.includes('SET lease_until = ?')) {
      const [leaseUntil, updatedAt, intentKey, now] = this.params;
      const existing = this.db.data.get(intentKey);
      
      if (!existing) {
        return { success: true, changes: 0 };
      }
      
      // WHERE status = 'creating' AND (lease_until IS NULL OR lease_until < now)
      const canAcquire = existing.status === 'creating' && 
        (existing.lease_until === null || existing.lease_until < now);
      
      if (canAcquire) {
        existing.lease_until = leaseUntil;
        existing.updated_at = updatedAt;
        return { success: true, changes: 1 };
      }
      
      return { success: true, changes: 0 };
    }
    
    // UPDATE intent with payment result
    if (this.sql.includes('UPDATE checkout_intents') && this.sql.includes('provider_reference')) {
      const [providerRef, status, qrCode, qrCodeBase64, updatedAt, intentKey] = this.params;
      const existing = this.db.data.get(intentKey);
      
      if (existing) {
        existing.provider_reference = providerRef;
        existing.status = status;
        existing.qr_code = qrCode;
        existing.qr_code_base64 = qrCodeBase64;
        existing.lease_until = null; // Clear lease on completion
        existing.updated_at = updatedAt;
      }
      
      return { success: true };
    }
    
    // INSERT or UPDATE rate_limits
    if (this.sql.includes('rate_limits')) {
      return { success: true };
    }
    
    // DELETE rate_limits cleanup
    if (this.sql.includes('DELETE FROM rate_limits')) {
      return { success: true };
    }
    
    return { success: true };
  }
}

test('Promise.all: 2 concurrent requests, primeira adquire lease e processa', async () => {
  const db = new MockD1Database();
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  
  const intentKey = '550e8400-e29b-41d4-a716-446655440100';
  
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    intentKey,
  };
  
  // Mock MP payment success
  let mpCallCount = 0;
  globalThis.__testCreatePixPayment = async () => {
    mpCallCount++;
    // Simular delay para race condition
    await new Promise(resolve => setTimeout(resolve, 10));
    return {
      ok: true,
      payment: {
        id: `mp_${mpCallCount}`,
        qrCode: 'test_qr',
        qrCodeBase64: 'dGVzdA==',
      },
    };
  };
  
  // 2 requests concorrentes
  const [result1, result2] = await Promise.all([
    createCheckoutPayment(request, mockEnv, db, '127.0.0.1'),
    createCheckoutPayment(request, mockEnv, db, '127.0.0.1'),
  ]);
  
  // Limpar mock
  delete globalThis.__testCreatePixPayment;
  
  // Exatamente 1 deve ter sucesso com pagamento
  const successResults = [result1, result2].filter(r => r.ok === true && r.payment);
  const conflictResults = [result1, result2].filter(r => r.ok === false && r.error === 'INTENT_PROCESSING');
  
  assert.equal(successResults.length, 1, 'Apenas 1 request deve processar pagamento');
  assert.equal(conflictResults.length, 1, 'Outra deve receber 409 INTENT_PROCESSING');
  assert.equal(mpCallCount, 1, 'MP deve ser chamado apenas 1 vez');
  
  // Verificar que intent final está 'pending'
  const finalIntent = db.data.get(intentKey);
  assert.equal(finalIntent.status, 'pending');
  assert.equal(finalIntent.lease_until, null, 'Lease deve ser limpo após completion');
});

test('Request com fingerprint diferente recebe 409 INTENT_CONFLICT', async () => {
  const db = new MockD1Database();
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  
  const intentKey = '650e8400-e29b-41d4-a716-446655440101';
  
  // Primeira request
  const request1 = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    intentKey,
  };
  
  globalThis.__testCreatePixPayment = async () => ({
    ok: true,
    payment: { id: 'mp_conflict_1', qrCode: 'test_qr', qrCodeBase64: 'dGVzdA==' },
  });
  
  const result1 = await createCheckoutPayment(request1, mockEnv, db, '127.0.0.1');
  assert.equal(result1.ok, true);
  
  // Segunda request com dados diferentes (fingerprint diferente)
  const request2 = {
    paymentMethod: 'pix',
    gifterName: 'Maria Santos', // DIFERENTE
    items: [{ giftId: 'danca', quantity: 1 }],
    intentKey, // MESMO intentKey
  };
  
  const result2 = await createCheckoutPayment(request2, mockEnv, db, '127.0.0.1');
  
  delete globalThis.__testCreatePixPayment;
  
  assert.equal(result2.ok, false);
  assert.equal(result2.error, 'INTENT_CONFLICT');
  assert.equal(result2.status, 409);
});

test('Request repetida após pending retorna cached result', async () => {
  const db = new MockD1Database();
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  
  const intentKey = '750e8400-e29b-41d4-a716-446655440102';
  
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    intentKey,
  };
  
  let mpCallCount = 0;
  globalThis.__testCreatePixPayment = async () => {
    mpCallCount++;
    return {
      ok: true,
      payment: { id: 'mp_cache_123', qrCode: 'test_qr', qrCodeBase64: 'dGVzdA==' },
    };
  };
  
  // Primeira request
  const result1 = await createCheckoutPayment(request, mockEnv, db, '127.0.0.1');
  assert.equal(result1.ok, true);
  assert.equal(result1.fromCache, undefined);
  
  // Segunda request idêntica (intent já pending)
  const result2 = await createCheckoutPayment(request, mockEnv, db, '127.0.0.1');
  
  delete globalThis.__testCreatePixPayment;
  
  assert.equal(result2.ok, true);
  assert.equal(result2.fromCache, true, 'Deve retornar cached result');
  assert.equal(result2.payment.id, 'mp_cache_123');
  assert.equal(mpCallCount, 1, 'MP deve ser chamado apenas 1 vez');
});
