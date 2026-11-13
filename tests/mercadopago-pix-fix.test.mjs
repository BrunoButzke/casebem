/**
 * Correções Pix MP — payload, e-mail sandbox, erros
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPixPayment,
  resolvePixPayerEmail,
  extractMercadoPagoError,
} from '../functions/_lib/mercadopago.mjs';

test('resolvePixPayerEmail: token TEST- usa @testuser.com ou MP_TEST_PAYER_EMAIL', () => {
  assert.equal(
    resolvePixPayerEmail('ok@testuser.com', 'TEST-abc'),
    'ok@testuser.com'
  );
  assert.equal(
    resolvePixPayerEmail('eu@gmail.com', 'TEST-abc', {
      MP_TEST_PAYER_EMAIL: 'buyer@testuser.com',
    }),
    'buyer@testuser.com'
  );
  // Sem conta de teste configurada, não inventa e-mail falso
  assert.equal(resolvePixPayerEmail('eu@gmail.com', 'TEST-abc'), 'eu@gmail.com');
  // APP_USR / placeholders de teste unitário NÃO reescrevem
  assert.equal(resolvePixPayerEmail('eu@gmail.com', 'TEST_TOKEN'), 'eu@gmail.com');
});

test('resolvePixPayerEmail: produção mantém e-mail válido', () => {
  assert.equal(
    resolvePixPayerEmail('convidado@email.com', 'APP_USR-prod-token'),
    'convidado@email.com'
  );
});

test('extractMercadoPagoError usa cause.description', () => {
  const msg = extractMercadoPagoError(
    { cause: [{ description: 'Invalid test user email' }], message: 'ignored' },
    400
  );
  assert.match(msg, /Invalid test user email/);
});

test('createPixPayment: body usa additional_info + notification_url + expiration', async () => {
  let captured = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    captured = {
      headers: options.headers,
      body: JSON.parse(options.body),
    };
    return {
      ok: true,
      status: 201,
      json: async () => ({
        id: 42,
        status: 'pending',
        point_of_interaction: {
          transaction_data: { qr_code: 'qr', qr_code_base64: 'dGVzdA==' },
        },
      }),
    };
  };

  try {
    const result = await createPixPayment({
      accessToken: 'APP_USR-xxxx',
      gifterName: 'Ana',
      items: [{ giftId: 'spa', quantity: 1, priceInCents: 10000, name: 'Spa' }],
      totalInCents: 10000,
      intentKey: '550e8400-e29b-41d4-a716-446655440099',
      payerEmail: 'ana@email.com',
      notificationUrl: 'https://casebem.com/api/webhooks/mercadopago',
      idempotencyKey: 'idem-1',
    });
    assert.equal(result.ok, true);
    assert.equal(captured.body.items, undefined);
    assert.equal(captured.body.additional_info.items[0].title, 'Spa');
    assert.equal(captured.body.notification_url, 'https://casebem.com/api/webhooks/mercadopago');
    assert.ok(captured.body.date_of_expiration);
    assert.equal(captured.headers['X-Idempotency-Key'], 'idem-1');
    assert.equal(captured.body.payer.email, 'ana@email.com');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createPixPayment: propaga erro MP real', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({
      message: 'Invalid email',
      cause: [{ description: 'payer.email must be a test user' }],
    }),
  });
  try {
    const result = await createPixPayment({
      accessToken: 'APP_USR-x',
      amount: 10,
      title: 'x',
      email: 'a@b.com',
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /test user|Invalid email/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
