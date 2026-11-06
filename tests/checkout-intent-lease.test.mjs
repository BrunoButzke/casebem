/**
 * Testes de Intent Lease FSM - Bug 3
 * Valida comportamento de lease TTL e concurrent requests
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOrCreateIntent, acquireLease, releaseLease } from '../functions/_lib/checkout-idempotency.mjs';

// Mock D1 Database com suporte a lease_until
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
    if (this.sql.includes('COUNT(*)')) {
      const [intentKey] = this.params;
      return { count: this.db.data.has(intentKey) ? 1 : 0 };
    }
    return null;
  }

  async run() {
    if (this.sql.includes('INSERT INTO checkout_intents')) {
      // Params com ou sem lease_until no final
      const [intentKey, fingerprint, provider, providerRef, amountCents, gifterName, canonicalItems, paymentMethod, status, createdAt, updatedAt, leaseUntil] = this.params;
      
      // Check UNIQUE constraint
      if (this.db.data.has(intentKey)) {
        throw new Error('UNIQUE constraint failed: checkout_intents.intent_key');
      }
      
      this.db.data.set(intentKey, {
        intent_key: intentKey,
        fingerprint,
        provider,
        provider_reference: providerRef,
        amount_cents: amountCents,
        gifter_name: gifterName,
        canonical_items: canonicalItems,
        payment_method: paymentMethod,
        status,
        qr_code: null,
        qr_code_base64: null,
        created_at: createdAt,
        updated_at: updatedAt,
        lease_until: leaseUntil !== undefined ? leaseUntil : null,
      });
      
      return { success: true };
    }
    
    if (this.sql.includes('UPDATE checkout_intents') && this.sql.includes('lease_until')) {
      // Lease acquisition/release: WHERE conditions matter
      const existing = this.db.data.get(this.params[2]); // intentKey is 3rd param
      
      if (!existing) {
        return { success: true, changes: 0 };
      }
      
      if (this.sql.includes('SET lease_until = ?')) {
        // Acquire lease - check WHERE conditions
        const [leaseUntil, updatedAt, intentKey, now] = this.params;
        
        // WHERE status = 'creating' AND (lease_until IS NULL OR lease_until < now)
        const canAcquire = existing.status === 'creating' && 
          (existing.lease_until === null || existing.lease_until < now);
        
        if (canAcquire) {
          existing.lease_until = leaseUntil;
          existing.updated_at = updatedAt;
          return { success: true, changes: 1 };
        }
        
        return { success: true, changes: 0 };
      } else if (this.sql.includes('SET lease_until = NULL')) {
        // Release lease - no WHERE conditions
        const [updatedAt, intentKey] = this.params;
        existing.lease_until = null;
        existing.updated_at = updatedAt;
        return { success: true, changes: 1 };
      }
      
      return { success: true, changes: 0 };
    }
    
    if (this.sql.includes('UPDATE checkout_intents')) {
      // Regular payment update
      const [providerRef, status, qrCode, qrCodeBase64, updatedAt, intentKey] = this.params;
      const existing = this.db.data.get(intentKey);
      
      if (existing) {
        existing.provider_reference = providerRef;
        existing.status = status;
        existing.qr_code = qrCode;
        existing.qr_code_base64 = qrCodeBase64;
        existing.updated_at = updatedAt;
      }
      
      return { success: true };
    }
    
    return { success: true };
  }
}

/**
 * Clock injetável para testar TTL sem aguardar 120s real
 */
class MockClock {
  constructor(initialTime = '2024-01-01T00:00:00.000Z') {
    this.currentTime = new Date(initialTime);
  }

  now() {
    return this.currentTime.toISOString();
  }

  advance(seconds) {
    this.currentTime = new Date(this.currentTime.getTime() + seconds * 1000);
  }
}

