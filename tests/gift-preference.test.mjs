/**
 * createGiftPreference — cartão/boleto Checkout Pro
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGiftPreference } from '../functions/_lib/mercadopago.mjs';
import { markIntentPaidByExternalRef } from '../functions/_lib/admin-service.mjs';

test('createGiftPreference: external_reference estável e exclusões para cartão', async () => {
  let captured = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    captured = {
      body: JSON.parse(options.body),
      idempotency: options.headers['X-Idempotency-Key'],
    };
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 'pref_1',
        init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref_1',
        sandbox_init_point: 'https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref_1',
      }),
    };
  };

  try {
    const intentKey = '550e8400-e29b-41d4-a716-446655440020';
    const result = await createGiftPreference({
      accessToken: 'TEST',
      intentKey,
      gifterName: 'Ana',
      paymentMethod: 'card',
      totalInCents: 15000,
      items: [
        { giftId: 'spa', quantity: 1, priceInCents: 10000, name: 'Spa' },
        { giftId: 'danca', quantity: 1, priceInCents: 5000, name: 'Dança' },
      ],
      payerEmail: 'noreply@casebem.com',
      successUrl: 'https://casebem.com/dani-carine/?pago=ok',
      failureUrl: 'https://casebem.com/dani-carine/?pago=erro',
      pendingUrl: 'https://casebem.com/dani-carine/?pago=pendente',
    });

    assert.equal(result.ok, true);
    assert.equal(result.preference.id, 'pref_1');
    assert.match(result.preference.initPoint, /^https:\/\//);
    assert.equal(captured.body.external_reference, `casebem:gift:${intentKey}`);
    assert.equal(captured.idempotency, intentKey);
    assert.equal(captured.body.items[0].id, 'danca'); // ordem canônica
    assert.ok(captured.body.payment_methods.excluded_payment_types.some((t) => t.id === 'ticket'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createGiftPreference: boleto exclui cartões', async () => {
  let captured = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    captured = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        id: 'pref_b',
        init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=b',
      }),
    };
  };

  try {
    const result = await createGiftPreference({
      accessToken: 'TEST',
      intentKey: '550e8400-e29b-41d4-a716-446655440021',
      gifterName: 'Ana',
      paymentMethod: 'boleto',
      totalInCents: 20000,
      items: [{ giftId: 'hotel', quantity: 1, priceInCents: 20000, name: 'Hotel' }],
      successUrl: 'https://casebem.com/ok',
      failureUrl: 'https://casebem.com/err',
      pendingUrl: 'https://casebem.com/pend',
    });
    assert.equal(result.ok, true);
    assert.ok(captured.payment_methods.excluded_payment_types.some((t) => t.id === 'credit_card'));
    assert.ok(captured.payment_methods.excluded_payment_types.some((t) => t.id === 'debit_card'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('markIntentPaidByExternalRef: atualiza por casebem:gift:uuid', async () => {
  let bound = null;
  const db = {
    prepare() {
      return {
        bind(...args) {
          bound = args;
          return this;
        },
        async run() {
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
  };
  const intentKey = '550e8400-e29b-41d4-a716-446655440022';
  const r = await markIntentPaidByExternalRef(
    db,
    `casebem:gift:${intentKey}`,
    'pay_99',
    '2026-01-01T00:00:00.000Z'
  );
  assert.equal(r.updated, true);
  assert.equal(r.intentKey, intentKey);
  assert.equal(bound[3], intentKey);
});
