/**
 * Run: node --test tests/draw-broadcast-service.test.mjs
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDrawBroadcast,
  upsertDrawBroadcast,
  resetDrawBroadcastForTests,
  DEFAULT_DURATION_MS,
} from '../functions/_lib/draw-broadcast-service.mjs';

beforeEach(() => {
  resetDrawBroadcastForTests();
});

describe('draw-broadcast-service', () => {
  it('default é gallery', async () => {
    const b = await getDrawBroadcast(null);
    assert.equal(b.phase, 'gallery');
    assert.equal(b.durationMs, DEFAULT_DURATION_MS);
    assert.deepEqual(b.pool, []);
  });

  it('soon limpa vencedor', async () => {
    await upsertDrawBroadcast(null, {
      phase: 'spinning',
      winnerNumber: 7,
      winnerName: 'Ana',
      raffleId: 'r1',
      pool: [{ number: 7, guestName: 'Ana' }],
      startedAt: '2026-11-20T12:00:00.000Z',
    });
    const soon = await upsertDrawBroadcast(null, { phase: 'soon' });
    assert.equal(soon.phase, 'soon');
    assert.equal(soon.winnerNumber, null);
    assert.equal(soon.startedAt, null);
  });

  it('spinning exige pool e winner', async () => {
    await assert.rejects(
      () => upsertDrawBroadcast(null, { phase: 'spinning', raffleId: 'r1', pool: [] }),
      /MISSING/
    );
    const b = await upsertDrawBroadcast(null, {
      phase: 'spinning',
      winnerNumber: 3,
      winnerName: 'Bia',
      raffleId: 'r1',
      pool: [{ number: 1, guestName: null }, { number: 3, guestName: 'Bia' }],
      durationMs: 8000,
      startedAt: '2026-11-20T12:00:00.000Z',
    });
    assert.equal(b.phase, 'spinning');
    assert.equal(b.winnerNumber, 3);
    assert.equal(b.pool.length, 2);
  });

  it('gallery zera tudo', async () => {
    await upsertDrawBroadcast(null, {
      phase: 'winner',
      winnerNumber: 9,
      raffleId: 'r1',
      pool: [{ number: 9, guestName: 'C' }],
      startedAt: '2026-11-20T12:00:00.000Z',
    });
    const g = await upsertDrawBroadcast(null, { phase: 'gallery' });
    assert.equal(g.phase, 'gallery');
    assert.equal(g.winnerNumber, null);
    assert.deepEqual(g.pool, []);
  });
});
