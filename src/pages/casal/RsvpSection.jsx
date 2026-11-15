import { useState } from 'react';
import { searchGuestsPublic, submitRsvp } from '../../lib/casal-api.mjs';

export default function RsvpSection({ slug }) {
  const [phase, setPhase] = useState('search');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [attending, setAttending] = useState(null);
  const [status, setStatus] = useState(null);
  const [nameError, setNameError] = useState('');
  const [matchError, setMatchError] = useState('');
  const [attendingError, setAttendingError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function clearErrors() {
    setNameError('');
    setMatchError('');
    setAttendingError('');
  }

  function resetToSearch() {
    setPhase('search');
    setQuery('');
    setMatches([]);
    setSelectedGuest(null);
    setAttending(null);
    setStatus(null);
    setDone(false);
    clearErrors();
  }

  function enterConfirm(guest) {
    setSelectedGuest(guest);
    setPhase('confirm');
    setMatches([]);
    setStatus(null);
    clearErrors();
  }

  async function runSearch() {
    clearErrors();
    setStatus(null);
    const q = query.trim();
    if (q.length < 2) {
      setNameError('Digite pelo menos 2 letras do nome.');
      return;
    }

    setBusy(true);
    try {
      const data = await searchGuestsPublic(slug, q);
      const list = Array.isArray(data.matches) ? data.matches : [];
      if (!data.ok) {
        setPhase('search');
        setSelectedGuest(null);
        setMatches([]);
        setStatus({
          type: 'error',
          message:
            data.message || data.error || 'Não foi possível buscar o convite. Tente de novo.',
        });
        return;
      }
      if (list.length === 0) {
        setPhase('search');
        setSelectedGuest(null);
        setMatches([]);
        setStatus({ type: 'error', message: 'Nome não encontrado na lista' });
        return;
      }
      if (list.length === 1) {
        enterConfirm(list[0]);
        setStatus({ type: 'success', message: 'Convite encontrado! Confirme sua presença abaixo.' });
        return;
      }
      setMatches(list);
      setSelectedGuest(null);
      setPhase('choose');
      setStatus({ type: 'info', message: 'Encontramos mais de um convite. Escolha o seu.' });
    } catch {
      setStatus({ type: 'error', message: 'Erro de conexão ao buscar. Tente de novo.' });
    } finally {
      setBusy(false);
    }
  }

  async function sendRsvp() {
    clearErrors();
    if (!selectedGuest?.displayName) {
      setStatus({ type: 'error', message: 'Busque e selecione seu convite antes de confirmar.' });
      setPhase('search');
      return;
    }
    if (attending !== true && attending !== false) {
      setAttendingError('Informe se você vai comparecer.');
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const data = await submitRsvp(slug, {
        guestName: selectedGuest.displayName,
        attending,
        adultsCount: attending ? 1 : 0,
        childrenCount: 0,
        consentGiven: true,
      });
      if (!data.ok) {
        if (data.status === 409) {
          setStatus({
            type: 'error',
            message: 'Esta confirmação já foi registrada. Fale com os noivos se precisar alterar.',
          });
          return;
        }
        setStatus({
          type: 'error',
          message: data.message || data.error || 'Não foi possível enviar a confirmação.',
        });
        return;
      }
      setDone(true);
      setStatus({ type: 'success', message: 'Confirmação enviada com sucesso!' });
    } catch {
      setStatus({ type: 'error', message: 'Erro de conexão. Verifique sua internet e tente novamente.' });
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (done) return;
    if (phase === 'search') {
      await runSearch();
      return;
    }
    if (phase === 'choose') {
      if (!selectedGuest) {
        setMatchError('Selecione o seu convite na lista.');
        return;
      }
      enterConfirm(selectedGuest);
      return;
    }
    await sendRsvp();
  }

  const submitLabel =
    busy && phase === 'search'
      ? 'Buscando…'
      : busy && phase === 'confirm'
        ? 'Enviando...'
        : phase === 'search'
          ? 'Buscar'
          : phase === 'choose'
            ? 'Continuar'
            : 'Confirmar presença';

  return (
    <div className="container">
      <p className="eyebrow">Confirme sua presença</p>
      <h2>Você vai estar com a gente?</h2>
      <p className="rsvp__lead">
        Sua presença é o nosso maior presente. Confirme até 15 de novembro.
      </p>

      <div className="rsvp__form-container">
        <form className="rsvp__form" onSubmit={onSubmit} noValidate>
          {status ? (
            <div className={`rsvp__status rsvp__status--${status.type}`}>
              <p className="rsvp__status-message">{status.message}</p>
            </div>
          ) : null}

          <div className="rsvp__fields">
            <div className="form-field">
              <label htmlFor="rsvp-name">
                Qual o seu nome? <span className="required">*</span>
              </label>
              <input
                type="text"
                id="rsvp-name"
                name="guestName"
                required
                maxLength={100}
                autoComplete="name"
                placeholder="Digite parte do nome do convite"
                value={query}
                disabled={busy || done || phase === 'confirm'}
                onChange={(event) => setQuery(event.target.value)}
              />
              <span className="form-hint">Ex.: digite Bruno para achar “Bruno Butzke e Familia”</span>
              {nameError ? (
                <span className="form-error" role="alert">
                  {nameError}
                </span>
              ) : null}
            </div>

            {phase === 'choose' ? (
              <div className="form-field">
                <fieldset>
                  <legend>Encontramos mais de um convite — qual é o seu?</legend>
                  <div className="radio-group">
                    {matches.map((guest) => (
                      <label key={guest.id} className="radio-label">
                        <input
                          type="radio"
                          name="rsvp-match"
                          value={guest.id}
                          checked={selectedGuest?.id === guest.id}
                          disabled={busy}
                          onChange={() => enterConfirm(guest)}
                        />
                        <span>{guest.displayName}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {matchError ? (
                  <span className="form-error" role="alert">
                    {matchError}
                  </span>
                ) : null}
              </div>
            ) : null}

            {phase === 'confirm' && selectedGuest ? (
              <div className="rsvp__invite">
                <p className="rsvp__invite-label">Seu convite</p>
                <p className="rsvp__invite-name">{selectedGuest.displayName}</p>
                <button
                  type="button"
                  className="btn btn--ghost rsvp__invite-change"
                  disabled={busy}
                  onClick={resetToSearch}
                >
                  Buscar outro nome
                </button>
              </div>
            ) : null}

            {phase === 'confirm' ? (
              <fieldset className="form-field">
                <legend>
                  Você vai comparecer? <span className="required">*</span>
                </legend>
                <div className="radio-group radio-group--row">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="attending"
                      value="true"
                      checked={attending === true}
                      disabled={busy || done}
                      onChange={() => {
                        setAttending(true);
                        setAttendingError('');
                      }}
                    />
                    <span>Sim, estaremos lá!</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="attending"
                      value="false"
                      checked={attending === false}
                      disabled={busy || done}
                      onChange={() => {
                        setAttending(false);
                        setAttendingError('');
                      }}
                    />
                    <span>Infelizmente não poderei ir</span>
                  </label>
                </div>
                {attendingError ? (
                  <span className="form-error" role="alert">
                    {attendingError}
                  </span>
                ) : null}
              </fieldset>
            ) : null}

            {done ? null : (
              <button type="submit" className="btn magnetic rsvp__submit" disabled={busy}>
                {submitLabel}
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rsvp__privacy">
        <p>
          <strong>Privacidade:</strong> Seu nome e resposta são usados apenas para a organização do
          evento.
        </p>
      </div>
    </div>
  );
}
