/**
 * Seção Hospedagem / dicas — carrega /api/lodging (fallback estático embutido no HTML vazio).
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTip(tip) {
  const area = tip.area ? `<p class="lodging__area">${escapeHtml(tip.area)}</p>` : '';
  const links = [];
  if (tip.mapsUrl) {
    links.push(
      `<a class="lodging__link" href="${escapeHtml(tip.mapsUrl)}" target="_blank" rel="noopener noreferrer">Ver no mapa</a>`
    );
  }
  if (tip.websiteUrl) {
    links.push(
      `<a class="lodging__link" href="${escapeHtml(tip.websiteUrl)}" target="_blank" rel="noopener noreferrer">Site</a>`
    );
  }
  const linkRow = links.length
    ? `<p class="lodging__links">${links.join('<span aria-hidden="true"> · </span>')}</p>`
    : '';

  return `<article class="lodging__item reveal" data-lodging-id="${escapeHtml(tip.id)}">
    <h3>${escapeHtml(tip.name)}</h3>
    ${area}
    <p>${escapeHtml(tip.description)}</p>
    ${linkRow}
  </article>`;
}

export async function initLodging(fetchImpl = fetch) {
  const list = document.getElementById('lodging-list');
  const section = document.getElementById('hospedagem');
  if (!list || !section) return;

  try {
    const res = await fetchImpl('/api/lodging');
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !Array.isArray(data.tips) || data.tips.length === 0) {
      return; // mantém conteúdo estático do HTML se existir
    }
    list.innerHTML = data.tips.map(renderTip).join('');
  } catch {
    // silent — seed HTML / empty list
  }
}