test('acquireLease: primeira request adquire lease com TTL 120s', async () => {
  const db = new MockD1Database();
  const clock = new MockClock('2024-01-01T12:00:00.000Z');
  
  const intentKey = '550e8400-e29b-41d4-a716-446655440001';
  const fingerprint = 'a'.repeat(64);
  
  // Primeiro insere intent com status "creating" mas sem lease
  await db.prepare(
    `INSERT INTO checkout_intents (
      intent_key, fingerprint, provider, provider_reference,
      amount_cents, gifter_name, canonical_items, payment_method,
      status, created_at, updated_at, lease_until
    ) VALUES (?, ?, 'mercadopago', NULL, 10000, 'Test', '[]', 'pix', 'creating', ?, ?, NULL)`
  ).bind(intentKey, fingerprint, clock.now(), clock.now()).run();
  
  // Tentar adquirir lease
  const acquired = await acquireLease(db, intentKey, 120, clock);
  
  assert.equal(acquired, true);
  
  // Verificar que lease_until foi setado para now + 120s
  const intent = await db.prepare('SELECT lease_until FROM checkout_intents WHERE intent_key = ?')
    .bind(intentKey).first();
  
  const expectedLeaseUntil = new Date(clock.currentTime.getTime() + 120 * 1000).toISOString();
  assert.equal(intent.lease_until, expectedLeaseUntil);
});

test('acquireLease: segunda request concurrent falha enquanto lease ativo', async () => {
  const db = new MockD1Database();
  const clock = new MockClock('2024-01-01T12:00:00.000Z');
  
  const intentKey = '550e8400-e29b-41d4-a716-446655440002';
  const fingerprint = 'b'.repeat(64);
  
  // Insere intent com lease já ativo (expires em 120s)
  const leaseUntil = new Date(clock.currentTime.getTime() + 120 * 1000).toISOString();
  await db.prepare(
    `INSERT INTO checkout_intents (
      intent_key, fingerprint, provider, provider_reference,
      amount_cents, gifter_name, canonical_items, payment_method,
      status, created_at, updated_at, lease_until
    ) VALUES (?, ?, 'mercadopago', NULL, 10000, 'Test', '[]', 'pix', 'creating', ?, ?, ?)`
  ).bind(intentKey, fingerprint, clock.now(), clock.now(), leaseUntil).run();
  
  // Segunda request tenta adquirir lease
  const acquired = await acquireLease(db, intentKey, 120, clock);
  
  assert.equal(acquired, false, 'Não deve adquirir lease se outro já tem ownership');
});

test('acquireLease: request após TTL 120s expira pode adquirir lease', async () => {
  const db = new MockD1Database();
  const clock = new MockClock('2024-01-01T12:00:00.000Z');
  
  const intentKey = '550e8400-e29b-41d4-a716-446655440003';
  const fingerprint = 'c'.repeat(64);
  
  // Insere intent com lease expirado (120s no passado)
  const expiredLeaseUntil = new Date(clock.currentTime.getTime() - 1000).toISOString();
  await db.prepare(
    `INSERT INTO checkout_intents (
      intent_key, fingerprint, provider, provider_reference,
      amount_cents, gifter_name, canonical_items, payment_method,
      status, created_at, updated_at, lease_until
    ) VALUES (?, ?, 'mercadopago', NULL, 10000, 'Test', '[]', 'pix', 'creating', ?, ?, ?)`
  ).bind(intentKey, fingerprint, clock.now(), clock.now(), expiredLeaseUntil).run();
  
  // Avançar clock além do TTL original
  clock.advance(121);
  
  // Nova request tenta adquirir lease
  const acquired = await acquireLease(db, intentKey, 120, clock);
  
  assert.equal(acquired, true, 'Deve adquirir lease se TTL anterior expirou');
  
  // Verificar novo lease_until
  const intent = await db.prepare('SELECT lease_until FROM checkout_intents WHERE intent_key = ?')
    .bind(intentKey).first();
  
  const expectedNewLease = new Date(clock.currentTime.getTime() + 120 * 1000).toISOString();
  assert.equal(intent.lease_until, expectedNewLease);
});

