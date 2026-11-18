/**
 * Isolamento multi-tenant: bruno-cris não vê / altera dados de dani-carine.
 * Run: node --test tests/tenant-isolation.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mintTenantToken, requireAdmin } from '../functions/_lib/admin-auth.mjs';
import {
  resetMemoryGuestsForTests,
  addGuests,
  listGuestList,
} from '../functions/_lib/rsvp-guest-list.mjs';
import {
  resetMemoryChallengesForTests,
  createQuestion,
  listQuestionsAdmin,
} from '../functions/_lib/challenges-service.mjs';
import {
  resetSiteSectionsForTests,
  listSiteSectionsAdmin,
  updateSiteSection,
} from '../functions/_lib/site-page-service.mjs';
import {
  resetMemoryCatalogForTests,
  createGift,
  listCatalogAdmin,
} from '../functions/_lib/catalog-service.mjs';
import { listAdminMembers, resetAdminMembersForTests } from '../functions/_lib/admin-members-service.mjs';
import { registerWedding, resetTenantsForTests } from '../functions/_lib/tenant-service.mjs';

const SECRET = 'tenant-isolation-secret-99';
const ENV = { ADMIN_PANEL_SECRET: SECRET };

beforeEach(() => {
  resetMemoryGuestsForTests();
  resetMemoryChallengesForTests();
  resetSiteSectionsForTests();
  resetMemoryCatalogForTests();
  resetAdminMembersForTests();
  resetTenantsForTests();
});

test('token scoped: requireAdmin devolve weddingKey do tenant', async () => {
  const token = await mintTenantToken(SECRET, 'bruno-cris');
  const auth = await requireAdmin(
    new Request('https://casebem.com/api/admin/summary', {
      headers: { Authorization: `Bearer ${token}` },
    }),
    ENV
  );
  assert.equal(auth.ok, true);
  assert.equal(auth.weddingKey, 'bruno-cris');
});

test('token de bruno-cris não autentica como dani-carine', async () => {
  const bruno = await mintTenantToken(SECRET, 'bruno-cris');
  const dani = await mintTenantToken(SECRET, 'dani-carine');
  assert.notEqual(bruno, dani);

  const authB = await requireAdmin(
    new Request('https://x', { headers: { Authorization: `Bearer ${bruno}` } }),
    ENV
  );
  const authD = await requireAdmin(
    new Request('https://x', { headers: { Authorization: `Bearer ${dani}` } }),
    ENV
  );
  assert.equal(authB.weddingKey, 'bruno-cris');
  assert.equal(authD.weddingKey, 'dani-carine');
});

test('lista de convidados isolada entre tenants', async () => {
  await addGuests(null, ['Amigo Bruno'], {}, 'bruno-cris');
  const bruno = await listGuestList(null, 'bruno-cris');
  const dani = await listGuestList(null, 'dani-carine');

  assert.ok(bruno.some((g) => g.displayName.includes('Amigo Bruno')));
  assert.ok(!dani.some((g) => g.displayName.includes('Amigo Bruno')));
  // dani-carine ainda pode ter seed; bruno não deve ver esses nomes do seed
  const seedLeak = bruno.some((g) => dani.some((d) => d.displayName === g.displayName && d.id === g.id));
  assert.equal(seedLeak, false);
});

test('desafios isolados: pergunta em bruno-cris não aparece em dani-carine', async () => {
  await createQuestion(
    null,
    {
      id: 'q-bruno-1',
      prompt: 'Pergunta só do Bruno?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      points: 10,
    },
    'bruno-cris'
  );

  const brunoQs = await listQuestionsAdmin(null, 'bruno-cris');
  const daniQs = await listQuestionsAdmin(null, 'dani-carine');

  assert.ok(brunoQs.some((q) => q.id === 'q-bruno-1'));
  assert.ok(!daniQs.some((q) => q.id === 'q-bruno-1'));
});

test('site-page isolada: edição em bruno-cris não altera dani-carine', async () => {
  await updateSiteSection(
    null,
    'hero',
    { content: { titleLeft: 'Bruno', titleRight: 'Cris' } },
    'bruno-cris'
  );

  const bruno = await listSiteSectionsAdmin(null, 'bruno-cris');
  const dani = await listSiteSectionsAdmin(null, 'dani-carine');

  const brunoHero = bruno.find((s) => s.sectionKey === 'hero');
  const daniHero = dani.find((s) => s.sectionKey === 'hero');

  assert.equal(brunoHero?.content?.titleLeft, 'Bruno');
  assert.notEqual(daniHero?.content?.titleLeft, 'Bruno');
});

test('catálogo isolado: presente de bruno-cris não vaza para dani-carine', async () => {
  await createGift(
    null,
    {
      id: 'presente-bruno',
      name: 'Presente Bruno',
      description: 'Só deste casal',
      priceInCents: 5000,
      imageUrl: '/img/x.jpg',
      mode: 'fixed',
      active: true,
    },
    'bruno-cris'
  );

  const bruno = await listCatalogAdmin(null, 'bruno-cris');
  const dani = await listCatalogAdmin(null, 'dani-carine');

  assert.ok(bruno.some((g) => g.id === 'presente-bruno'));
  assert.ok(!dani.some((g) => g.id === 'presente-bruno'));
});

test('acessos admin_members isolados por wedding_key no cadastro', async () => {
  const result = await registerWedding(null, {
    yourName: 'Bruno',
    partnerName: 'Cris',
    role: 'noivo',
    email: 'bruno@example.com',
    password: 'Senha12!',
    passwordConfirm: 'Senha12!',
  });
  // noiva=Cris, noivo=Bruno → slug cris-bruno
  assert.equal(result.tenant.id, 'cris-bruno');

  const coupleMembers = await listAdminMembers(null, result.tenant.id);
  const daniMembers = await listAdminMembers(null, 'dani-carine');

  assert.ok(coupleMembers.some((m) => m.email === 'bruno@example.com'));
  assert.ok(!daniMembers.some((m) => m.email === 'bruno@example.com'));
});
