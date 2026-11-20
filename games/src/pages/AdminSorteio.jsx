import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listRaffleDrawEntries,
  getDrawBroadcastAdmin,
  putDrawBroadcast,
} from '../admin-api.js';
import { reelDisplayAt, DEFAULT_DRAW_DURATION_MS, tickIntervalMs } from '../draw-reel.mjs';

const CONFETTI_COLORS = ['#ffffff', '#ffe4ec', '#ffb7c5', '#f472b6', '#ec4899', '#db2777', '#fdf2f8'];

function pickWinner(entries) {
  if (!entries.length) return null;
  const i = Math.floor(Math.random() * entries.length);
  return entries[i];
}

function buildPool(mode, raffle, soldEntries) {
  if (mode === 'sold') return soldEntries;
  const total = Math.max(0, Number(raffle?.totalNumbers) || 0);
  const byNumber = new Map(soldEntries.map((e) => [Number(e.number), e.guestName]));
  const pool = [];
  for (let n = 1; n <= total; n += 1) {
    pool.push({
      number: n,
      guestName: byNumber.get(n) || null,
      sold: byNumber.has(n),
    });
  }
  return pool;
}

function ConfettiBurst({ active }) {
  const pieces = useMemo(() => {
    if (!active) return [];
    return Array.from({ length: 48 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 48 + (i % 3) * 0.15;
      const dist = 90 + (i % 6) * 32;
      return {
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        dx: `${Math.cos(angle) * dist}px`,
        dy: `${Math.sin(angle) * dist - 50}px`,
        rot: `${(i % 2 === 0 ? 1 : -1) * (240 + (i % 7) * 45)}deg`,
        delay: `${(i % 10) * 0.025}s`,
        round: i % 3 === 0,
      };
    });
  }, [active]);

  if (!pieces.length) return null;
  return (
    <div className="admin-draw__confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`admin-draw__confetti-piece${p.round ? ' is-round' : ''}`}
          style={{
            background: p.color,
            '--dx': p.dx,
            '--dy': p.dy,
            '--rot': p.rot,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

export default function AdminSorteio() {
  const [raffle, setRaffle] = useState(null);
  const [entries, setEntries] = useState([]);
  const [mode, setMode] = useState('sold');
  const [screenMode, setScreenMode] = useState('gallery');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyMode, setBusyMode] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [displayNumber, setDisplayNumber] = useState('—');
  const [winner, setWinner] = useState(null);
  const [confetti, setConfetti] = useState(false);
  const timerRef = useRef(null);
  const spinMetaRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, broadcast] = await Promise.all([
          listRaffleDrawEntries(),
          getDrawBroadcastAdmin().catch(() => ({ phase: 'gallery' })),
        ]);
        if (!cancelled) {
          setRaffle(data.raffle);
          setEntries(data.entries);
          setScreenMode(broadcast?.phase === 'soon' || broadcast?.phase === 'spinning' || broadcast?.phase === 'winner' ? 'soon' : 'gallery');
          if (broadcast?.phase === 'winner' && broadcast.winnerNumber) {
            setWinner({
              number: broadcast.winnerNumber,
              guestName: broadcast.winnerName,
            });
            setDisplayNumber(String(broadcast.winnerNumber).padStart(2, '0'));
          }
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setRaffle(null);
          setEntries([]);
          setError(err.message || 'Não deu para carregar o sorteio');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const pool = useMemo(() => buildPool(mode, raffle, entries), [mode, raffle, entries]);

  function changeMode(next) {
    if (spinning || next === mode) return;
    setMode(next);
    setWinner(null);
    setDisplayNumber('—');
    setConfetti(false);
  }

  async function setBroadcastMode(next) {
    if (spinning || busyMode || next === screenMode) return;
    setBusyMode(true);
    setActionError('');
    try {
      await putDrawBroadcast({ phase: next === 'soon' ? 'soon' : 'gallery' });
      setScreenMode(next);
      if (next === 'gallery') {
        setConfetti(false);
      }
    } catch (err) {
      setActionError(err.message || 'Não deu para mudar o modo do telão');
    } finally {
      setBusyMode(false);
    }
  }

  function clearSpinTimer() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function scheduleReelTick() {
    const meta = spinMetaRef.current;
    if (!meta) return;
    const snap = reelDisplayAt({
      pool: meta.pool,
      startedAt: meta.startedAt,
      durationMs: meta.durationMs,
      winnerNumber: meta.winner.number,
      now: Date.now(),
    });
    setDisplayNumber(snap.displayNumber);
    if (snap.done) {
      clearSpinTimer();
      setWinner(meta.winner);
      setSpinning(false);
      setConfetti(true);
      void putDrawBroadcast({
        phase: 'winner',
        winnerNumber: meta.winner.number,
        winnerName: meta.winner.guestName || null,
        raffleId: raffle?.id,
        startedAt: meta.startedAt,
        durationMs: meta.durationMs,
        pool: meta.pool,
      }).catch(() => {});
      return;
    }
    timerRef.current = window.setTimeout(scheduleReelTick, tickIntervalMs(snap.progress));
  }

  async function runDraw() {
    if (spinning || pool.length < 1 || !raffle?.id) return;
    setActionError('');
    setWinner(null);
    setConfetti(false);
    const final = pickWinner(pool);
    const startedAt = new Date().toISOString();
    const durationMs = DEFAULT_DRAW_DURATION_MS;
    const poolPayload = pool.map((e) => ({
      number: Number(e.number),
      guestName: e.guestName || null,
    }));

    try {
      await putDrawBroadcast({
        phase: 'spinning',
        winnerNumber: final.number,
        winnerName: final.guestName || null,
        raffleId: raffle.id,
        durationMs,
        startedAt,
        pool: poolPayload,
      });
    } catch (err) {
      setActionError(err.message || 'Não deu para iniciar o sorteio no telão');
      return;
    }

    setScreenMode('soon');
    setSpinning(true);
    spinMetaRef.current = {
      winner: final,
      pool: poolPayload,
      startedAt,
      durationMs,
    };
    clearSpinTimer();
    scheduleReelTick();
  }

  const canDraw = !loading && !error && pool.length > 0 && raffle?.id;
  const emptySold = mode === 'sold' && !loading && !error && entries.length === 0;
  const emptyAll = mode === 'all' && !loading && !error && !Number(raffle?.totalNumbers);
  const controlsLocked = spinning || busyMode;

  return (
    <div className="play-page admin-draw">
      <h1 className="sorteio-title">Sorteio</h1>
      <p className="play-sub">
        {raffle?.name
          ? `${raffle.name} · ${entries.length} vendido(s) · ${raffle.totalNumbers || 0} no total`
          : 'Sorteie um número da rifa'}
      </p>

      <div className="admin-draw__modes" role="group" aria-label="Modo do telão">
        <button
          type="button"
          className={`admin-draw__mode${screenMode === 'soon' ? ' is-active' : ''}`}
          disabled={controlsLocked}
          onClick={() => setBroadcastMode('soon')}
        >
          Modo sorteio
        </button>
        <button
          type="button"
          className={`admin-draw__mode${screenMode === 'gallery' ? ' is-active' : ''}`}
          disabled={controlsLocked}
          onClick={() => setBroadcastMode('gallery')}
        >
          Modo telão
        </button>
      </div>

      <div className="admin-draw__modes" role="group" aria-label="Escopo do sorteio">
        <button
          type="button"
          className={`admin-draw__mode${mode === 'sold' ? ' is-active' : ''}`}
          disabled={controlsLocked}
          onClick={() => changeMode('sold')}
        >
          Só vendidos
        </button>
        <button
          type="button"
          className={`admin-draw__mode${mode === 'all' ? ' is-active' : ''}`}
          disabled={controlsLocked}
          onClick={() => changeMode('all')}
        >
          Todos os números
        </button>
      </div>

      {error ? <p className="hub-error">{error}</p> : null}
      {actionError ? <p className="hub-error">{actionError}</p> : null}
      {loading ? <p className="hub-empty">Carregando…</p> : null}

      {emptySold ? <p className="hub-empty">Ainda não há números vendidos para sortear.</p> : null}
      {emptyAll ? <p className="hub-empty">Rifa sem quantidade de números configurada.</p> : null}

      {canDraw ? (
        <>
          <div
            className={`admin-draw__reel${spinning ? ' is-spinning' : ''}${winner ? ' is-done' : ''}`}
          >
            <ConfettiBurst active={confetti} />
            <p className="admin-draw__label">Número</p>
            <p className="admin-draw__number" aria-live="polite">
              {displayNumber}
            </p>
          </div>

          {winner ? (
            <div className="admin-draw__winner" role="status">
              <p className="admin-draw__winner-kicker">
                {winner.guestName ? 'Ganhador(a)' : 'Número sorteado'}
              </p>
              {winner.guestName ? (
                <p className="admin-draw__winner-name">{winner.guestName}</p>
              ) : (
                <p className="admin-draw__winner-name">Sem comprador</p>
              )}
              <p className="admin-draw__winner-num">Número {winner.number}</p>
            </div>
          ) : (
            <p className="play-sub">
              {spinning
                ? 'Sorteando nos telões…'
                : screenMode === 'soon'
                  ? 'Telões em “Sorteio em breve” — pode sortear'
                  : mode === 'sold'
                    ? 'Sorteio entre os números já comprados'
                    : 'Sorteio entre todos os números da rifa'}
            </p>
          )}

          <button
            type="button"
            className="desafio__cta admin-draw__cta"
            disabled={controlsLocked}
            onClick={runDraw}
          >
            {spinning ? 'Sorteando…' : winner ? 'Sortear de novo' : 'Sortear'}
          </button>
        </>
      ) : null}
    </div>
  );
}
