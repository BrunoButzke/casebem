import { useEffect, useState } from 'react';
import { createGiftAdmin, deleteGiftAdmin, listGiftsAdmin } from '../../lib/admin-api.mjs';
import AdminSection from './AdminSection.jsx';

function reais(cents) {
  return ((Number(cents) || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function Gifts() {
  const [gifts, setGifts] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await listGiftsAdmin();
    const body = await res.json().catch(() => ({}));
    setGifts(Array.isArray(body.gifts) ? body.gifts : []);
  }

  useEffect(() => {
    refresh().catch(() => setError('Não foi possível carregar os presentes.'));
  }, []);

  async function onAdd(event) {
    event.preventDefault();
    const priceInCents = Math.round(Number(String(price).replace(',', '.')) * 100);
    setBusy(true);
    setError('');
    try {
      const res = await createGiftAdmin({
        name: name.trim(),
        description: description.trim() || 'Presente da lista',
        priceInCents,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError('Não foi possível criar o presente. Confira nome e valor.');
        return;
      }
      setGifts(Array.isArray(body.gifts) ? body.gifts : []);
      setName('');
      setDescription('');
      setPrice('');
    } catch {
      setError('Não foi possível criar o presente.');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id) {
    const res = await deleteGiftAdmin(id);
    const body = await res.json().catch(() => ({}));
    if (res.ok) setGifts(Array.isArray(body.gifts) ? body.gifts : []);
  }

  return (
    <AdminSection
      eyebrow="Presentes"
      title="Lista de presentes"
      lead="Cadastre itens da sua conta. Contas novas começam sem presentes."
    >
      {error ? (
        <p className="hub-msg" role="alert">
          {error}
        </p>
      ) : null}
      {gifts.length === 0 ? (
        <p className="hub-empty">Nenhum presente ainda.</p>
      ) : (
        <ul className="hub-list">
          {gifts.map((gift) => (
            <li key={gift.id}>
              <span>
                {gift.name}
                <span className="hub-list__meta"> · {reais(gift.priceInCents)}</span>
              </span>
              <button type="button" className="hub-top__logout" onClick={() => onRemove(gift.id)}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="hub-form" onSubmit={onAdd}>
        <label className="hub-field">
          <span>Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </label>
        <label className="hub-field">
          <span>Descrição</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="hub-field">
          <span>Valor (R$)</span>
          <input
            type="number"
            min="1"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="hub-btn" disabled={busy}>
          {busy ? 'Salvando…' : 'Adicionar'}
        </button>
      </form>
    </AdminSection>
  );
}
