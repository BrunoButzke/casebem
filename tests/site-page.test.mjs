/**
 * Run: node --test tests/site-page.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resetSiteSectionsForTests,
  listSiteSectionsAdmin,
  listSiteSectionsPublic,
  updateSiteSection,
  siteHasFilledContent,
} from '../functions/_lib/site-page-service.mjs';
import { onRequestGet as adminGet, onRequestPatch as adminPatch } from '../functions/api/admin/site-page.js';
import { onRequestGet as publicGet } from '../functions/api/site-page.js';
import { onRequestGet as weddingGet } from '../functions/api/wedding.js';

const SECRET = 'production-secret-16';

beforeEach(() => resetSiteSectionsForTests());

test('seed cria seções padrão', async () => {
  const sections = await listSiteSectionsAdmin(null);
  assert.ok(sections.length >= 10);
  assert.ok(sections.every((s) => s.active));
});

test('novo tenant começa com Nossa página vazia (em breve)', async () => {
  const sections = await listSiteSectionsAdmin(null, 'bruno-cris');
  assert.ok(sections.length >= 10);
  assert.equal(siteHasFilledContent(sections), false);
  assert.ok(sections.every((s) => s.active === false));

  const meta = await weddingGet({
    request: new Request('https://casebem.com/api/wedding?w=bruno-cris'),
    env: {},
  });
  const body = await meta.json();
  assert.equal(body.comingSoon, true);

  await updateSiteSection(
    null,
    'hero',
    { active: true, content: { titleLeft: 'Bruno' } },
    'bruno-cris'
  );
  const after = await listSiteSectionsAdmin(null, 'bruno-cris');
  assert.equal(siteHasFilledContent(after), true);
  assert.equal(after.find((s) => s.sectionKey === 'hero')?.active, true);

  const meta2 = await weddingGet({
    request: new Request('https://casebem.com/api/wedding?w=bruno-cris'),
    env: {},
  });
  const body2 = await meta2.json();
  assert.equal(body2.comingSoon, false);
});

test('desativar some do público', async () => {
  await updateSiteSection(null, 'hero', { active: false });
  const pub = await listSiteSectionsPublic(null);
  assert.equal(pub.some((s) => s.sectionKey === 'hero'), false);
  assert.ok(pub.some((s) => s.sectionKey === 'boas-vindas'));
});

test('update content persiste', async () => {
  const updated = await updateSiteSection(null, 'local', {
    content: { title: 'Novo Local', placeText: 'Centro' },
  });
  assert.equal(updated.content.title, 'Novo Local');
  assert.equal(updated.content.placeText, 'Centro');
});

test('API admin e pública', async () => {
  const adminRes = await adminGet({
    request: new Request('https://casebem.com/api/admin/site-page', {
      headers: { authorization: `Bearer ${SECRET}` },
    }),
    env: { ADMIN_PANEL_SECRET: SECRET },
  });
  assert.equal(adminRes.status, 200);

  const patch = await adminPatch({
    request: new Request('https://casebem.com/api/admin/site-page', {
      method: 'PATCH',
      headers: {
        origin: 'https://casebem.com',
        authorization: `Bearer ${SECRET}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sectionKey: 'dress-code',
        content: { title: 'Esporte fino' },
      }),
    }),
    env: { ADMIN_PANEL_SECRET: SECRET },
  });
  assert.equal(patch.status, 200);

  const pub = await publicGet({
    request: new Request('https://casebem.com/api/site-page'),
    env: {},
  });
  assert.equal(pub.status, 200);
  const body = await pub.json();
  const dress = body.sections.find((s) => s.sectionKey === 'dress-code');
  assert.equal(dress.content.title, 'Esporte fino');
});
