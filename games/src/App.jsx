import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Welcome from './pages/Welcome.jsx';
import MissoesSoon from './pages/MissoesSoon.jsx';
import Splash from './pages/Splash.jsx';
import { getGuestName } from './guest.js';

const SPLASH_MS = 2600;
const SPLASH_KEY = 'casebem_desafio_splash_done';

function useEntrySplash() {
  const [showSplash, setShowSplash] = useState(() => {
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

  return showSplash;
}

export default function App() {
  const showSplash = useEntrySplash();

  if (showSplash) return <Splash />;

  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/missoes" element={<MissoesSoon />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
