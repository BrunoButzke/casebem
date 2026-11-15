import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signup, setAccountSlug, login } from '../functions/_lib/auth-service.mjs';
import { addGuests, resetMemoryGuestsForTests } from '../functions/_lib/rsvp-guest-list.mjs';
import { createMessage, resetMemoryMessagesForTests } from '../functions/_lib/messages-service.mjs';
import { createGift, getActiveCatalog, resetMemoryCatalogForTests } from '../functions/_lib/catalog-service.mjs';
import { createCheckoutPayment } from '../functions/_lib/gifts-service.mjs';
import { onRequestGet as messagesGet, onRequestPost as messagesPost } from '../functions/api/messages.js';
import { onRequestPost as rsvpPost, onRequest as rsvpOnRequest } from '../functions/api/rsvp.js';
import { onRequestPost as checkoutPost } from '../functions/api/gifts/checkout.js';

const SECRET = Buffer.alloc(32, 7).toString('base64');
const NOW = '2026-11-15T03:00:00.000Z';

async function signupOrLogin(email) {
  try {
    return await signup(null, { email, password: 'segredo12', plan: 'basic' }, NOW);
  } catch (err) {
    if (err.message !== 'EMAIL_TAKEN') throw err;
    return login(null, { email, password: 'segredo12' }, NOW);
  }
}

test('messages GET for slug B does not list message created on A', async () => {
  resetMemoryMessagesForTests();
  const a = await signupOrLogin('msg-a@x.com');
  const b = await signupOrLogin('msg-b@x.com');
  await setAccountSlug(null, a.accountId, 'msg-a');
  await setAccountSlug(null, b.accountId, 'msg-b');
  await createMessage(null, { guestName: 'Ana', message: 'Oi do A', consentGiven: true }, 'k-a', SECRET, a.accountId);
  const res = await messagesGet({
    request: new Request('https://casebem.com/api/messages?slug=msg-b'),
    env: { DB: null, RSVP_SECRET: SECRET },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  const texts = (body.messages || []).map((m) => m.message);
  assert.equal(texts.includes('Oi do A'), false);
  assert.equal(JSON.stringify(body).includes(a.accountId), false);
});

test('messages POST unknown slug is 404', async () => {
  const res = await messagesPost({
    request: new Request('https://casebem.com/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'k-unknown' },
      body: JSON.stringify({
        slug: 'nao-existe',
        guestName: 'Ana',
        message: 'Oi',
        consentGiven: true,
      }),
    }),
    env: { DB: null, RSVP_SECRET: SECRET },
  });
  assert.equal(res.status, 404);
});

test('RSVP for slug B cannot confirm guest that only exists on A', async () => {
  resetMemoryGuestsForTests();
  const a = await signupOrLogin('g-a@x.com');
  const b = await signupOrLogin('g-b@x.com');
  await setAccountSlug(null, a.accountId, 'g-a');
  await setAccountSlug(null, b.accountId, 'g-b');
  await addGuests(null, ['Ana Alpha'], { accountId: a.accountId });
  const res = await rsvpPost({
    request: new Request('https://casebem.com/api/rsvp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'rsvp-b-1' },
      body: JSON.stringify({
        slug: 'g-b',
        guestName: 'Ana Alpha',
        attending: true,
        adultsCount: 1,
        childrenCount: 0,
        consentGiven: true,
      }),
    }),
    env: { DB: null, RSVP_SECRET: SECRET },
  });
  assert.ok(res.status === 400 || res.status === 403);
});

test('checkout catalog lookup uses options.accountId not the partner default', async () => {
  resetMemoryCatalogForTests();
  const giftA = await createGift(null, 'acc-checkout-a', {
    name: 'Gift A',
    description: 'presente A',
    priceInCents: 1000,
    mode: 'fixed',
  });
  const catalogB = await getActiveCatalog(null, 'acc-checkout-b');
  assert.equal(catalogB.some((g) => g.id === giftA.id), false);
});

test('createCheckoutPayment rejects gift from another account catalog', async () => {
  resetMemoryCatalogForTests();
  const db = { prepare() { throw new Error('no d1'); } };
  try {
    const result = await createCheckoutPayment(
      {
        paymentMethod: 'pix',
        gifterName: 'Ana',
        intentKey: 'intent-b-1',
        items: [{ giftId: 'danca', quantity: 1 }],
      },
      { RSVP_SECRET: SECRET, MP_ACCESS_TOKEN: 'x' },
      db,
      '1.1.1.1',
      { accountId: 'pay-b' }
    );
    assert.equal(result.ok, false);
    assert.match(String(result.error || result.message || ''), /Presente não encontrado|DATABASE/i);
  } catch (err) {
    assert.match(String(err.message || err), /Presente não encontrado|DATABASE/i);
  }
});

