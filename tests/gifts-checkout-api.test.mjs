/**
 * Tests for gifts checkout API handler (CORS, origin validation)
 * Run with: node --test tests/gifts-checkout-api.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, onRequestOptions } from '../functions/api/gifts/checkout.js';

// Mock environment
const mockEnv = { MP_ACCESS_TOKEN: 'TEST_TOKEN' };

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
    },
  });
  const context = { request, env: {} }; // Sem token
  
  const response = await onRequestPost(context);
  
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.ok, false);
  assert.equal(data.error, 'PAYMENT_SERVICE_NOT_CONFIGURED');
});

test('POST com cartão retorna 503 provider não configurado', async () => {
  const request = createMockRequest({
    origin: 'https://casebem.pages.dev',
    body: {
      paymentMethod: 'card',
      gifterName: 'João Silva',
      items: [{ giftId: 'danca', quantity: 1 }],
    },
  });
  const context = { request, env: mockEnv };
  
  const response = await onRequestPost(context);
  
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.ok, false);
  assert.equal(data.error, 'PAYMENT_PROVIDER_NOT_CONFIGURED');
  assert.ok(data.availableMethods.includes('pix'));
});
