/**
 * Run: node --test tests/pages-routing.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';
import { gamesRouterBasename, resolvePagesRoute } from '../functions/_lib/pages-routing.mjs';

function mockContext(url, { nextStatus = 404, assets = true } = {}) {
  const fetched = [];
  return {
    fetched,
    context: {
      request: new Request(url),
      env: assets
        ? {
            ASSETS: {
              fetch(req) {
                fetched.push(String(req.url));
                return new Response('<html>games</html>', { headers: { 'content-type': 'text/html' } });
              },
            },
          }
        : {},
      next: async () => new Response('fallback', { status: nextStatus }),
    },
  };
}

test('nested /games routes on casebem.com rewrite to the games SPA', () => {
  assert.deepEqual(resolvePagesRoute('casebem.com', '/games/galeria/telao'), {
    action: 'rewrite',
    assetPath: '/games/index.html',
  });
  assert.deepEqual(resolvePagesRoute('www.casebem.com', '/games/selo'), {
    action: 'rewrite',
    assetPath: '/games/index.html',
  });
  assert.deepEqual(resolvePagesRoute('casebem.com', '/games/'), {
    action: 'rewrite',
    assetPath: '/games/index.html',
  });
});

test('real files and APIs on casebem.com are not rewritten', () => {
  assert.deepEqual(resolvePagesRoute('casebem.com', '/games/index.html'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('casebem.com', '/assets/casebemGames.js'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('casebem.com', '/api/desafio/gallery'), { action: 'next' });
  assert.deepEqual(resolvePagesRoute('casebem.com', '/dani-carine/'), { action: 'next' });
});

test('desafio.casebem.com serves the games SPA at the host root', () => {
  assert.deepEqual(resolvePagesRoute('desafio.casebem.com', '/'), {
    action: 'rewrite',
    assetPath: '/games/index.html',
  });
  assert.deepEqual(resolvePagesRoute('desafio.casebem.com', '/galeria/telao'), {
    action: 'rewrite',
    assetPath: '/games/index.html',
  });
  assert.deepEqual(resolvePagesRoute('www.desafio.casebem.com', '/quiz'), {
    action: 'rewrite',
    assetPath: '/games/index.html',
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

test('games router basename is / on the desafio host and /games elsewhere', () => {
  assert.equal(gamesRouterBasename('desafio.casebem.com'), '/');
  assert.equal(gamesRouterBasename('www.desafio.casebem.com'), '/');
  assert.equal(gamesRouterBasename('casebem.com'), '/games');
  assert.equal(gamesRouterBasename('localhost'), '/games');
});

test('middleware serves games index for nested casebem.com routes', async () => {
  const { context, fetched } = mockContext('https://casebem.com/games/galeria/telao');
  const res = await onRequest(context);
  assert.equal(res.status, 200);
  assert.deepEqual(fetched, ['https://casebem.com/games/index.html']);
});

test('middleware serves games index at desafio.casebem.com root and nested paths', async () => {
  const root = mockContext('https://desafio.casebem.com/');
  const nested = mockContext('https://desafio.casebem.com/galeria/telao');
  assert.equal((await onRequest(root.context)).status, 200);
  assert.equal((await onRequest(nested.context)).status, 200);
  assert.deepEqual(root.fetched, ['https://desafio.casebem.com/games/index.html']);
  assert.deepEqual(nested.fetched, ['https://desafio.casebem.com/games/index.html']);
});

test('middleware redirects /games on desafio.casebem.com to the host root path', async () => {
  const res = await onRequest(mockContext('https://desafio.casebem.com/games/galeria/telao').context);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://desafio.casebem.com/galeria/telao');
});
