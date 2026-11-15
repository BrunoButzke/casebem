import { useEffect, useState } from 'react';
import { getAdminPage, putAdminPage } from '../../lib/admin-api.mjs';
import AdminSection from './AdminSection.jsx';

const ERROR_COPY = {
  SLUG_TAKEN: 'Este endereço já está em uso',
  SLUG_RESERVED: 'Este endereço não está disponível',
  SLUG_LOCKED: 'O endereço do casal parceiro não muda',
  SLUG_INVALID: 'Use 3 a 40 letras minúsculas, números ou hífen',
  VALIDATION: 'Confira os campos da página.',
};

function emptyPage() {
  return {
    names: ['', ''],
    dateLine: '',
    city: '',
    welcomeTitle: '',
    welcomeBody: '',
    story: '',
    venueName: '',
    venuePlace: '',
    mapsHref: '',
    dressTitle: '',
    dressRule: '',
    etapas: [],
  };
}

function fromApiPage(page) {
  const next = { ...emptyPage(), ...(page && typeof page === 'object' ? page : {}) };
  const names = Array.isArray(page?.names) ? page.names.map((item) => String(item ?? '')) : [];
  while (names.length < 2) names.push('');
  next.names = names.slice(0, 2);
  next.etapas = Array.isArray(page?.etapas)
    ? page.etapas.map((item) => ({
        title: String(item?.title ?? ''),
        detail: String(item?.detail ?? ''),
      }))
    : [];
  return next;
}

export default function MinhaPagina() {
  const [slug, setSlug] = useState('');
  const [slugLocked, setSlugLocked] = useState(false);
  const [savedSlug, setSavedSlug] = useState('');
  const [page, setPage] = useState(emptyPage);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAdminPage()
      .then((res) => res.json().catch(() => ({})))
      .then((body) => {
        const nextSlug = body.slug || '';
        setSlug(nextSlug);
        setSavedSlug(nextSlug);
        setSlugLocked(Boolean(body.slugLocked));
        setPage(fromApiPage(body.page));
      })
      .catch(() => setError('Não foi possível carregar a página.'));
  }, []);

  function setField(key, value) {
    setPage((prev) => ({ ...prev, [key]: value }));
  }

  function setName(index, value) {
    setPage((prev) => {
      const names = [...prev.names];
      names[index] = value;
      return { ...prev, names };
    });
  }

  function setEtapa(index, key, value) {
    setPage((prev) => {
      const etapas = prev.etapas.map((item, i) => (i === index ? { ...item, [key]: value } : item));
      return { ...prev, etapas };
    });
  }

  function addEtapa() {
    setPage((prev) => {
      if (prev.etapas.length >= 8) return prev;
      return { ...prev, etapas: [...prev.etapas, { title: '', detail: '' }] };
    });
  }

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess(false);
    try {
      const names = page.names.map((item) => item.trim()).filter(Boolean);
      const etapas = page.etapas
        .map((item) => ({ title: item.title.trim(), detail: item.detail.trim() }))
        .filter((item) => item.title);
      const res = await putAdminPage({
        slug,
        page: {
          names,
          dateLine: page.dateLine,
          city: page.city,
          welcomeTitle: page.welcomeTitle,
          welcomeBody: page.welcomeBody,
          story: page.story,
          venueName: page.venueName,
          venuePlace: page.venuePlace,
          mapsHref: page.mapsHref,
          dressTitle: page.dressTitle,
          dressRule: page.dressRule,
          etapas,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(ERROR_COPY[body.error] || 'Não foi possível publicar a página.');
        return;
      }
      setSuccess(true);
      const nextSlug = body.slug || '';
      setSlug(nextSlug);
      setSavedSlug(nextSlug);
      setSlugLocked(Boolean(body.slugLocked));
      setPage(fromApiPage(body.page));
    } catch {
      setError('Não foi possível publicar a página.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminSection
      eyebrow="Minha página"
      title="Publique o site do casal"
      lead="Escolha o endereço público e edite a história, a data, o local e as etapas do dia."
    >
      {error ? (
        <p className="hub-msg" role="alert">
          {error}
        </p>
      ) : null}
      {success ? <p role="status">Página publicada.</p> : null}
      {savedSlug ? (
        <p>
          <a className="hub__footer-link" href={`/casal/${savedSlug}`}>
            Ver página
          </a>
        </p>
      ) : null}
      <form className="hub-form" onSubmit={onSubmit}>
        <label className="hub-field">
          <span>Endereço</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            readOnly={slugLocked}
            autoComplete="off"
            placeholder="ana-e-joao"
          />
        </label>
        <label className="hub-field">
          <span>Nome 1</span>
          <input value={page.names[0]} onChange={(e) => setName(0, e.target.value)} />
        </label>
        <label className="hub-field">
          <span>Nome 2</span>
          <input value={page.names[1]} onChange={(e) => setName(1, e.target.value)} />
        </label>
        <label className="hub-field">
          <span>Data</span>
          <input value={page.dateLine} onChange={(e) => setField('dateLine', e.target.value)} />
        </label>
        <label className="hub-field">
          <span>Cidade</span>
          <input value={page.city} onChange={(e) => setField('city', e.target.value)} />
        </label>
        <label className="hub-field">
          <span>Título de boas-vindas</span>
          <input
            value={page.welcomeTitle}
            onChange={(e) => setField('welcomeTitle', e.target.value)}
          />
        </label>
        <label className="hub-field">
          <span>Texto de boas-vindas</span>
          <textarea
            value={page.welcomeBody}
            onChange={(e) => setField('welcomeBody', e.target.value)}
            rows={4}
          />
        </label>
        <label className="hub-field">
          <span>História</span>
          <textarea value={page.story} onChange={(e) => setField('story', e.target.value)} rows={4} />
        </label>
        <label className="hub-field">
          <span>Local</span>
          <input value={page.venueName} onChange={(e) => setField('venueName', e.target.value)} />
        </label>
        <label className="hub-field">
          <span>Endereço do local</span>
          <input value={page.venuePlace} onChange={(e) => setField('venuePlace', e.target.value)} />
        </label>
        <label className="hub-field">
          <span>Link do mapa</span>
          <input
            value={page.mapsHref}
            onChange={(e) => setField('mapsHref', e.target.value)}
            placeholder="https://"
          />
        </label>
        <label className="hub-field">
          <span>Título do dress code</span>
          <input value={page.dressTitle} onChange={(e) => setField('dressTitle', e.target.value)} />
        </label>
        <label className="hub-field">
          <span>Dress code</span>
          <input value={page.dressRule} onChange={(e) => setField('dressRule', e.target.value)} />
        </label>
        {page.etapas.map((etapa, index) => (
          <div key={index} className="hub-form">
            <label className="hub-field">
              <span>Etapa {index + 1} — título</span>
              <input
                value={etapa.title}
                onChange={(e) => setEtapa(index, 'title', e.target.value)}
              />
            </label>
            <label className="hub-field">
              <span>Etapa {index + 1} — detalhe</span>
              <input
                value={etapa.detail}
                onChange={(e) => setEtapa(index, 'detail', e.target.value)}
              />
            </label>
          </div>
        ))}
        <button type="button" className="hub-btn hub-btn--ghost" onClick={addEtapa}>
          Adicionar etapa
        </button>
        <button type="submit" className="hub-btn" disabled={busy}>
          {busy ? 'Publicando…' : 'Publicar'}
        </button>
      </form>
    </AdminSection>
  );
}
