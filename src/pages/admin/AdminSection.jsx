import { Link } from 'react-router-dom';
import './hub.css';

export default function AdminSection({ eyebrow, title, lead, children }) {
  return (
    <div className="hub">
      <div className="hub__shell">
        <p className="hub__eyebrow">{eyebrow}</p>
        <h1 className="hub__title">{title}</h1>
        {lead ? <p className="hub__lead">{lead}</p> : null}
        {children}
        <Link className="hub__back" to="/admin">
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