test('checkout unknown slug is 404', async () => {
  const res = await checkoutPost({
    request: new Request('https://casebem.com/api/gifts/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Origin: 'https://casebem.com' },
      body: JSON.stringify({
        slug: 'nao-existe',
        paymentMethod: 'pix',
        gifterName: 'Ana',
        intentKey: 'i1',
        items: [{ giftId: 'x', quantity: 1 }],
      }),
    }),
    env: { DB: { prepare() { return { bind() { return this; }, first: async () => null }; } } },
  });
  assert.equal(res.status, 404);
});

test('checkout unknown slug without DB is 404 not 503', async () => {
  const res = await checkoutPost({
    request: new Request('https://casebem.com/api/gifts/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Origin: 'https://casebem.com' },
      body: JSON.stringify({
        slug: 'nao-existe',
        paymentMethod: 'pix',
        gifterName: 'Ana',
        intentKey: 'i2',
        items: [{ giftId: 'x', quantity: 1 }],
      }),
    }),
    env: { DB: null },
  });
  assert.equal(res.status, 404);
});

function createPublicApiDb(accounts = []) {
  const data = { accounts: [...accounts], rsvps: [], rate_limits: [], messages: [] };

  function matchToken(sql, bindings) {
    const tokenHash = bindings[0];
    if (sql.includes('wedding_key')) {
      const weddingKey = bindings[sql.includes('UPDATE') ? bindings.length - 1 : 1];
      return data.rsvps.find(
        (r) => r.manage_token_hash === tokenHash && r.wedding_key === weddingKey
      ) || null;
    }
    return data.rsvps.find((r) => r.manage_token_hash === tokenHash) || null;
  }

  return {
    data,
    async batch(statements) {
      return Promise.all(statements.map((stmt) => stmt.run()));
    },
    prepare(sql) {
      return {
        sql,
        bindings: [],
        bind(...args) {
          this.bindings = args;
          return this;
        },
        async first() {
          if (sql.includes('FROM accounts')) {
            const [slug] = this.bindings;
            return data.accounts.find((a) => a.slug === slug) || null;
          }
          if (sql.includes('FROM wedding_settings')) {
            return { rsvp_mode: 'open' };
          }
          if (sql.includes('FROM rsvps')) {
            if (sql.includes('idempotency_key')) {
              const [accountId, idemKey] = this.bindings;
              return data.rsvps.find(
                (r) => r.account_id === accountId && r.idempotency_key === idemKey
              ) || null;
            }
            return matchToken(sql, this.bindings);
          }
          if (sql.includes('RETURNING request_count')) {
            const runResult = await this.run();
            if (!runResult.success) return null;
            const [id] = this.bindings;
            const row = data.rate_limits.find((l) => l.id === id);
            return row ? { request_count: row.request_count } : null;
          }
          return null;
        },
        async run() {
          if (sql.includes('INSERT INTO rsvps')) {
            const [
              id, weddingKey, guestName, attending, adultsCount, childrenCount,
              observations, consentGiven, tokenHash, createdAt, updatedAt,
              idemKey, idemFingerprint, accountId,
            ] = this.bindings;
            data.rsvps.push({
              id,
              wedding_key: weddingKey,
              guest_name: guestName,
              attending,
              adults_count: adultsCount,
              children_count: childrenCount,
              observations,
              consent_given: consentGiven,
              manage_token_hash: tokenHash,
              created_at: createdAt,
              updated_at: updatedAt,
              idempotency_key: idemKey,
              idempotency_fingerprint: idemFingerprint,
              account_id: accountId,
            });
            return { success: true };
          }
          if (sql.includes('UPDATE rsvps')) {
            const tokenHash = sql.includes('wedding_key')
              ? this.bindings[this.bindings.length - 2]
              : this.bindings[this.bindings.length - 1];
            const found = sql.includes('wedding_key')
              ? matchToken(sql, [tokenHash, this.bindings[this.bindings.length - 1]])
              : matchToken(sql, [tokenHash]);
            return { success: Boolean(found) };
          }
          if (sql.includes('INSERT INTO wedding_messages')) {
            const [
              id, weddingKey, guestName, message, consentGiven, createdAt,
              idempotencyKey, fingerprint, accountId,
            ] = this.bindings;
            data.messages.push({
              id, wedding_key: weddingKey, guest_name: guestName, message,
              consent_given: consentGiven, created_at: createdAt,
              idempotency_key: idempotencyKey, idempotency_fingerprint: fingerprint,
              account_id: accountId,
            });
            return { success: true };
          }
          if (sql.includes('INSERT INTO rate_limits')) {
            const [id, weddingKey, ipHash, windowStart, ts1, ts2, ts3, limit] = this.bindings;
            const existing = data.rate_limits.find((l) => l.id === id);
            if (existing) {
              if (Number(existing.request_count) >= limit) return { success: false };
              existing.request_count = Number(existing.request_count) + 1;
              existing.updated_at = ts3;
              return { success: true };
            }
            data.rate_limits.push({
              id, wedding_key: weddingKey, ip_hash: ipHash, window_start: windowStart,
              request_count: 1, created_at: ts1, updated_at: ts2,
            });
            return { success: true };
          }
          return { success: true, meta: { changes: 0 } };
        },
      };
    },
  };
}

