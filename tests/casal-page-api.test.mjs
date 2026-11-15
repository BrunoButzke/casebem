import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAuthDb } from './helpers/memory-auth-db.mjs';
import { ensurePartnerAccount } from '../functions/_lib/partner-seed.mjs';
import { signup, claimAccountSlug } from '../functions/_lib/auth-service.mjs';
import { saveCouplePage, resetMemoryCouplePagesForTests } from '../functions/_lib/couple-page-service.mjs';
import { onRequestGet } from '../functions/api/casal/[slug].js';

function ctx(slug, db) {
  return {
    request: new Request(`https://casebem.com/api/casal/${slug}`),
    env: { DB: db },
    params: { slug },
  };
}

test('GET /api/casal/dani-carine returns slug without id or email', async () => {
  await ensurePartnerAccount(null, { email: 'dani@casebem.com', password: 'segredo12' }, '2026-11-15T03:00:00.000Z');
  const res = await onRequestGet(ctx('dani-carine', null));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.slug, 'dani-carine');
  assert.equal(body.isPartner, true);
  assert.equal('id' in body, false);
  assert.equal('email' in body, false);
});

test('GET /api/casal/dani-carine with process memory and no partner env is 200', async () => {
  await ensurePartnerAccount(null, {}, '2026-11-15T03:00:00.000Z');
  const res = await onRequestGet(ctx('dani-carine', null));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.slug, 'dani-carine');
});

test('GET /api/casal/unknown is 404 SLUG_NOT_FOUND', async () => {
  const db = new MemoryAuthDb();
  const res = await onRequestGet(ctx('nao-existe', db));
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error, 'SLUG_NOT_FOUND');
});

test('GET /api/casal/:slug of a non-partner account with slug is 200 isPartner false', async () => {
  const now = '2026-11-15T03:00:00.000Z';
  const { accountId } = await signup(null, { email: 'a@x.com', password: 'segredo12', plan: 'basic' }, now);
  await claimAccountSlug(null, accountId, 'casal-a');
  const res = await onRequestGet(ctx('casal-a', null));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.isPartner, false);
  assert.equal(body.slug, 'casal-a');
});

test('GET /api/casal/:slug includes public page without ids', async () => {
  resetMemoryCouplePagesForTests();
  const now = '2026-11-15T08:00:00.000Z';
  const created = await signup(null, { email: 'pub@x.com', password: 'segredo12', plan: 'basic' }, now);
  await claimAccountSlug(null, created.accountId, 'pub-casal');
  await saveCouplePage(null, created.accountId, { names: ['Lia'], story: 'Oi' });
  const res = await onRequestGet({
    request: new Request('https://casebem.com/api/casal/pub-casal'),
    env: { DB: null },
    params: { slug: 'pub-casal' },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.page.names, ['Lia']);
  assert.equal(body.page.story, 'Oi');
  assert.equal('id' in body, false);
  assert.equal('email' in body, false);
});

test('GET partner page includes default etapas', async () => {
  resetMemoryCouplePagesForTests();
  const res = await onRequestGet({
    request: new Request('https://casebem.com/api/casal/dani-carine'),
    env: { DB: null },
    params: { slug: 'dani-carine' },
  });
  const body = await res.json();
  assert.equal(body.page.etapas[0].title, 'Cerimônia');
});
