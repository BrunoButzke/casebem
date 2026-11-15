import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginRequest } from '../lib/session-api.mjs';
import './admin/hub.css';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    setBusy(true);
    try {
      const res = await loginRequest({ email: email.trim().toLowerCase(), password });
      if (res.ok) {
        navigate('/admin', { replace: true });
        return;
      }
      setError('E-mail ou senha inválidos.');
    } catch {
      setError('Não foi possível entrar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hub hub--auth">
      <div className="hub__shell hub__shell--narrow">
        <p className="hub__brand">
          Case<em>Bem</em>
        </p>
        <p className="hub__eyebrow">Acesso</p>
        <h1 className="hub__title">Entrar</h1>
        <p className="hub__lead">Use o e-mail e a senha da conta CaseBem.</p>

        <form className="hub-form" onSubmit={onSubmit}>
          <label className="hub-field">
            <span>E-mail</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
            />
          </label>
          <label className="hub-field">
            <span>Senha</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </label>
          {error ? (
            <p className="hub-msg" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="hub-btn" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="hub__footer-link">
          Ainda não tem conta? <Link to="/#cadastro">Criar conta</Link>
        </p>
      </div>
    </div>
  );
}
