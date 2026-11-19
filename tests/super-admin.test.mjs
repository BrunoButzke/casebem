/**
 * Run: node --test tests/super-admin.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as loginPost } from '../functions/api/admin/login.js';
import { onRequestGet as superGet } from '../functions/api/admin/super.js';
import { onRequestPost as waitlistPost } from '../functions/api/waitlist.js';
import { onRequestPost as enterTenantPost } from '../functions/api/admin/super/enter.js';
import {
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASS,
  resolveSuperAdminToken,
  enterTenantAsSuper,
} from '../functions/_lib/super-admin.mjs';
import { resetWaitlistForTests } from '../functions/_lib/waitlist-service.mjs';
import { mintTenantToken } from '../functions/_lib/admin-auth.mjs';

const SECRET = 'production-secret-16';

beforeEach(() => resetWaitlistForTests());

function loginCtx(body, env = { ADMIN_PANEL_SECRET: SECRET }) {
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

test('super login returns role super and distinct token', async () => {
  const res = await loginPost(
    loginCtx({ user: SUPER_ADMIN_EMAIL, pass: SUPER_ADMIN_PASS })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.role, 'super');
  assert.equal(body.token, `super.${SECRET}`);
  assert.notEqual(body.token, SECRET);
});

test('login legado Dani/Carine não entra mais como tenant', async () => {
  const res = await loginPost(loginCtx({ user: 'Dani', pass: 'Carine' }));
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.ok, false);
});

test('token tenant scoped ainda autentica o painel', async () => {
  const token = await mintTenantToken(SECRET, 'dani-carine');
  assert.match(token, /^t\./);
});

test('super overview requires super token', async () => {
  const denied = await superGet({
    request: new Request('https://casebem.com/api/admin/super', {
      headers: { authorization: `Bearer ${SECRET}` },
    }),
    env: { ADMIN_PANEL_SECRET: SECRET },
  });
  assert.equal(denied.status, 401);

  const token = resolveSuperAdminToken({ ADMIN_PANEL_SECRET: SECRET });
  const ok = await superGet({
    request: new Request('https://casebem.com/api/admin/super', {
      headers: { authorization: `Bearer ${token}` },
    }),
    env: { ADMIN_PANEL_SECRET: SECRET },
  });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.ok, true);
  assert.ok(body.tenants.some((t) => t.id === 'dani-carine'));
  assert.ok(Array.isArray(body.waitlist));
});

test('super overview inclui casais cadastrados além do parceiro', async () => {
  const { resetTenantsForTests, registerWedding } = await import('../functions/_lib/tenant-service.mjs');
  const { resetAdminMembersForTests } = await import('../functions/_lib/admin-members-service.mjs');
  const { getSuperAdminOverview } = await import('../functions/_lib/super-admin.mjs');
  resetTenantsForTests();
  resetAdminMembersForTests();
  await registerWedding(null, {
    yourName: 'Bruno',
    partnerName: 'Cris',
    role: 'noivo',
    email: 'bruno-super@example.com',
    password: 'Senha12!',
    passwordConfirm: 'Senha12!',
  });
  const overview = await getSuperAdminOverview(null);
  const ids = overview.tenants.map((t) => t.id);
  assert.ok(ids.includes('dani-carine'));
  assert.ok(ids.includes('cris-bruno'));
});

test('enterTenantAsSuper returns tenant token for known wedding', async () => {
  const result = await enterTenantAsSuper({ ADMIN_PANEL_SECRET: SECRET }, 'dani-carine');
  assert.equal(result.ok, true);
  assert.equal(result.token, await mintTenantToken(SECRET, 'dani-carine'));
  assert.equal(result.role, 'tenant');
  assert.equal(result.weddingKey, 'dani-carine');
});

test('POST /api/admin/super/enter requires super token', async () => {
  const denied = await enterTenantPost({
    request: new Request('https://casebem.com/api/admin/super/enter', {
      method: 'POST',
      headers: {
        origin: 'https://casebem.com',
        authorization: `Bearer ${SECRET}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ tenantId: 'dani-carine' }),
    }),
    env: { ADMIN_PANEL_SECRET: SECRET },
  });
  assert.equal(denied.status, 401);

  const token = resolveSuperAdminToken({ ADMIN_PANEL_SECRET: SECRET });
  const ok = await enterTenantPost({
    request: new Request('https://casebem.com/api/admin/super/enter', {
      method: 'POST',
      headers: {
        origin: 'https://casebem.com',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ tenantId: 'dani-carine' }),
    }),
    env: { ADMIN_PANEL_SECRET: SECRET },
  });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.ok, true);
  assert.equal(body.token, await mintTenantToken(SECRET, 'dani-carine'));
  assert.equal(body.role, 'tenant');
});

test('waitlist signup persists and appears in super overview', async () => {
  const res = await waitlistPost({
    request: new Request('https://casebem.com/api/waitlist', {
      method: 'POST',
      headers: {
        origin: 'https://casebem.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Ana',
        email: 'ana@example.com',
        plan: 'pro',
        consent: true,
      }),
    }),
    env: {},
  });
  assert.equal(res.status, 200);
  const created = await res.json();
  assert.equal(created.ok, true);

  const token = resolveSuperAdminToken({ ADMIN_PANEL_SECRET: SECRET });
  const overview = await superGet({
    request: new Request('https://casebem.com/api/admin/super', {
      headers: { authorization: `Bearer ${token}` },
    }),
    env: { ADMIN_PANEL_SECRET: SECRET },
  });
  const body = await overview.json();
  assert.equal(body.waitlist.length, 1);
  assert.equal(body.waitlist[0].email, 'ana@example.com');
});
