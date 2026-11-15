import { useEffect, useState } from 'react';
import { fetchMessages, postMessage } from '../../lib/casal-api.mjs';

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

export default function MessagesSection({ slug }) {
  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [message, setMessage] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [nameError, setNameError] = useState('');
  const [messageError, setMessageError] = useState('');
  const [consentError, setConsentError] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMessages(slug)
      .then((data) => {
        if (cancelled) return;
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setNextCursor(data.nextCursor || null);
        if (data.ok === false) {
          setStatus({
            type: 'error',
            message: data.message || data.error || 'Não foi possível carregar as mensagens.',
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ type: 'error', message: 'Erro de conexão ao carregar as mensagens.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchMessages(slug, { cursor: nextCursor });
      const extra = Array.isArray(data.messages) ? data.messages : [];
      setMessages((prev) => [...prev, ...extra]);
      setNextCursor(data.nextCursor || null);
    } catch {
      setStatus({ type: 'error', message: 'Erro de conexão ao carregar mais mensagens.' });
    } finally {
      setLoadingMore(false);
    }
  }

  function clearErrors() {
    setNameError('');
    setMessageError('');
    setConsentError('');
  }

  async function onSubmit(event) {
    event.preventDefault();
    clearErrors();
    const name = guestName.trim();
    const text = message.trim();

    let invalid = false;
    if (name.length < 2) {
      setNameError('Nome deve ter pelo menos 2 caracteres.');
      invalid = true;
    }
    if (text.length < 3 || text.length > 250) {
      setMessageError('Mensagem deve ter entre 3 e 250 caracteres.');
      invalid = true;
    }
    if (!consentGiven) {
      setConsentError('Você deve concordar em compartilhar a mensagem.');
      invalid = true;
    }
    if (invalid) return;

    setBusy(true);
    setStatus(null);
    try {
      const result = await postMessage(slug, {
        guestName: name,
        message: text,
        consentGiven: true,
      });
      if (!result.ok) {
        setStatus({
          type: 'error',
          message: result.message || result.error || 'Não foi possível enviar a mensagem.',
        });
        return;
      }
      setMessages((prev) => [result, ...prev.filter((item) => item.id !== result.id)]);
      setGuestName('');
      setMessage('');
      setConsentGiven(false);
      setStatus({ type: 'success', message: 'Mensagem enviada com sucesso!' });
    } catch {
      setStatus({ type: 'error', message: 'Erro ao enviar mensagem. Tente novamente.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="container">
        <p className="eyebrow">Mural de recados</p>
        <h2>Mensagens com carinho</h2>
        <p className="messages__lead">
          Recados dos convidados passando por aqui — deixe o seu também.
        </p>
      </div>

      <div
        className="messages__list"
        style={{
          width: '100%',
          maxWidth: '72rem',
          margin: '0 auto',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {messages.length === 0 ? (
          <p className="messages__empty">Seja o primeiro a deixar um recado!</p>
        ) : (
          messages.map((item) => (
            <article key={item.id} className="message-item" data-message-id={item.id}>
              <div className="message-item__header">
                <strong className="message-item__name">{item.guestName}</strong>
                {item.createdAt ? (
                  <time className="message-item__date" dateTime={item.createdAt}>
                    {formatDate(item.createdAt)}
                  </time>
                ) : null}
              </div>
              <p className="message-content">{item.message}</p>
            </article>
          ))
        )}
      </div>

      {nextCursor ? (
        <button
          type="button"
          className="btn btn--ghost magnetic messages__load-more"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? 'Carregando…' : 'Carregar mais'}
        </button>
      ) : null}

      <div className="container">
        <div className="messages__form-container">
          <h3 className="messages__form-title">Deixe uma mensagem</h3>
          <form className="messages__form" onSubmit={onSubmit} noValidate>
            {status ? (
              <div
                className={`messages__status messages__status--${status.type}`}
                style={{ display: 'block' }}
              >
                {status.message}
              </div>
            ) : null}

            <div className="messages__fields">
              <div className="form-field">
                <label htmlFor="guest-name">
                  Seu nome <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="guest-name"
                  name="guestName"
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={guestName}
                  disabled={busy}
                  onChange={(event) => setGuestName(event.target.value)}
                />
                {nameError ? (
                  <span className="form-error" role="alert">
                    {nameError}
                  </span>
                ) : null}
              </div>

              <div className="form-field">
                <label htmlFor="message-text">
                  Sua mensagem <span className="required">*</span>
                </label>
                <textarea
                  id="message-text"
                  name="message"
                  required
                  maxLength={250}
                  rows={4}
                  placeholder="Escreva suas felicitações para o casal..."
                  value={message}
                  disabled={busy}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <span className="form-hint">{message.length}/250 caracteres</span>
                {messageError ? (
                  <span className="form-error" role="alert">
                    {messageError}
                  </span>
                ) : null}
              </div>

              <div className="form-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="consentGiven"
                    id="consent-checkbox"
                    required
                    checked={consentGiven}
                    disabled={busy}
                    onChange={(event) => setConsentGiven(event.target.checked)}
                  />
                  <span>
                    Concordo em compartilhar minha mensagem publicamente no mural do casal.
                  </span>
                </label>
                {consentError ? (
                  <span className="form-error" role="alert">
                    {consentError}
                  </span>
                ) : null}
              </div>

              <button type="submit" className="btn magnetic messages__submit" disabled={busy}>
                {busy ? 'Enviando...' : 'Enviar mensagem'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
