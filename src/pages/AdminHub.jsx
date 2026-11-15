import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logoutRequest, meRequest, parseMe, upgradePlanRequest } from '../lib/session-api.mjs';
import { hubTiles } from './admin/hub-tiles.mjs';
import './admin/hub.css';

const PLAN_LABEL = { basic: 'Básico', pro: 'Pro', vip: 'VIP' };

export default function AdminHub() {
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [upgradeFor, setUpgradeFor] = useState(null);
  const [upgradeError, setUpgradeError] = useState('');
  const [busyPlan, setBusyPlan] = useState('');

  useEffect(() => {
    let cancelled = false;
    meRequest()
      .then(parseMe)
      .then((session) => {
        if (cancelled) return;
        if (!session) {
          navigate('/entrar', { replace: true });
          return;
        }
        setAccount(session);
      })
      .catch(() => {
        if (!cancelled) navigate('/entrar', { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function onLogout() {
    await logoutRequest().catch(() => {});
    navigate('/entrar', { replace: true });
  }

  async function onUpgrade(plan) {
    setUpgradeError('');
    setBusyPlan(plan);
    try {
      const res = await upgradePlanRequest(plan);
      if (!res.ok) {
        setUpgradeError('Não foi possível atualizar o plano agora.');
        return;
      }
      const body = await res.json();
      if (body.account) setAccount(body.account);
      else {
        const me = await meRequest();
        if (me.ok) setAccount(await me.json());
      }
      setUpgradeFor(null);
    } catch {
      setUpgradeError('Não foi possível atualizar o plano agora.');
    } finally {
      setBusyPlan('');
    }
  }

  if (!account) return <p>Carregando…</p>;

  const tiles = hubTiles(account.plan);
  const planLabel = PLAN_LABEL[account.plan] || account.plan;

  return (
    <div className="hub">
      <div className="hub__shell">
        <header className="hub-top">
          <p className="hub__brand">
            Case<em>Bem</em>
          </p>
          <div className="hub-top__meta">
            <span className="hub-top__email">{account.email}</span>
            <span className="hub-plan-badge">{planLabel}</span>
            <button type="button" className="hub-top__logout" onClick={onLogout}>
              Sair
            </button>
          </div>
        </header>

        {account.planStatus === 'pending_payment' ? (
          <p className="hub-banner" role="status">
            Pagamento em breve
          </p>
        ) : null}

        <p className="hub__eyebrow">Painel</p>
        <h1 className="hub__title">Olá, vamos organizar o casamento</h1>
        <p className="hub__lead">Escolha uma área para continuar.</p>

        <div className="admin-hub">
          {tiles.map((tile) =>
            tile.needsUpgrade ? (
              <button
                key={tile.id}
                type="button"
                className="hub-tile"
                onClick={() => {
                  setUpgradeError('');
                  setUpgradeFor(tile);
                }}
              >
                <span className="hub-tile__title">{tile.title}</span>
                <span className="hub-tile__lead">Pro e VIP</span>
              </button>
            ) : (
              <Link key={tile.id} className="hub-tile" to={tile.to}>
                <span className="hub-tile__title">{tile.title}</span>
              </Link>
            )
          )}
        </div>

        {upgradeFor ? (
          <div className="hub-upgrade" role="dialog" aria-labelledby="hub-upgrade-title">
            <h2 id="hub-upgrade-title">Disponível no Pro e no VIP</h2>
            <p>
              {upgradeFor.title} entra nos planos Pro e VIP. O pagamento fica em breve; o
              painel continua liberado.
            </p>
            {upgradeError ? (
              <p className="hub-msg" role="alert">
                {upgradeError}
              </p>
            ) : null}
            <div className="hub-upgrade__actions">
              <button
                type="button"
                className="hub-btn"
                disabled={Boolean(busyPlan)}
                onClick={() => onUpgrade('pro')}
              >
                {busyPlan === 'pro' ? 'Atualizando…' : 'Quero o Pro'}
              </button>
              <button
                type="button"
                className="hub-btn hub-btn--ghost"
                disabled={Boolean(busyPlan)}
                onClick={() => onUpgrade('vip')}
              >
                {busyPlan === 'vip' ? 'Atualizando…' : 'Quero o VIP'}
              </button>
              <button type="button" className="hub-top__logout" onClick={() => setUpgradeFor(null)}>
                Fechar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
