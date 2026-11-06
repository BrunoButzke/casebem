/**
 * Tests for gifts checkout API handler (CORS, origin validation)
 * Run with: node --test tests/gifts-checkout-api.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, onRequestOptions } from '../functions/api/gifts/checkout.js';

// Mock D1 Database
class MockD1Database {
  constructor() {
    this.intents = new Map();
    this.rateLimits = new Map();
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
      return this.db.intents.get(intentKey) || null;
    }
    
    // Rate limit RETURNING
    if (this.sql.includes('RETURNING request_count')) {
      return { request_count: 1 };
    }
    
    return null;
  }

  async run() {
    // INSERT checkout_intents (8 params)
    if (this.sql.includes('INSERT INTO checkout_intents')) {
      const [intentKey, fingerprint, amountCents, gifterName, canonicalItems, paymentMethod, createdAt, updatedAt] = this.params;
      
      if (this.db.intents.has(intentKey)) {
        throw new Error('UNIQUE constraint failed: checkout_intents.intent_key');
      }
      
      this.db.intents.set(intentKey, {
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
      const existing = this.db.intents.get(intentKey);
      
      if (!existing) {
        return { success: true, meta: { changes: 0 } };
      }
      
      const canAcquire = existing.status === 'creating' && 
        (existing.lease_until === null || existing.lease_until < now);
      
      if (canAcquire) {
        existing.lease_until = leaseUntil;
        existing.updated_at = updatedAt;
        return { success: true, meta: { changes: 1 } };
      }
      
      return { success: true, meta: { changes: 0 } };
    }
    
    // UPDATE intent with payment result
    if (this.sql.includes('UPDATE checkout_intents') && this.sql.includes('provider_reference')) {
      const [providerRef, status, qrCode, qrCodeBase64, updatedAt, intentKey] = this.params;
      const existing = this.db.intents.get(intentKey);
      
      if (existing) {
        existing.provider_reference = providerRef;
        existing.status = status;
        existing.qr_code = qrCode;
        existing.qr_code_base64 = qrCodeBase64;
        existing.lease_until = null;
        existing.updated_at = updatedAt;
      }
      
      return { success: true };
    }

    if (this.sql.includes('DELETE FROM rate_limits')) {
      return { success: true };
    }
    
    return { success: true };
  }
}

// Mock environment
const mockEnv = {
  MP_ACCESS_TOKEN: 'TEST_TOKEN',
  RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  DB: new MockD1Database(),
};

// Mock Mercado Pago
globalThis.__testCreatePixPayment = async ({ amount }) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, status: 503, error: 'Valor inválido' };
  }
  return {
    ok: true,
    payment: {
      id: `test_pix_${Date.now()}`,
      qrCode: 'test_qr_code_data',
      qrCodeBase64: 'dGVzdF9xcl9iYXNlNjQ=',
    },
  };
};

/**
 * Helper para criar request mock
 */
function createMockRequest({ method = 'POST', origin = 'https://casebem.pages.dev', body = {} }) {
  return {
    method,
    url: 'https://casebem.pages.dev/api/gifts/checkout',
    headers: {
      get(name) {
        if (name === 'Origin') return origin;
        if (name === 'Content-Type') return 'application/json';
        return null;
      },
    },
    async json() {
      return body;
    },
  };
}

test('OPTIONS retorna 204 com CORS headers', async () => {
  const request = createMockRequest({ method: 'OPTIONS' });
  const context = { request, env: mockEnv };
  
  const response = await onRequestOptions(context);
  
  assert.equal(response.status, 204);
  assert.ok(response.headers.has('Access-Control-Allow-Methods'));
});

test('POST com origin válido retorna 200', async () => {
  const request = createMockRequest({
    origin: 'https://casebem.pages.dev',
    body: {
      paymentMethod: 'pix',
      gifterName: 'João Silva',
      items: [{ giftId: 'danca', quantity: 1 }],
      intentKey: '550e8400-e29b-41d4-a716-446655440000',
    },
  });
  const context = { request, env: mockEnv };
  
  const response = await onRequestPost(context);
  
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
});

test('POST sem origin retorna 403', async () => {
  const request = createMockRequest({
    origin: null,
    body: {
      paymentMethod: 'pix',
      gifterName: 'João Silva',
      items: [{ giftId: 'danca', quantity: 1 }],
      intentKey: '550e8400-e29b-41d4-a716-446655440000',
    },
  });
  const context = { request, env: mockEnv };
  
  const response = await onRequestPost(context);
  
  assert.equal(response.status, 403);
  const data = await response.json();
  assert.match(data.error, /origin/i);
});

test('POST com origin não autorizado retorna 403', async () => {
  const request = createMockRequest({
    origin: 'https://malicious.com',
    body: {
      paymentMethod: 'pix',
      gifterName: 'João Silva',
      items: [{ giftId: 'danca', quantity: 1 }],
      intentKey: '550e8400-e29b-41d4-a716-446655440000',
    },
  });
  const context = { request, env: mockEnv };
  
  const response = await onRequestPost(context);
  
  assert.equal(response.status, 403);
  const data = await response.json();
  assert.match(data.error, /n[ãa]o.*autorizado/i);
});

test('POST com JSON inválido retorna 400', async () => {
  const request = {
    method: 'POST',
    url: 'https://casebem.pages.dev/api/gifts/checkout',
    headers: {
      get(name) {
        if (name === 'Origin') return 'https://casebem.pages.dev';
        return null;
      },
    },
    async json() {
      throw new Error('Invalid JSON');
    },
  };
  const context = { request, env: mockEnv };
  
  const response = await onRequestPost(context);
  
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.match(data.error, /json.*inv[áa]lido/i);
});

test('POST sem MP_ACCESS_TOKEN retorna 503', async () => {
  const request = createMockRequest({
    origin: 'https://casebem.pages.dev',
    body: {
      paymentMethod: 'pix',
      gifterName: 'João Silva',
      items: [{ giftId: 'danca', quantity: 1 }],
      intentKey: '550e8400-e29b-41d4-a716-446655440000',
    },
  });
  const context = {
    request,
    env: {
      RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
      DB: new MockD1Database(),
    }
  }; // Sem token
  
  const response = await onRequestPost(context);
  
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.ok, false);
  assert.equal(data.error, 'PAYMENT_SERVICE_NOT_CONFIGURED');
});

test('POST com cartão retorna redirectUrl Checkout Pro', async () => {
  globalThis.__testCreateGiftPreference = async () => ({
    ok: true,
    preference: {
      id: 'pref_api_card',
      initPoint: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=api',
    },
  });

  try {
    const request = createMockRequest({
      origin: 'https://casebem.pages.dev',
      body: {
        paymentMethod: 'card',
        gifterName: 'João Silva',
        items: [{ giftId: 'danca', quantity: 1 }],
        intentKey: '550e8400-e29b-41d4-a716-446655440001',
      },
    });
    const context = { request, env: mockEnv };

    const response = await onRequestPost(context);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(data.method, 'card');
    assert.match(data.redirectUrl, /^https:\/\//);
  } finally {
    delete globalThis.__testCreateGiftPreference;
  }
});
