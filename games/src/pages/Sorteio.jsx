import { useEffect, useMemo, useState } from 'react';
import { fetchActiveRaffle } from '../raffle-api.js';

function formatPrice(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function Sorteio() {
  const [raffle, setRaffle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [showSoon, setShowSoon] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const next = await fetchActiveRaffle();
        if (!cancelled) {
          setRaffle(next);
          setError('');
          setSelected(new Set());
        }
      } catch (err) {
        if (!cancelled) {
          setRaffle(null);
          setError(err.message || 'Não deu para carregar o sorteio.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const available = raffle?.availableNumbers || [];
  const sold = raffle?.soldNumbers || [];
  const total = useMemo(
    () => selected.size * (Number(raffle?.priceCents) || 0),
    [selected, raffle?.priceCents]
  );

  function toggleNumber(n) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="play-page">
        <h1 className="sorteio-title">Sorteio</h1>
        <p className="play-sub">Carregando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="play-page">
        <h1 className="sorteio-title">Sorteio</h1>
        <p className="hub-empty" role="status">
          {error}
        </p>
      </div>
    );
  }

  if (!raffle) {
    return (
      <div className="play-page">
        <h1 className="sorteio-title">Sorteio</h1>
        <p className="hub-empty" role="status">
          Nenhum sorteio ativo no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="play-page sorteio-page">
      <h1 className="sorteio-title">{raffle.name}</h1>
      <p className="play-sub">Escolha seus números · {formatPrice(raffle.priceCents)} cada</p>

      {raffle.imageUrl ? (
        <div className="sorteio-photo">
          <img src={raffle.imageUrl} alt="" decoding="async" />
        </div>
      ) : null}

      <section className="sorteio-section" aria-labelledby="sorteio-disponiveis">
        <h2 id="sorteio-disponiveis">Disponíveis</h2>
        <div className="sorteio-grid">
          {available.map((n) => {
            const on = selected.has(n);
            return (
              <button
                key={n}
                type="button"
                className={`sorteio-num${on ? ' is-selected' : ''}`}
                aria-pressed={on}
                onClick={() => toggleNumber(n)}
              >
                {n}
              </button>
            );
          })}
        </div>
        {!available.length ? <p className="hub-empty">Todos os números já foram vendidos.</p> : null}
      </section>

      <section className="sorteio-section" aria-labelledby="sorteio-comprados">
        <h2 id="sorteio-comprados">Comprados</h2>
        {sold.length ? (
          <div className="sorteio-grid">
            {sold.map((n) => (
              <span key={n} className="sorteio-num is-sold">
                {n}
              </span>
            ))}
          </div>
        ) : (
          <p className="hub-empty">Nenhum número comprado ainda.</p>
        )}
      </section>

      <div className="sorteio-checkout">
        <p className="sorteio-total">
          {selected.size
            ? `${selected.size} número(s) · ${formatPrice(total)}`
            : 'Selecione um ou mais números'}
        </p>
        <button
          type="button"
          className="desafio__cta"
          disabled={!selected.size}
          onClick={() => setShowSoon(true)}
        >
          Comprar
        </button>
      </div>

      {showSoon ? (
        <div className="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="sorteio-soon-title">
          <button
            type="button"
            className="quiz-modal__backdrop"
            aria-label="Fechar"
            onClick={() => setShowSoon(false)}
          />
          <div className="quiz-modal__panel">
            <p className="quiz-modal__kicker">Sorteio</p>
            <h2 id="sorteio-soon-title">Compras em Breve</h2>
            <p className="play-sub">Em breve você poderá pagar e garantir seus números por aqui.</p>
            <button type="button" className="desafio__cta" onClick={() => setShowSoon(false)}>
              Entendi
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
