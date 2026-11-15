import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { coupleNavItems } from '../src/pages/casal/couple-nav.mjs';
import { fetchCouplePage } from '../src/lib/casal-api.mjs';
import { readFileSync } from 'node:fs';

test('couple nav omits playlist, lodging, stationery and login', () => {
  const ids = coupleNavItems().map((i) => i.href);
  assert.deepEqual(ids, [
    '#boas-vindas',
    '#o-casal',
    '#o-dia',
    '#local',
    '#confirmar-presenca',
    '#presentes',
    '#mural-recados',
  ]);
  assert.equal(ids.some((h) => h.includes('playlist') || h.includes('hosped')), false);
});

test('fetchCouplePage 404 yields SLUG_NOT_FOUND', async () => {
  const window = new Window({ url: 'http://localhost/casal/x' });
  globalThis.window = window;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), '/api/casal/nao-existe');
    return new Response(JSON.stringify({ error: 'SLUG_NOT_FOUND' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  };
  const result = await fetchCouplePage('nao-existe');
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.equal(result.error, 'SLUG_NOT_FOUND');
});

test('App.jsx declares /casal/:slug and CoupleSite has no admin login', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/casal\/:slug"/);
  const page = readFileSync(new URL('../src/pages/casal/CoupleSite.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /admin-login|Acesso dos noivos/);
  assert.match(page, /Página não encontrada/);
});