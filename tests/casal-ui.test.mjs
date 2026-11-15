import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { coupleNavItems } from '../src/pages/casal/couple-nav.mjs';
import { fetchCouplePage, searchGuestsPublic, submitRsvp } from '../src/lib/casal-api.mjs';
import { PARTNER_COPY } from '../src/pages/casal/partner-copy.mjs';
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

test('fetchCouplePage invalid JSON on error response does not throw', async () => {
  const window = new Window({ url: 'http://localhost/casal/x' });
  globalThis.window = window;
  globalThis.fetch = async () =>
    new Response('not-json', {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  const result = await fetchCouplePage('x');
  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
  assert.equal(result.error, 'SLUG_NOT_FOUND');
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

test('CoupleSite catches fetchCouplePage rejection', () => {
  const page = readFileSync(new URL('../src/pages/casal/CoupleSite.jsx', import.meta.url), 'utf8');
  assert.match(page, /fetchCouplePage\(slug\)[\s\S]*\.catch\s*\(/);
});

test('App.jsx declares /casal/:slug and CoupleSite has no admin login', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/casal\/:slug"/);
  const page = readFileSync(new URL('../src/pages/casal/CoupleSite.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /admin-login|Acesso dos noivos/);
  assert.match(page, /Página não encontrada/);
});

test('partner copy names Dani and Carine and keeps venue Indaiá', () => {
  assert.deepEqual(PARTNER_COPY.names, ['Dani', 'Carine']);
  assert.equal(PARTNER_COPY.venueName, 'Indaiá Eventos');
  assert.equal(PARTNER_COPY.dressRule, 'Branco proibido');
  assert.match(PARTNER_COPY.heroImage, /hero-casal/);
});

test('PartnerHome markup contains required section ids and omits playlist', () => {
  const src = readFileSync(new URL('../src/pages/casal/PartnerHome.jsx', import.meta.url), 'utf8');
  for (const id of ['boas-vindas', 'o-casal', 'o-dia', 'local', 'dress-code', 'manual-convidado']) {
    assert.match(src, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(src, /id="playlist"|hospedagem|Papelaria/);
});

test('searchGuestsPublic and submitRsvp send slug', async () => {
  const window = new Window({ url: 'http://localhost/casal/dani-carine' });
  globalThis.window = window;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true, matches: [], count: 0 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  await searchGuestsPublic('dani-carine', 'Ana');
  assert.equal(calls[0].url.includes('slug=dani-carine'), true);
  assert.equal(calls[0].url.includes('q=Ana'), true);
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: '1' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };
  await submitRsvp('dani-carine', {
    guestName: 'Ana Alpha',
    attending: true,
    adultsCount: 1,
    childrenCount: 0,
    consentGiven: true,
  });
  const last = calls[calls.length - 1];
  assert.equal(last.url, '/api/rsvp');
  assert.equal(last.init.method, 'POST');
  const body = JSON.parse(last.init.body);
  assert.equal(body.slug, 'dani-carine');
  const headers = last.init.headers;
  const key = headers['Idempotency-Key'] || headers['idempotency-key'] || (headers.get && headers.get('Idempotency-Key'));
  assert.ok(key && String(key).length >= 8);
});

test('RsvpSection asks to confirm by 15 November and has attending radios', () => {
  const src = readFileSync(new URL('../src/pages/casal/RsvpSection.jsx', import.meta.url), 'utf8');
  assert.match(src, /15 de novembro/);
  assert.match(src, /attending/);
  assert.match(src, /searchGuestsPublic/);
});

test('RsvpSection uses not-found copy only after successful search with zero matches', () => {
  const src = readFileSync(new URL('../src/pages/casal/RsvpSection.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /if\s*\(!data\.ok\s*\|\|\s*list\.length\s*===\s*0\)/);
  assert.match(src, /if\s*\(!data\.ok\)/);
  assert.match(src, /list\.length\s*===\s*0[\s\S]*Nome não encontrado na lista/);
});

test('RsvpSection clears validation on submit and softens duplicate RSVP copy', () => {
  const src = readFileSync(new URL('../src/pages/casal/RsvpSection.jsx', import.meta.url), 'utf8');
  assert.match(src, /async function sendRsvp\(\)[\s\S]*clearErrors\(\)/);
  assert.match(src, /Esta confirmação já foi registrada/);
  assert.doesNotMatch(src, /mesmo dispositivo/i);
});

test('PartnerHome renders RsvpSection inside confirmar-presenca', () => {
  const src = readFileSync(new URL('../src/pages/casal/PartnerHome.jsx', import.meta.url), 'utf8');
  assert.match(src, /<section className="rsvp" id="confirmar-presenca">/);
  assert.match(src, /<RsvpSection slug=\{slug\}/);
});
