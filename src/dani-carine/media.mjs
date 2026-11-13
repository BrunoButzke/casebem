/**
 * Seção Playlist / vídeo — /api/media (esconde se vazio)
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderItems(items) {
  const [featured, ...rest] = items;
  const embed = featured?.embedUrl
    ? `<div class="playlist__embed">
        <iframe
          title="${escapeHtml(featured.title)}"
          src="${escapeHtml(featured.embedUrl)}"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      </div>`
    : '';

  const list =
    rest.length > 0
      ? `<ul class="playlist__tracks">
        ${rest
          .map(
            (i) => `<li>
            <a href="${escapeHtml(i.youtubeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(i.title)}</a>
          </li>`
          )
          .join('')}
      </ul>`
      : featured
        ? `<p class="playlist__featured-title">${escapeHtml(featured.title)}</p>`
        : '';

  return `${embed}${list}`;
}

export async function initMedia(fetchImpl = fetch) {
  const section = document.getElementById('playlist');
  const mount = document.getElementById('playlist-mount');
  if (!section || !mount) return;

  try {
    const res = await fetchImpl('/api/media');
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !Array.isArray(data.items) || data.items.length === 0) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    mount.innerHTML = renderItems(data.items);
  } catch {
    section.hidden = true;
  }
}
