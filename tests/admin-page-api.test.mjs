import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signup } from '../functions/_lib/auth-service.mjs';
import { resetMemoryCouplePagesForTests } from '../functions/_lib/couple-page-service.mjs';
import { onRequestGet, onRequestPut } from '../functions/api/admin/page.js';

function ctx(account, { method = 'GET', body } = {}) {
  return {
    request: new Request('https://casebem.com/api/admin/page', {
      method,
      headers: {
        cookie: `cb_session=${account.sessionId}`,
        origin: 'https://casebem.com',
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env: { DB: null },
  };
}

test('admin page GET is 401 without cookie', async () => {
  const res = await onRequestGet({
    request: new Request('https://casebem.com/api/admin/page'),
    env: { DB: null },
  });
  assert.equal(res.status, 401);
});

test('PUT page claims slug and does not leak account id', async () => {
  resetMemoryCouplePagesForTests();
  const now = '2026-11-15T08:00:00.000Z';
  const a = await signup(null, { email: 'adm-a@x.com', password: 'segredo12', plan: 'basic' }, now);
  const b = await signup(null, { email: 'adm-b@x.com', password: 'segredo12', plan: 'basic' }, now);
  const res = await onRequestPut(
    ctx(a, {
      method: 'PUT',
      body: { slug: 'casal-ana', page: { names: ['Ana'], dateLine: 'maio' } },
    })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.slug, 'casal-ana');
  assert.equal(body.slugLocked, false);
  assert.deepEqual(body.page.names, ['Ana']);
  assert.equal('id' in body, false);
  assert.equal('accountId' in body, false);
  assert.equal('accountId' in body.page, false);

  const taken = await onRequestPut(
    ctx(b, { method: 'PUT', body: { slug: 'casal-ana' } })
  );
  assert.equal(taken.status, 409);
  assert.equal((await taken.json()).error, 'SLUG_TAKEN');

  const mine = await onRequestGet(ctx(b));
  assert.equal((await mine.json()).slug, null);
});
