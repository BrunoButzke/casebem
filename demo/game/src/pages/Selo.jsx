import { useDemo } from '../DemoContext.jsx';

function loyaltyCopy(card, scores) {
  const slots = Math.max(1, Math.min(12, Number(card?.stampsRequired) || 5));
  const filled = Math.min(slots, Number(scores?.stamps) || 0);
  const remaining = Math.max(0, slots - filled);
  return {
    slots,
    stamps: filled,
    title: card?.name || '',
    bannerStrong: String(card?.rewardText || '').trim(),
    bannerHint: String(card?.barHint || '').trim(),
    footer: String(card?.footerTemplate || '').replace('{n}', String(remaining)),
  };
}

function LoyaltyCard({ card, guestName, scores }) {
  const copy = loyaltyCopy(card, scores);
  const style = {
    ...(card.cardBg ? { '--lc-bg': card.cardBg } : {}),
    ...(card.cardAccent ? { '--lc-accent': card.cardAccent } : {}),
    ...(card.cardAccentSoft ? { '--lc-accent-soft': card.cardAccentSoft } : {}),
    ...(card.cardText ? { '--lc-text': card.cardText } : {}),
    ...(card.cardBorder ? { '--lc-border': card.cardBorder } : {}),
  };

  return (
    <article className="loyalty-card" style={style}>
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
