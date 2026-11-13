import { Link } from 'react-router-dom';
import { logout } from '../auth.js';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <p className="eyebrow">CaseBem</p>
          <h1>Olá</h1>
          <p className="muted">Escolha por onde começar</p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onLogout}>
          Sair
        </button>
      </header>

      <div className="cards">
        <Link className="card-link" to="/admin">
          <h2>Admin</h2>
          <p>Lista, grupos, presentes e mural do casamento</p>
        </Link>
        <Link className="card-link" to="/desafios">
          <h2>Desafios</h2>
          <p>Entretenimento do grande dia — em construção</p>
        </Link>
      </div>
    </div>
  );
}
