import { Navigate, useNavigate } from 'react-router-dom';
import { clearGuestName, getGuestName } from '../guest.js';

export default function MissoesSoon() {
  const navigate = useNavigate();
  const guest = getGuestName();

  if (!guest) return <Navigate to="/" replace />;

  function leave() {
    clearGuestName();
    try {
      sessionStorage.removeItem('casebem_desafio_splash_done');
    } catch {
      /* ignore */
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="desafio">
      <div className="desafio__sparkles" aria-hidden="true" />
      <div className="desafio__petals" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="desafio__petal"
            style={{
              left: `${(i * 9 + 4) % 100}%`,
              animationDelay: `${(i * 0.6).toFixed(1)}s`,
              animationDuration: `${10 + (i % 5)}s`,
              fontSize: `${11 + (i % 6)}px`,
              ['--drift']: `${i % 2 === 0 ? -36 - i * 2 : 36 + i * 2}px`,
            }}
          >
            {i % 3 === 0 ? '♥' : '❀'}
          </span>
        ))}
      </div>

      <header className="desafio__hero desafio__hero--compact">
        <div className="desafio__wreath-wrap desafio__wreath-wrap--hero">
          <img
            className="desafio__wreath"
            src="/images/desafio/wreath.png"
            alt=""
            width="512"
            height="512"
            decoding="async"
          />
          <div className="desafio__wreath-copy">
            <p className="desafio__kicker">O casamento de</p>
            <h1 className="desafio__names desafio__names--sm">
              <span>Dani</span>
              <span className="desafio__amp">&amp;</span>
              <span>Carine</span>
            </h1>
          </div>
        </div>
      </header>

      <section className="desafio__card">
        <p className="desafio__hello">Oi, {guest}!</p>
        <h2>Missões em breve</h2>
        <p className="desafio__lead">
          Estamos preparando os desafios, carimbos e o ranking da festa. Volte em breve para
          jogar ✨
        </p>
        <button type="button" className="desafio__cta desafio__cta--ghost" onClick={leave}>
          Trocar nome
        </button>
      </section>
    </div>
  );
}