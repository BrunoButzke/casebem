import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signup, setAccountSlug } from '../functions/_lib/auth-service.mjs';
import {
  createQuestion,
  resetMemoryChallengesForTests,
} from '../functions/_lib/challenges-service.mjs';
import { onRequestGet as challengesGet } from '../functions/api/desafio/challenges.js';
import { onRequestPost as answerPost } from '../functions/api/desafio/answer.js';
import { onRequestGet as themeGet } from '../functions/api/desafio/theme.js';
import {
  resetMemoryGalleryForTests,
  upsertGalleryPhoto,
  listGalleryPhotos,
} from '../functions/_lib/gallery-service.mjs';
import { onRequestGet as galleryGet } from '../functions/api/desafio/gallery.js';
import { onRequestGet as galleryGetOne } from '../functions/api/desafio/gallery/[id].js';
import { onRequestGet as galleryGetImage } from '../functions/api/desafio/gallery/[id]/image.js';

const GALLERY_JPEG_PREVIEW = 'data:image/jpeg;base64,/9j/4AAQ';

test('challenges for slug B omit question created on A', async () => {
  resetMemoryChallengesForTests();
  const now = '2026-11-15T06:00:00.000Z';
  const a = await signup(null, { email: 'ch-a@x.com', password: 'segredo12', plan: 'pro' }, now);
  const b = await signup(null, { email: 'ch-b@x.com', password: 'segredo12', plan: 'pro' }, now);
  await setAccountSlug(null, a.accountId, 'ch-a');
  await setAccountSlug(null, b.accountId, 'ch-b');
  const q = await createQuestion(null, a.accountId, {
    prompt: 'Segredo A?',
    options: ['1', '2'],
    correctIndex: 0,
    points: 10,
  });
  const resB = await challengesGet({
    request: new Request('https://casebem.com/api/desafio/challenges?slug=ch-b'),
    env: { DB: null },
  });
  assert.equal(resB.status, 200);
  const body = await resB.json();
  assert.equal((body.questions || []).some((item) => item.id === q.id), false);

  const unknown = await challengesGet({
    request: new Request('https://casebem.com/api/desafio/challenges?slug=nao-existe'),
    env: { DB: null },
  });
  assert.equal(unknown.status, 404);
});

test('answer POST unknown slug is 404', async () => {
  const res = await answerPost({
    request: new Request('https://casebem.com/api/desafio/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Origin: 'https://casebem.com' },
      body: JSON.stringify({ slug: 'nao-existe', questionId: 'x', selectedIndex: 0 }),
    }),
    env: { DB: null },
  });
  assert.equal(res.status, 404);
});

test('theme GET unknown slug is 404', async () => {
  const res = await themeGet({
    request: new Request('https://casebem.com/api/desafio/theme?slug=nao-existe'),
    env: { DB: null },
  });
  assert.equal(res.status, 404);
});

test('theme GET for non-partner slug does not leak account UUID as weddingKey', async () => {
  const now = '2026-11-15T06:00:00.000Z';
  const a = await signup(null, { email: 'theme-uuid-leak@x.com', password: 'segredo12', plan: 'pro' }, now);
  await setAccountSlug(null, a.accountId, 'tema-uuid');
  const res = await themeGet({
    request: new Request('https://casebem.com/api/desafio/theme?slug=tema-uuid'),
    env: { DB: null },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(JSON.stringify(body).includes(a.accountId), false);
  assert.ok(body.theme.weddingKey === undefined || body.theme.weddingKey === 'tema-uuid');

  const partner = await themeGet({
    request: new Request('https://casebem.com/api/desafio/theme'),
    env: { DB: null },
  });
  assert.equal(partner.status, 200);
  const partnerBody = await partner.json();
  assert.ok(
    partnerBody.theme.weddingKey === undefined || partnerBody.theme.weddingKey === 'dani-carine'
  );
});

test('gallery list for slug B omits photo uploaded on A', async () => {
  resetMemoryGalleryForTests();
  const now = '2026-11-15T06:00:00.000Z';
  const a = await signup(null, { email: 'gal-a@x.com', password: 'segredo12', plan: 'pro' }, now);
  const b = await signup(null, { email: 'gal-b@x.com', password: 'segredo12', plan: 'pro' }, now);
  await setAccountSlug(null, a.accountId, 'gal-a');
  await setAccountSlug(null, b.accountId, 'gal-b');
  const photo = await upsertGalleryPhoto(
    null,
    { guestName: 'Ana', missionId: 'm1', title: 'Foto A', preview: GALLERY_JPEG_PREVIEW },
    null,
    a.accountId
  );
  assert.equal(photo.accountId, undefined);
  const res = await galleryGet({
    request: new Request('https://casebem.com/api/desafio/gallery?slug=gal-b'),
    env: { DB: null },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal((body.photos || []).some((p) => p.id === photo.id), false);
  assert.equal((await listGalleryPhotos(null, b.accountId)).some((p) => p.id === photo.id), false);
});

test('gallery GET photo by id for slug B is 404 when uploaded on A', async () => {
  resetMemoryGalleryForTests();
  const now = '2026-11-15T06:00:00.000Z';
  const a = await signup(null, { email: 'gal-id-a@x.com', password: 'segredo12', plan: 'pro' }, now);
  const b = await signup(null, { email: 'gal-id-b@x.com', password: 'segredo12', plan: 'pro' }, now);
  await setAccountSlug(null, a.accountId, 'gal-id-a');
  await setAccountSlug(null, b.accountId, 'gal-id-b');
  const photo = await upsertGalleryPhoto(
    null,
    { guestName: 'Ana', missionId: 'm1', title: 'Foto A', preview: GALLERY_JPEG_PREVIEW },
    null,
    a.accountId
  );
  const res = await galleryGetOne({
    request: new Request(`https://casebem.com/api/desafio/gallery/${photo.id}?slug=gal-id-b`),
    env: { DB: null },
    params: { id: photo.id },
  });
  assert.equal(res.status, 404);

  const image = await galleryGetImage({
    request: new Request(`https://casebem.com/api/desafio/gallery/${photo.id}/image?slug=gal-id-b`),
    env: { DB: null },
    params: { id: photo.id },
  });
  assert.equal(image.status, 404);
});

test('gallery GET unknown slug is 404', async () => {
  const res = await galleryGet({
    request: new Request('https://casebem.com/api/desafio/gallery?slug=nao-existe'),
    env: { DB: null },
  });
  assert.equal(res.status, 404);
});
