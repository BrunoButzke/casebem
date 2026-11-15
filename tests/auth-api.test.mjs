/**
 * Run: node --test tests/auth-api.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as signup } from '../functions/api/auth/signup.js';
import { onRequestPost as login } from '../functions/api/auth/login.js';
import { onRequestPost as logout } from '../functions/api/auth/logout.js';
import { onRequestGet as me } from '../functions/api/auth/me.js';
import { onRequestPost as plan } from '../functions/api/account/plan.js';

function ctx(url, { method = 'GET', body, cookie, db } = {}) {
  const headers = { origin: 'http://localhost:5173' };
  if (body) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  return {
    request: new Request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
    env: { DB: db || null },
  };
}

function cookieFrom(res) {
  return res.headers.get('set-cookie') || '';
}

test('signup 201 sets cb_session; me reads it; duplicate 409', async () => {
  const created = await signup(
    ctx('http://localhost/api/auth/signup', {
      method: 'POST',
      body: { email: 'nova@x.com', password: 'segredo12', plan: 'vip' },
    })
  );
  assert.equal(created.status, 201);
  const json = await created.json();
  assert.equal(json.account.plan, 'vip');
  assert.equal(json.account.planStatus, 'pending_payment');
  const set = cookieFrom(created);
  assert.match(set, /cb_session=/);
  assert.doesNotMatch(set, /Secure/); // http localhost
  const session = /cb_session=([^;]+)/.exec(set)[1];
  const mine = await me(ctx('http://localhost/api/auth/me', { cookie: `cb_session=${session}` }));
  assert.equal(mine.status, 200);
  assert.equal((await mine.json()).slug, null);
  const dup = await signup(
    ctx('http://localhost/api/auth/signup', {
      method: 'POST',
      body: { email: 'nova@x.com', password: 'segredo12', plan: 'basic' },
    })
  );
  assert.equal(dup.status, 409);
});

test('login 401 same message; logout 204 even without cookie', async () => {
  await signup(
    ctx('http://localhost/api/auth/signup', {
      method: 'POST',
      body: { email: 'l@x.com', password: 'segredo12', plan: 'basic' },
    })
  );
  const bad = await login(
    ctx('http://localhost/api/auth/login', {
      method: 'POST',
      body: { email: 'l@x.com', password: 'nope-nope' },
    })
  );
  assert.equal(bad.status, 401);
  const payload = await bad.json();
  assert.equal(payload.error, 'INVALID_CREDENTIALS');
  const naked = await logout(ctx('http://localhost/api/auth/logout', { method: 'POST' }));
  assert.equal(naked.status, 204);
});

test('me without cookie is 401; pending payment never 402', async () => {
  const res = await me(ctx('http://localhost/api/auth/me'));
  assert.equal(res.status, 401);
  const created = await signup(
    ctx('http://localhost/api/auth/signup', {
      method: 'POST',
      body: { email: 'p@x.com', password: 'segredo12', plan: 'pro' },
    })
  );
  assert.notEqual(created.status, 402);
});

test('login 200 sets cookie; me JSON has no id', async () => {
  await signup(
    ctx('http://localhost/api/auth/signup', {
      method: 'POST',
      body: { email: 'ok@x.com', password: 'segredo12', plan: 'basic' },
    })
  );
  const ok = await login(
    ctx('http://localhost/api/auth/login', {
      method: 'POST',
      body: { email: 'ok@x.com', password: 'segredo12' },
    })
  );
  assert.equal(ok.status, 200);
  const set = cookieFrom(ok);
  assert.match(set, /cb_session=/);
  const session = /cb_session=([^;]+)/.exec(set)[1];
  const mine = await me(ctx('http://localhost/api/auth/me', { cookie: `cb_session=${session}` }));
  assert.equal(mine.status, 200);
  const body = await mine.json();
  assert.equal(body.email, 'ok@x.com');
  assert.equal(body.plan, 'basic');
  assert.equal(body.planStatus, 'active');
  assert.equal(body.slug, null);
  assert.equal(body.isPartner, false);
  assert.equal(body.id, undefined);
  assert.deepEqual(Object.keys(body).sort(), ['email', 'isPartner', 'plan', 'planStatus', 'slug']);
});

test('https signup sets Secure cookie', async () => {
  const created = await signup(
    ctx('https://localhost/api/auth/signup', {
      method: 'POST',
      body: { email: 'secure@x.com', password: 'segredo12', plan: 'basic' },
    })
  );
  assert.equal(created.status, 201);
  assert.match(cookieFrom(created), /Secure/);
});

test('plan without session is 401; basic upgrades to pro pending_payment', async () => {
  const denied = await plan(
    ctx('http://localhost/api/account/plan', {
      method: 'POST',
      body: { plan: 'pro' },
    })
  );
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).error, 'UNAUTHORIZED');

  const created = await signup(
    ctx('http://localhost/api/auth/signup', {
      method: 'POST',
      body: { email: 'up@x.com', password: 'segredo12', plan: 'basic' },
    })
  );
  const session = /cb_session=([^;]+)/.exec(cookieFrom(created))[1];
  const cookie = `cb_session=${session}`;
  const upgraded = await plan(
    ctx('http://localhost/api/account/plan', {
      method: 'POST',
      body: { plan: 'pro' },
      cookie,
    })
  );
  assert.equal(upgraded.status, 200);
  const json = await upgraded.json();
  assert.equal(json.account.plan, 'pro');
  assert.equal(json.account.planStatus, 'pending_payment');
  const mine = await me(ctx('http://localhost/api/auth/me', { cookie }));
  assert.equal((await mine.json()).planStatus, 'pending_payment');
});

test('signup CORS allows credentials; logout 204 expires cookie', async () => {
  const created = await signup(
    ctx('http://localhost/api/auth/signup', {
      method: 'POST',
      body: { email: 'cors@x.com', password: 'segredo12', plan: 'basic' },
    })
  );
  assert.equal(created.headers.get('access-control-allow-credentials'), 'true');
  assert.match(created.headers.get('access-control-allow-headers') || '', /Content-Type/i);
  const session = /cb_session=([^;]+)/.exec(cookieFrom(created))[1];
  const gone = await logout(
    ctx('http://localhost/api/auth/logout', {
      method: 'POST',
      cookie: `cb_session=${session}`,
    })
  );
  assert.equal(gone.status, 204);
  assert.match(cookieFrom(gone), /Max-Age=0/);
  const mine = await me(ctx('http://localhost/api/auth/me', { cookie: `cb_session=${session}` }));
  assert.equal(mine.status, 401);
});
