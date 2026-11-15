import { Link } from 'react-router-dom';
import './hub.css';

export default function ComingSoon() {
  return (
    <div className="hub">
      <div className="hub__shell">
        <p className="hub__eyebrow">Minha página</p>
        <h1 className="hub__title">Em breve</h1>
        <p className="hub__lead">
          A edição da página pública do casal chega em breve. Ainda não há slug para
          publicar.
        </p>
        <Link className="hub__back" to="/admin">
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
