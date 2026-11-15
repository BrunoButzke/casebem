import { useEffect, useState } from 'react';
import { PARTNER_COPY } from './partner-copy.mjs';
import '../../dani-carine/style.css';

const WEDDING_AT = Date.parse('2026-11-21T08:00:00-03:00');

const MADRINHA_LOOKS = [
  { color: '#e8b4b8', image: '/images/madrinha-rosa.jpg', title: 'Rosa claro' },
  { color: '#d4846a', image: '/images/madrinha-salmao.jpg', title: 'Salmão' },
  { color: '#e07a5f', image: '/images/madrinha-coral.jpg', title: 'Coral' },
  { color: '#c46b4a', image: '/images/madrinha-terracota.jpg', title: 'Terracota' },
];

function padUnit(n, { allowWideDays = false } = {}) {
  const value = Math.max(0, n);
  if (allowWideDays && value > 99) return String(value);
  return String(value).padStart(2, '0');
}

function remainingFrom(now, target) {
  const diff = target - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }
  const totalSec = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    done: false,
  };
}

function WeddingCountdown() {
  const [clock, setClock] = useState(() => remainingFrom(Date.now(), WEDDING_AT));

  useEffect(() => {
    const id = setInterval(() => {
      const next = remainingFrom(Date.now(), WEDDING_AT);
      setClock(next);
      if (next.done) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={clock.done ? 'countdown manifesto__stats is-done' : 'countdown manifesto__stats'}
      aria-live="polite"
      aria-label="Contagem regressiva até o casamento"
    >
      <div className="stat">
        <span className="stat__num" data-unit="days">
          {padUnit(clock.days, { allowWideDays: true })}
        </span>
        <span className="stat__label">dias</span>
      </div>
      <div className="stat">
        <span className="stat__num" data-unit="hours">
          {padUnit(clock.hours)}
        </span>
        <span className="stat__label">horas</span>
      </div>
      <div className="stat">
        <span className="stat__num" data-unit="minutes">
          {padUnit(clock.minutes)}
        </span>
        <span className="stat__label">min</span>
      </div>
      <div className="stat">
        <span className="stat__num" data-unit="seconds">
          {padUnit(clock.seconds)}
        </span>
        <span className="stat__label">seg</span>
      </div>
    </div>
  );
}

const MARQUEE_ITEMS = [
  'Lagoa',
  '·',
  'Florianópolis',
  '·',
  'Para sempre',
  '·',
  'Indaiá',
  '·',
  'Amanhecer',
  '·',
  'Canto da Lagoa',
  '·',
  'Dani & Carine',
  '·',
];

export default function PartnerHome({ slug }) {
  const [activeMoment, setActiveMoment] = useState(0);
  const [madrinha, setMadrinha] = useState(MADRINHA_LOOKS[0]);
  const copy = PARTNER_COPY;
  const [dani, carine] = copy.names;

  return (
    <main id="topo" data-slug={slug}>
      <section className="hero">
        <div className="hero__bg">
          <img
            src={copy.heroImage}
            alt="Casal ao amanhecer à beira da lagoa"
            width="1600"
            height="900"
          />
        </div>
        <div className="hero__shade"></div>
        <div className="hero__content container">
          <p className="eyebrow hero__eyebrow">{copy.city}</p>
          <h1 className="hero__title">
            <span className="line">
              <span>{dani}</span>
            </span>
            <span className="line line--amp">
              <span className="amp">&amp;</span>
            </span>
            <span className="line">
              <span>{carine}</span>
            </span>
          </h1>
          <p className="hero__meta">{copy.dateLine}</p>
          <a href="#o-dia" className="btn btn--ghost magnetic hero__cta">
            O grande dia
          </a>
        </div>
        <div className="hero__scroll" aria-hidden="true">
          <span></span>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>

      <section className="story" id="boas-vindas">
        <div className="container story__inner">
          <p className="eyebrow">Bem-vindos</p>
          <h2>{copy.welcomeTitle}</h2>
          <div className="story__body">
            <p>
              Criamos este site para compartilhar com vocês todos os detalhes do nosso grande dia.
              Estamos muito felizes por celebrar o nosso amor ao lado de pessoas tão especiais e
              importantes em nossas vidas. Contamos os dias para viver esse momento único e
              inesquecível junto de vocês!
            </p>
            <p>
              Aqui vocês encontrarão informações importantes sobre a cerimônia e a recepção, além de
              dicas de traje e estacionamento. Pedimos também que confirmem sua presença por meio do
              menu <a href="#confirmar-presenca">“Confirme sua Presença”</a>, preenchendo os dados
              solicitados.
            </p>
            <p>
              Caso desejarem nos presentear, preparamos uma{' '}
              <a href="#presentes">Lista de Casamento</a> com muito carinho. Sintam-se à vontade para
              escolher o presente que preferirem.
            </p>
            <p>Estamos ansiosos para celebrar esse dia tão especial com vocês!</p>
          </div>
        </div>
      </section>

      <section className="manifesto" id="manifesto">
        <div className="container manifesto__grid">
          <p className="manifesto__text">
            Um <mark>sim</mark> ao amanhecer.
          </p>
          <WeddingCountdown />
        </div>
        <div className="manifesto__img reveal">
          <img
            src={copy.manifestoImage}
            alt="Um sim ao amanhecer no Indaiá Eventos"
            width="1280"
            height="720"
          />
        </div>
      </section>

      <section className="story story--lagoon" id="o-casal">
        <div className="container story__couple">
          <div className="story__intro">
            <p className="eyebrow">{copy.storyEyebrow}</p>
            <h2>O casal</h2>
          </div>

          <div className="story__portraits" aria-label="Fotos de Dani e Carine">
            <figure className="story__portrait reveal">
              <img
                src={copy.portraits[0].src}
                alt={copy.portraits[0].alt}
                width="300"
                height="300"
                loading="lazy"
              />
              <figcaption>{copy.portraits[0].caption}</figcaption>
            </figure>
            <span className="story__amp" aria-hidden="true">
              &amp;
            </span>
            <figure className="story__portrait reveal">
              <img
                src={copy.portraits[1].src}
                alt={copy.portraits[1].alt}
                width="300"
                height="300"
                loading="lazy"
              />
              <figcaption>{copy.portraits[1].caption}</figcaption>
            </figure>
          </div>

          <div className="story__body story__body--couple">
            <p>
              Acreditamos que o amor é um ato de sonhar — sonhar com uma vida compartilhada,
              construída com companheirismo, respeito e amizade.
            </p>
            <p>
              Para nós, o amor é como uma ponte erguida tijolo por tijolo. Ao longo desses oito anos,
              dedicamos tempo, cuidado e carinho para fortalecer cada parte dessa construção, criando
              uma base sólida para tudo o que estamos vivendo hoje.
            </p>
            <p>
              Foram três anos sonhando e planejando este momento tão especial e, enfim, ele chegou.
              Agora, queremos celebrar essa nova etapa ao lado das pessoas que fazem parte da nossa
              história.
            </p>
            <p>Estamos muito felizes por compartilhar esse dia com vocês.</p>
          </div>
        </div>
      </section>

      <section className="how" id="o-dia">
        <div className="how__pin">
          <div className="container how__layout">
            <div className="how__copy">
              <p className="eyebrow">O dia</p>
              <h2 className="how__title">Três momentos</h2>
              <ul className="how__steps" role="list">
                {copy.moments.map((moment, index) => (
                  <li
                    key={moment.n}
                    className={index === activeMoment ? 'how__step is-active' : 'how__step'}
                    data-step={String(index)}
                    onMouseEnter={() => setActiveMoment(index)}
                    onFocus={() => setActiveMoment(index)}
                  >
                    <span className="how__n">{moment.n}</span>
                    <div>
                      <strong>{moment.title}</strong>
                      <p>{moment.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="how__visual" aria-hidden="true">
              {copy.moments.map((moment, index) => (
                <figure
                  key={moment.image}
                  className={index === activeMoment ? 'how__frame is-active' : 'how__frame'}
                  data-frame={String(index)}
                >
                  <img src={moment.image} alt="" />
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="local" id="local">
        <div className="container local__grid">
          <div className="local__copy">
            <p className="eyebrow">Local</p>
            <h2>{copy.venueName}</h2>
            <p className="local__place">{copy.venuePlace}</p>
            <p className="local__hint">Lagoa da Conceição</p>
            <a className="btn magnetic" href={copy.mapsHref} target="_blank" rel="noopener noreferrer">
              Abrir no Maps
            </a>
          </div>
          <figure className="local__photo local__map reveal">
            <iframe
              title="Mapa — Indaiá Eventos, Canto da Lagoa, Florianópolis"
              src="https://maps.google.com/maps?q=Indai%C3%A1+Eventos+Canto+da+Lagoa+Florian%C3%B3polis&hl=pt-BR&z=15&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            ></iframe>
          </figure>
        </div>
      </section>

      <section className="dress" id="dress-code">
        <div className="container">
          <p className="eyebrow">Dress code</p>
          <h2>{copy.dressTitle}</h2>
          <p className="dress__rule">{copy.dressRule}</p>

          <div className="dress__swatches" aria-label="Paleta convidados">
            <span style={{ '--c': '#c4c0b8' }} title="Cinza claro"></span>
            <span style={{ '--c': '#3d5a4c' }} title="Verde"></span>
            <span style={{ '--c': '#3a3a3a' }} title="Cinza escuro"></span>
            <span style={{ '--c': '#d4846a' }} title="Salmão"></span>
            <span style={{ '--c': '#e8b4b8' }} title="Rosa claro"></span>
            <span style={{ '--c': '#c46b4a' }} title="Terracota"></span>
            <span style={{ '--c': '#e07a5f' }} title="Coral"></span>
          </div>

          <div className="dress__cards">
            <article className="dress__card reveal">
              <figure>
                <img
                  src="/images/dress-padrinho.jpg"
                  alt="Look padrinhos: terno cinza claro e gravata verde"
                />
              </figure>
              <h3>Padrinhos</h3>
              <p>Cinza claro · gravata verde</p>
            </article>
            <article className="dress__card reveal">
              <figure>
                <img
                  src="/images/dress-pais.jpg"
                  alt="Look pais: terno cinza escuro e gravata salmão"
                />
              </figure>
              <h3>Pais</h3>
              <p>Cinza escuro · gravata salmão</p>
            </article>
            <article className="dress__card dress__card--madrinha reveal">
              <figure className="dress__preview" aria-label="Look madrinhas: escolha a cor do vestido">
                <img
                  className="dress__photo"
                  src={madrinha.image}
                  alt="Madrinha com vestido rosa claro"
                  width="864"
                  height="1152"
                />
              </figure>
              <h3>Madrinhas</h3>
              <p>Toque na cor para ver o vestido</p>
              <div className="dress__picker" role="group" aria-label="Cor do vestido da madrinha">
                {MADRINHA_LOOKS.map((look) => (
                  <button
                    key={look.color}
                    type="button"
                    className={look.color === madrinha.color ? 'dress__dot is-active' : 'dress__dot'}
                    style={{ '--c': look.color }}
                    aria-pressed={look.color === madrinha.color}
                    title={look.title}
                    onClick={() => setMadrinha(look)}
                  >
                    <span className="sr-only">{look.title}</span>
                  </button>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="manual" id="manual-convidado">
        <div className="container manual__inner">
          <p className="eyebrow">Para os convidados</p>
          <h2>Manual do convidado</h2>
          <p className="manual__lead">Um guia carinhoso com o que importa no nosso grande dia.</p>
          <figure className="manual__figure reveal">
            <img
              src={copy.manualImage}
              alt="Manual do convidado: confirme presença, traje, pontualidade e outras orientações"
              width="1000"
              height="1485"
              loading="lazy"
            />
          </figure>
        </div>
      </section>

      <section id="confirmar-presenca" />
      <section id="presentes" />
      <section id="mural-recados" />
    </main>
  );
}
