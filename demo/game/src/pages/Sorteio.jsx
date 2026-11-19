import { useMemo, useState } from 'react';
import { MOCK_RAFFLE } from '../mock-data.js';

function formatPrice(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function Sorteio() {
  const raffle = MOCK_RAFFLE;
  const [selected, setSelected] = useState(() => new Set());
  const [notice, setNotice] = useState('');

  const myNumbers = raffle.myNumbers;
  const sold = new Set(raffle.soldNumbers);
  const total = selected.size * (Number(raffle.priceCents) || 0);

  function toggleNumber(n) {
    setNotice('');
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  function onBuy() {
    if (!selected.size) return;
    setNotice(
      `Demo: números ${[...selected].sort((a, b) => a - b).join(', ')} · ${formatPrice(total)}. Sem pagamento real.`
    );
  }

  const allNumbers = useMemo(
    () => Array.from({ length: raffle.maxNumber }, (_, i) => i + 1),
    [raffle.maxNumber]
  );

  return (
    <div className="play-page sorteio-page">
      <h1 className="sorteio-title">{raffle.name}</h1>
      <p className="play-sub">Escolha seus números · {formatPrice(raffle.priceCents)} cada · só demo</p>

      {raffle.imageUrl ? (
        <div className="sorteio-photo">
          <img src={raffle.imageUrl} alt="Prêmio do sorteio demo" decoding="async" />
        </div>
      ) : null}

      {myNumbers.length ? (
        <section className="sorteio-section" aria-labelledby="sorteio-meus">
          <h2 id="sorteio-meus">Meus números</h2>
          <div className="sorteio-grid">
            {myNumbers.map((n) => (
              <span key={n} className="sorteio-num is-mine">
                {n}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="sorteio-section" aria-labelledby="sorteio-mapa">
        <h2 id="sorteio-mapa">Mapa (vendidos em cinza)</h2>
        <div className="sorteio-grid">
          {allNumbers.map((n) => {
            if (sold.has(n)) {
              return (
                <span key={n} className="sorteio-num is-sold">
                  {n}
                </span>
              );
            }
            if (myNumbers.includes(n)) {
              return (
                <span key={n} className="sorteio-num is-mine">
                  {n}
                </span>
              );
            }
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
      </section>

      <div className="sorteio-checkout">
        <p className="sorteio-total">
          {selected.size
            ? `${selected.size} número(s) · ${formatPrice(total)}`
            : 'Selecione números para simular a compra'}
        </p>
        <button type="button" className="desafio__cta" disabled={!selected.size} onClick={onBuy}>
          Simular compra
        </button>
        {notice ? (
          <p className="hub-empty" role="status">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
