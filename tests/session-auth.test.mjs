/**
 * Run: node --test tests/session-auth.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireAccount } from '../functions/_lib/session-auth.mjs';
import { signup } from '../functions/_lib/auth-service.mjs';

test('requireAccount 401 without cookie and 200 with valid session', async () => {
  const missing = await requireAccount(new Request('http://localhost/api/admin/gifts'), { DB: null });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 401);
  const created = await signup(
    null,
    { email: 'adm@x.com', password: 'segredo12', plan: 'basic' },
    new Date().toISOString()
  );
  const req = new Request('http://localhost/api/admin/gifts', {
    headers: { cookie: `cb_session=${created.sessionId}` },
  });
  const ok = await requireAccount(req, { DB: null });
  assert.equal(ok.ok, true);
  assert.equal(ok.account.email, 'adm@x.com');
});
