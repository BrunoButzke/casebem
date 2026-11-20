/**
 * Run: node --test tests/desafio-progress.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getGuestProgress,
  upsertGuestProgress,
  sanitizePhotosForStorage,
  resetGuestProgressForTests,
  GAMES_WEDDING_KEY,
} from '../functions/_lib/desafio-progress-service.mjs';
import {
  onRequestGet as progressGet,
  onRequestPut as progressPut,
} from '../functions/api/desafio/progress.js';

beforeEach(() => resetGuestProgressForTests());

test('GAMES_WEDDING_KEY é dani-carine', () => {
  assert.equal(GAMES_WEDDING_KEY, 'dani-carine');
});

test('sanitizePhotosForStorage remove preview e data URLs', () => {
  const cleaned = sanitizePhotosForStorage({
    m1: {
      done: true,
      title: 'Brinde',
      awardsStamp: true,
      preview: 'data:image/jpeg;base64,AAAA',
      galleryId: 'gal-1',
    },
  });
  assert.deepEqual(cleaned.m1, {
    done: true,
    title: 'Brinde',
    awardsStamp: true,
    galleryId: 'gal-1',
  });
  assert.equal(cleaned.m1.preview, undefined);
});

test('upsert e get progress em memória', async () => {
  const empty = await getGuestProgress(null, 'Ana Silva');
  assert.equal(empty.empty, true);
  assert.deepEqual(empty.answers, {});

  const saved = await upsertGuestProgress(null, {
    guestName: 'Ana Silva',
    answers: {
      q1: { selectedIndex: 2, correct: true, points: 10 },
    },
    photos: {
      m1: { done: true, title: 'Pista', preview: 'data:image/png;base64,xx', awardsStamp: true },
    },
  });
  assert.equal(saved.empty, false);
  assert.equal(saved.answers.q1.points, 10);
  assert.equal(saved.photos.m1.done, true);
  assert.equal(saved.photos.m1.preview, undefined);

  const again = await getGuestProgress(null, 'ana silva');
  assert.equal(again.empty, false);
  assert.equal(again.guestName, 'Ana Silva');
  assert.equal(again.answers.q1.correct, true);
});

test('guestName inválido falha validação', async () => {
  await assert.rejects(() => getGuestProgress(null, 'A'), (err) => err.message === 'VALIDATION');
});

test('GET /api/desafio/progress retorna progresso', async () => {
  await upsertGuestProgress(null, {
    guestName: 'Bruno',
    answers: { q1: { selectedIndex: 0, correct: false, points: 0 } },
    photos: {},
  });
  const res = await progressGet({
    request: new Request('https://casebem.com/api/desafio/progress?guestName=Bruno'),
    env: {},
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.progress.answers.q1.selectedIndex, 0);
});

test('PUT /api/desafio/progress grava e GET recupera', async () => {
  const put = await progressPut({
    request: new Request('https://casebem.com/api/desafio/progress', {
      method: 'PUT',
      headers: {
        origin: 'https://casebem.com',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        guestName: 'Cris',
        answers: { q2: { selectedIndex: 1, correct: true, points: 15 } },
        photos: { m2: { done: true, title: 'Doce', preview: 'blob:x' } },
      }),
    }),
    env: {},
  });
  assert.equal(put.status, 200);
  const putBody = await put.json();
  assert.equal(putBody.ok, true);
  assert.equal(putBody.progress.photos.m2.preview, undefined);

  const get = await progressGet({
    request: new Request('https://casebem.com/api/desafio/progress?guestName=Cris'),
    env: {},
  });
  const getBody = await get.json();
  assert.equal(getBody.progress.answers.q2.points, 15);
  assert.equal(getBody.progress.photos.m2.done, true);
});
