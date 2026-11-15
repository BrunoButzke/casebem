import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gameSlugFromPathname, gameTo } from '../src/lib/game-paths.mjs';
import { desafioUrl, getGameSlug } from '../games/src/game-api.mjs';

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

test('desafioUrl adds slug query when present', () => {
  assert.equal(desafioUrl('/api/desafio/challenges', { slug: 'dani-carine' }), '/api/desafio/challenges?slug=dani-carine');
  assert.equal(desafioUrl('/api/desafio/challenges', { slug: null }), '/api/desafio/challenges');
  assert.equal(
    desafioUrl('/api/desafio/gallery/abc/image', { slug: 'x' }),
    '/api/desafio/gallery/abc/image?slug=x'
  );
});

test('PlayContext and gallery-api call desafioUrl', () => {
  const play = readFileSync(new URL('../games/src/PlayContext.jsx', import.meta.url), 'utf8');
  const gal = readFileSync(new URL('../games/src/gallery-api.js', import.meta.url), 'utf8');
  const theme = readFileSync(new URL('../games/src/theme.js', import.meta.url), 'utf8');
  assert.match(play, /desafioUrl/);
  assert.match(gal, /desafioUrl/);
  assert.match(theme, /desafioUrl|getGameSlug/);
});
