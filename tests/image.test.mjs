/**
 * Run: node --test tests/image.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaledSize } from '../games/src/image.js';

test('keeps small images as-is', () => {
  assert.deepEqual(scaledSize(640, 480, 1920), { width: 640, height: 480 });
});

test('fits a landscape phone photo into 2560 on the long edge', () => {
  assert.deepEqual(scaledSize(4032, 3024, 2560), { width: 2560, height: 1920 });
});

test('fits a portrait phone photo into 2560 on the long edge', () => {
  assert.deepEqual(scaledSize(3024, 4032, 2560), { width: 1920, height: 2560 });
});
