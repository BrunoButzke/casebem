import RsvpSection from './RsvpSection.jsx';
import GiftsSection from './GiftsSection.jsx';
import MessagesSection from './MessagesSection.jsx';

export default function CoupleHome({ slug, page }) {
  const names = (page?.names || []).filter(Boolean);
  const heading = names.join(' & ') || slug;
  const etapas = Array.isArray(page?.etapas) ? page.etapas : [];

  return (
    <main>
      <h1>{heading}</h1>
      {page?.dateLine ? <p>{page.dateLine}</p> : null}
      {page?.city ? <p>{page.city}</p> : null}

      <section id="boas-vindas">
        <h2>{page?.welcomeTitle || 'Bem-vindos'}</h2>
        {page?.welcomeBody ? <p>{page.welcomeBody}</p> : null}
      </section>

      <section id="o-casal">
        <h2>O casal</h2>
        {page?.story ? <p>{page.story}</p> : null}
      </section>

      <section id="o-dia">
        <h2>O dia</h2>
        {etapas.map((etapa, index) => (
          <div key={`${etapa.title}-${index}`}>
            <strong>{etapa.title}</strong>
            {etapa.detail ? <p>{etapa.detail}</p> : null}
          </div>
        ))}
      </section>

      <section id="local">
        <h2>{page?.venueName || 'Local'}</h2>
        {page?.venuePlace ? <p>{page.venuePlace}</p> : null}
        {page?.mapsHref ? (
          <a href={page.mapsHref} target="_blank" rel="noopener noreferrer">
            Abrir no Maps
          </a>
        ) : null}
      </section>

      <section className="rsvp" id="confirmar-presenca">
        <RsvpSection slug={slug} />
      </section>
      <section className="gifts" id="presentes">
        <GiftsSection slug={slug} />
      </section>
      <section className="messages" id="mural-recados">
        <MessagesSection slug={slug} />
      </section>
    </main>
  );
}
