/**
 * Testes do MercadoPago com shape oficial da API real (não global mock)
 * Valida body request, payer.email, items canonical order, response shape
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPixPayment } from '../functions/_lib/mercadopago.mjs';

test('createPixPayment: body real inclui payer.email obrigatório', async () => {
  let capturedRequest = null;
  
  // Mock fetch que captura request
  const mockFetch = async (url, options) => {
    capturedRequest = {
      url,
      method: options.method,
      headers: options.headers,
      body: JSON.parse(options.body),
    };
    
    // Resposta oficial MP shape
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 123456789,
        status: 'pending',
        status_detail: 'pending_waiting_payment',
        transaction_amount: 100.00,
        description: 'Test payment',
        payment_method_id: 'pix',
        point_of_interaction: {
          type: 'PIX',
          transaction_data: {
            qr_code: '00020101021243650016COM.MERCADOLIBRE...',
            qr_code_base64: 'iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51...',
          },
        },
      }),
    };
  };
  
  // Substituir fetch global temporariamente
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  
  try {
    const result = await createPixPayment({
      accessToken: 'TEST_TOKEN',
      gifterName: 'João Silva',
      items: [
        { giftId: 'danca', quantity: 2, priceInCents: 5000 },
      ],
      totalInCents: 10000,
      intentKey: '550e8400-e29b-41d4-a716-446655440000',
      payerEmail: 'noreply@casebem.com',
    });
    
    assert.equal(result.ok, true);
    assert.ok(capturedRequest, 'Request deve ter sido capturado');
    
    // Validar body oficial MP
    const body = capturedRequest.body;
    assert.equal(body.payment_method_id, 'pix');
    assert.equal(typeof body.transaction_amount, 'number');
    assert.ok(body.payer, 'payer obrigatório');
    assert.equal(body.payer.email, 'noreply@casebem.com', 'payer.email obrigatório');
    assert.ok(body.payer.first_name, 'payer.first_name presente');
    assert.equal(body.external_reference, 'casebem:gift:550e8400-e29b-41d4-a716-446655440000');
    
    // Validar header X-Idempotency-Key
    assert.ok(capturedRequest.headers['X-Idempotency-Key'], 'X-Idempotency-Key obrigatório');
    
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createPixPayment: items em ordem canônica alfabética', async () => {
  let capturedBody = null;
  
  const mockFetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 123,
        point_of_interaction: {
          transaction_data: {
            qr_code: 'test',
            qr_code_base64: 'dGVzdA==',
          },
        },
      }),
    };
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  
  try {
    // Items fora de ordem alfabética
    await createPixPayment({
      accessToken: 'TEST_TOKEN',
      gifterName: 'Test',
      items: [
        { giftId: 'viagem', quantity: 1, priceInCents: 10000 },
        { giftId: 'danca', quantity: 2, priceInCents: 5000 },
        { giftId: 'musica', quantity: 1, priceInCents: 3000 },
      ],
      totalInCents: 23000,
      intentKey: '550e8400-e29b-41d4-a716-446655440001',
      payerEmail: 'test@example.com',
    });
    
    // Validar que items foram ordenados alfabeticamente
    assert.ok(capturedBody.items, 'items presente');
    assert.equal(capturedBody.items.length, 3);
    assert.equal(capturedBody.items[0].title, 'danca', 'primeiro alfabeticamente');
    assert.equal(capturedBody.items[1].title, 'musica', 'segundo alfabeticamente');
    assert.equal(capturedBody.items[2].title, 'viagem', 'terceiro alfabeticamente');
    
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createPixPayment: resposta oficial MP shape com point_of_interaction', async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 201,
    json: async () => ({
      id: 987654321,
      status: 'pending',
      payment_method_id: 'pix',
      point_of_interaction: {
        type: 'PIX',
        transaction_data: {
          qr_code: '00020101021243650016COM.MERCADOLIBRE0209987654321',
          qr_code_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          ticket_url: 'https://www.mercadopago.com.br/payments/987654321/ticket',
        },
      },
    }),
  });
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  
  try {
    const result = await createPixPayment({
      accessToken: 'TEST_TOKEN',
      gifterName: 'Maria',
      items: [{ giftId: 'lua-de-mel', quantity: 1, priceInCents: 50000 }],
      totalInCents: 50000,
      intentKey: '550e8400-e29b-41d4-a716-446655440002',
      payerEmail: 'service@casebem.com',
    });
    
    assert.equal(result.ok, true);
    assert.ok(result.payment, 'payment object presente');
    assert.equal(result.payment.id, 987654321);
    assert.equal(result.payment.qrCode, '00020101021243650016COM.MERCADOLIBRE0209987654321');
    assert.ok(result.payment.qrCodeBase64, 'qrCodeBase64 presente');
    
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createPixPayment: transaction_amount decimal correto (cents/100)', async () => {
  let capturedAmount = null;
  
  const mockFetch = async (url, options) => {
    const body = JSON.parse(options.body);
    capturedAmount = body.transaction_amount;
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 123,
        point_of_interaction: {
          transaction_data: { qr_code: 'test', qr_code_base64: 'dGVzdA==' },
        },
      }),
    };
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  
  try {
    // 12345 cents = 123.45 reais
    await createPixPayment({
      accessToken: 'TEST_TOKEN',
      gifterName: 'Test',
      items: [{ giftId: 'presente', quantity: 1, priceInCents: 12345 }],
      totalInCents: 12345,
      intentKey: '550e8400-e29b-41d4-a716-446655440003',
      payerEmail: 'test@test.com',
    });
    
    assert.equal(capturedAmount, 123.45, 'transaction_amount = totalInCents / 100');
    
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createPixPayment: backward compat single gift (plans) mantém email required', async () => {
  let capturedBody = null;
  
  const mockFetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 456,
        point_of_interaction: {
          transaction_data: { qr_code: 'old', qr_code_base64: 'b2xk' },
        },
      }),
    };
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  
  try {
    // Antiga assinatura (plans)
    await createPixPayment({
      accessToken: 'TEST_TOKEN',
      amount: 99.99,
      title: 'Plano Premium',
      email: 'user@example.com',
      giftId: 'premium-plan',
      idempotencyKey: 'old-key-123',
    });
    
    assert.ok(capturedBody.payer, 'payer presente');
    assert.equal(capturedBody.payer.email, 'user@example.com', 'email old signature');
    assert.equal(capturedBody.external_reference, 'casebem:plan:old-key-123');
    
  } finally {
    globalThis.fetch = originalFetch;
  }
});
