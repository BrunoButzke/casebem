/**
 * Run: node --test tests/pages-routing.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/_middleware.js';
import { gamesRouterBasename, resolvePagesRoute } from '../functions/_lib/pages-routing.mjs';

function mockContext(url, { nextStatus = 404 } = {}) {
  const fetched = [];
  return {
    fetched,
    context: {
      request: new Request(url),
      env: {
        ASSETS: {
          fetch(req) {
            const path = new URL(req.url).pathname;
            fetched.push(path);
            if (path.endsWith('index.html')) {
              return new Response(null, { status: 308, headers: { location: '/games/' } });
            }
            return new Response('<html>games</html>', { headers: { 'content-type': 'text/html' } });
          },
        },
      },
      next: async () => new Response('fallback', { status: nextStatus }),
    },
  };
}

test('nested /games routes on casebem.com rewrite to the games directory, not index.html', () => {
  assert.deepEqual(resolvePagesRoute('casebem.com', '/games/galeria/telao'), {
    action: 'rewrite',
    assetPath: '/games/',
  });
  assert.deepEqual(resolvePagesRoute('www.casebem.com', '/games/selo'), {
    action: 'rewrite',
    assetPath: '/games/',
  });
});

test('legacy games host and /games stay on the games SPA', () => {
  assert.deepEqual(resolvePagesRoute('casebem.com', '/games/quiz'), {
    action: 'rewrite',
    assetPath: '/games/',
  });
  assert.deepEqual(resolvePagesRoute('desafio.casebem.com', '/quiz'), {
    action: 'rewrite',
    assetPath: '/games/',
  });
});

test('existing /games on casebem.com is served as a static file', () => {
  assert.deepEqual(resolvePagesRoute('casebem.com', '/games'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('casebem.com', '/games/'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('casebem.com', '/games/index.html'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('casebem.com', '/assets/casebemGames.js'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('casebem.com', '/api/desafio/gallery'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('casebem.com', '/dani-carine/'), { action: 'next' });
});

test('desafio.casebem.com serves the games SPA at the host root via /games/', () => {
  assert.deepEqual(resolvePagesRoute('desafio.casebem.com', '/'), {
    action: 'rewrite',
    assetPath: '/games/',
  });
  assert.deepEqual(resolvePagesRoute('desafio.casebem.com', '/galeria/telao'), {
    action: 'rewrite',
    assetPath: '/games/',
  });
  assert.deepEqual(resolvePagesRoute('www.desafio.casebem.com', '/quiz'), {
    action: 'rewrite',
    assetPath: '/games/',
  });
});

test('desafio.casebem.com keeps assets and API on the same host', () => {
  assert.deepEqual(resolvePagesRoute('desafio.casebem.com', '/assets/casebemGames.js'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('desafio.casebem.com', '/favicon.svg'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('desafio.casebem.com', '/api/desafio/gallery'), { action: 'next' });
});

test('desafio.casebem.com strips the leftover /games prefix', () => {
  assert.deepEqual(resolvePagesRoute('desafio.casebem.com', '/games'), {
    action: 'redirect',
    pathname: '/',
  });
  assert.deepEqual(resolvePagesRoute('desafio.casebem.com', '/games/'), {
    action: 'redirect',
    pathname: '/',
  });
  assert.deepEqual(resolvePagesRoute('desafio.casebem.com', '/games/galeria/telao'), {
    action: 'redirect',
    pathname: '/galeria/telao',
  });
});

test('apex / is the SPA, not the old landing redirect', () => {
  assert.deepEqual(resolvePagesRoute('casebem.com', '/'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('www.casebem.com', '/'), { action: 'next' });
});

test('product routes rewrite to the root SPA', () => {
  for (const path of ['/entrar', '/admin', '/admin/presentes', '/casal/outro-casal', '/casal/x/game/quiz']) {
    assert.deepEqual(resolvePagesRoute('casebem.com', path), {
      action: 'rewrite',
      assetPath: '/',
    });
  }
});

test('/casal/dani-carine rewrites to the root SPA', () => {
  for (const path of ['/casal/dani-carine', '/casal/dani-carine/']) {
    assert.deepEqual(resolvePagesRoute('casebem.com', path), {
      action: 'rewrite',
      assetPath: '/',
    });
  }
});

test('legacy /dani-carine/ static site is unchanged', () => {
  assert.deepEqual(resolvePagesRoute('casebem.com', '/dani-carine/'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('casebem.com', '/dani-carine/index.html'), { action: 'next' });
});

test('/casal without slug redirects to /entrar', () => {
  assert.deepEqual(resolvePagesRoute('casebem.com', '/casal'), {
    action: 'redirect',
    pathname: '/entrar',
  });
  assert.deepEqual(resolvePagesRoute('casebem.com', '/casal/'), {
    action: 'redirect',
    pathname: '/entrar',
  });
});

test('games router basename is / on the desafio host and /games elsewhere', () => {
  assert.equal(gamesRouterBasename('desafio.casebem.com'), '/');
  assert.equal(gamesRouterBasename('www.desafio.casebem.com'), '/');
  assert.equal(gamesRouterBasename('casebem.com'), '/games');
  assert.equal(gamesRouterBasename('localhost'), '/games');
});

test('games entry wires BrowserRouter basename to gamesRouterBasename', () => {
  const main = readFileSync(new URL('../games/src/main.jsx', import.meta.url), 'utf8');
  assert.match(main, /gamesRouterBasename/);
  assert.match(main, /<BrowserRouter\s+basename=\{gamesRouterBasename\([^)]*\)\}/);
});

test('middleware serves /games/ HTML for nested casebem.com routes without leaking 308', async () => {
  const { context, fetched } = mockContext('https://casebem.com/games/galeria/telao');
  const res = await onRequest(context);
  assert.equal(res.status, 200);
  assert.deepEqual(fetched, ['/games/']);
});

test('middleware serves games HTML at desafio.casebem.com root and nested paths', async () => {
  const root = mockContext('https://desafio.casebem.com/');
  const nested = mockContext('https://desafio.casebem.com/galeria/telao');
  assert.equal((await onRequest(root.context)).status, 200);
  assert.equal((await onRequest(nested.context)).status, 200);
  assert.deepEqual(root.fetched, ['/games/']);
  assert.deepEqual(nested.fetched, ['/games/']);
});

test('middleware serves casebem.com / via next (SPA at root)', async () => {
  const { context, fetched } = mockContext('https://casebem.com/', { nextStatus: 200 });
  const res = await onRequest(context);
  assert.equal(res.status, 200);
  assert.deepEqual(fetched, []);
});

test('middleware rewrites /casal/dani-carine to the root SPA asset', async () => {
  const { context, fetched } = mockContext('https://casebem.com/casal/dani-carine');
  const res = await onRequest(context);
  assert.equal(res.status, 200);
  assert.deepEqual(fetched, ['/']);
});

test('middleware redirects /games on desafio.casebem.com to the host root path', async () => {
  const res = await onRequest(mockContext('https://desafio.casebem.com/games/galeria/telao').context);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://desafio.casebem.com/galeria/telao');
});

test('middleware follows Pages pretty-URL 308 instead of sending it to the browser', async () => {
  const { context, fetched } = mockContext('https://casebem.com/games/galeria/telao');
  context.env.ASSETS.fetch = (req) => {
    const path = new URL(req.url).pathname;
    fetched.push(path);
    if (path === '/games/') {
      return new Response(null, { status: 308, headers: { location: '/games/index.html' } });
    }
    return new Response('<html>games</html>', { headers: { 'content-type': 'text/html' } });
  };
  const res = await onRequest(context);
  assert.equal(res.status, 200);
  assert.deepEqual(fetched, ['/games/', '/games/index.html']);
});
