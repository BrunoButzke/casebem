import { useEffect, useState } from 'react';
import { hideMessageAdmin, listMessagesAdmin } from '../../lib/admin-api.mjs';
import AdminSection from './AdminSection.jsx';

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');

  async function refresh() {
    const res = await listMessagesAdmin();
    const body = await res.json().catch(() => ({}));
    setMessages(Array.isArray(body.messages) ? body.messages : []);
  }

  useEffect(() => {
    refresh().catch(() => setError('Não foi possível carregar o mural.'));
  }, []);

  async function onHide(id) {
    const res = await hideMessageAdmin(id, true);
    if (res.ok) refresh().catch(() => {});
  }

  return (
    <AdminSection
      eyebrow="Mural"
      title="Recados dos convidados"
      lead="Os recados chegam pelo site. Aqui você só acompanha e oculta o que não quiser publicar."
    >
      {error ? (
        <p className="hub-msg" role="alert">
          {error}
        </p>
      ) : null}
      {messages.length === 0 ? (
        <p className="hub-empty">Nenhum recado ainda.</p>
      ) : (
        <ul className="hub-list">
          {messages.map((item) => (
            <li key={item.id}>
              <span>
                <strong>{item.guestName}</strong>
                <span className="hub-list__meta"> — {item.message}</span>
              </span>
              {item.hidden ? (
                <span className="hub-list__meta">Oculto</span>
              ) : (
                <button type="button" className="hub-top__logout" onClick={() => onHide(item.id)}>
                  Ocultar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
