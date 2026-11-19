/**
 * Run: node --test tests/games-admin-login-api.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/admin/login.js';
import {
  resetAdminMembersForTests,
  upsertAdminMember,
} from '../functions/_lib/admin-members-service.mjs';
import { mintTenantToken } from '../functions/_lib/admin-auth.mjs';

const SECRET = 'production-secret-16';

beforeEach(() => resetAdminMembersForTests());

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

test('login legado Dani/Carine é rejeitado', async () => {
  for (const pair of [
    { user: 'Carine', pass: 'Dani' },
    { user: 'Dani', pass: 'Carine' },
  ]) {
    const res = await onRequestPost(ctx(pair, { ADMIN_PANEL_SECRET: SECRET }));
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.ok, false);
  }
});

test('login com e-mail de Acessos retorna token do tenant', async () => {
  await upsertAdminMember(
    null,
    {
      email: 'noiva@example.com',
      role: 'noiva',
      password: 'SenhaForte1!',
    },
    'dani-carine'
  );
  const res = await onRequestPost(
    ctx({ user: 'noiva@example.com', pass: 'SenhaForte1!' }, { ADMIN_PANEL_SECRET: SECRET })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.role, 'tenant');
  assert.equal(body.weddingKey, 'dani-carine');
  assert.equal(body.token, await mintTenantToken(SECRET, 'dani-carine'));
});

test('login with the wrong pair is rejected', async () => {
  const res = await onRequestPost(ctx({ user: 'ana@example.com', pass: 'errada' }));
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.ok, false);
});
