/**
 * Run: node --test tests/telao-queue.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergePlaylist, nextId } from '../games/src/telao-queue.js';

test('new photos are inserted right after the current one', () => {
  const playlist = mergePlaylist(['a', 'b', 'c'], 'b', ['a', 'b', 'c', 'd']);
  assert.deepEqual(playlist, ['a', 'b', 'd', 'c']);
  assert.equal(nextId(playlist, 'b'), 'd');
  assert.equal(nextId(playlist, 'd'), 'c');
  assert.equal(nextId(playlist, 'c'), 'a');
});

test('several new photos keep arrival order after current', () => {
  const playlist = mergePlaylist(['a', 'b'], 'a', ['a', 'b', 'n1', 'n2']);
  assert.deepEqual(playlist, ['a', 'n1', 'n2', 'b']);
});

test('removed photos leave the loop without breaking next', () => {
  const playlist = mergePlaylist(['a', 'b', 'c'], 'b', ['a', 'c']);
  assert.deepEqual(playlist, ['a', 'c']);
  assert.equal(nextId(playlist, 'b'), 'a');
});

test('empty playlist starts with live order', () => {
  assert.deepEqual(mergePlaylist([], '', ['x', 'y']), ['x', 'y']);
  assert.equal(nextId(['x', 'y'], 'y'), 'x');
});
