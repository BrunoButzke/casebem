import { useRef, useState } from 'react';
import { usePlay } from '../PlayContext.jsx';
import { prepareGalleryImage } from '../image.js';

export default function Desafios() {
  const { catalog, scores, error, setPhoto, removePhoto, getPhoto } = usePlay();
  const photos = catalog?.photoMissions || [];
  const [openId, setOpenId] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const cameraRef = useRef(null);
  const fileRef = useRef(null);

  const open = photos.find((m) => m.id === openId) || null;
  const shot = open ? getPhoto(open.id) : null;

  async function onFile(file) {
    if (!open || !file) return;
    setBusy(true);
    setLocalError('');
    try {
      const image = await prepareGalleryImage(file);
      const ok = await setPhoto(open, image);
      if (!ok) setLocalError('Não deu para salvar a foto neste aparelho.');
    } catch (err) {
      setLocalError(err.message || 'Não deu para enviar a foto');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpenId('');
    setLocalError('');
  }

  return (
    <div className="play-page">
      <h1 className="play-script">Desafios</h1>
      <p className="play-sub">
        {scores.donePhotos} de {photos.length || 0} fotos · algumas valem selo · entram na galeria
      </p>
      {error ? <p className="hub-error">{error}</p> : null}
      {!catalog ? <p className="hub-empty">Carregando desafios…</p> : null}
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
          <button type="button" className="quiz-modal__backdrop" aria-label="Fechar" onClick={close} />
          <div className="quiz-modal__panel">
            <p className="quiz-modal__kicker">Desafio de foto</p>
            <h2 id="photo-modal-title">{open.title}</h2>
            <p className="photo-meta">
              {open.points} pts{open.awardsStamp ? ' · vale 1 selo' : ''} · a foto entra na galeria
            </p>
            {shot?.preview ? (
              <img className="photo-preview" src={shot.preview} alt="Foto enviada" />
            ) : (
              <div className="photo-placeholder">A foto aparece aqui</div>
            )}
            {localError ? <p className="hub-error">{localError}</p> : null}
            <input
              ref={cameraRef}
              className="sr-only"
              type="file"
              accept="image/*"
              capture="environment"
              tabIndex={-1}
              aria-label="Tirar foto com a câmera"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void onFile(file);
              }}
            />
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="image/*"
              tabIndex={-1}
              aria-label="Carregar imagem da galeria"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void onFile(file);
              }}
            />
            <div className="quiz-modal__nav photo-actions">
              <button
                type="button"
                className="desafio__cta"
                disabled={busy}
                onClick={() => cameraRef.current?.click()}
              >
                {busy ? 'Enviando…' : 'Abrir câmera'}
              </button>
              <button
                type="button"
                className="desafio__cta desafio__cta--ghost"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                Carregar imagem
              </button>
            </div>
            {shot?.preview ? (
              <button
                type="button"
                className="photo-delete"
                disabled={busy}
                onClick={() => removePhoto(open)}
              >
                Excluir foto
              </button>
            ) : null}
            <button type="button" className="desafio__cta desafio__cta--ghost" onClick={close}>
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
