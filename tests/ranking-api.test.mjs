/**
 * Run: node --test tests/ranking-api.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetMemoryRankingForTests } from '../functions/_lib/ranking-service.mjs';
import { onRequestGet, onRequestPost } from '../functions/api/desafio/ranking.js';

beforeEach(() => resetMemoryRankingForTests());

function ctx(method, body) {
  return {
    request: new Request('https://casebem.com/api/desafio/ranking', {
      method,
      headers: {
        origin: 'https://casebem.com',
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env: { DB: null },
  };
}

test('GET ranking starts empty', async () => {
  const res = await onRequestGet(ctx('GET'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.rows, []);
});

test('POST ranking then GET lists both guests', async () => {
  const first = await onRequestPost(ctx('POST', { guestName: 'Ana', points: 10, stamps: 1 }));
  assert.equal(first.status, 200);
  await onRequestPost(ctx('POST', { guestName: 'Beto', points: 30, stamps: 0 }));
  const res = await onRequestGet(ctx('GET'));
  const body = await res.json();
  assert.equal(body.rows.length, 2);
  assert.equal(body.rows[0].guestName, 'Beto');
  assert.equal(body.rows[1].guestName, 'Ana');
});
