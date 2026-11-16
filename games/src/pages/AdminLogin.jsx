import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginGamesAdmin } from '../admin-api.js';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await loginGamesAdmin(user, pass);
      navigate('/admin/quiz', { replace: true });
    } catch (err) {
      setError(err.message || 'Login ou senha não conferem.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="desafio">
      <div className="desafio__sparkles" aria-hidden="true" />
      <header className="desafio__hero">
        <div className="desafio__wreath-wrap desafio__wreath-wrap--hero">
          <img
            className="desafio__wreath desafio__wreath--spin"
            src="/images/desafio/wreath.png"
            alt=""
            width="512"
            height="512"
            decoding="async"
          />
          <div className="desafio__wreath-copy">
            <h1 className="desafio__names">
              <span>Dani</span>
              <span className="desafio__amp">&amp;</span>
              <span>Carine</span>
            </h1>
          </div>
        </div>
      </header>

      <form className="desafio__card" onSubmit={onSubmit}>
        <h2>Painel dos noivos</h2>
        <p className="desafio__lead">Marquem o gabarito do quiz e cuidem da galeria.</p>
        <label className="desafio__field">
          <span className="sr-only">Usuário</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            placeholder="Usuário"
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
        </label>
        <label className="desafio__field">
          <span className="sr-only">Senha</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Senha"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </label>
        {error ? <p className="hub-error">{error}</p> : null}
        <button type="submit" className="desafio__cta" disabled={pending || !user.trim() || !pass}>
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
