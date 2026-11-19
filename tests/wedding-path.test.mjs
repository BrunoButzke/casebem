/**
 * Run: node --test tests/wedding-path.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  weddingKeyFromPathname,
  isPublishedWeddingSite,
  coupleNamesFallbackFromSlug,
} from '../functions/_lib/wedding-path.mjs';
import { onRequestGet as weddingGet } from '../functions/api/wedding.js';
import {
  resetTenantsForTests,
  registerWedding,
} from '../functions/_lib/tenant-service.mjs';
import { resetAdminMembersForTests } from '../functions/_lib/admin-members-service.mjs';

beforeEach(() => {
  resetTenantsForTests();
  resetAdminMembersForTests();
});

test('weddingKeyFromPathname lê o slug do casal', () => {
  assert.equal(weddingKeyFromPathname('/bruno-cris/'), 'bruno-cris');
  assert.equal(weddingKeyFromPathname('/bruno-cris/admin'), 'bruno-cris');
  assert.equal(weddingKeyFromPathname('/dani-carine/'), 'dani-carine');
  assert.equal(weddingKeyFromPathname('/landing-page-animada/'), 'dani-carine');
});

test('novos casais ficam em breve; dani-carine publicado', () => {
  assert.equal(isPublishedWeddingSite('dani-carine'), true);
  assert.equal(isPublishedWeddingSite('bruno-cris'), false);
  assert.equal(coupleNamesFallbackFromSlug('bruno-cris'), 'Bruno & Cris');
});

test('API wedding devolve comingSoon e coupleNames do tenant', async () => {
  await registerWedding(null, {
    yourName: 'Bruno',
    partnerName: 'Cris',
    role: 'noivo',
    email: 'bruno-em-breve@example.com',
    password: 'Senha12!',
    passwordConfirm: 'Senha12!',
  });

  const res = await weddingGet({
    request: new Request('https://casebem.com/api/wedding?w=cris-bruno'),
    env: {},
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.comingSoon, true);
  assert.equal(body.hasSiteContent, false);
  assert.equal(body.coupleNames, 'Bruno & Cris');
});
