/**
 * Tests for MercadoPago idempotency with stable external_reference
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

test('createPixPayment: external_reference usa intentKey estável', async () => {
  const intentKey = '550e8400-e29b-41d4-a716-446655440000';
  const gifterName = 'João Silva';
  const items = [
    { giftId: 'danca', quantity: 1, priceInCents: 30000 },
  ];
  const totalInCents = 30000;
  
  const mockAccessToken = 'TEST_TOKEN';
  
  // Mockar fetch ANTES do import
  let capturedPayload = null;
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (options?.body) {
      capturedPayload = JSON.parse(options.body);
    }
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 12345,
        status: 'pending',
        transaction_amount: 300,
        point_of_interaction: {
          transaction_data: {
            qr_code: 'test_qr',
            qr_code_base64: 'dGVzdA==',
          },
        },
      }),
    };
  };
  
  const { createPixPayment } = await import('../functions/_lib/mercadopago.mjs');
  
  await createPixPayment({
    accessToken: mockAccessToken,
    gifterName,
    items,
    totalInCents,
    intentKey,
  });
  
  // Restaurar fetch
  global.fetch = originalFetch;
  
  // Verificar external_reference
  assert.ok(capturedPayload, 'Payload deve ter sido capturado');
  assert.ok(capturedPayload.external_reference);
  assert.match(capturedPayload.external_reference, /^casebem:gift:/);
  assert.ok(capturedPayload.external_reference.includes(intentKey));
  assert.equal(capturedPayload.external_reference.includes('Date.now'), false, 'Não deve conter timestamp');
});

test('createPixPayment: dois calls com mesmo intentKey geram external_reference idêntico', async () => {
  const intentKey = '550e8400-e29b-41d4-a716-446655440001';
  const payload = {
    accessToken: 'TEST_TOKEN',
    gifterName: 'Maria Santos',
    items: [{ giftId: 'spa', quantity: 2, priceInCents: 25000 }],
    totalInCents: 50000,
    intentKey,
  };
  
  const capturedRefs = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (options?.body) {
      const parsed = JSON.parse(options.body);
      capturedRefs.push(parsed.external_reference);
    }
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 12345,
        status: 'pending',
        transaction_amount: 500,
        point_of_interaction: {
          transaction_data: {
            qr_code: 'test',
            qr_code_base64: 'dGVzdA==',
          },
        },
      }),
    };
  };
  
  const { createPixPayment } = await import('../functions/_lib/mercadopago.mjs');
  
  await createPixPayment(payload);
  await new Promise(resolve => setTimeout(resolve, 10)); // Pequeno delay
  await createPixPayment(payload);
  
  global.fetch = originalFetch;
  
  assert.equal(capturedRefs.length, 2);
  assert.equal(capturedRefs[0], capturedRefs[1], 'external_reference deve ser idêntico em calls consecutivos');
});

test('createPixPayment: items em ordem canônica consistente', async () => {
  const intentKey = '550e8400-e29b-41d4-a716-446655440002';
  
  const mockAccessToken = 'TEST_TOKEN';
  
  let capturedPayload = null;
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (options?.body) {
      capturedPayload = JSON.parse(options.body);
    }
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 12345,
        status: 'pending',
        transaction_amount: 800,
        point_of_interaction: {
          transaction_data: {
            qr_code: 'test',
            qr_code_base64: 'dGVzdA==',
          },
        },
      }),
    };
  };
  
  const { createPixPayment } = await import('../functions/_lib/mercadopago.mjs');
  
  await createPixPayment({
    accessToken: mockAccessToken,
    gifterName: 'Pedro Costa',
    items: [
      { giftId: 'danca', quantity: 1, priceInCents: 30000 },
      { giftId: 'spa', quantity: 2, priceInCents: 20000 },
      { giftId: 'jantar', quantity: 1, priceInCents: 30000 },
    ],
    totalInCents: 80000,
    intentKey,
  });
  
  global.fetch = originalFetch;
  
  // Verificar que items estão em ordem alfabética por giftId
  assert.ok(capturedPayload.items);
  assert.ok(Array.isArray(capturedPayload.items));
  const giftIds = capturedPayload.items.map(i => i.title);
  const sortedIds = [...giftIds].sort();
  assert.deepEqual(giftIds, sortedIds, 'Items devem estar em ordem canônica alfabética');
});
