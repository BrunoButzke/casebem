/**
 * Run: node --test tests/register.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resetTenantsForTests,
  registerWedding,
  buildTenantSlugCandidates,
  listTenantsAdmin,
} from '../functions/_lib/tenant-service.mjs';
import { resetAdminMembersForTests, authenticateAdminMember, listAdminMembers } from '../functions/_lib/admin-members-service.mjs';
import { onRequestPost as registerPost } from '../functions/api/register.js';

beforeEach(() => {
  resetTenantsForTests();
  resetAdminMembersForTests();
});

test('slug prioriza noiva-noivo e depois noivo-noiva', () => {
  const c = buildTenantSlugCandidates('Carine Silva', 'Dani Souza');
  assert.equal(c[0], 'carine-silva-dani-souza');
  assert.equal(c[1], 'dani-souza-carine-silva');
});

test('register cria tenant e dois papéis', async () => {
  const result = await registerWedding(null, {
    yourName: 'Carine',
    partnerName: 'Dani',
    role: 'noiva',
    email: 'carine@example.com',
    password: 'Senha12!',
    passwordConfirm: 'Senha12!',
  });
  assert.equal(result.tenant.id, 'carine-dani');
  assert.equal(result.tenant.adminPath, '/carine-dani/admin');
  assert.equal(result.tenant.sitePath, '/carine-dani/');
  assert.equal(result.role, 'noiva');
  assert.equal(result.partnerRole, 'noivo');

  const members = await listAdminMembers(null, 'carine-dani');
  assert.equal(members.length, 2);
  assert.ok(members.some((m) => m.role === 'noiva' && m.email === 'carine@example.com'));
  assert.ok(members.some((m) => m.role === 'noivo' && m.pending));

  const auth = await authenticateAdminMember(null, 'carine@example.com', 'Senha12!');
  assert.equal(auth.ok, true);
  assert.equal(auth.weddingKey, 'carine-dani');
});

test('slug invertido se o primeiro existir', async () => {
  await registerWedding(null, {
    yourName: 'Ana',
    partnerName: 'Bruno',
    role: 'noiva',
    email: 'ana1@example.com',
    password: 'Senha12!',
    passwordConfirm: 'Senha12!',
  });
  const second = await registerWedding(null, {
    yourName: 'Ana',
    partnerName: 'Bruno',
    role: 'noiva',
    email: 'ana2@example.com',
    password: 'Senha12!',
    passwordConfirm: 'Senha12!',
  });
  assert.equal(second.tenant.id, 'bruno-ana');
});

test('API register', async () => {
  const res = await registerPost({
    request: new Request('https://casebem.com/api/register', {
      method: 'POST',
      headers: {
        origin: 'https://casebem.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        yourName: 'Zoe',
        partnerName: 'Max',
        role: 'noiva',
        email: 'zoe@example.com',
        password: 'Senha12!',
        passwordConfirm: 'Senha12!',
      }),
    }),
    env: {},
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.tenantId, 'zoe-max');
  assert.equal(body.adminPath, '/zoe-max/admin');
  assert.equal((await listTenantsAdmin(null)).length, 1);
});
