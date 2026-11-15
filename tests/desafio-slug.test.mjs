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
