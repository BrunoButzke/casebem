import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { meRequest, parseMe } from './lib/session-api.mjs';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import AdminHub from './pages/AdminHub.jsx';
import ComingSoon from './pages/admin/ComingSoon.jsx';

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

function SectionPlaceholder() {
  return <p>Carregando…</p>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
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
            <ComingSoon />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/convidados"
        element={
          <RequireAuth>
            <SectionPlaceholder />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/presentes"
        element={
          <RequireAuth>
            <SectionPlaceholder />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/papelaria"
        element={
          <RequireAuth>
            <SectionPlaceholder />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/mural"
        element={
          <RequireAuth>
            <SectionPlaceholder />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/entretenimento"
        element={
          <RequireAuth>
            <SectionPlaceholder />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/album"
        element={
          <RequireAuth>
            <SectionPlaceholder />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
