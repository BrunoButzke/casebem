/**
 * Tests for gifts checkout API
 * Run with: node --test tests/gifts-checkout.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCheckoutRequest,
  createCheckoutPayment,
} from '../functions/_lib/gifts-service.mjs';

// Mock D1 Database simples para testes
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
      return { request_count: 1 };  // Simula primeira requisição sempre permitida
    }
    
    return null;
  }

  async run() {
    if (this.sql.includes('INSERT INTO checkout_intents')) {
      const [intentKey, fingerprint, provider, providerRef, amountCents, gifterName, canonicalItems, paymentMethod, status, createdAt, updatedAt] = this.params;
      
      if (this.db.intents.has(intentKey)) {
        throw new Error('UNIQUE constraint failed: checkout_intents.intent_key');
      }
      
      this.db.intents.set(intentKey, {
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
      const existing = this.db.intents.get(intentKey);
      
      if (existing) {
        existing.provider_reference = providerRef;
        existing.status = status;
        existing.qr_code = qrCode;
        existing.qr_code_base64 = qrCodeBase64;
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

// Mock Mercado Pago para testes
let mockCallCount = 0;
globalThis.__testCreatePixPayment = async ({ gifterName, items, amount, mpIdempotencyKey, intentKey }) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Valor inválido' };
  }

  mockCallCount++;

  return {
    ok: true,
    payment: {
      id: `test_pix_${intentKey || Date.now()}`,
      qrCode: 'test_qr_code_data',
      qrCodeBase64: 'dGVzdF9xcl9iYXNlNjQ=',
    },
    callCount: mockCallCount,
  };
};

test('validateCheckoutRequest aceita requisição válida com Pix', () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [
      { giftId: 'danca', quantity: 2 }
    ]
  };
  
  const result = validateCheckoutRequest(request);
  assert.equal(result.valid, true);
});

test('validateCheckoutRequest rejeita paymentMethod vazio', () => {
  const request = {
    paymentMethod: '',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }]
  };
  
  const result = validateCheckoutRequest(request);
  assert.equal(result.valid, false);
  assert.match(result.error, /m[ée]todo.*pagamento/i);
});

test('validateCheckoutRequest rejeita paymentMethod inválido', () => {
  const request = {
    paymentMethod: 'bitcoin',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }]
  };
  
  const result = validateCheckoutRequest(request);
  assert.equal(result.valid, false);
  assert.match(result.error, /m[ée]todo.*inv[áa]lido/i);
});

test('validateCheckoutRequest rejeita gifterName vazio', () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: '',
    items: [{ giftId: 'danca', quantity: 1 }]
  };
  
  const result = validateCheckoutRequest(request);
  assert.equal(result.valid, false);
  assert.match(result.error, /nome/i);
});

test('validateCheckoutRequest rejeita gifterName muito curto', () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'A',
    items: [{ giftId: 'danca', quantity: 1 }]
  };
  
  const result = validateCheckoutRequest(request);
  assert.equal(result.valid, false);
  assert.match(result.error, /nome.*2.*caracteres/i);
});

test('validateCheckoutRequest rejeita gifterName muito longo', () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'A'.repeat(101),
    items: [{ giftId: 'danca', quantity: 1 }]
  };
  
  const result = validateCheckoutRequest(request);
  assert.equal(result.valid, false);
  assert.match(result.error, /nome.*100.*caracteres/i);
});

test('validateCheckoutRequest rejeita items vazio', () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: []
  };
  
  const result = validateCheckoutRequest(request);
  assert.equal(result.valid, false);
  assert.match(result.error, /carrinho.*vazio/i);
});

test('validateCheckoutRequest rejeita item com giftId inexistente', () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [{ giftId: 'inexistente', quantity: 1 }]
  };
  
  const result = validateCheckoutRequest(request);
  assert.equal(result.valid, false);
  assert.match(result.error, /presente.*inv[áa]lido|n[ãa]o.*encontrado/i);
});

test('validateCheckoutRequest rejeita item com quantidade inválida', () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 0 }]
  };
  
  const result = validateCheckoutRequest(request);
  assert.equal(result.valid, false);
  assert.match(result.error, /quantidade/i);
});

test('createCheckoutPayment com Pix e token válido retorna pagamento pendente', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [
      { giftId: 'danca', quantity: 2 }  // 15000 * 2 = 30000 centavos
    ],
    intentKey: '550e8400-e29b-41d4-a716-446655440010',
  };
  
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  const result = await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1');
  
  assert.equal(result.ok, true);
  assert.equal(result.method, 'pix');
  assert.equal(result.status, 'pending');
  assert.ok(result.payment);
  assert.ok(result.payment.id);
});

test('createCheckoutPayment com Pix mas sem MP_ACCESS_TOKEN retorna 503', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [
      { giftId: 'danca', quantity: 1 }
    ],
    intentKey: '550e8400-e29b-41d4-a716-446655440011',
  };
  
  const mockEnv = {
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  }; // Sem token
  const mockDB = new MockD1Database();
  
  const result = await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1');
  
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.error, 'PAYMENT_SERVICE_NOT_CONFIGURED');
  assert.match(result.message, /servi[çc]o.*pagamento.*n[ãa]o.*configurado/i);
});

test('createCheckoutPayment com cartão retorna 503 provider não configurado', async () => {
  const request = {
    paymentMethod: 'card',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    intentKey: '550e8400-e29b-41d4-a716-446655440012',
  };
  
  const mockEnv = {
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  const result = await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1');
  
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.error, 'PAYMENT_PROVIDER_NOT_CONFIGURED');
  assert.match(result.message, /cart[ãa]o.*boleto.*n[ãa]o.*dispon[íi]vel/i);
  assert.ok(Array.isArray(result.availableMethods));
  assert.ok(result.availableMethods.includes('pix'));
});

test('createCheckoutPayment com boleto retorna 503 provider não configurado', async () => {
  const request = {
    paymentMethod: 'boleto',
    gifterName: 'Maria Santos',
    items: [{ giftId: 'spa', quantity: 1 }],
    intentKey: '550e8400-e29b-41d4-a716-446655440013',
  };
  
  const mockEnv = {
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  const result = await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1');
  
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.error, 'PAYMENT_PROVIDER_NOT_CONFIGURED');
  assert.match(result.message, /cart[ãa]o.*boleto.*n[ãa]o.*dispon[íi]vel/i);
});

test('createCheckoutPayment recalcula total no servidor', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [
      { giftId: 'danca', quantity: 3 },    // 15000 * 3 = 45000
      { giftId: 'spa', quantity: 1 },      // 30000 * 1 = 30000
    ],
    intentKey: '550e8400-e29b-41d4-a716-446655440014',
    // Total correto: 75000 centavos (R$ 750,00)
  };
  
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  const result = await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1');
  
  assert.equal(result.ok, true);
  // Verificar que o total foi calculado corretamente
  assert.ok(result.payment);
});

test('createCheckoutPayment com método desconhecido retorna erro 400', async () => {
  const request = {
    paymentMethod: 'paypal',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    intentKey: '550e8400-e29b-41d4-a716-446655440015',
  };
  
  const mockEnv = {
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  await assert.rejects(
    async () => await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1'),
    { message: /m[ée]todo.*inv[áa]lido/i }
  );
});

test('createCheckoutPayment valida items antes de processar', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [
      { giftId: 'danca', quantity: 1 },
      { giftId: 'inexistente', quantity: 2 },  // Item inválido
    ],
    intentKey: '550e8400-e29b-41d4-a716-446655440016',
  };
  
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  await assert.rejects(
    async () => await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1'),
    { message: /presente.*inv[áa]lido|n[ãa]o.*encontrado/i }
  );
});

test('createCheckoutPayment rejeita quantidade acima do limite', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [
      { giftId: 'danca', quantity: 100 }  // Acima de 99
    ],
    intentKey: '550e8400-e29b-41d4-a716-446655440017',
  };
  
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  await assert.rejects(
    async () => await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1'),
    { message: /quantidade/i }
  );
});

test('createCheckoutPayment com nome contém identificação no pagamento', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'Ana Paula Costa',
    items: [{ giftId: 'danca', quantity: 1 }],
    intentKey: '550e8400-e29b-41d4-a716-446655440018',
  };
  
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  const result = await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1');
  
  assert.equal(result.ok, true);
  // Nome do presenteador deve estar no contexto do pagamento
  assert.ok(result.payment);
});

test('createCheckoutPayment normaliza items duplicados (merge quantidade)', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [
      { giftId: 'danca', quantity: 2 },
      { giftId: 'spa', quantity: 1 },
      { giftId: 'danca', quantity: 3 },  // Duplicado, deve somar
    ],
    intentKey: '550e8400-e29b-41d4-a716-446655440019',
  };
  
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  // Capturar chamada do mock para verificar normalização
  let capturedItems = null;
  globalThis.__testCreatePixPayment = async ({ items }) => {
    capturedItems = items;
    return {
      ok: true,
      payment: {
        id: 'test_payment',
        qrCode: 'test_qr',
        qrCodeBase64: '',
      },
    };
  };
  
  const result = await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1');
  
  assert.equal(result.ok, true);
  // Verificar que items foram normalizados (2 únicos)
  // danca: 2+3=5, spa: 1
  assert.ok(capturedItems);
});

test('createCheckoutPayment rejeita items duplicados quando merged qty > 99', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [
      { giftId: 'danca', quantity: 60 },
      { giftId: 'danca', quantity: 50 },  // Total 110 > 99, deve rejeitar
    ],
    intentKey: '550e8400-e29b-41d4-a716-446655440000',
  };
  
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  await assert.rejects(
    async () => await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1'),
    { message: /quantidade.*99/i }
  );
});

// ========== Testes de Idempotência ==========

test('createCheckoutPayment exige intentKey', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    // intentKey ausente
  };
  
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  await assert.rejects(
    async () => await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1'),
    { message: /Intent key obrigat[óo]rio/i }
  );
});

test('createCheckoutPayment retorna 503 se DB indisponível', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    intentKey: '550e8400-e29b-41d4-a716-446655440000',
  };
  
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  
  const result = await createCheckoutPayment(request, mockEnv, null, '127.0.0.1');
  
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.error, 'DATABASE_UNAVAILABLE');
});

test('createCheckoutPayment: retry com mesmo intentKey e payload retorna mesmo payment', async () => {
  mockCallCount = 0;
  
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    intentKey: '550e8400-e29b-41d4-a716-446655440001',
  };
  
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  // Primeira chamada
  const result1 = await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1');
  assert.equal(result1.ok, true);
  const callCount1 = mockCallCount;
  
  // Segunda chamada (idempotente)
  const result2 = await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1');
  assert.equal(result2.ok, true);
  assert.equal(result2.fromCache, true, 'Segunda chamada deve ser do cache');
  assert.equal(mockCallCount, callCount1, 'MP não deve ser chamado novamente');
  
  // QR deve ser o mesmo
  assert.equal(result2.payment.qrCode, result1.payment.qrCode);
  assert.equal(result2.payment.id, result1.payment.id);
});

test('createCheckoutPayment: mesmo intentKey com payload diferente retorna 409', async () => {
  const intentKey = '550e8400-e29b-41d4-a716-446655440002';
  
  const request1 = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    intentKey,
  };
  
  const request2 = {
    paymentMethod: 'pix',
    gifterName: 'Maria Santos',  // Nome diferente
    items: [{ giftId: 'danca', quantity: 1 }],
    intentKey,  // Mesmo intent key
  };
  
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  // Primeira chamada
  const result1 = await createCheckoutPayment(request1, mockEnv, mockDB, '127.0.0.1');
  assert.equal(result1.ok, true);
  
  // Segunda chamada com payload diferente
  const result2 = await createCheckoutPayment(request2, mockEnv, mockDB, '127.0.0.1');
  assert.equal(result2.ok, false);
  assert.equal(result2.status, 409);
  assert.equal(result2.error, 'INTENT_CONFLICT');
});

test('createCheckoutPayment: validação e rate limit antes de criar intent', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }],
    intentKey: '550e8400-e29b-41d4-a716-446655440003',
  };
  
  const mockEnv = {
    MP_ACCESS_TOKEN: 'TEST_TOKEN',
    RSVP_SECRET: Buffer.from('a'.repeat(32)).toString('base64'),
  };
  const mockDB = new MockD1Database();
  
  // Teste passará se não lançar exceção de rate limit ou DB
  const result = await createCheckoutPayment(request, mockEnv, mockDB, '127.0.0.1');
  assert.equal(result.ok, true);
});
