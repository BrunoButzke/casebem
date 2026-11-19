/**
 * Run: node --test tests/admin-access.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  onRequestGet,
  onRequestPost,
  onRequestDelete,
} from '../functions/api/admin/access.js';
import { onRequestPost as loginPost } from '../functions/api/admin/login.js';
import { mintTenantToken } from '../functions/_lib/admin-auth.mjs';
import {
  resetAdminMembersForTests,
  upsertAdminMember,
  listAdminMembers,
  authenticateAdminMember,
} from '../functions/_lib/admin-members-service.mjs';

const SECRET = 'production-secret-16';

beforeEach(() => resetAdminMembersForTests());

function accessCtx(method, { body, email, env } = {}) {
  const url = email
    ? `https://casebem.com/api/admin/access?email=${encodeURIComponent(email)}`
    : 'https://casebem.com/api/admin/access';
  return {
    request: new Request(url, {
      method,
      headers: {
        origin: 'https://casebem.com',
        authorization: `Bearer ${SECRET}`,
        'content-type': 'application/json',
      },
      body: body != null ? JSON.stringify(body) : undefined,
    }),
    env: env ?? { ADMIN_PANEL_SECRET: SECRET },
  };
}

test('upsert cria noiva e noivo e bloqueia a 3ª conta', async () => {
  await upsertAdminMember(null, {
    email: 'noiva@example.com',
    role: 'noiva',
    password: 'Senha12!',
  });
  await upsertAdminMember(null, {
    email: 'noivo@example.com',
    role: 'noivo',
    password: 'Senha22!',
  });
  assert.equal((await listAdminMembers(null)).length, 2);
  await assert.rejects(
    () =>
      upsertAdminMember(null, {
        email: 'outro@example.com',
        role: 'noiva',
        password: 'Senha33!',
      }),
    /MEMBER_LIMIT|ROLE_TAKEN/
  );
});

test('senha fraca é rejeitada', async () => {
  await assert.rejects(
    () =>
      upsertAdminMember(null, {
        email: 'fraca@example.com',
        role: 'noiva',
        password: 'senha123',
      }),
    /PASSWORD_WEAK/
  );
});

test('authenticateAdminMember valida senha', async () => {
  await upsertAdminMember(null, {
    email: 'dani@example.com',
    role: 'noiva',
    password: 'Segredo1!',
  });
  const bad = await authenticateAdminMember(null, 'dani@example.com', 'errada');
  assert.equal(bad.ok, false);
  const good = await authenticateAdminMember(null, 'dani@example.com', 'Segredo1!');
  assert.equal(good.ok, true);
  assert.equal(good.member.role, 'noiva');
});

test('API GET lista membros sem password_hash', async () => {
  await upsertAdminMember(null, {
    email: 'a@example.com',
    role: 'noiva',
    password: 'SenhaA12!',
  });
  const res = await onRequestGet(accessCtx('GET'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.members.length, 1);
  assert.equal(body.members[0].email, 'a@example.com');
  assert.equal(body.members[0].password_hash, undefined);
});

test('API POST e DELETE', async () => {
  const created = await onRequestPost(
    accessCtx('POST', {
      body: { email: 'b@example.com', role: 'noivo', password: 'TempPass1!' },
    })
  );
  assert.equal(created.status, 200);
  const del = await onRequestDelete(accessCtx('DELETE', { email: 'b@example.com' }));
  assert.equal(del.status, 200);
  const body = await del.json();
  assert.equal(body.members.length, 0);
});

test('login com membro retorna token tenant e memberRole', async () => {
  await upsertAdminMember(null, {
    email: 'carine@example.com',
    role: 'noiva',
    password: 'Casa1234!',
  });
  const res = await loginPost({
    request: new Request('https://casebem.com/api/admin/login', {
      method: 'POST',
      headers: {
        origin: 'https://casebem.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ user: 'carine@example.com', pass: 'Casa1234!' }),
    }),
    env: { ADMIN_PANEL_SECRET: SECRET },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.role, 'tenant');
  assert.equal(body.memberRole, 'noiva');
  assert.equal(body.token, await mintTenantToken(SECRET, 'dani-carine'));
});
