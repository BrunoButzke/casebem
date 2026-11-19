import { useRef, useState } from 'react';
import { useDemo } from '../DemoContext.jsx';

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler a imagem'));
    reader.readAsDataURL(file);
  });
}

export default function Desafios() {
  const { catalog, scores, setPhoto, getPhoto } = useDemo();
  const photos = catalog.photoMissions;
  const [openId, setOpenId] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const fileRef = useRef(null);

  const open = photos.find((m) => m.id === openId) || null;
  const shot = open ? getPhoto(open.id) : null;

  async function onFile(file) {
    if (!open || !file) return;
    setBusy(true);
    setLocalError('');
    try {
      const image = await readAsDataUrl(file);
      setPhoto(open, image);
    } catch (err) {
      setLocalError(err.message || 'Não deu para carregar a foto');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="play-page">
      <h1 className="play-script">Desafios</h1>
      <p className="play-sub">
        {scores.donePhotos} de {photos.length} fotos · algumas valem selo · entram na galeria
      </p>
      <div className="mission-list">
        {photos.map((m) => {
          const done = Boolean(getPhoto(m.id)?.done);
          const preview = getPhoto(m.id)?.preview;
          return (
            <article key={m.id} className={`mission-card${done ? ' is-done' : ''}`}>
              <button type="button" className="mission-card__row" onClick={() => setOpenId(m.id)}>
                {preview ? (
                  <img className="mission-card__thumb" src={preview} alt="" />
                ) : (
                  <span className="mission-card__avatar" aria-hidden="true">
                    📷
                  </span>
                )}
                <span className="mission-card__body">
                  <strong>{m.title}</strong>
                  <em>
                    Desafio · {m.points} pts{m.awardsStamp ? ' · vale 1 selo' : ''}
                  </em>
                </span>
                {done ? (
                  <span className="mission-card__badge">Feita ✓</span>
                ) : (
                  <span className="mission-card__chevron" aria-hidden="true">
                    ›
                  </span>
                )}
              </button>
            </article>
          );
        })}
      </div>

      {open ? (
        <div className="quiz-modal" role="dialog" aria-modal="true" aria-labelledby="photo-modal-title">
          <button
            type="button"
            className="quiz-modal__backdrop"
            aria-label="Fechar"
            onClick={() => {
              setOpenId('');
              setLocalError('');
            }}
          />
          <div className="quiz-modal__panel">
            <p className="quiz-modal__kicker">Desafio de foto</p>
            <h2 id="photo-modal-title">{open.title}</h2>
            <p className="photo-meta">
              {open.points} pts{open.awardsStamp ? ' · vale 1 selo' : ''} · demo local (não sobe pro
              servidor)
            </p>
            {shot?.preview ? (
              <img className="photo-preview" src={shot.preview} alt="Foto da missão" />
            ) : (
              <div className="photo-placeholder">A foto aparece aqui</div>
            )}
            {localError ? <p className="hub-error">{localError}</p> : null}
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="image/*"
              tabIndex={-1}
              aria-label="Escolher foto"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void onFile(file);
              }}
            />
            <div className="quiz-modal__nav">
              <button
                type="button"
                className="desafio__cta"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {busy ? 'Carregando…' : shot ? 'Trocar foto' : 'Enviar foto'}
              </button>
              <button
                type="button"
                className="desafio__cta desafio__cta--ghost"
                onClick={() => {
                  setOpenId('');
                  setLocalError('');
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
