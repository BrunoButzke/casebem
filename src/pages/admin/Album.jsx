import { useEffect, useState } from 'react';
import { listGalleryAdmin, shouldFetchAdminResource } from '../../lib/admin-api.mjs';
import AdminSection from './AdminSection.jsx';
import UpgradeCta from './UpgradeCta.jsx';
import { useAdminAccount } from './use-admin-account.js';

export default function Album() {
  const { account, status, reload } = useAdminAccount();
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');

  const locked = account ? !shouldFetchAdminResource(account.plan, 'album') : false;

  useEffect(() => {
    if (!account || locked) return;
    listGalleryAdmin()
      .then((res) => res.json().catch(() => ({})))
      .then((body) => setPhotos(Array.isArray(body.photos) ? body.photos : []))
      .catch(() => setError('Não foi possível carregar o álbum.'));
  }, [account, locked]);

  if (status === 'loading' || !account) return <p>Carregando…</p>;
  if (locked) return <UpgradeCta title="Álbum compartilhado" onUpgraded={reload} />;

  return (
    <AdminSection
      eyebrow="Álbum"
      title="Fotos dos convidados"
      lead="Contas novas começam sem fotos. O álbum completo do casal parceiro continua no desafio."
    >
      {error ? (
        <p className="hub-msg" role="alert">
          {error}
        </p>
      ) : null}
      {photos.length === 0 ? (
        <p className="hub-empty">Nenhuma foto ainda.</p>
      ) : (
        <ul className="hub-list">
          {photos.map((photo) => (
            <li key={photo.id}>
              <span>
                {photo.title || 'Foto'}
                {photo.guestName ? (
                  <span className="hub-list__meta"> · {photo.guestName}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AdminSection>
  );
}
