import { useEffect, useState } from 'react';
import { listGallery, unpublishGalleryPhoto } from '../gallery-api.js';

export default function AdminGaleria() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const photos = await listGallery();
        if (!cancelled) setItems(photos);
      } catch (err) {
        if (!cancelled) {
          setItems([]);
          setError(err.message || 'Não deu para carregar a galeria');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(shot) {
    if (!shot?.id || pending) return;
    if (!window.confirm(`Excluir a foto de ${shot.guestName}?`)) return;
    setPending(shot.id);
    setError('');
    try {
      await unpublishGalleryPhoto({ id: shot.id });
      setItems((list) => list.filter((item) => item.id !== shot.id));
    } catch (err) {
      setError(err.message || 'Não deu para excluir a foto');
    } finally {
      setPending('');
    }
  }

  return (
    <div className="play-page">
      <h1 className="play-script">Galeria</h1>
      <p className="play-sub">Tirem do telão qualquer foto que não queiram na festa</p>
      {error ? <p className="hub-error">{error}</p> : null}
      {loading ? (
        <p className="hub-empty">Carregando fotos…</p>
      ) : items.length ? (
        <div className="gallery-grid">
          {items.map((shot) => (
            <article key={shot.id} className="gallery-card">
              {shot.preview ? <img src={shot.preview} alt={shot.title} /> : <span aria-hidden="true">📷</span>}
              <strong>{shot.title}</strong>
              <p>{shot.guestName}</p>
              <button
                type="button"
                className="gallery-card__delete"
                disabled={pending === shot.id}
                onClick={() => remove(shot)}
              >
                Excluir
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="hub-empty">Nenhuma foto na galeria ainda.</p>
      )}
    </div>
  );
}
