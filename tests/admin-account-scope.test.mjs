/**
 * Isolamento admin — papelaria e desafios por accountId.
 * Run: node --test tests/admin-account-scope.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStationeryTemplate,
  listStationeryAdmin,
  resetMemoryStationeryForTests,
} from '../functions/_lib/stationery-service.mjs';
import {
  createQuestion,
  listQuestionsAdmin,
  resetMemoryChallengesForTests,
} from '../functions/_lib/challenges-service.mjs';

test('listStationeryAdmin for account B is empty after creating on A', async () => {
  resetMemoryStationeryForTests();
  const created = await createStationeryTemplate(null, 'acc-a', {
    title: 'Convite A',
    body: 'Oi, casal A — venham ao nosso casamento!',
  });
  const listB = await listStationeryAdmin(null, 'acc-b');
  assert.equal(listB.length, 0);
  assert.equal(
    listB.some((t) => t.id === created.id),
    false
  );
  const listA = await listStationeryAdmin(null, 'acc-a');
  assert.equal(
    listA.some((t) => t.id === created.id),
    true
  );
});

test('listQuestionsAdmin for account B is empty after creating on A', async () => {
  resetMemoryChallengesForTests();
  const created = await createQuestion(null, 'acc-a', {
    prompt: 'Pergunta exclusiva da conta A?',
    options: ['Sim', 'Não'],
    correctIndex: 0,
    points: 10,
  });
  const listB = await listQuestionsAdmin(null, 'acc-b');
  assert.equal(listB.length, 0);
  assert.equal(
    listB.some((q) => q.id === created.id),
    false
  );
  const listA = await listQuestionsAdmin(null, 'acc-a');
  assert.equal(
    listA.some((q) => q.id === created.id),
    true
  );
});
