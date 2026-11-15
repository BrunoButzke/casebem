import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestStorageKey } from '../games/src/guest.js';
import { progressStorageKey } from '../games/src/progress.js';

test('storage keys differ by slug', () => {
  assert.equal(guestStorageKey(null), 'casebem_desafio_guest_name');
  assert.equal(guestStorageKey('dani-carine'), 'casebem_desafio_guest_name:dani-carine');
  assert.equal(progressStorageKey(null, 'Ana'), 'casebem_desafio_progress:ana');
  assert.equal(
    progressStorageKey('dani-carine', 'Ana'),
    'casebem_desafio_progress:ana:dani-carine',
  );
});