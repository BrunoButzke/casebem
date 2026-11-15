import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAuthDb } from './helpers/memory-auth-db.mjs';
import { ensurePartnerAccount } from '../functions/_lib/partner-seed.mjs';
import { signup } from '../functions/_lib/auth-service.mjs';
import { onRequestGet } from '../functions/api/casal/[slug].js';

function ctx(slug, db) {
  return {
    request: new Request(`https://casebem.com/api/casal/${slug}`),
    env: { DB: db },
    params: { slug },
  };
}

test('GET /api/casal/dani-carine returns slug without id or email', async () => {
  const db = new MemoryAuthDb();
  await ensurePartnerAccount(db, { email: 'dani@casebem.com', password: 'segredo12' }, '2026-11-15T03:00:00.000Z');
  const res = await onRequestGet(ctx('dani-carine', db));
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
  const db = new MemoryAuthDb();
  const now = '2026-11-15T03:00:00.000Z';
  const { accountId } = await signup(db, { email: 'a@x.com', password: 'segredo12', plan: 'basic' }, now);
  await db.prepare('UPDATE accounts SET slug = ? WHERE id = ?').bind('casal-a', accountId).run();
  const res = await onRequestGet(ctx('casal-a', db));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.isPartner, false);
  assert.equal(body.slug, 'casal-a');
});
