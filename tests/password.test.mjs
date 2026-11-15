/**
 * Run: node --test tests/password.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PBKDF2_ITERATIONS,
  randomSaltB64,
  hashPassword,
  verifyPassword,
} from '../functions/_lib/password.mjs';

test('PBKDF2 uses 10000 iterations', () => {
  assert.equal(PBKDF2_ITERATIONS, 10000);
});

test('same password and salt verify; wrong password does not', async () => {
  const salt = randomSaltB64();
  const hash = await hashPassword('segredo12', salt);
  assert.equal(await verifyPassword('segredo12', salt, hash), true);
  assert.equal(await verifyPassword('outra-senha', salt, hash), false);
});

test('two random salts differ', () => {
  assert.notEqual(randomSaltB64(), randomSaltB64());
});