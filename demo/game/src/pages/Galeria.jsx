import { MOCK_GALLERY } from '../mock-data.js';
import { useDemo } from '../DemoContext.jsx';

export default function Galeria() {
  const { catalog, getPhoto } = useDemo();

  const extras = catalog.photoMissions
    .map((m) => {
      const shot = getPhoto(m.id);
      if (!shot?.preview) return null;
      if (MOCK_GALLERY.some((g) => g.preview === shot.preview)) return null;
      return {
        id: `local-${m.id}`,
        title: m.title,
        guestName: 'Você',
        preview: shot.preview,
      };
    })
    .filter(Boolean);

  const items = [...MOCK_GALLERY, ...extras];

  return (
    <div className="play-page">
      <h1 className="play-script">Galeria</h1>
      <p className="play-sub">Fotos de exemplo geradas para esta demo</p>
      <div className="gallery-grid">
        {items.map((shot) => (
          <article key={shot.id} className="gallery-card">
            {shot.preview ? <img src={shot.preview} alt={shot.title} /> : <span aria-hidden="true">📷</span>}
            <strong>{shot.title}</strong>
            <p>{shot.guestName}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
