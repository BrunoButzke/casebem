/**
 * Run: node --test tests/auth-service.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAuthDb } from './helpers/memory-auth-db.mjs';
import {
  signup,
  login,
  logout,
  getSessionAccount,
  upgradePlan,
  resolveAccountBySlug,
  sessionCookieHeader,
  parseSessionCookie,
  SESSION_COOKIE,
} from '../functions/_lib/auth-service.mjs';

const now = '2026-11-14T23:00:00.000Z';

test('signup basic is active; pro is pending_payment; cookie name is cb_session', async () => {
  const db = new MemoryAuthDb();
  const basic = await signup(db, { email: 'A@X.com', password: 'segredo12', plan: 'basic' }, now);
  assert.equal(basic.account.email, 'a@x.com');
  assert.equal(basic.account.plan, 'basic');
  assert.equal(basic.account.planStatus, 'active');
  assert.equal(basic.account.slug, null);
  assert.equal(basic.account.isPartner, false);
  const header = sessionCookieHeader(basic.sessionId, { secure: true });
  assert.match(header, new RegExp(`^${SESSION_COOKIE}=`));
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Path=\//);
  assert.match(header, /Secure/);
  const pro = await signup(db, { email: 'b@x.com', password: 'segredo12', plan: 'pro' }, now);
  assert.equal(pro.account.plan, 'pro');
  assert.equal(pro.account.planStatus, 'pending_payment');
});

test('duplicate email is EMAIL_TAKEN; short password is PASSWORD_TOO_SHORT', async () => {
  const db = new MemoryAuthDb();
  await signup(db, { email: 'a@x.com', password: 'segredo12', plan: 'basic' }, now);
  await assert.rejects(
    () => signup(db, { email: 'a@x.com', password: 'segredo12', plan: 'basic' }, now),
    { message: 'EMAIL_TAKEN' }
  );
  await assert.rejects(
    () => signup(db, { email: 'c@x.com', password: '123', plan: 'basic' }, now),
    { message: 'PASSWORD_TOO_SHORT' }
  );
});

test('login sets session; wrong password is INVALID_CREDENTIALS; logout expires session', async () => {
  const db = new MemoryAuthDb();
  await signup(db, { email: 'a@x.com', password: 'segredo12', plan: 'basic' }, now);
  const ok = await login(db, { email: 'a@x.com', password: 'segredo12' }, now);
  const me = await getSessionAccount(db, ok.sessionId, now);
  assert.equal(me.email, 'a@x.com');
  await assert.rejects(
    () => login(db, { email: 'a@x.com', password: 'erradaaaa' }, now),
    { message: 'INVALID_CREDENTIALS' }
  );
  await logout(db, ok.sessionId);
  assert.equal(await getSessionAccount(db, ok.sessionId, now), null);
});

test('upgrade basic to pro sets pending_payment; vip-to-pro is ACCOUNT_NOT_BASIC', async () => {
  const db = new MemoryAuthDb();
  const { accountId } = await signup(
    db,
    { email: 'a@x.com', password: 'segredo12', plan: 'basic' },
    now
  );
  const updated = await upgradePlan(db, accountId, 'pro');
  assert.equal(updated.plan, 'pro');
  assert.equal(updated.planStatus, 'pending_payment');
  await assert.rejects(() => upgradePlan(db, accountId, 'vip'), { message: 'ACCOUNT_NOT_BASIC' });
});

test('unknown slug resolves to null', async () => {
  const db = new MemoryAuthDb();
  assert.equal(await resolveAccountBySlug(db, 'nao-existe'), null);
});

test('parseSessionCookie reads cb_session', () => {
  assert.equal(parseSessionCookie('foo=1; cb_session=abc; bar=2'), 'abc');
  assert.equal(parseSessionCookie(null), null);
});
