import { useEffect, useMemo, useState } from 'react';
import { usePlay } from '../PlayContext.jsx';
import { loyaltyCardCopy, loyaltyCardStyle } from '../loyalty-card.js';

const CONFETTI_COLORS = ['#ffffff', '#ffe4ec', '#ffb7c5', '#f472b6', '#ec4899', '#db2777', '#fdf2f8'];

function ConfettiBurst({ active }) {
  const pieces = useMemo(() => {
    if (!active) return [];
    return Array.from({ length: 36 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 36 + (i % 3) * 0.2;
      const dist = 70 + (i % 5) * 28;
      return {
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        dx: `${Math.cos(angle) * dist}px`,
        dy: `${Math.sin(angle) * dist - 40}px`,
        rot: `${(i % 2 === 0 ? 1 : -1) * (220 + (i % 7) * 40)}deg`,
        delay: `${(i % 8) * 0.03}s`,
        round: i % 3 === 0,
      };
    });
  }, [active]);

  if (!pieces.length) return null;
  return (
    <div className="loyalty-card__confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`loyalty-card__confetti-piece${p.round ? ' is-round' : ''}`}
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

function LoyaltyCard({ card, guestName, scores }) {
  const copy = loyaltyCardCopy(card, scores);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (!copy.complete) {
      setBurst(false);
      return undefined;
    }
    const key = `casebem_loyalty_confetti:${card?.id || copy.title}`;
    let already = false;
    try {
      already = sessionStorage.getItem(key) === '1';
    } catch {
      /* ignore */
    }
    if (already) {
      setBurst(true);
      return undefined;
    }
    setBurst(true);
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
    return undefined;
  }, [card?.id, copy.complete, copy.title]);

  return (
    <article
      className={`loyalty-card${copy.complete ? ' is-complete' : ''}`}
      style={copy.complete ? undefined : loyaltyCardStyle(card)}
      aria-label={copy.complete ? 'Missão completa' : undefined}
    >
      {copy.complete ? (
        <>
          <ConfettiBurst active={burst} />
          <p className="loyalty-card__complete-label">Missão completa</p>
          <p className="loyalty-card__name">{guestName}</p>
          <p className="loyalty-card__complete-reward">Você liberou o drink secreto, avise o garçom!</p>
        </>
      ) : (
        <>
          <p className="loyalty-card__title">{copy.title}</p>
          <p className="loyalty-card__name">{guestName}</p>
          <div className="loyalty-card__slots">
            {Array.from({ length: copy.slots }, (_, i) => {
              const on = i < copy.stamps;
              return (
                <span key={i} className={`loyalty-card__slot${on ? ' is-filled' : ''}`}>
                  {on ? '♥♥♥' : i + 1}
                </span>
              );
            })}
          </div>
          <div className="loyalty-card__banner">
            <strong>{copy.bannerStrong}</strong>
            {copy.bannerHint ? <span>{copy.bannerHint}</span> : null}
          </div>
          {copy.footer ? <p className="loyalty-card__footer">{copy.footer}</p> : null}
        </>
      )}
    </article>
  );
}

export default function Selo() {
  const { catalog, guestName, scores } = usePlay();
  const cards = catalog?.stampCards || [];
  const allComplete =
    cards.length > 0 && cards.every((card) => loyaltyCardCopy(card, scores).complete);

  return (
    <div className="play-page">
      <h1 className="play-script">Selo</h1>
      {!allComplete ? (
        <p className="play-sub">
          {scores.stamps} selos · {scores.points} pts · complete o cartão e ganhe o brinde
        </p>
      ) : null}
      {cards.map((card) => (
        <LoyaltyCard key={card.id} card={card} guestName={guestName} scores={scores} />
      ))}
      {!cards.length && catalog ? <p className="hub-empty">Nenhum cartão ainda.</p> : null}
    </div>
  );
}
