/**
 * Run: node --test tests/raffle-api.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  onRequestGet as adminGet,
  onRequestPost as adminPost,
} from '../functions/api/admin/raffles.js';
import { onRequestGet as publicGet } from '../functions/api/desafio/raffle.js';
import { resetMemoryRafflesForTests, createRaffle } from '../functions/_lib/raffle-service.mjs';

const SECRET = 'admin-local-dev-ok';

beforeEach(() => resetMemoryRafflesForTests());

function adminCtx(method, { body, env } = {}) {
  const headers = {
    origin: 'https://casebem.com',
    authorization: `Bearer ${SECRET}`,
    'content-type': 'application/json',
  };
  return {
    request: new Request('https://casebem.com/api/admin/raffles', {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    }),
    env: env ?? { ADMIN_PANEL_SECRET: SECRET, DB: {} },
  };
}

test('admin GET without auth is 401', async () => {
  const res = await adminGet({
    request: new Request('https://casebem.com/api/admin/raffles'),
    env: { ADMIN_PANEL_SECRET: SECRET, DB: {} },
  });
  assert.equal(res.status, 401);
});

test('admin GET without DB is 503', async () => {
  const res = await adminGet({
    request: new Request('https://casebem.com/api/admin/raffles', {
      headers: { authorization: `Bearer ${SECRET}` },
    }),
    env: { ADMIN_PANEL_SECRET: SECRET },
  });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, 'DB_NOT_CONFIGURED');
});

test('public GET returns 404 when no active raffle', async () => {
  const res = await publicGet({
    request: new Request('https://casebem.com/api/desafio/raffle'),
    env: {},
  });
  assert.equal(res.status, 404);
});

test('public GET returns active raffle from memory when DB null', async () => {
  await createRaffle(null, {
    name: 'Cesta',
    totalNumbers: 4,
    priceCents: 2000,
    active: true,
  });
  const res = await publicGet({
    request: new Request('https://casebem.com/api/desafio/raffle'),
    env: {},
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.raffle.name, 'Cesta');
  assert.equal(body.raffle.soldNumbers, undefined);
  assert.deepEqual(body.raffle.myNumbers, []);
  assert.deepEqual(body.raffle.availableNumbers, [1, 2, 3, 4]);
});

test('admin POST with stub DB object fails write path but auth passes to service', async () => {
  // Admin handlers require env.DB truthy; stub without prepare will 500 — ensure auth gate works via GET list.
  const res = await adminPost(
    adminCtx('POST', {
      body: { name: 'Teste', totalNumbers: 10, priceCents: 500 },
      env: { ADMIN_PANEL_SECRET: SECRET, DB: { prepare() { throw new Error('no-d1'); } } },
    })
  );
  assert.equal(res.status, 500);
});
