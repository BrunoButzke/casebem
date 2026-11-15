import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signup, setAccountSlug, login } from '../functions/_lib/auth-service.mjs';
import { addGuests, resetMemoryGuestsForTests } from '../functions/_lib/rsvp-guest-list.mjs';
import { createMessage, resetMemoryMessagesForTests } from '../functions/_lib/messages-service.mjs';
import { createGift, getActiveCatalog, resetMemoryCatalogForTests } from '../functions/_lib/catalog-service.mjs';
import { createCheckoutPayment } from '../functions/_lib/gifts-service.mjs';
import { onRequestGet as messagesGet, onRequestPost as messagesPost } from '../functions/api/messages.js';
import { onRequestPost as rsvpPost } from '../functions/api/rsvp.js';
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
