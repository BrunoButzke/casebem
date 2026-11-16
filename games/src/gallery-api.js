export function galleryImageUrl(id) {
  if (!id) return '';
  return `/api/desafio/gallery/${encodeURIComponent(id)}/image`;
}

export async function listGallery() {
  const res = await fetch('/api/desafio/gallery');
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || 'Não deu para carregar a galeria');
  return (data.photos || []).map((photo) => ({
    ...photo,
    preview: photo.preview || galleryImageUrl(photo.id),
  }));
}

export async function loadGalleryPhoto(id) {
  if (!id) return null;
  const res = await fetch(`/api/desafio/gallery/${encodeURIComponent(id)}`);
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
    res = await fetch('/api/desafio/gallery', { method: 'POST', body: form });
  } else {
    res = await fetch('/api/desafio/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Não deu para publicar a foto');
  return data.photo;
}

export async function unpublishGalleryPhoto({ guestName, missionId, id }) {
  const q = new URLSearchParams();
  if (id) q.set('id', id);
  else {
    q.set('guestName', guestName);
    q.set('missionId', missionId);
  }
  const res = await fetch(`/api/desafio/gallery?${q}`, { method: 'DELETE' });
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
