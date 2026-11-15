import { useState } from 'react';
import { upgradePlanRequest } from '../../lib/session-api.mjs';
import AdminSection from './AdminSection.jsx';

export default function UpgradeCta({ title, onUpgraded }) {
  const [error, setError] = useState('');
  const [busyPlan, setBusyPlan] = useState('');

  async function onUpgrade(plan) {
    setError('');
    setBusyPlan(plan);
    try {
      const res = await upgradePlanRequest(plan);
      if (!res.ok) {
        setError('Não foi possível atualizar o plano agora.');
        return;
      }
      onUpgraded?.();
    } catch {
      setError('Não foi possível atualizar o plano agora.');
    } finally {
      setBusyPlan('');
    }
  }

  return (
    <AdminSection
      eyebrow="Plano"
      title={title}
      lead="Disponível no Pro e no VIP. O pagamento fica em breve; o painel continua liberado."
    >
      {error ? (
        <p className="hub-msg" role="alert">
          {error}
        </p>
      ) : null}
      <div className="hub-upgrade__actions">
        <button type="button" className="hub-btn" disabled={Boolean(busyPlan)} onClick={() => onUpgrade('pro')}>
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
      </div>
    </AdminSection>
  );
}
