import { useEffect, useState } from 'react';
import { addGuestsAdmin, listGuestsAdmin, removeGuestAdmin } from '../../lib/admin-api.mjs';
import AdminSection from './AdminSection.jsx';

export default function Guests() {
  const [guests, setGuests] = useState([]);
  const [names, setNames] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await listGuestsAdmin();
    const body = await res.json().catch(() => ({}));
    setGuests(Array.isArray(body.guests) ? body.guests : []);
  }

  useEffect(() => {
    refresh().catch(() => setError('Não foi possível carregar a lista.'));
  }, []);

  async function onAdd(event) {
    event.preventDefault();
    const list = names
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!list.length) return;
    setBusy(true);
    setError('');
    try {
      const res = await addGuestsAdmin(list);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError('Não foi possível adicionar os nomes.');
        return;
      }
      setGuests(Array.isArray(body.guests) ? body.guests : []);
      setNames('');
    } catch {
      setError('Não foi possível adicionar os nomes.');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id) {
    const res = await removeGuestAdmin(id);
    const body = await res.json().catch(() => ({}));
    if (res.ok) setGuests(Array.isArray(body.guests) ? body.guests : []);
  }

  return (
    <AdminSection
      eyebrow="Convidados"
      title="Lista de convidados"
      lead="Adicione nomes da sua conta. A lista começa vazia até você incluir alguém."
    >
      {error ? (
        <p className="hub-msg" role="alert">
          {error}
        </p>
      ) : null}
      {guests.length === 0 ? (
        <p className="hub-empty">Nenhum convidado ainda.</p>
      ) : (
        <ul className="hub-list">
          {guests.map((guest) => (
            <li key={guest.id}>
              <span>{guest.displayName}</span>
              <button type="button" className="hub-top__logout" onClick={() => onRemove(guest.id)}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="hub-form" onSubmit={onAdd}>
        <label className="hub-field">
          <span>Nomes</span>
          <textarea
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder="Um nome por linha, ou separados por vírgula"
            rows={3}
          />
        </label>
        <button type="submit" className="hub-btn" disabled={busy}>
          {busy ? 'Salvando…' : 'Adicionar'}
        </button>
      </form>
    </AdminSection>
  );
}
