import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { logoutGamesAdmin } from '../admin-auth.js';

function IconQuiz() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      <circle cx="12" cy="12" r="5.7" fill="none" stroke="currentColor" strokeWidth="1.2" />
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

const TABS = [
  { to: '/admin/quiz', label: 'Quiz', icon: IconQuiz },
  { to: '/admin/galeria', label: 'Galeria', icon: IconGaleria },
];

export default function AdminShell() {
  const navigate = useNavigate();

  function leave() {
    logoutGamesAdmin();
    navigate('/admin', { replace: true });
  }

  return (
    <div className="play">
      <header className="play-top">
        <button type="button" className="play-top__brand" onClick={() => navigate('/admin/quiz')}>
          <span className="play-top__names">Dani &amp; Carine</span>
          <span className="play-top__hello">Painel dos noivos</span>
        </button>
        <div className="play-top__right">
          <button type="button" className="play-top__sair" onClick={leave}>
            sair
          </button>
        </div>
      </header>

      <main className="play-main">
        <Outlet />
      </main>

      <nav className="play-tabs play-tabs--two" aria-label="Seções do painel">
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
