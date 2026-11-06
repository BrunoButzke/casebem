/**
 * Seção Convite / papelaria — botões WhatsApp a partir de /api/stationery
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTemplate(t) {
  const share =
    t.shareUrl && t.kind === 'whatsapp'
      ? `<a class="btn btn--sm magnetic stationery__wa" href="${escapeHtml(t.shareUrl)}" target="_blank" rel="noopener noreferrer">Abrir no WhatsApp</a>`
      : '';
  const copyBtn = `<button type="button" class="btn btn--ghost btn--sm stationery__copy" data-copy-text="${escapeHtml(t.text)}">Copiar texto</button>`;

  return `<article class="stationery__item reveal" data-stationery-id="${escapeHtml(t.id)}">
    <h3>${escapeHtml(t.title)}</h3>
    <p class="stationery__preview">${escapeHtml(t.text)}</p>
    <div class="stationery__actions">${share}${copyBtn}</div>
  </article>`;
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export async function initStationery(fetchImpl = fetch) {
  const list = document.getElementById('stationery-list');
  const section = document.getElementById('convite');
  if (!list || !section) return;

  list.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-copy-text]');
    if (!btn) return;
    const text = btn.getAttribute('data-copy-text') || '';
    const ok = await copyText(text);
    const prev = btn.textContent;
    btn.textContent = ok ? 'Copiado!' : 'Falhou';
    setTimeout(() => {
      btn.textContent = prev;
    }, 1600);
  });

  try {
    const res = await fetchImpl('/api/stationery');
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !Array.isArray(data.templates) || data.templates.length === 0) {
      return;
    }
    list.innerHTML = data.templates.map(renderTemplate).join('');
  } catch {
    // keep static HTML
  }
}
