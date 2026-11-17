import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearGuestName, getGuestName } from '../guest.js';
import { PlayProvider, usePlay } from '../PlayContext.jsx';

function IconQuiz() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      <circle cx="12" cy="12" r="5.7" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconDesafios() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 6.5h2.2l.7-1.3h4.2L14.8 6.5H17a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Zm5 10.1A3.6 3.6 0 1 0 12 9.4a3.6 3.6 0 0 0 0 7.2Z"
      />
    </svg>
  );
}

function IconSelo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.4 4.8h11.2A1.6 1.6 0 0 1 19.2 6.4v8.3l-7.2 4.5-7.2-4.5V6.4A1.6 1.6 0 0 1 6.4 4.8Zm5.6 3.2a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z"
      />
    </svg>
  );
}

function IconRanking() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.2 9.2h2.6v10.1H7.2zm3.6-4.4h2.4v14.5h-2.4zm3.6 7.1h2.6v7.4h-2.6zM8.2 4.8 12 6.6l3.8-1.8-.7 3.1 2.3 2.1-3.2.3L12 13 10.8 9.5l-3.2-.3 2.3-2.1z"
      />
    </svg>
  );
}

function IconGaleria() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5.4 5.5h13.2A1.8 1.8 0 0 1 20.4 7.3v9.4a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8V7.3a1.8 1.8 0 0 1 1.8-1.8Zm2.3 3.1a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6ZM6.2 16.4l3.4-4.2 2.4 2.9 2.5-3.1 3.3 4.4H6.2Z"
      />
    </svg>
  );
}

function IconSorteio() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.2 4.8h9.6A2.4 2.4 0 0 1 19.2 7.2v9.6a2.4 2.4 0 0 1-2.4 2.4H7.2a2.4 2.4 0 0 1-2.4-2.4V7.2A2.4 2.4 0 0 1 7.2 4.8Zm1.2 3.6v2.4h2.4V8.4H8.4Zm4.8 0v2.4h2.4V8.4h-2.4ZM8.4 13.2v2.4h2.4v-2.4H8.4Zm4.8 0v2.4h2.4v-2.4h-2.4Z"
      />
    </svg>
  );
}

const TABS = [
  { to: '/quiz', label: 'Quiz', icon: IconQuiz },
  { to: '/desafios', label: 'Desafios', icon: IconDesafios },
  { to: '/selo', label: 'Selo', icon: IconSelo },
  { to: '/ranking', label: 'Ranking', icon: IconRanking },
  { to: '/galeria', label: 'Galeria', icon: IconGaleria },
  { to: '/sorteio', label: 'Sorteio', icon: IconSorteio },
];

function ShellFrame() {
  const navigate = useNavigate();
  const location = useLocation();
  const { guestName, scores } = usePlay();
  const telao = location.pathname === '/galeria/telao';

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
    <div className={`play${telao ? ' is-telao' : ''}`}>
      <header className="play-top">
        <button type="button" className="play-top__brand" onClick={() => navigate('/quiz')}>
          <span className="play-top__names">Dani &amp; Carine</span>
          <span className="play-top__hello">Olá, {guestName} 💕</span>
        </button>
        <div className="play-top__right">
          <p className="play-top__pts">{scores.points} pts</p>
          <button type="button" className="play-top__sair" onClick={leave}>
            sair
          </button>
        </div>
      </header>

      <main className="play-main">
        <Outlet />
      </main>

      <nav className="play-tabs" aria-label="Seções do jogo">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `play-tab${isActive ? ' is-active' : ''}`}>
              <Icon />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export default function PlayShell() {
  const guest = getGuestName();
  if (!guest) return <Navigate to="/" replace />;

  return (
    <PlayProvider guestName={guest}>
      <ShellFrame />
    </PlayProvider>
  );
}