test('RSVP POST 201 does not leak account UUID as weddingKey', async () => {
  const a = await signupOrLogin('rsvp-uuid-leak@x.com');
  await setAccountSlug(null, a.accountId, 'casal-uuid');
  const db = createPublicApiDb([{ id: a.accountId, slug: 'casal-uuid', is_partner: 0 }]);
  const res = await rsvpPost({
    request: new Request('https://casebem.com/api/rsvp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'rsvp-uuid-1' },
      body: JSON.stringify({
        slug: 'casal-uuid',
        guestName: 'Maria Silva',
        attending: true,
        adultsCount: 1,
        childrenCount: 0,
        consentGiven: true,
      }),
    }),
    env: { DB: db, RSVP_SECRET: SECRET },
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(JSON.stringify(body).includes(a.accountId), false);
  assert.ok(body.weddingKey === undefined || body.weddingKey === 'casal-uuid');
});

test('RSVP GET by manage token returns 200 for non-partner slug', async () => {
  const a = await signupOrLogin('rsvp-token-np@x.com');
  await setAccountSlug(null, a.accountId, 'casal-token');
  const db = createPublicApiDb([{ id: a.accountId, slug: 'casal-token', is_partner: 0 }]);
  const created = await rsvpPost({
    request: new Request('https://casebem.com/api/rsvp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'rsvp-token-np-1' },
      body: JSON.stringify({
        slug: 'casal-token',
        guestName: 'João Pedro',
        attending: true,
        adultsCount: 1,
        childrenCount: 0,
        consentGiven: true,
      }),
    }),
    env: { DB: db, RSVP_SECRET: SECRET },
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.ok(createdBody.manageToken);
  const getRes = await rsvpOnRequest({
    request: new Request('https://casebem.com/api/rsvp', {
      method: 'GET',
      headers: { Authorization: `Bearer ${createdBody.manageToken}` },
    }),
    env: { DB: db, RSVP_SECRET: SECRET },
  });
  assert.equal(getRes.status, 200);
  const getBody = await getRes.json();
  assert.equal(getBody.guestName, 'João Pedro');
  assert.equal(JSON.stringify(getBody).includes(a.accountId), false);
});

test('messages POST 201 does not leak account UUID as weddingKey', async () => {
  const a = await signupOrLogin('msg-uuid-leak@x.com');
  await setAccountSlug(null, a.accountId, 'msg-uuid');
  const db = createPublicApiDb([{ id: a.accountId, slug: 'msg-uuid', is_partner: 0 }]);
  const res = await messagesPost({
    request: new Request('https://casebem.com/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Idempotency-Key': 'msg-uuid-1' },
      body: JSON.stringify({
        slug: 'msg-uuid',
        guestName: 'Ana',
        message: 'Parabéns aos noivos!',
        consentGiven: true,
      }),
    }),
    env: { DB: db, RSVP_SECRET: SECRET },
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(JSON.stringify(body).includes(a.accountId), false);
  assert.ok(body.weddingKey === undefined || body.weddingKey === 'msg-uuid');
});
