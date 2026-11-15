import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSlug, RESERVED_SLUGS, assertSlugFormat } from '../functions/_lib/slug.mjs';
import { signup, claimAccountSlug, PARTNER_ACCOUNT_ID } from '../functions/_lib/auth-service.mjs';
import { ensurePartnerAccount } from '../functions/_lib/partner-seed.mjs';

test('normalizeSlug trims and lowercases', () => {
  assert.equal(normalizeSlug('  Ana-E-Joao '), 'ana-e-joao');
});

test('assertSlugFormat rejects short, reserved-looking punctuation and double hyphen', () => {
  assert.throws(() => assertSlugFormat('ab'), { message: 'SLUG_INVALID' });
  assert.throws(() => assertSlugFormat('-abc'), { message: 'SLUG_INVALID' });
  assert.throws(() => assertSlugFormat('abc-'), { message: 'SLUG_INVALID' });
  assert.throws(() => assertSlugFormat('ana--joao'), { message: 'SLUG_INVALID' });
  assert.throws(() => assertSlugFormat('Ana E Joao'), { message: 'SLUG_INVALID' });
  assert.doesNotThrow(() => assertSlugFormat('ana-e-joao'));
  assert.doesNotThrow(() => assertSlugFormat('abc'));
});

test('RESERVED_SLUGS includes product paths and the partner slug', () => {
  for (const item of ['admin', 'entrar', 'casal', 'games', 'dani-carine']) {
    assert.equal(RESERVED_SLUGS.has(item), true);
  }
});

test('claimAccountSlug stores unique slug and rejects taken or reserved', async () => {
  const now = '2026-11-15T08:00:00.000Z';
  const a = await signup(null, { email: 'slug-a@x.com', password: 'segredo12', plan: 'basic' }, now);
  const b = await signup(null, { email: 'slug-b@x.com', password: 'segredo12', plan: 'basic' }, now);
  const ok = await claimAccountSlug(null, a.accountId, '  Ana-E-Joao ');
  assert.equal(ok.slug, 'ana-e-joao');
  await assert.rejects(() => claimAccountSlug(null, b.accountId, 'ana-e-joao'), { message: 'SLUG_TAKEN' });
  await assert.rejects(() => claimAccountSlug(null, b.accountId, 'admin'), { message: 'SLUG_RESERVED' });
  await assert.rejects(() => claimAccountSlug(null, b.accountId, 'x'), { message: 'SLUG_INVALID' });
});

test('partner cannot change slug away from dani-carine', async () => {
  await ensurePartnerAccount(null, {}, '2026-11-15T08:00:00.000Z');
  await assert.rejects(
    () => claimAccountSlug(null, PARTNER_ACCOUNT_ID, 'outro-casal'),
    { message: 'SLUG_LOCKED' }
  );
  const same = await claimAccountSlug(null, PARTNER_ACCOUNT_ID, 'dani-carine');
  assert.equal(same.slug, 'dani-carine');
});
