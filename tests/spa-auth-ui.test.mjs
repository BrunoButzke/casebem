/**
 * Run: node --test tests/spa-auth-ui.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { hubTiles } from '../src/pages/admin/hub-tiles.mjs';
import { parseMe, signupRequest } from '../src/lib/session-api.mjs';

test('basic sees entertainment locked; pro does not', () => {
  assert.equal(hubTiles('basic').find((t) => t.id === 'entretenimento').needsUpgrade, true);
  assert.equal(hubTiles('pro').find((t) => t.id === 'entretenimento').needsUpgrade, false);
  assert.equal(hubTiles('basic').some((t) => t.id === 'hospedagem' || t.id === 'playlist'), false);
});

test('hub tiles lock album for basic and omit playlist/hospedagem', () => {
  const basic = hubTiles('basic');
  const vip = hubTiles('vip');
  assert.deepEqual(
    basic.map((t) => t.id),
    ['minha-pagina', 'convidados', 'presentes', 'papelaria', 'mural', 'entretenimento', 'album']
  );
  assert.equal(basic.find((t) => t.id === 'album').needsUpgrade, true);
  assert.equal(vip.find((t) => t.id === 'album').needsUpgrade, false);
  assert.equal(basic.find((t) => t.id === 'minha-pagina').to, '/admin/minha-pagina');
  assert.equal(basic.find((t) => t.id === 'minha-pagina').title, 'Minha página');
});

test('signupRequest posts to /api/auth/signup with credentials include', async () => {
  const window = new Window({ url: 'http://localhost/' });
  globalThis.window = window;
  globalThis.document = window.document;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(
      JSON.stringify({
        ok: true,
        account: {
          email: 'nova@x.com',
          plan: 'basic',
          planStatus: 'active',
          slug: null,
          isPartner: false,
        },
      }),
      { status: 201, headers: { 'content-type': 'application/json' } }
    );
  };

  const res = await signupRequest({
    email: 'nova@x.com',
    password: 'segredo12',
    plan: 'basic',
  });

  assert.equal(String(captured.url).includes('/api/auth/signup'), true);
  assert.equal(captured.init.credentials, 'include');
  assert.equal(captured.init.method, 'POST');
  const body = JSON.parse(captured.init.body);
  assert.equal(body.plan, 'basic');
  assert.equal(body.email, 'nova@x.com');
  assert.ok(body.password.length >= 8);
  assert.equal(res.status, 201);
});

test('parseMe ignores HTML 200 from SPA fallback', async () => {
  const html = new Response('<!doctype html><title>CaseBem</title>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });
  assert.equal(await parseMe(html), null);

  const json = new Response(
    JSON.stringify({
      email: 'a@x.com',
      plan: 'basic',
      planStatus: 'active',
      slug: null,
      isPartner: false,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
  assert.equal((await parseMe(json)).email, 'a@x.com');

  const unauthorized = new Response(JSON.stringify({ ok: false }), { status: 401 });
  assert.equal(await parseMe(unauthorized), null);
});
