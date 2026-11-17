/**
 * Run: node --test tests/games-admin-login-api.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/admin/login.js';

function ctx(body, env = { ADMIN_PANEL_SECRET: 'admin-local-dev-ok' }) {
  return {
    request: new Request('https://casebem.com/api/admin/login', {
      method: 'POST',
      headers: {
        origin: 'https://casebem.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
    env,
  };
}

test('login Carine / Dani returns the env admin secret', async () => {
  const res = await onRequestPost(
    ctx({ user: 'Carine', pass: 'Dani' }, { ADMIN_PANEL_SECRET: 'production-secret-16' })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.token, 'production-secret-16');
});

test('login Dani / Carine returns the env admin secret', async () => {
  const res = await onRequestPost(
    ctx({ user: 'Dani', pass: 'Carine' }, { ADMIN_PANEL_SECRET: 'production-secret-16' })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.token, 'production-secret-16');
});

test('login with the wrong pair is rejected', async () => {
  const res = await onRequestPost(ctx({ user: 'Ana', pass: 'errada' }));
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.ok, false);
});

test('login without ADMIN_PANEL_SECRET is 503', async () => {
  const res = await onRequestPost(ctx({ user: 'Carine', pass: 'Dani' }, {}));
  assert.equal(res.status, 503);
});
