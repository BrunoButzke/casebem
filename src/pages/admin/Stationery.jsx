import { useEffect, useState } from 'react';
import {
  createStationeryAdmin,
  deleteStationeryAdmin,
  listStationeryAdmin,
} from '../../lib/admin-api.mjs';
import AdminSection from './AdminSection.jsx';

export default function Stationery() {
  const [templates, setTemplates] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await listStationeryAdmin();
    const data = await res.json().catch(() => ({}));
    setTemplates(Array.isArray(data.templates) ? data.templates : []);
  }

  useEffect(() => {
    refresh().catch(() => setError('Não foi possível carregar a papelaria.'));
  }, []);

  async function onAdd(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await createStationeryAdmin({ title: title.trim(), body: body.trim() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError('Não foi possível criar o modelo.');
        return;
      }
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
      setTitle('');
      setBody('');
    } catch {
      setError('Não foi possível criar o modelo.');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id) {
    const res = await deleteStationeryAdmin(id);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setTemplates(Array.isArray(data.templates) ? data.templates : []);
  }

  return (
    <AdminSection
      eyebrow="Papelaria"
      title="Modelos de WhatsApp"
      lead="Textos prontos para convite e recados. Não aparecem no site público."
    >
      {error ? (
        <p className="hub-msg" role="alert">
          {error}
        </p>
      ) : null}
      {templates.length === 0 ? (
        <p className="hub-empty">Nenhum modelo ainda.</p>
      ) : (
        <ul className="hub-list">
          {templates.map((item) => (
            <li key={item.id}>
              <span>{item.title}</span>
              <button type="button" className="hub-top__logout" onClick={() => onRemove(item.id)}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="hub-form" onSubmit={onAdd}>
        <label className="hub-field">
          <span>Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
        </label>
        <label className="hub-field">
          <span>Texto</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={2} rows={4} />
        </label>
        <button type="submit" className="hub-btn" disabled={busy}>
          {busy ? 'Salvando…' : 'Adicionar'}
        </button>
      </form>
    </AdminSection>
  );
}
