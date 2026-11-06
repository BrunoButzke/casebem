/**
 * Tests for checkout idempotency system
 * Run with: node --test tests/checkout-idempotency.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCheckoutFingerprint,
  generateMPIdempotencyKey,
  isValidIntentKey,
  getOrCreateIntent,
  updateIntentWithPayment,
} from '../functions/_lib/checkout-idempotency.mjs';

// Mock D1 Database
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
    return null;
  }

  async run() {
    if (this.sql.includes('INSERT INTO checkout_intents')) {
      const [intentKey, fingerprint, provider, providerRef, amountCents, gifterName, canonicalItems, paymentMethod, status, createdAt, updatedAt] = this.params;
      
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
      });
      
      return { success: true };
    }
    
    if (this.sql.includes('UPDATE checkout_intents')) {
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

const TEST_SECRET = Buffer.from('a'.repeat(32)).toString('base64');

test('createCheckoutFingerprint normaliza payload canonicamente', async () => {
  const data1 = {
    gifterName: 'João Silva',
    items: [
      { giftId: 'danca', quantity: 2 },
      { giftId: 'spa', quantity: 1 },
    ],
    paymentMethod: 'pix',
    amountCents: 45000,
  };

  const data2 = {
    gifterName: 'João   Silva',  // Espaços extras
    items: [
      { giftId: 'spa', quantity: 1 },    // Ordem diferente
      { giftId: 'danca', quantity: 2 },
    ],
    paymentMethod: 'pix',
    amountCents: 45000,
  };

  const fp1 = await createCheckoutFingerprint(data1);
  const fp2 = await createCheckoutFingerprint(data2);

  assert.equal(fp1, fp2, 'Fingerprints devem ser iguais após normalização');
  assert.equal(fp1.length, 64, 'Fingerprint deve ser SHA-256 hex (64 chars)');
});

test('createCheckoutFingerprint detecta mudança em gifterName', async () => {
  const data1 = {
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    paymentMethod: 'pix',
    amountCents: 15000,
  };

  const data2 = { ...data1, gifterName: 'Maria Santos' };

  const fp1 = await createCheckoutFingerprint(data1);
  const fp2 = await createCheckoutFingerprint(data2);

  assert.notEqual(fp1, fp2, 'Nome diferente deve gerar fingerprint diferente');
});

test('createCheckoutFingerprint detecta mudança em items', async () => {
  const data1 = {
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    paymentMethod: 'pix',
    amountCents: 15000,
  };

  const data2 = {
    ...data1,
    items: [{ giftId: 'danca', quantity: 2 }],  // Quantidade mudou
  };

  const fp1 = await createCheckoutFingerprint(data1);
  const fp2 = await createCheckoutFingerprint(data2);

  assert.notEqual(fp1, fp2, 'Quantidade diferente deve gerar fingerprint diferente');
});

test('generateMPIdempotencyKey retorna string estável de 64 chars', async () => {
  const intentKey = '550e8400-e29b-41d4-a716-446655440000';
  
  const key1 = await generateMPIdempotencyKey(intentKey, TEST_SECRET);
  const key2 = await generateMPIdempotencyKey(intentKey, TEST_SECRET);

  assert.equal(key1, key2, 'Mesmo intent_key deve gerar mesma MP key');
  assert.equal(key1.length, 64, 'MP key deve ter 64 chars');
  assert.match(key1, /^[0-9a-f]{64}$/, 'MP key deve ser hex lowercase');
});

test('isValidIntentKey aceita UUID v4 válido', () => {
  assert.ok(isValidIntentKey('550e8400-e29b-41d4-a716-446655440000'));
  assert.ok(isValidIntentKey('123e4567-e89b-42d3-a456-426614174000'));
});

test('isValidIntentKey rejeita UUID inválido', () => {
  assert.equal(isValidIntentKey(''), false);
  assert.equal(isValidIntentKey('not-a-uuid'), false);
  assert.equal(isValidIntentKey('550e8400-e29b-31d4-a716-446655440000'), false); // versão errada
  assert.equal(isValidIntentKey('550e8400e29b41d4a716446655440000'), false); // sem hífens
});

test('getOrCreateIntent cria novo intent', async () => {
  const db = new MockD1Database();
  const params = {
    intentKey: '550e8400-e29b-41d4-a716-446655440000',
    fingerprint: 'a'.repeat(64),
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    paymentMethod: 'pix',
    amountCents: 15000,
  };

  const result = await getOrCreateIntent(db, params, TEST_SECRET);

  assert.equal(result.status, 'created');
  assert.ok(result.intent);
  assert.equal(result.intent.intentKey, params.intentKey);
  assert.equal(result.intent.fingerprint, params.fingerprint);
});

test('getOrCreateIntent retorna intent existente com mesmo fingerprint', async () => {
  const db = new MockD1Database();
  const params = {
    intentKey: '550e8400-e29b-41d4-a716-446655440000',
    fingerprint: 'a'.repeat(64),
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    paymentMethod: 'pix',
    amountCents: 15000,
  };

  // Criar intent
  await getOrCreateIntent(db, params, TEST_SECRET);

  // Tentar criar novamente com mesmo fingerprint
  const result = await getOrCreateIntent(db, params, TEST_SECRET);

  assert.equal(result.status, 'existing');
  assert.ok(result.intent);
  assert.equal(result.intent.fingerprint, params.fingerprint);
});

test('getOrCreateIntent retorna conflict com fingerprint diferente', async () => {
  const db = new MockD1Database();
  const params1 = {
    intentKey: '550e8400-e29b-41d4-a716-446655440000',
    fingerprint: 'a'.repeat(64),
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    paymentMethod: 'pix',
    amountCents: 15000,
  };

  const params2 = {
    ...params1,
    fingerprint: 'b'.repeat(64),  // Fingerprint diferente
  };

  // Criar intent
  await getOrCreateIntent(db, params1, TEST_SECRET);

  // Tentar criar com mesmo intentKey mas fingerprint diferente
  const result = await getOrCreateIntent(db, params2, TEST_SECRET);

  assert.equal(result.status, 'conflict');
  assert.equal(result.conflict, true);
  assert.ok(result.message);
});

test('getOrCreateIntent rejeita intent_key inválido', async () => {
  const db = new MockD1Database();
  const params = {
    intentKey: 'invalid-key',
    fingerprint: 'a'.repeat(64),
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    paymentMethod: 'pix',
    amountCents: 15000,
  };

  await assert.rejects(
    async () => await getOrCreateIntent(db, params, TEST_SECRET),
    { message: /INVALID_INTENT_KEY/ }
  );
});

test('updateIntentWithPayment atualiza status e qr data', async () => {
  const db = new MockD1Database();
  const intentKey = '550e8400-e29b-41d4-a716-446655440000';
  
  // Criar intent
  const params = {
    intentKey,
    fingerprint: 'a'.repeat(64),
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    paymentMethod: 'pix',
    amountCents: 15000,
  };
  await getOrCreateIntent(db, params, TEST_SECRET);

  // Atualizar com payment data
  const payment = {
    id: 'mp_12345',
    qrCode: 'qr_code_data',
    qrCodeBase64: 'base64_data',
  };
  await updateIntentWithPayment(db, intentKey, payment, 'pending');

  // Verificar atualização
  const updated = db.data.get(intentKey);
  assert.equal(updated.provider_reference, 'mp_12345');
  assert.equal(updated.status, 'pending');
  assert.equal(updated.qr_code, 'qr_code_data');
  assert.equal(updated.qr_code_base64, 'base64_data');
});
