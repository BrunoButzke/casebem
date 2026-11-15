import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { meRequest, parseMe } from './lib/session-api.mjs';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import AdminHub from './pages/AdminHub.jsx';
import MinhaPagina from './pages/admin/MinhaPagina.jsx';
import Guests from './pages/admin/Guests.jsx';
import Gifts from './pages/admin/Gifts.jsx';
import Stationery from './pages/admin/Stationery.jsx';
import Messages from './pages/admin/Messages.jsx';
import Entertainment from './pages/admin/Entertainment.jsx';
import Album from './pages/admin/Album.jsx';

const CoupleSite = lazy(() => import('./pages/casal/CoupleSite.jsx'));
const CoupleGames = lazy(() => import('./pages/casal/CoupleGames.jsx'));

function RequireAuth({ children }) {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    meRequest()
      .then(parseMe)
      .then((account) => setStatus(account ? 'in' : 'out'))
      .catch(() => setStatus('out'));
  }, []);

  if (status === 'loading') return <p>Carregando…</p>;
  if (status === 'out') return <Navigate to="/entrar" replace />;
  return children;
}

function GuestOnly({ children }) {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    meRequest()
      .then(parseMe)
      .then((account) => setStatus(account ? 'in' : 'out'))
      .catch(() => setStatus('out'));
  }, []);

  if (status === 'loading') return <p>Carregando…</p>;
  if (status === 'in') return <Navigate to="/admin" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/casal/:slug/game/*"
        element={
          <Suspense fallback={<p>Carregando…</p>}>
            <CoupleGames />
          </Suspense>
        }
      />
      <Route
        path="/casal/:slug"
        element={
          <Suspense fallback={<p>Carregando…</p>}>
            <CoupleSite />
          </Suspense>
        }
      />
      <Route
        path="/entrar"
        element={
          <GuestOnly>
            <Login />
          </GuestOnly>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminHub />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/minha-pagina"
        element={
          <RequireAuth>
            <MinhaPagina />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/convidados"
        element={
          <RequireAuth>
            <Guests />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/presentes"
        element={
          <RequireAuth>
            <Gifts />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/papelaria"
        element={
          <RequireAuth>
            <Stationery />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/mural"
        element={
          <RequireAuth>
            <Messages />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/entretenimento"
        element={
          <RequireAuth>
            <Entertainment />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/album"
        element={
          <RequireAuth>
            <Album />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
