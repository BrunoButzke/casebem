/**
 * Run: node --test tests/draw-reel.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reelDisplayAt, easeOutCubic, tickIntervalMs } from '../games/src/draw-reel.mjs';

describe('draw-reel', () => {
  const pool = [
    { number: 1, guestName: 'A' },
    { number: 7, guestName: 'B' },
    { number: 12, guestName: 'C' },
  ];
  const startedAt = '2026-11-20T12:00:00.000Z';
  const startMs = Date.parse(startedAt);

  it('easeOutCubic bounds', () => {
    assert.equal(easeOutCubic(0), 0);
    assert.equal(easeOutCubic(1), 1);
    assert.ok(easeOutCubic(0.5) > 0.5);
  });

  it('tickIntervalMs aumenta com o progresso', () => {
    assert.ok(tickIntervalMs(0.9) > tickIntervalMs(0.1));
  });

  it('antes do fim ainda não done', () => {
    const r = reelDisplayAt({
      pool,
      startedAt,
      durationMs: 8000,
      winnerNumber: 7,
      now: startMs + 2000,
    });
    assert.equal(r.done, false);
    assert.match(r.displayNumber, /^\d{2}$/);
  });

  it('após duration pousa no vencedor', () => {
    const r = reelDisplayAt({
      pool,
      startedAt,
      durationMs: 8000,
      winnerNumber: 7,
      now: startMs + 8000,
    });
    assert.equal(r.done, true);
    assert.equal(r.displayNumber, '07');
    assert.equal(r.winnerNumber, 7);
  });

  it('mesmo instante → mesmo dígito (sync TVs)', () => {
    const a = reelDisplayAt({
      pool,
      startedAt,
      durationMs: 8000,
      winnerNumber: 7,
      now: startMs + 3500,
    });
    const b = reelDisplayAt({
      pool,
      startedAt,
      durationMs: 8000,
      winnerNumber: 7,
      now: startMs + 3500,
    });
    assert.equal(a.displayNumber, b.displayNumber);
  });
});
