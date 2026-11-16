import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Welcome from './pages/Welcome.jsx';
import Splash from './pages/Splash.jsx';
import PlayShell from './pages/PlayShell.jsx';
import Quiz from './pages/Quiz.jsx';
import Desafios from './pages/Desafios.jsx';
import Selo from './pages/Selo.jsx';
import Ranking from './pages/Ranking.jsx';
import Galeria from './pages/Galeria.jsx';
import Telao from './pages/Telao.jsx';
import AdminGate from './pages/AdminGate.jsx';
import AdminQuiz from './pages/AdminQuiz.jsx';
import AdminGaleria from './pages/AdminGaleria.jsx';
import { isGamesAdminPath } from './admin-auth.js';
import { getGuestName } from './guest.js';

const SPLASH_MS = 2600;
const SPLASH_KEY = 'casebem_desafio_splash_done';

function useEntrySplash() {
  const { pathname } = useLocation();
  const [showSplash, setShowSplash] = useState(() => {
    if (isGamesAdminPath(pathname)) return false;
    if (getGuestName()) return false;
    try {
      return sessionStorage.getItem(SPLASH_KEY) !== '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!showSplash) return undefined;
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SPLASH_KEY, '1');
      } catch {
        /* ignore */
      }
      setShowSplash(false);
    }, SPLASH_MS);
    return () => window.clearTimeout(t);
  }, [showSplash]);

  if (isGamesAdminPath(pathname)) return false;
  return showSplash;
}

export default function App() {
  const showSplash = useEntrySplash();

  if (showSplash) return <Splash />;

  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/admin" element={<AdminGate />}>
        <Route path="quiz" element={<AdminQuiz />} />
        <Route path="galeria" element={<AdminGaleria />} />
      </Route>
      <Route element={<PlayShell />}>
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/desafios" element={<Desafios />} />
        <Route path="/selo" element={<Selo />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/galeria" element={<Galeria />} />
        <Route path="/galeria/telao" element={<Telao />} />
      </Route>
      <Route path="/home" element={<Navigate to="/quiz" replace />} />
      <Route path="/missoes" element={<Navigate to="/quiz" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
