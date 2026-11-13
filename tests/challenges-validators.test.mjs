/**
 * Run: node --test tests/challenges-validators.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEDDING_KEY,
  CHALLENGE_LIMITS,
  validateQuestionCreate,
  validateQuestionPatch,
  validatePhotoMissionCreate,
  validateStampCardCreate,
} from '../functions/_lib/challenges-validators.mjs';

test('WEDDING_KEY', () => assert.equal(WEDDING_KEY, 'dani-carine'));

test('CHALLENGE_LIMITS options bounds', () => {
  assert.equal(CHALLENGE_LIMITS.OPTIONS_MIN, 2);
  assert.equal(CHALLENGE_LIMITS.OPTIONS_MAX, 4);
});

test('question create ok', () => {
  const r = validateQuestionCreate({
    prompt: 'Onde se conheceram?',
    options: ['Praia', 'Faculdade', 'App', ''],
    correctIndex: 1,
    points: 10,
  });
  assert.equal(r.valid, true);
  assert.deepEqual(r.data.options, ['Praia', 'Faculdade', 'App']);
  assert.equal(r.data.correctIndex, 1);
  assert.equal(r.data.points, 10);
});

test('question rejects 1 option', () => {
  const r = validateQuestionCreate({
    prompt: 'Pergunta?',
    options: ['Só uma'],
    correctIndex: 0,
    points: 5,
  });
  assert.equal(r.valid, false);
});

test('question rejects invalid correctIndex', () => {
  const r = validateQuestionCreate({
    prompt: 'Pergunta?',
    options: ['A', 'B'],
    correctIndex: 5,
    points: 5,
  });
  assert.equal(r.valid, false);
});

test('photo mission create with stamp', () => {
  const r = validatePhotoMissionCreate({
    title: 'Selfie com os noivos',
    points: 20,
    awardsStamp: true,
  });
  assert.equal(r.valid, true);
  assert.equal(r.data.awardsStamp, true);
  assert.equal(r.data.title, 'Selfie com os noivos');
});

test('stamp card create ok', () => {
  const r = validateStampCardCreate({
    name: 'Drink',
    stampsRequired: 5,
    rewardText: 'Drink do casamento',
  });
  assert.equal(r.valid, true);
  assert.equal(r.data.stampsRequired, 5);
});

test('stamp card rejects stampsRequired 0', () => {
  const r = validateStampCardCreate({
    name: 'Drink',
    stampsRequired: 0,
    rewardText: 'Drink',
  });
  assert.equal(r.valid, false);
});

test('question patch points only', () => {
  const r = validateQuestionPatch({ points: 15 });
  assert.equal(r.valid, true);
  assert.equal(r.data.points, 15);
  assert.equal(r.data.prompt, undefined);
});
