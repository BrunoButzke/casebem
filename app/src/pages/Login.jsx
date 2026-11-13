import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isLoggedIn, tryLogin } from '../auth.js';

export default function Login() {
  const navigate = useNavigate();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  if (isLoggedIn()) return <Navigate to="/" replace />;

  function onSubmit(e) {
    e.preventDefault();
    if (!tryLogin(user.trim(), pass)) {
      setError('Usuário ou senha inválidos.');
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="login">
      <header className="login__brand">
        Case<em>Bem</em>
      </header>
      <form className="login__card" onSubmit={onSubmit}>
        <p className="eyebrow">Acesso</p>
        <h1>Entrar</h1>
        <p className="muted">Admin, desafios e mais — mobile first</p>

        <label className="field">
          <span>Usuário</span>
          <input
            autoComplete="username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="login"
          />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="senha"
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" className="btn btn--block">
          Entrar
        </button>
        <p className="hint">
          Temporário: <code>Dani</code> / <code>Carine</code>
        </p>
      </form>
    </div>
  );
}
