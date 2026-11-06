/**
 * Fase 1 — painel admin / CSV / auth / webhook (Free-tier)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireAdmin } from '../functions/_lib/admin-auth.mjs';
import {
  rsvpsToCsv,
  giftsToCsv,
  markIntentPaidByProviderRef,
  setMessageHidden,
} from '../functions/_lib/admin-service.mjs';
import { processMercadoPagoWebhook } from '../functions/_lib/mp-webhook.mjs';
import { sendAdminNotification } from '../functions/_lib/notify-email.mjs';

test('requireAdmin: 503 se ADMIN_PANEL_SECRET curto/ausente', () => {
  const req = new Request('https://casebem.com/api/admin/summary', {
    headers: { Authorization: 'Bearer abc' },
  });
  const r = requireAdmin(req, {});
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
});

test('requireAdmin: 401 com token errado', () => {
  const secret = 'a'.repeat(20);
  const req = new Request('https://casebem.com/api/admin/summary', {
    headers: { Authorization: 'Bearer wrong-token-xxxxxx' },
  });
  const r = requireAdmin(req, { ADMIN_PANEL_SECRET: secret });
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
});

test('requireAdmin: ok com Bearer correto', () => {
  const secret = 'super-secret-admin-1';
  const req = new Request('https://casebem.com/api/admin/summary', {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const r = requireAdmin(req, { ADMIN_PANEL_SECRET: secret });
  assert.equal(r.ok, true);
});

test('rsvpsToCsv: gera header e escapa vírgulas', () => {
  const csv = rsvpsToCsv([
    {
      id: '1',
      guestName: 'Ana, Maria',
      attending: true,
      adultsCount: 2,
      childrenCount: 0,
      observations: 'oi "olá"',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  assert.match(csv, /^id,guest_name/);
  assert.match(csv, /"Ana, Maria"/);
  assert.match(csv, /yes/);
});

test('giftsToCsv: header + itens + valor BRL', () => {
  const csv = giftsToCsv([
    {
      intentKey: '550e8400-e29b-41d4-a716-446655440000',
      gifterName: 'João, Silva',
      amountCents: 15000,
      paymentMethod: 'pix',
      status: 'pending',
      paid: true,
      paidAt: '2026-01-02T00:00:00.000Z',
      providerReference: 'pay_1',
      items: [{ giftId: 'danca', quantity: 2 }, { giftId: 'spa', quantity: 1 }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ]);
  assert.match(csv, /^intent_key,gifter_name/);
  assert.match(csv, /"João, Silva"/);
  assert.match(csv, /150\.00/);
  assert.match(csv, /dancax2;spax1/);
  assert.match(csv, /yes/);
});

test('sendAdminNotification: skip sem RESEND_API_KEY (zero custo)', async () => {
  const r = await sendAdminNotification({}, { subject: 'x', text: 'y' });
  assert.equal(r.skipped, true);
  assert.equal(r.sent, false);
});

test('markIntentPaidByProviderRef: usa meta.changes oficial D1', async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async run() {
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
  };
  const r = await markIntentPaidByProviderRef(db, '12345', '2026-01-01T00:00:00.000Z');
  assert.equal(r.updated, true);
});

test('setMessageHidden: 0 changes → MESSAGE_NOT_FOUND', async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async run() {
          return { success: true, meta: { changes: 0 } };
        },
      };
    },
  };
  await assert.rejects(() => setMessageHidden(db, 'missing-id', true), /MESSAGE_NOT_FOUND/);
});

test('processMercadoPagoWebhook: marca paid quando approved', async () => {
  let updatedSql = '';
  const db = {
    prepare(sql) {
      updatedSql = sql;
      return {
        bind() {
          return this;
        },
        async run() {
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      id: 999,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 150,
    }),
  });

  try {
    const result = await processMercadoPagoWebhook({
      db,
      env: { MP_ACCESS_TOKEN: 'TEST' },
      payload: { type: 'payment', data: { id: 999 } },
    });
    assert.equal(result.ok, true);
    assert.equal(result.paid, true);
    assert.match(updatedSql, /paid_at/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('processMercadoPagoWebhook: card/boleto marca paid via external_reference', async () => {
  const sqls = [];
  const binds = [];
  const db = {
    prepare(sql) {
      sqls.push(sql);
      return {
        bind(...args) {
          binds.push(args);
          return this;
        },
        async run() {
          // 1ª tentativa (provider_reference) = 0; 2ª (external_ref) = 1
          const changes = sqls.length === 1 ? 0 : 1;
          return { success: true, meta: { changes } };
        },
      };
    },
  };

  const intentKey = '550e8400-e29b-41d4-a716-446655440099';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      id: 888,
      status: 'approved',
      transaction_amount: 200,
      external_reference: `casebem:gift:${intentKey}`,
    }),
  });

  try {
    const result = await processMercadoPagoWebhook({
      db,
      env: { MP_ACCESS_TOKEN: 'TEST' },
      payload: { type: 'payment', data: { id: 888 } },
    });
    assert.equal(result.ok, true);
    assert.equal(result.paid, true);
    assert.ok(sqls.some((s) => /intent_key/.test(s)));
    assert.ok(binds.some((b) => b.includes(intentKey)));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('processMercadoPagoWebhook: pending não marca paid', async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return this;
        },
        async run() {
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      id: 111,
      status: 'pending',
      transaction_amount: 10,
    }),
  });

  try {
    const result = await processMercadoPagoWebhook({
      db,
      env: { MP_ACCESS_TOKEN: 'TEST' },
      payload: { topic: 'payment', id: 111 },
    });
    assert.equal(result.ok, true);
    assert.equal(result.paid, undefined);
    assert.match(result.reason, /pending/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
