/**
 * Run: node --test tests/games-admin-auth.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGamesAdminPath,
  isGamesAdminLoggedIn,
  acceptsGamesAdminCredentials,
  setGamesAdminToken,
  logoutGamesAdmin,
} from '../games/src/admin-auth.js';

const memory = new Map();

beforeEach(() => {
  memory.clear();
  globalThis.sessionStorage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  };
  logoutGamesAdmin();
});

test('admin path is /admin and nested routes', () => {
  assert.equal(isGamesAdminPath('/admin'), true);
  assert.equal(isGamesAdminPath('/admin/quiz'), true);
  assert.equal(isGamesAdminPath('/admin/galeria'), true);
  assert.equal(isGamesAdminPath('/quiz'), false);
  assert.equal(isGamesAdminPath('/'), false);
});

test('login Carine / Dani is the games admin pair', () => {
  assert.equal(acceptsGamesAdminCredentials('Carine', 'Dani'), true);
});

test('login Dani / Carine is rejected on games admin', () => {
  assert.equal(acceptsGamesAdminCredentials('Dani', 'Carine'), false);
});

test('storing the API token opens the games admin', () => {
  setGamesAdminToken('production-secret-16');
  assert.equal(isGamesAdminLoggedIn(), true);
});

test('logout clears the games admin session', () => {
  setGamesAdminToken('production-secret-16');
  logoutGamesAdmin();
  assert.equal(isGamesAdminLoggedIn(), false);
});
