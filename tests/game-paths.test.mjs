import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { gameSlugFromPathname, gameTo } from '../src/lib/game-paths.mjs';
import { desafioUrl, getGameSlug } from '../games/src/game-api.mjs';
import { listGallery, loadGalleryPhoto } from '../games/src/gallery-api.js';

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

test('gallery-api maps preview via galleryImageUrl and ignores server preview', () => {
  const gal = readFileSync(new URL('../games/src/gallery-api.js', import.meta.url), 'utf8');
  assert.doesNotMatch(gal, /photo\.preview\s*\|\|/);
  assert.doesNotMatch(gal, /data\.photo\?\.preview\s*\|\|/);
  assert.match(gal, /preview:\s*galleryImageUrl/);
});

test('listGallery and loadGalleryPhoto add slug to preview URLs', async () => {
  const serverPreview = '/api/desafio/gallery/photo-1/image';
  const window = new Window({ url: 'http://localhost/casal/outro-casal/game/galeria' });
  globalThis.window = window;
  globalThis.fetch = async (url) => {
    const p = String(url);
    if (p === '/api/desafio/gallery?slug=outro-casal') {
      return new Response(JSON.stringify({ ok: true, photos: [{ id: 'photo-1', preview: serverPreview }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (p === '/api/desafio/gallery/photo-1?slug=outro-casal') {
      return new Response(JSON.stringify({ ok: true, photo: { id: 'photo-1', preview: serverPreview } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch: ${p}`);
  };
  const photos = await listGallery();
  assert.equal(photos.length, 1);
  assert.match(photos[0].preview, /\?slug=outro-casal$/);
  assert.notEqual(photos[0].preview, serverPreview);
  const photo = await loadGalleryPhoto('photo-1');
  assert.match(photo.preview, /\?slug=outro-casal$/);
  assert.notEqual(photo.preview, serverPreview);
});
