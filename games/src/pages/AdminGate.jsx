import { Navigate, useLocation } from 'react-router-dom';
import { isGamesAdminLoggedIn } from '../admin-auth.js';
import AdminLogin from './AdminLogin.jsx';
import AdminShell from './AdminShell.jsx';

export default function AdminGate() {
  const location = useLocation();
  if (!isGamesAdminLoggedIn()) {
    if (location.pathname !== '/admin') return <Navigate to="/admin" replace />;
    return <AdminLogin />;
  }
  if (location.pathname === '/admin') return <Navigate to="/admin/quiz" replace />;
  return <AdminShell />;
}
