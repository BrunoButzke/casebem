import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAuthDb } from './helpers/memory-auth-db.mjs';
import { signup, PARTNER_ACCOUNT_ID } from '../functions/_lib/auth-service.mjs';
import { ensurePartnerAccount } from '../functions/_lib/partner-seed.mjs';
import {
  slugFromRequest,
  resolvePublicSlug,
  resolvePublicSlugOrPartner,
} from '../functions/_lib/public-slug.mjs';

test('slugFromRequest reads query then body, lowercased', () => {
  const req = new Request('https://casebem.com/api/gifts/catalog?slug=Dani-Carine');
  assert.equal(slugFromRequest(req), 'dani-carine');
  const req2 = new Request('https://casebem.com/api/rsvp', { method: 'POST' });
  assert.equal(slugFromRequest(req2, { slug: 'Outro' }), 'outro');
  assert.equal(slugFromRequest(req2, {}), null);
});

test('resolvePublicSlug 400 without slug, 404 unknown, 200 known', async () => {
  const db = new MemoryAuthDb();
  const now = '2026-11-15T03:00:00.000Z';
  await ensurePartnerAccount(db, { email: 'dani@casebem.com', password: 'segredo12' }, now);
  assert.equal((await resolvePublicSlug(db, '')).error, 'SLUG_REQUIRED');
  assert.equal((await resolvePublicSlug(db, 'nao-existe')).status, 404);
  const hit = await resolvePublicSlug(db, 'dani-carine');
  assert.equal(hit.ok, true);
  assert.equal(hit.account.id, PARTNER_ACCOUNT_ID);
});

test('resolvePublicSlugOrPartner falls back to partner when slug omitted', async () => {
  const db = new MemoryAuthDb();
  await ensurePartnerAccount(db, { email: 'dani@casebem.com', password: 'segredo12' }, '2026-11-15T03:00:00.000Z');
  const hit = await resolvePublicSlugOrPartner(db, null);
  assert.equal(hit.ok, true);
  assert.equal(hit.account.id, PARTNER_ACCOUNT_ID);
});
