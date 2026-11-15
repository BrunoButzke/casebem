import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { coupleNavItems } from '../src/pages/casal/couple-nav.mjs';
import {
  fetchCouplePage,
  searchGuestsPublic,
  submitRsvp,
  fetchCatalog,
  submitCheckout,
  fetchMessages,
  postMessage,
} from '../src/lib/casal-api.mjs';
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

test('CoupleSite catches fetchCouplePage rejection as load error, not 404', () => {
  const page = readFileSync(new URL('../src/pages/casal/CoupleSite.jsx', import.meta.url), 'utf8');
  assert.match(page, /fetchCouplePage\(slug\)[\s\S]*\.catch\s*\(/);
  assert.match(page, /Não foi possível carregar a página/);
  assert.match(page, /status === 404/);
  const catchMatch = page.match(/\.catch\s*\(([\s\S]*?)\)\s*;/);
  assert.ok(catchMatch);
  assert.doesNotMatch(catchMatch[1], /not-found/);
  assert.match(catchMatch[1], /error/);
});

test('App.jsx lazy-loads CoupleSite behind Suspense', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /lazy\(\s*\(\)\s*=>\s*import\(['"]\.\/pages\/casal\/CoupleSite\.jsx['"]\)/);
  assert.match(app, /<Suspense[\s\S]*Carregando…/);
  assert.doesNotMatch(app, /import CoupleSite from/);
});

test('App.jsx declares /casal/:slug and CoupleSite has no admin login', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/casal\/:slug"/);
  const page = readFileSync(new URL('../src/pages/casal/CoupleSite.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /admin-login|Acesso dos noivos/);
  assert.match(page, /Página não encontrada/);
});

test('App.jsx nests games under /casal/:slug/game/*', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /path="\/casal\/:slug\/game\/\*"/);
  const gamesApp = readFileSync(new URL('../games/src/App.jsx', import.meta.url), 'utf8');
  assert.match(gamesApp, /path="quiz"/);
  assert.doesNotMatch(gamesApp, /path="\/quiz"/);
});

test('PlayShell keeps relative tab ids and prefixes couple game URLs with gameTo', () => {
  const src = readFileSync(new URL('../games/src/pages/PlayShell.jsx', import.meta.url), 'utf8');
  assert.match(src, /to: 'quiz'/);
  assert.doesNotMatch(src, /to: '\/quiz'/);
  assert.match(src, /endsWith\(['"]\/galeria\/telao['"]\)/);
  assert.match(src, /gameTo\(/);
  assert.match(src, /gameSlugFromPathname/);
});

test('CoupleSite sets partner document title and restores CaseBem', () => {
  const page = readFileSync(new URL('../src/pages/casal/CoupleSite.jsx', import.meta.url), 'utf8');
  assert.match(page, /document\.title/);
  assert.match(page, /Dani & Carine/);
  assert.match(page, /CaseBem/);
});

test('root index.html loads Cormorant Garamond and Great Vibes', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /Cormorant\+Garamond/);
  assert.match(html, /Great\+Vibes/);
});

test('vite local plugin forwards POST /api/gifts/checkout to onRequestPost', () => {
  const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(vite, /\/api\/gifts\/checkout/);
  assert.match(vite, /functions\/api\/gifts\/checkout\.js/);
  assert.match(vite, /onRequestPost/);
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

test('PartnerHome o-dia steps change photo on click', () => {
  const src = readFileSync(new URL('../src/pages/casal/PartnerHome.jsx', import.meta.url), 'utf8');
  assert.match(src, /how__step[\s\S]*onClick=\{\(\)\s*=>\s*setActiveMoment\(index\)\}/);
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

test('fetchCatalog and submitCheckout include slug', async () => {
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/api/gifts/catalog')) {
      assert.equal(String(url).includes('slug=dani-carine'), true);
      return new Response(JSON.stringify({ ok: true, gifts: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = JSON.parse(init.body);
    assert.equal(body.slug, 'dani-carine');
    assert.equal(body.paymentMethod, 'pix');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  await fetchCatalog('dani-carine');
  await submitCheckout('dani-carine', {
    gifterName: 'Ana',
    intentKey: 'k1',
    items: [{ giftId: 'spa', quantity: 1 }],
  });
});

test('GiftsSection renders present list section id', () => {
  const src = readFileSync(new URL('../src/pages/casal/GiftsSection.jsx', import.meta.url), 'utf8');
  assert.match(src, /fetchCatalog/);
  assert.match(src, /CartStorage/);
});

test('PartnerHome renders GiftsSection inside presentes', () => {
  const src = readFileSync(new URL('../src/pages/casal/PartnerHome.jsx', import.meta.url), 'utf8');
  assert.match(src, /<section className="gifts" id="presentes">/);
  assert.match(src, /<GiftsSection slug=\{slug\}/);
});

test('gift helpers omit credentials and keep gifterName without extra email', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true, gifts: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  await fetchCatalog('dani-carine');
  await submitCheckout('dani-carine', {
    gifterName: 'Ana',
    intentKey: 'k1',
    items: [{ giftId: 'spa', quantity: 1 }],
  });
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[1].init.credentials, 'omit');
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.gifterName, 'Ana');
  assert.equal('payerEmail' in body, false);
  assert.equal('email' in body, false);
});

test('GiftsSection uses CartStorage, Pix keys from createCheckoutPayment, and skips empty checkout', () => {
  const src = readFileSync(new URL('../src/pages/casal/GiftsSection.jsx', import.meta.url), 'utf8');
  assert.match(src, /new CartStorage/);
  assert.match(src, /localStorage/);
  assert.match(src, /crypto\.randomUUID/);
  assert.match(
    src,
    /Intl\.NumberFormat\('pt-BR',\s*\{\s*style:\s*'currency',\s*currency:\s*'BRL'\s*\}\)/
  );
  assert.match(src, /gifterName/);
  assert.doesNotMatch(src, /payerEmail|type=["']email["']/);
  assert.match(src, /qrCodeBase64/);
  assert.match(src, /payment\.qrCode/);
  assert.doesNotMatch(src, /pixQrCode|pixCopyPaste/);
  assert.match(src, /items\.length\s*===?\s*0/);
  assert.match(src, /submitCheckout/);
});

test('message helpers send slug and idempotency key', async () => {
  globalThis.fetch = async (url, init) => {
    if (!init || init.method === 'GET' || !init.method) {
      assert.equal(String(url).includes('slug=dani-carine'), true);
      return new Response(JSON.stringify({ messages: [], nextCursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const body = JSON.parse(init.body);
    assert.equal(body.slug, 'dani-carine');
    const h = init.headers;
    const key = h['Idempotency-Key'] || h['idempotency-key'];
    assert.ok(key);
    return new Response(JSON.stringify({ id: 'm1' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  };
  await fetchMessages('dani-carine');
  await postMessage('dani-carine', { guestName: 'Ana', message: 'Felicidades', consentGiven: true });
});

test('PartnerHome wires mural and still omits playlist', () => {
  const home = readFileSync(new URL('../src/pages/casal/PartnerHome.jsx', import.meta.url), 'utf8');
  assert.match(home, /MessagesSection/);
  assert.match(home, /GiftsSection/);
  assert.match(home, /RsvpSection/);
  assert.doesNotMatch(home, /id="playlist"|Hospedagem|Papelaria/);
  const landing = readFileSync(new URL('../src/pages/Landing.jsx', import.meta.url), 'utf8');
  assert.match(landing, /\/casal\/dani-carine/);
});

test('MessagesSection lists recados with load more and validates the form', () => {
  const src = readFileSync(new URL('../src/pages/casal/MessagesSection.jsx', import.meta.url), 'utf8');
  assert.match(src, /fetchMessages/);
  assert.match(src, /postMessage/);
  assert.match(src, /nextCursor/);
  assert.match(src, /Carregar mais/);
  assert.match(src, /guestName/);
  assert.match(src, /consentGiven/);
  assert.match(src, /length\s*<\s*2/);
  assert.match(src, /length\s*<\s*3|length\s*>\s*250/);
});

test('CoupleGames calls loadAndApplyDesafioTheme on mount', () => {
  const src = readFileSync(new URL('../src/pages/casal/CoupleGames.jsx', import.meta.url), 'utf8');
  assert.match(src, /loadAndApplyDesafioTheme/);
  assert.match(src, /useEffect[\s\S]*loadAndApplyDesafioTheme/);
});

test('CoupleGames 404 copy matches CoupleSite', () => {
  const src = readFileSync(new URL('../src/pages/casal/CoupleGames.jsx', import.meta.url), 'utf8');
  assert.match(src, /Página não encontrada/);
  assert.doesNotMatch(src, /admin-login|Acesso dos noivos/);
  assert.match(src, /fetchCouplePage/);
});
