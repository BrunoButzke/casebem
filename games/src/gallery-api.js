import { desafioUrl } from './game-api.mjs';

export function galleryImageUrl(id) {
  if (!id) return '';
  return desafioUrl(`/api/desafio/gallery/${encodeURIComponent(id)}/image`);
}

export async function listGallery() {
  const res = await fetch(desafioUrl('/api/desafio/gallery'), { credentials: 'omit' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || 'Não deu para carregar a galeria');
  return (data.photos || []).map((photo) => ({
    ...photo,
    preview: photo.preview || galleryImageUrl(photo.id),
  }));
}

export async function loadGalleryPhoto(id) {
  if (!id) return null;
  const res = await fetch(desafioUrl(`/api/desafio/gallery/${encodeURIComponent(id)}`), {
    credentials: 'omit',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || 'Não deu para abrir a foto');
  return {
    ...data.photo,
    preview: data.photo?.preview || galleryImageUrl(id),
  };
}

export async function publishGalleryPhoto(body) {
  const file = body?.file || body?.blob;
  let res;
  if (file instanceof Blob) {
    const form = new FormData();
    form.set('guestName', body.guestName);
    form.set('missionId', body.missionId);
    form.set('title', body.title);
    form.set('file', file, 'photo.jpg');
    res = await fetch(desafioUrl('/api/desafio/gallery'), { method: 'POST', body: form, credentials: 'omit' });
  } else {
    res = await fetch(desafioUrl('/api/desafio/gallery'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(body),
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Não deu para publicar a foto');
  return data.photo;
}

export async function unpublishGalleryPhoto({ guestName, missionId }) {
  const res = await fetch(
    desafioUrl('/api/desafio/gallery', { search: { guestName, missionId } }),
    { method: 'DELETE', credentials: 'omit' }
  );
  if (res.status === 404) return false;
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Não deu para excluir a foto');
  return true;
}

export function prefetchGalleryImage(id) {
  if (!id || typeof Image === 'undefined') return;
  const img = new Image();
  img.src = galleryImageUrl(id);
}