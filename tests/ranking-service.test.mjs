/**
 * Run: node --test tests/ranking-service.test.mjs
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  resetMemoryRankingForTests,
  upsertRanking,
  listRanking,
} from '../functions/_lib/ranking-service.mjs';
import { mergeRankingRows } from '../games/src/ranking-board.mjs';

beforeEach(() => resetMemoryRankingForTests());

test('upsert ranking lists every guest ordered by points', async () => {
  await upsertRanking(null, { guestName: 'Ana', points: 10, stamps: 1 });
  await upsertRanking(null, { guestName: 'Beto', points: 40, stamps: 0 });
  await upsertRanking(null, { guestName: 'ana', points: 25, stamps: 2 });
  const rows = await listRanking(null);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].guestName, 'Beto');
  assert.equal(rows[0].points, 40);
  assert.equal(rows[1].guestName, 'ana');
  assert.equal(rows[1].points, 25);
  assert.equal(rows[1].stamps, 2);
  assert.equal('guestKey' in rows[0], false);
});

test('upsert ranking drops points when the guest score falls', async () => {
  await upsertRanking(null, { guestName: 'Ana', points: 40, stamps: 1 });
  await upsertRanking(null, { guestName: 'Ana', points: 10, stamps: 0 });
  const rows = await listRanking(null);
  assert.equal(rows[0].guestName, 'Ana');
  assert.equal(rows[0].points, 10);
  assert.equal(rows[0].stamps, 0);
});

test('upsert ranking rejects a short name', async () => {
  await assert.rejects(() => upsertRanking(null, { guestName: 'A', points: 1 }), (err) => {
    assert.equal(err.message, 'VALIDATION');
    return true;
  });
});

test('mergeRankingRows puts the local guest on the board', () => {
  const rows = mergeRankingRows(
    [{ guestName: 'Beto', points: 40, stamps: 0 }],
    { guestName: 'Ana', points: 12, stamps: 1 }
  );
  assert.deepEqual(
    rows.map((r) => r.guestName),
    ['Beto', 'Ana']
  );
  assert.equal(rows.find((r) => r.guestName === 'Ana').points, 12);
});

test('mergeRankingRows uses the local score after a photo is removed', () => {
  const rows = mergeRankingRows(
    [
      { guestName: 'Ana', points: 25, stamps: 2 },
      { guestName: 'Beto', points: 40, stamps: 0 },
    ],
    { guestName: 'Ana', points: 0, stamps: 0 }
  );
  assert.equal(rows.find((r) => r.guestName === 'Ana').points, 0);
  assert.equal(rows.find((r) => r.guestName === 'Ana').stamps, 0);
  assert.equal(rows[0].guestName, 'Beto');
});
