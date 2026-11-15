import { test } from 'node:test';
import assert from 'node:assert/strict';
import { login, signup, setAccountSlug } from '../functions/_lib/auth-service.mjs';
import { createGift, resetMemoryCatalogForTests } from '../functions/_lib/catalog-service.mjs';
import { addGuests, resetMemoryGuestsForTests } from '../functions/_lib/rsvp-guest-list.mjs';
import { onRequestGet as catalogGet } from '../functions/api/gifts/catalog.js';
import { onRequestGet as searchGet } from '../functions/api/guests/search.js';

async function signupOrLogin(email, now) {
  try {
    return await signup(null, { email, password: 'segredo12', plan: 'basic' }, now);
  } catch (err) {
    if (err.message !== 'EMAIL_TAKEN') throw err;
    return login(null, { email, password: 'segredo12' }, now);
  }
}

async function twoAccounts() {
  const now = '2026-11-15T03:00:00.000Z';
  const a = await signupOrLogin('a@public-catalog.example', now);
  const b = await signupOrLogin('b@public-catalog.example', now);
  await setAccountSlug(null, a.accountId, 'casal-a');
  await setAccountSlug(null, b.accountId, 'casal-b');
  return { a: { ...a.account, id: a.accountId }, b: { ...b.account, id: b.accountId } };
}

test('catalog for slug B does not include gift created on A', async () => {
  resetMemoryCatalogForTests();
  const { a } = await twoAccounts();
  const gift = await createGift(null, a.id, {
    name: 'Lua A',
    description: 'Viagem',
    priceInCents: 1000,
    mode: 'fixed',
  });
  const resB = await catalogGet({
    request: new Request('https://casebem.com/api/gifts/catalog?slug=casal-b'),
    env: { DB: null },
  });
  assert.equal(resB.status, 200);
  const body = await resB.json();
  assert.equal(body.gifts.some((g) => g.id === gift.id), false);

  const resUnknown = await catalogGet({
    request: new Request('https://casebem.com/api/gifts/catalog?slug=nao-existe'),
    env: { DB: null },
  });
  assert.equal(resUnknown.status, 404);
});

test('guest search for slug B does not return guest of A', async () => {
  resetMemoryGuestsForTests();
  const { a } = await twoAccounts();
  await addGuests(null, ['Ana Alpha'], { accountId: a.id });
  const resB = await searchGet({
    request: new Request('https://casebem.com/api/guests/search?q=Ana&slug=casal-b'),
    env: { DB: null },
  });
  assert.equal(resB.status, 200);
  const body = await resB.json();
  assert.equal(body.count, 0);
});
