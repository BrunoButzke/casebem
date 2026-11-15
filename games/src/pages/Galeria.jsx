import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listGallery } from '../gallery-api.js';

export default function Galeria() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const photos = await listGallery();
        if (!cancelled) setItems(photos);
      } catch {
        if (!cancelled) setItems([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="play-page">
      <h1 className="play-script">Galeria</h1>
      <p className="play-sub">As fotos dos desafios ficam públicas para toda a festa</p>
      <Link className="desafio__cta" to="telao">
        Modo telão
      </Link>
      {items.length ? (
        <div className="gallery-grid">
          {items.map((shot) => (
            <article key={shot.id} className="gallery-card">
              {shot.preview ? <img src={shot.preview} alt={shot.title} /> : <span aria-hidden="true">📷</span>}
              <strong>{shot.title}</strong>
              <p>{shot.guestName}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="hub-empty">Nenhuma foto ainda. Complete um desafio e ela aparece aqui para todos.</p>
      )}
    </div>
  );
}
