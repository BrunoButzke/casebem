import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchCouplePage } from '../../lib/casal-api.mjs';
import { coupleNavItems } from './couple-nav.mjs';
import PartnerHome from './PartnerHome.jsx';

const DEFAULT_TITLE = 'CaseBem';
const PARTNER_TITLE = 'Dani & Carine';

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
        setState({ kind: 'ok', slug: result.slug, isPartner: result.isPartner });
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
    if (state.kind !== 'ok' || !state.isPartner) return undefined;
    document.title = PARTNER_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [state.kind, state.isPartner]);

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
      {state.isPartner ? <PartnerHome slug={state.slug} /> : (
        <main>
          <h1>Em breve</h1>
        </main>
      )}
    </div>
  );
}
