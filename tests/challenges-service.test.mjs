/**
 * Run: node --test tests/challenges-service.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resetMemoryChallengesForTests,
  createQuestion,
  listQuestionsAdmin,
  updateQuestion,
  deleteQuestion,
  createPhotoMission,
  createStampCard,
  listStampCardsAdmin,
  listChallengesPublic,
  gradeQuestion,
} from '../functions/_lib/challenges-service.mjs';

beforeEach(() => resetMemoryChallengesForTests());

test('create and list question in memory', async () => {
  const q = await createQuestion(null, {
    prompt: 'Cor favorita?',
    options: ['Azul', 'Verde', 'Rosa'],
    correctIndex: 2,
    points: 10,
  });
  assert.equal(q.prompt, 'Cor favorita?');
  assert.equal(q.correctIndex, 2);
  const list = await listQuestionsAdmin(null);
  assert.equal(list.length, 1);
});

test('update question points', async () => {
  const q = await createQuestion(null, {
    prompt: 'Pergunta longa ok',
    options: ['A', 'B'],
    correctIndex: 0,
    points: 5,
  });
  const updated = await updateQuestion(null, q.id, { points: 99 });
  assert.equal(updated.points, 99);
});

test('delete question', async () => {
  const q = await createQuestion(null, {
    prompt: 'Apagar?',
    options: ['Sim', 'Não'],
    correctIndex: 0,
    points: 1,
  });
  await deleteQuestion(null, q.id);
  assert.equal((await listQuestionsAdmin(null)).length, 0);
});

test('photo mission awardsStamp', async () => {
  const m = await createPhotoMission(null, {
    title: 'Foto no altar',
    points: 30,
    awardsStamp: true,
  });
  assert.equal(m.awardsStamp, true);
});

test('stamp card create list', async () => {
  await createStampCard(null, {
    name: 'Lembrancinha',
    stampsRequired: 3,
    rewardText: 'Kit lembrancinha',
  });
  const list = await listStampCardsAdmin(null);
  assert.equal(list[0].stampsRequired, 3);
});

test('public stamp cards expose fillMode and pointsPerSlot', async () => {
  await createStampCard(null, {
    name: 'Por ponto',
    stampsRequired: 4,
    rewardText: 'Brinde',
    fillMode: 'points',
    pointsPerSlot: 15,
  });
  const catalog = await listChallengesPublic(null);
  const card = catalog.stampCards.find((c) => c.name === 'Por ponto');
  assert.equal(card.fillMode, 'points');
  assert.equal(card.pointsPerSlot, 15);
});

test('public catalog omits gabarito and grades answers', async () => {
  const catalog = await listChallengesPublic(null);
  assert.ok(catalog.questions.length >= 19);
  assert.equal(catalog.questions[0].correctIndex, undefined);
  const first = catalog.questions[0];
  const right = await gradeQuestion(null, first.id, 0);
  assert.equal(right.correct, true);
  assert.equal(right.points, 10);
  const wrong = await gradeQuestion(null, first.id, 1);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.points, 0);
});

test('duplicate id throws EXISTS', async () => {
  const body = {
    id: 'q-dup',
    prompt: 'Dup?',
    options: ['A', 'B'],
    correctIndex: 0,
    points: 1,
  };
  await createQuestion(null, body);
  await assert.rejects(() => createQuestion(null, body), /EXISTS/);
});
