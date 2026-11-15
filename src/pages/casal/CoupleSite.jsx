import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchCouplePage } from '../../lib/casal-api.mjs';
import { coupleNavItems } from './couple-nav.mjs';
import CoupleHome from './CoupleHome.jsx';
import PartnerHome from './PartnerHome.jsx';
import '../../dani-carine/style.css';

const DEFAULT_TITLE = 'CaseBem';
const PARTNER_TITLE = 'Dani & Carine';

function publicTitle(page, slug) {
  const names = (page?.names || []).filter(Boolean);
  return names.join(' & ') || slug || DEFAULT_TITLE;
}

export default function CoupleSite() {
  const { slug } = useParams();
  const [state, setState] = useState({ kind: 'loading' });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    fetchCouplePage(slug)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setState({ kind: result.status === 404 ? 'not-found' : 'error' });
          return;
        }
        setState({ kind: 'ok', slug: result.slug, isPartner: result.isPartner, page: result.page });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, retry]);

  useEffect(() => {
    if (state.kind !== 'ok') return undefined;
    document.title = state.isPartner ? PARTNER_TITLE : publicTitle(state.page, state.slug);
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [state.kind, state.isPartner, state.page, state.slug]);

  if (state.kind === 'loading') {
    return (
      <div className="couple-site">
        <p>Carregando…</p>
      </div>
    );
  }

  if (state.kind === 'not-found') {
    return (
      <div className="couple-site">
        <h1>Página não encontrada</h1>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="couple-site">
        <h1>Não foi possível carregar a página.</h1>
        <p>Tente novamente em alguns instantes.</p>
        <button type="button" onClick={() => setRetry((n) => n + 1)}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="couple-site">
      <nav>
        {coupleNavItems().map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      {state.isPartner ? (
        <PartnerHome slug={state.slug} page={state.page} />
      ) : (
        <CoupleHome slug={state.slug} page={state.page} />
      )}
    </div>
  );
}
