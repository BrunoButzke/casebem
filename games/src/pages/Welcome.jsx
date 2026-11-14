import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getGuestName, setGuestName } from '../guest.js';

export default function Welcome() {
  const navigate = useNavigate();
  const [name, setName] = useState('');

  if (getGuestName()) return <Navigate to="/missoes" replace />;

  function onSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setGuestName(trimmed);
    navigate('/missoes', { replace: true });
  }

  const canEnter = name.trim().length >= 2;

  return (
    <div className="desafio">
      <div className="desafio__sparkles" aria-hidden="true" />
      <div className="desafio__petals" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            className="desafio__petal"
            style={{
              left: `${(i * 7 + 3) % 100}%`,
              animationDelay: `${(i * 0.55).toFixed(1)}s`,
              animationDuration: `${9 + (i % 6)}s`,
              fontSize: `${10 + (i % 8)}px`,
              ['--drift']: `${i % 2 === 0 ? -40 - i * 3 : 40 + i * 3}px`,
            }}
          >
            {i % 3 === 0 ? '♥' : '❀'}
          </span>
        ))}
      </div>

      <header className="desafio__hero">
        <div className="desafio__wreath-wrap desafio__wreath-wrap--hero">
          <img
            className="desafio__wreath desafio__wreath--spin"
            src="/images/desafio/wreath.png"
            alt=""
            width="512"
            height="512"
            decoding="async"
          />
          <div className="desafio__wreath-copy">
            <span className="desafio__ring" aria-hidden="true">
              💍
            </span>
            <p className="desafio__kicker">O casamento de</p>
            <h1 className="desafio__names">
              <span>Dani</span>
              <span className="desafio__amp">&amp;</span>
              <span>Carine</span>
            </h1>
          </div>
        </div>
      </header>

      <form className="desafio__card" onSubmit={onSubmit}>
        <h2>Bem-vindo(a) à nossa festa!</h2>
        <p className="desafio__lead">
          Complete as missões, junte carimbos e ganhe uma bebida especial ✨
        </p>
        <label className="desafio__field">
          <span className="sr-only">Seu nome</span>
          <input
            type="text"
            name="guestName"
            autoComplete="name"
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        </label>
        <button type="submit" className="desafio__cta" disabled={!canEnter}>
          Entrar na festa 💕
        </button>
      </form>
    </div>
  );
}
