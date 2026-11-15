/**
 * Isolamento admin — papelaria e desafios por accountId.
 * Run: node --test tests/admin-account-scope.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signup } from '../functions/_lib/auth-service.mjs';
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
import { onRequestPost as postQuestion } from '../functions/api/admin/challenges/questions.js';

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

test('basic session POST question returns 403 PLAN_REQUIRED', async () => {
  const now = new Date().toISOString();
  const created = await signup(
    null,
    { email: `basic-q-${Date.now()}@x.com`, password: 'segredo12', plan: 'basic' },
    now
  );
  const res = await postQuestion({
    request: new Request('http://localhost/api/admin/challenges/questions', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
        'content-type': 'application/json',
        cookie: `cb_session=${created.sessionId}`,
      },
      body: JSON.stringify({
        prompt: 'Pergunta do plano básico?',
        options: ['Sim', 'Não'],
        correctIndex: 0,
        points: 10,
      }),
    }),
    env: { DB: null },
  });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error, 'PLAN_REQUIRED');
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
