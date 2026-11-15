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
import { PARTNER_ACCOUNT_ID } from '../functions/_lib/auth-service.mjs';

const ACC = PARTNER_ACCOUNT_ID;

beforeEach(() => resetMemoryChallengesForTests());

test('create and list question in memory', async () => {
  const q = await createQuestion(null, ACC, {
    prompt: 'Cor favorita?',
    options: ['Azul', 'Verde', 'Rosa'],
    correctIndex: 2,
    points: 10,
  });
  assert.equal(q.prompt, 'Cor favorita?');
  assert.equal(q.correctIndex, 2);
  const list = await listQuestionsAdmin(null, ACC);
  assert.equal(list.length, 1);
});

test('update question points', async () => {
  const q = await createQuestion(null, ACC, {
    prompt: 'Pergunta longa ok',
    options: ['A', 'B'],
    correctIndex: 0,
    points: 5,
  });
  const updated = await updateQuestion(null, ACC, q.id, { points: 99 });
  assert.equal(updated.points, 99);
});

test('delete question', async () => {
  const q = await createQuestion(null, ACC, {
    prompt: 'Apagar?',
    options: ['Sim', 'Não'],
    correctIndex: 0,
    points: 1,
  });
  await deleteQuestion(null, ACC, q.id);
  assert.equal((await listQuestionsAdmin(null, ACC)).length, 0);
});

test('photo mission awardsStamp', async () => {
  const m = await createPhotoMission(null, ACC, {
    title: 'Foto no altar',
    points: 30,
    awardsStamp: true,
  });
  assert.equal(m.awardsStamp, true);
});

test('stamp card create list', async () => {
  await createStampCard(null, ACC, {
    name: 'Lembrancinha',
    stampsRequired: 3,
    rewardText: 'Kit lembrancinha',
  });
  const list = await listStampCardsAdmin(null, ACC);
  assert.equal(list[0].stampsRequired, 3);
});

test('public stamp cards expose fillMode and pointsPerSlot', async () => {
  await createStampCard(null, ACC, {
    name: 'Por ponto',
    stampsRequired: 4,
    rewardText: 'Brinde',
    fillMode: 'points',
    pointsPerSlot: 15,
  });
  const catalog = await listChallengesPublic(null, ACC);
  const card = catalog.stampCards.find((c) => c.name === 'Por ponto');
  assert.equal(card.fillMode, 'points');
  assert.equal(card.pointsPerSlot, 15);
});

test('public catalog omits gabarito and grades answers', async () => {
  const catalog = await listChallengesPublic(null, ACC);
  assert.ok(catalog.questions.length >= 19);
  assert.equal(catalog.questions[0].correctIndex, undefined);
  const first = catalog.questions[0];
  const right = await gradeQuestion(null, ACC, first.id, 0);
  assert.equal(right.correct, true);
  assert.equal(right.points, 10);
  const wrong = await gradeQuestion(null, ACC, first.id, 1);
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
  await createQuestion(null, ACC, body);
  await assert.rejects(() => createQuestion(null, ACC, body), /EXISTS/);
});
