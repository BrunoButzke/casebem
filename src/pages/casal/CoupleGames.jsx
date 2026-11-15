import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchCouplePage } from '../../lib/casal-api.mjs';
import GamesApp from '../../../games/src/App.jsx';
import '../../../games/src/styles.css';

export default function CoupleGames() {
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

  if (state.kind === 'loading') {
    return (
      <div className="couple-games">
        <p>Carregando…</p>
      </div>
    );
  }

  if (state.kind === 'not-found') {
    return (
      <div className="couple-games">
        <h1>Página não encontrada</h1>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="couple-games">
        <h1>Não foi possível carregar a página.</h1>
        <p>Tente novamente em alguns instantes.</p>
        <button type="button" onClick={() => setRetry((n) => n + 1)}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="couple-games">
      <GamesApp />
    </div>
  );
}
