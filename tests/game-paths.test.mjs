import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameSlugFromPathname, gameTo } from '../src/lib/game-paths.mjs';

test('gameSlugFromPathname reads /casal/:slug/game and ignores /games', () => {
  assert.equal(gameSlugFromPathname('/casal/dani-carine/game'), 'dani-carine');
  assert.equal(gameSlugFromPathname('/casal/Dani-Carine/game/quiz'), 'dani-carine');
  assert.equal(gameSlugFromPathname('/casal/x/game/galeria/telao'), 'x');
  assert.equal(gameSlugFromPathname('/games/quiz'), null);
  assert.equal(gameSlugFromPathname('/casal/dani-carine'), null);
  assert.equal(gameSlugFromPathname('/quiz'), null);
});

test('gameTo prefixes couple slug and keeps absolute game paths for the /games basename', () => {
  assert.equal(gameTo('/quiz', 'dani-carine'), '/casal/dani-carine/game/quiz');
  assert.equal(gameTo('quiz', 'dani-carine'), '/casal/dani-carine/game/quiz');
  assert.equal(gameTo('/quiz', null), '/quiz');
  assert.equal(gameTo('/', 'dani-carine'), '/casal/dani-carine/game/');
});