test('releaseLease: limpa lease_until e permite nova acquisition', async () => {
  const db = new MockD1Database();
  const clock = new MockClock('2024-01-01T12:00:00.000Z');
  
  const intentKey = '550e8400-e29b-41d4-a716-446655440004';
  const fingerprint = 'd'.repeat(64);
  
  // Insere intent com lease ativo
  const leaseUntil = new Date(clock.currentTime.getTime() + 120 * 1000).toISOString();
  await db.prepare(
    `INSERT INTO checkout_intents (
      intent_key, fingerprint, provider, provider_reference,
      amount_cents, gifter_name, canonical_items, payment_method,
      status, created_at, updated_at, lease_until
    ) VALUES (?, ?, 'mercadopago', NULL, 10000, 'Test', '[]', 'pix', 'creating', ?, ?, ?)`
  ).bind(intentKey, fingerprint, clock.now(), clock.now(), leaseUntil).run();
  
  // Release do lease
  await releaseLease(db, intentKey);
  
  // Verificar que lease_until foi limpo
  const intent = await db.prepare('SELECT lease_until FROM checkout_intents WHERE intent_key = ?')
    .bind(intentKey).first();
  
  assert.equal(intent.lease_until, null);
  
  // Deve poder adquirir novamente
  const reacquired = await acquireLease(db, intentKey, 120, clock);
  assert.equal(reacquired, true);
});

test('getOrCreateIntent: status "pending" não permite lease acquisition', async () => {
  const db = new MockD1Database();
  const clock = new MockClock('2024-01-01T12:00:00.000Z');
  
  const intentKey = '550e8400-e29b-41d4-a716-446655440005';
  const fingerprint = 'e'.repeat(64);
  
  // Insere intent com status "pending" (já pago)
  await db.prepare(
    `INSERT INTO checkout_intents (
      intent_key, fingerprint, provider, provider_reference,
      amount_cents, gifter_name, canonical_items, payment_method,
      status, created_at, updated_at, lease_until
    ) VALUES (?, ?, 'mercadopago', 'mp_ref_123', 10000, 'Test', '[]', 'pix', 'pending', ?, ?, NULL)`
  ).bind(intentKey, fingerprint, clock.now(), clock.now()).run();
  
  // Tentar adquirir lease sobre intent finalizado
  const acquired = await acquireLease(db, intentKey, 120, clock);
  
  assert.equal(acquired, false, 'Não deve adquirir lease se status não é "creating"');
});

test('concurrent requests: apenas uma adquire lease, outras recebem 409', async () => {
  const db = new MockD1Database();
  const clock = new MockClock('2024-01-01T12:00:00.000Z');
  const secret = Buffer.from('a'.repeat(32)).toString('base64');
  
  const intentKey = '550e8400-e29b-41d4-a716-446655440006';
  const fingerprint = 'f'.repeat(64);
  
  const params = {
    intentKey,
    fingerprint,
    gifterName: 'Concurrent Test',
    items: [{ giftId: 'danca', quantity: 1 }],
    paymentMethod: 'pix',
    amountCents: 10000,
  };
  
  // Simular 3 requests concorrentes com Promise.all
  const results = await Promise.all([
    getOrCreateIntent(db, params, secret, clock),
    getOrCreateIntent(db, params, secret, clock),
    getOrCreateIntent(db, params, secret, clock),
  ]);
  
  // Apenas um deve ter status "creating" com lease
  const creatingResults = results.filter(r => r.status === 'creating');
  const conflictResults = results.filter(r => r.conflict === true);
  
  assert.equal(creatingResults.length, 1, 'Apenas uma request deve adquirir lease');
  assert.equal(conflictResults.length, 2, 'Outras 2 devem receber 409 conflict');
  
  // Verificar que existe apenas 1 intent no DB
  const intents = await db.prepare('SELECT COUNT(*) as count FROM checkout_intents WHERE intent_key = ?')
    .bind(intentKey).first();
  
  assert.equal(intents.count, 1);
});
