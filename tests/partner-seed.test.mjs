/**
 * Run: node --test tests/partner-seed.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAuthDb } from './helpers/memory-auth-db.mjs';
import { ensurePartnerAccount } from '../functions/_lib/partner-seed.mjs';
import { login, resolveAccountBySlug, signup, PARTNER_ACCOUNT_ID } from '../functions/_lib/auth-service.mjs';

test('partner seed can log in and resolves dani-carine slug', async () => {
  const db = new MemoryAuthDb();
  const now = '2026-11-14T23:00:00.000Z';
  await ensurePartnerAccount(db, { email: 'dani@casebem.com', password: 'segredo12' }, now);
  const acc = await resolveAccountBySlug(db, 'dani-carine');
  assert.equal(acc.id, PARTNER_ACCOUNT_ID);
  assert.equal(acc.isPartner, true);
  const session = await login(db, { email: 'dani@casebem.com', password: 'segredo12' }, now);
  assert.ok(session.sessionId);
  assert.equal(await resolveAccountBySlug(db, 'nao-existe'), null);
});

test('ensurePartnerAccount inserts partner row without email or password', async () => {
  const db = new MemoryAuthDb();
  const now = '2026-11-14T23:00:00.000Z';
  await ensurePartnerAccount(db, {}, now);
  const acc = await resolveAccountBySlug(db, 'dani-carine');
  assert.equal(acc.id, PARTNER_ACCOUNT_ID);
  assert.equal(acc.email, '');
  assert.equal(acc.password_hash, '');
  assert.equal(acc.isPartner, true);
  assert.equal(acc.plan, 'pro');
  assert.equal(acc.plan_status, 'active');
});

test('ensurePartnerAccount does not rehash password on second call', async () => {
  const db = new MemoryAuthDb();
  const now = '2026-11-14T23:00:00.000Z';
  const creds = { email: 'dani@casebem.com', password: 'segredo12' };
  await ensurePartnerAccount(db, creds, now);
  const accAfterFirst = await db.prepare('SELECT * FROM accounts WHERE id = ?').bind(PARTNER_ACCOUNT_ID).first();
  assert.ok(accAfterFirst.password_hash);
  await ensurePartnerAccount(db, creds, now);
  const accAfterSecond = await db.prepare('SELECT * FROM accounts WHERE id = ?').bind(PARTNER_ACCOUNT_ID).first();
  assert.equal(accAfterSecond.password_hash, accAfterFirst.password_hash);
  assert.equal(accAfterSecond.password_salt, accAfterFirst.password_salt);
  const session = await login(db, creds, now);
  assert.ok(session.sessionId);
});

test('ensurePartnerAccount no-ops if PARTNER_EMAIL is already taken', async () => {
  const db = new MemoryAuthDb();
  const now = '2026-11-14T23:00:00.000Z';
  await signup(db, { email: 'dani@casebem.com', password: 'segredo12', plan: 'basic' }, now);
  await ensurePartnerAccount(db, { email: 'dani@casebem.com', password: 'partner-secret' }, now);
  assert.equal(await resolveAccountBySlug(db, 'dani-carine'), null);
  const squatter = await db.prepare('SELECT * FROM accounts WHERE email = ?').bind('dani@casebem.com').first();
  assert.equal(squatter.plan, 'basic');
  assert.notEqual(squatter.id, PARTNER_ACCOUNT_ID);
});

test('ensurePartnerAccount no-ops UPDATE when partner email collides', async () => {
  const db = new MemoryAuthDb();
  const now = '2026-11-14T23:00:00.000Z';
  await db
    .prepare(
      `INSERT INTO accounts (id, email, password_hash, password_salt, plan, plan_status, slug, is_partner, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(PARTNER_ACCOUNT_ID, '', '', '', 'pro', 'active', 'dani-carine', 1, now)
    .run();
  await signup(db, { email: 'dani@casebem.com', password: 'segredo12', plan: 'basic' }, now);
  await ensurePartnerAccount(db, { email: 'dani@casebem.com', password: 'partner-secret' }, now);
  const partner = await db.prepare('SELECT * FROM accounts WHERE id = ?').bind(PARTNER_ACCOUNT_ID).first();
  assert.equal(partner.email, '');
  const squatter = await db.prepare('SELECT * FROM accounts WHERE email = ?').bind('dani@casebem.com').first();
  assert.equal(squatter.plan, 'basic');
});

test('ensurePartnerAccount updates existing partner row by id', async () => {
  const db = new MemoryAuthDb();
  const now = '2026-11-14T23:00:00.000Z';
  await db
    .prepare(
      `INSERT INTO accounts (id, email, password_hash, password_salt, plan, plan_status, slug, is_partner, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(PARTNER_ACCOUNT_ID, '', '', '', 'pro', 'active', 'dani-carine', 1, now)
    .run();
  await ensurePartnerAccount(db, { email: 'Dani@CaseBem.com', password: 'segredo12' }, now);
  const acc = await resolveAccountBySlug(db, 'dani-carine');
  assert.equal(acc.id, PARTNER_ACCOUNT_ID);
  assert.equal(acc.email, 'dani@casebem.com');
  assert.notEqual(acc.password_hash, 'segredo12');
  assert.notEqual(acc.password_hash, '');
  const session = await login(db, { email: 'dani@casebem.com', password: 'segredo12' }, now);
  assert.ok(session.sessionId);
});
