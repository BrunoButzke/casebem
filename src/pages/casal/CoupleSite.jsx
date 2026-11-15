import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchCouplePage } from '../../lib/casal-api.mjs';
import { coupleNavItems } from './couple-nav.mjs';
import PartnerHome from './PartnerHome.jsx';

export default function CoupleSite() {
  const { slug } = useParams();
  const [state, setState] = useState({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    fetchCouplePage(slug)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setState({ kind: 'not-found' });
          return;
        }
        setState({ kind: 'ok', slug: result.slug, isPartner: result.isPartner });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ kind: 'not-found' });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.kind === 'loading') {
    return <p>Carregando…</p>;
  }

  if (state.kind === 'not-found') {
    return <h1>Página não encontrada</h1>;
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
