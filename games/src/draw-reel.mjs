/**
 * Roleta compartilhada admin ↔ telão.
 * Anima localmente a partir de startedAt + pool + winnerNumber.
 */

export const DEFAULT_DRAW_DURATION_MS = 8000;

/**
 * Ease-out cubic 0..1
 * @param {number} t
 */
export function easeOutCubic(t) {
  const x = Math.min(1, Math.max(0, Number(t) || 0));
  return 1 - (1 - x) ** 3;
}

/**
 * Intervalo entre ticks (ms) — começa rápido e desacelera.
 * @param {number} progress 0..1
 */
export function tickIntervalMs(progress) {
  const p = Math.min(1, Math.max(0, Number(progress) || 0));
  return Math.round(45 + easeOutCubic(p) * 220);
}

/**
 * Índice do pool para o instante `now` (determinístico o suficiente via tempo).
 * @param {{ pool: Array<{number:number}>, startedAt: string, durationMs: number, winnerNumber: number, now?: number|Date }} opts
 * @returns {{ displayNumber: string, done: boolean, progress: number, winnerNumber: number }}
 */
export function reelDisplayAt(opts) {
  const pool = Array.isArray(opts?.pool) ? opts.pool : [];
  const winnerNumber = Math.floor(Number(opts?.winnerNumber));
  const durationMs = Math.max(1000, Number(opts?.durationMs) || DEFAULT_DRAW_DURATION_MS);
  const started = Date.parse(opts?.startedAt || '');
  const nowMs =
    opts?.now instanceof Date
      ? opts.now.getTime()
      : typeof opts?.now === 'number'
        ? opts.now
        : Date.now();

  const pad = (n) => String(n).padStart(2, '0');

  if (!Number.isInteger(winnerNumber) || winnerNumber < 1) {
    return { displayNumber: '—', done: false, progress: 0, winnerNumber: null };
  }

  if (!Number.isFinite(started)) {
    return { displayNumber: pad(winnerNumber), done: true, progress: 1, winnerNumber };
  }

  const elapsed = Math.max(0, nowMs - started);
  const progress = Math.min(1, elapsed / durationMs);

  if (progress >= 1 || !pool.length) {
    return { displayNumber: pad(winnerNumber), done: true, progress: 1, winnerNumber };
  }

  // Amostra pseudo-aleatória estável por “janela” de tick (evita jitter entre TVs no mesmo ms).
  const interval = tickIntervalMs(progress);
  const slot = Math.floor(elapsed / interval);
  const idx = Math.abs((slot * 2654435761) ^ (winnerNumber * 97)) % pool.length;
  const sample = pool[idx];
  const num = Number(sample?.number) || winnerNumber;
  return {
    displayNumber: pad(num),
    done: false,
    progress,
    winnerNumber,
  };
}
