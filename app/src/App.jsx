import { Navigate, Route, Routes } from 'react-router-dom';
import { isLoggedIn } from './auth.js';
import AppShell from './components/AppShell.jsx';
import AdminStub from './pages/AdminStub.jsx';
import DesafiosStub from './pages/DesafiosStub.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';

function RequireAuth({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="admin" element={<AdminStub />} />
        <Route path="desafios" element={<DesafiosStub />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
