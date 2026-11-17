import { useEffect, useMemo, useRef, useState } from 'react';
import { listRaffleDrawEntries } from '../admin-api.js';

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

export default function AdminSorteio() {
  const [raffle, setRaffle] = useState(null);
  const [entries, setEntries] = useState([]);
  const [mode, setMode] = useState('sold');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [displayNumber, setDisplayNumber] = useState('—');
  const [winner, setWinner] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listRaffleDrawEntries();
        if (!cancelled) {
          setRaffle(data.raffle);
          setEntries(data.entries);
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
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const pool = useMemo(() => buildPool(mode, raffle, entries), [mode, raffle, entries]);

  function changeMode(next) {
    if (spinning || next === mode) return;
    setMode(next);
    setWinner(null);
    setDisplayNumber('—');
  }

  function runDraw() {
    if (spinning || pool.length < 1) return;
    setWinner(null);
    setSpinning(true);
    const final = pickWinner(pool);
    const started = Date.now();
    const duration = 3200;

    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const sample = pickWinner(pool);
      if (sample) setDisplayNumber(String(sample.number).padStart(2, '0'));
      if (elapsed >= duration) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
        setDisplayNumber(String(final.number).padStart(2, '0'));
        setWinner(final);
        setSpinning(false);
      }
    }, 70);
  }

  const canDraw = !loading && !error && pool.length > 0;
  const emptySold = mode === 'sold' && !loading && !error && entries.length === 0;
  const emptyAll = mode === 'all' && !loading && !error && !Number(raffle?.totalNumbers);

  return (
    <div className="play-page admin-draw">
      <h1 className="sorteio-title">Sorteio</h1>
      <p className="play-sub">
        {raffle?.name
          ? `${raffle.name} · ${entries.length} vendido(s) · ${raffle.totalNumbers || 0} no total`
          : 'Sorteie um número da rifa'}
      </p>

      <div className="admin-draw__modes" role="group" aria-label="Escopo do sorteio">
        <button
          type="button"
          className={`admin-draw__mode${mode === 'sold' ? ' is-active' : ''}`}
          disabled={spinning}
          onClick={() => changeMode('sold')}
        >
          Só vendidos
        </button>
        <button
          type="button"
          className={`admin-draw__mode${mode === 'all' ? ' is-active' : ''}`}
          disabled={spinning}
          onClick={() => changeMode('all')}
        >
          Todos os números
        </button>
      </div>

      {error ? <p className="hub-error">{error}</p> : null}
      {loading ? <p className="hub-empty">Carregando…</p> : null}

      {emptySold ? <p className="hub-empty">Ainda não há números vendidos para sortear.</p> : null}
      {emptyAll ? <p className="hub-empty">Rifa sem quantidade de números configurada.</p> : null}

      {canDraw ? (
        <>
          <div className={`admin-draw__reel${spinning ? ' is-spinning' : ''}${winner ? ' is-done' : ''}`}>
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
                ? 'Sorteando…'
                : mode === 'sold'
                  ? 'Sorteio entre os números já comprados'
                  : 'Sorteio entre todos os números da rifa'}
            </p>
          )}

          <button
            type="button"
            className="desafio__cta admin-draw__cta"
            disabled={spinning}
            onClick={runDraw}
          >
            {spinning ? 'Sorteando…' : winner ? 'Sortear de novo' : 'Sortear'}
          </button>
        </>
      ) : null}
    </div>
  );
}
