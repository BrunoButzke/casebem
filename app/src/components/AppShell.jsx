import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';

export default function AppShell() {
  return (
    <div className="shell">
      <main className="shell__main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
