import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Início', end: true },
  { to: '/admin', label: 'Admin' },
  { to: '/desafios', label: 'Desafios' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Principal">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            isActive ? 'bottom-nav__link is-active' : 'bottom-nav__link'
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
