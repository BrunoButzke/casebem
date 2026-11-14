import { usePlay } from '../PlayContext.jsx';
import { loyaltyCardCopy, loyaltyCardStyle } from '../loyalty-card.js';

function LoyaltyCard({ card, guestName, scores }) {
  const copy = loyaltyCardCopy(card, scores);

  return (
    <article className="loyalty-card" style={loyaltyCardStyle(card)}>
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
  const { catalog, guestName, scores } = usePlay();
  const cards = catalog?.stampCards || [];

  return (
    <div className="play-page">
      <h1 className="play-script">Selo</h1>
      <p className="play-sub">
        {scores.stamps} selos · {scores.points} pts · complete o cartão e ganhe o brinde
      </p>
      {cards.map((card) => (
        <LoyaltyCard key={card.id} card={card} guestName={guestName} scores={scores} />
      ))}
      {!cards.length && catalog ? <p className="hub-empty">Nenhum cartão ainda.</p> : null}
    </div>
  );
}
