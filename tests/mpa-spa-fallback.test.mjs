/**
 * Run: node --test tests/mpa-spa-fallback.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteMpaSpaUrl } from '../dev/mpa-spa-fallback.mjs';

test('nested games routes fall back to games index, files stay as-is', () => {
  assert.equal(rewriteMpaSpaUrl('/games/selo'), '/games/index.html');
  assert.equal(rewriteMpaSpaUrl('/games/quiz?x=1'), '/games/index.html?x=1');
  assert.equal(rewriteMpaSpaUrl('/games/admin'), '/games/index.html');
  assert.equal(rewriteMpaSpaUrl('/games/admin/galeria'), '/games/index.html');
  assert.equal(rewriteMpaSpaUrl('/games/'), '/games/');
  assert.equal(rewriteMpaSpaUrl('/games/src/main.jsx'), '/games/src/main.jsx');
  assert.equal(rewriteMpaSpaUrl('/landing-page-animada/'), '/landing-page-animada/');
});
