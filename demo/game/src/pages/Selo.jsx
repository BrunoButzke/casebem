import { useEffect, useMemo, useState } from 'react';
import { useDemo } from '../DemoContext.jsx';

const CONFETTI_COLORS = ['#ffffff', '#ffe4ec', '#ffb7c5', '#f472b6', '#ec4899', '#db2777', '#fdf2f8'];

function loyaltyCopy(card, scores) {
  const slots = Math.max(1, Math.min(12, Number(card?.stampsRequired) || 5));
  const filled = Math.min(slots, Number(scores?.stamps) || 0);
  const remaining = Math.max(0, slots - filled);
  const complete = filled >= slots;
  return {
    slots,
    stamps: filled,
    complete,
    title: card?.name || '',
    bannerStrong: String(card?.rewardText || '').trim(),
    bannerHint: String(card?.barHint || '').trim(),
    footer: complete ? '' : String(card?.footerTemplate || '').replace('{n}', String(remaining)),
  };
}

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
  const copy = loyaltyCopy(card, scores);
  const [burst, setBurst] = useState(false);
  const style = {
    ...(card.cardBg ? { '--lc-bg': card.cardBg } : {}),
    ...(card.cardAccent ? { '--lc-accent': card.cardAccent } : {}),
    ...(card.cardAccentSoft ? { '--lc-accent-soft': card.cardAccentSoft } : {}),
    ...(card.cardText ? { '--lc-text': card.cardText } : {}),
    ...(card.cardBorder ? { '--lc-border': card.cardBorder } : {}),
  };

  useEffect(() => {
    if (!copy.complete) {
      setBurst(false);
      return undefined;
    }
    setBurst(true);
    return undefined;
  }, [copy.complete]);

  return (
    <article
      className={`loyalty-card${copy.complete ? ' is-complete' : ''}`}
      style={copy.complete ? undefined : style}
      aria-label={copy.complete ? 'Missão completa' : undefined}
    >
      {copy.complete ? (
        <>
          <ConfettiBurst active={burst} />
          <p className="loyalty-card__complete-label">Missão completa</p>
          <p className="loyalty-card__name">{guestName}</p>
          {copy.bannerStrong ? <p className="loyalty-card__complete-reward">{copy.bannerStrong}</p> : null}
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
  const { catalog, guestName, scores } = useDemo();
  const cards = catalog.stampCards;

  return (
    <div className="play-page">
      <h1 className="play-script">Selo</h1>
      <p className="play-sub">
        {scores.stamps} selos · {scores.points} pts · complete o cartão e ganhe o brinde
      </p>
      {cards.map((card) => (
        <LoyaltyCard key={card.id} card={card} guestName={guestName} scores={scores} />
      ))}
    </div>
  );
}
