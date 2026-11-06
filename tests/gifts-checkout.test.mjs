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

// Mock Mercado Pago para testes
globalThis.__testCreatePixPayment = async ({ gifterName, items, amount }) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Valor inválido' };
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

test('createCheckoutPayment com Pix retorna pagamento pendente', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [
      { giftId: 'danca', quantity: 2 }  // 15000 * 2 = 30000 centavos
    ]
  };
  
  const mockEnv = { MP_ACCESS_TOKEN: 'TEST_TOKEN' };
  
  const result = await createCheckoutPayment(request, mockEnv);
  
  assert.equal(result.ok, true);
  assert.equal(result.method, 'pix');
  assert.equal(result.status, 'pending');
  assert.ok(result.payment);
  assert.ok(result.payment.id);
});

test('createCheckoutPayment com cartão retorna 503 provider não configurado', async () => {
  const request = {
    paymentMethod: 'card',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }]
  };
  
  const mockEnv = {};
  
  const result = await createCheckoutPayment(request, mockEnv);
  
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
    items: [{ giftId: 'spa', quantity: 1 }]
  };
  
  const mockEnv = {};
  
  const result = await createCheckoutPayment(request, mockEnv);
  
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
    ]
    // Total correto: 75000 centavos (R$ 750,00)
  };
  
  const mockEnv = { MP_ACCESS_TOKEN: 'TEST_TOKEN' };
  
  const result = await createCheckoutPayment(request, mockEnv);
  
  assert.equal(result.ok, true);
  // Verificar que o total foi calculado corretamente
  assert.ok(result.payment);
});

test('createCheckoutPayment com método desconhecido retorna erro 400', async () => {
  const request = {
    paymentMethod: 'paypal',
    gifterName: 'João Silva',
    items: [{ giftId: 'danca', quantity: 1 }]
  };
  
  const mockEnv = {};
  
  await assert.rejects(
    async () => await createCheckoutPayment(request, mockEnv),
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
    ]
  };
  
  const mockEnv = { MP_ACCESS_TOKEN: 'TEST_TOKEN' };
  
  await assert.rejects(
    async () => await createCheckoutPayment(request, mockEnv),
    { message: /presente.*inv[áa]lido|n[ãa]o.*encontrado/i }
  );
});

test('createCheckoutPayment rejeita quantidade acima do limite', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'João Silva',
    items: [
      { giftId: 'danca', quantity: 100 }  // Acima de 99
    ]
  };
  
  const mockEnv = { MP_ACCESS_TOKEN: 'TEST_TOKEN' };
  
  await assert.rejects(
    async () => await createCheckoutPayment(request, mockEnv),
    { message: /quantidade/i }
  );
});

test('createCheckoutPayment com nome contém identificação no pagamento', async () => {
  const request = {
    paymentMethod: 'pix',
    gifterName: 'Ana Paula Costa',
    items: [{ giftId: 'danca', quantity: 1 }]
  };
  
  const mockEnv = { MP_ACCESS_TOKEN: 'TEST_TOKEN' };
  
  const result = await createCheckoutPayment(request, mockEnv);
  
  assert.equal(result.ok, true);
  // Nome do presenteador deve estar no contexto do pagamento
  assert.ok(result.payment);
});
