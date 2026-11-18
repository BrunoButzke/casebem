/**
 * Aplica conteúdo do construtor Nossa página no DOM público.
 */

import {
  PUBLISHED_WEDDING_KEY,
  weddingKeyFromPathname,
} from '../../functions/_lib/wedding-path.mjs';

function sectionHasFilledContent(content) {
  if (!content || typeof content !== 'object') return false;
  return Object.values(content).some((v) => String(v ?? '').trim().length > 0);
}

function setText(sel, value, root = document, { clearEmpty = false } = {}) {
  const el = root.querySelector(sel);
  if (!el) return;
  if (value == null || value === '') {
    if (clearEmpty) el.textContent = '';
    return;
  }
  el.textContent = value;
}

function setHtmlParagraphs(sel, body, root = document, { clearEmpty = false } = {}) {
  const el = root.querySelector(sel);
  if (!el) return;
  if (body == null || body === '') {
    if (clearEmpty) el.innerHTML = '';
    return;
  }
  const parts = String(body)
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) {
    if (clearEmpty) el.innerHTML = '';
    return;
  }
  el.innerHTML = parts.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`).join('');
}

function setImg(sel, src, root = document, { clearEmpty = false } = {}) {
  const el = root.querySelector(sel);
  if (!el) return;
  if (!src) {
    if (clearEmpty) el.removeAttribute('src');
    return;
  }
  el.setAttribute('src', src);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sectionRoot(key) {
  if (key === 'hero') return document.querySelector('section.hero');
  if (key === 'rodape') return document.querySelector('.atmosphere') || document.querySelector('.footer');
  return document.getElementById(key);
}

function applyMarquee(text, clearEmpty) {
  const track = document.querySelector('.marquee__track');
  if (!track) return;
  const parts = String(text || '')
    .split(/[·|,;/]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) {
    if (clearEmpty) track.innerHTML = '';
    return;
  }
  const spans = [];
  for (const part of parts) {
    spans.push(`<span>${escapeHtml(part)}</span>`, '<span>·</span>');
  }
  track.innerHTML = spans.join('');
}

function mapsEmbedSrc(mapsUrl) {
  try {
    const u = new URL(mapsUrl);
    const q = u.searchParams.get('query') || u.searchParams.get('q') || mapsUrl;
    return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&hl=pt-BR&z=15&output=embed`;
  } catch {
    return `https://maps.google.com/maps?q=${encodeURIComponent(mapsUrl)}&hl=pt-BR&z=15&output=embed`;
  }
}

function applyMapsLinks(mapsUrl, localRoot) {
  const hasMaps = Boolean(String(mapsUrl || '').trim());
  document.querySelectorAll('[data-maps-cta]').forEach((el) => {
    el.hidden = !hasMaps;
    if (hasMaps) el.setAttribute('href', mapsUrl);
  });
  const btn = localRoot?.querySelector('.local__copy a.btn');
  if (btn) {
    btn.hidden = !hasMaps;
    if (hasMaps) btn.setAttribute('href', mapsUrl);
  }
  const mapFigure = localRoot?.querySelector('.local__map');
  if (mapFigure) {
    mapFigure.hidden = !hasMaps;
    const iframe = mapFigure.querySelector('iframe');
    if (iframe && hasMaps) iframe.setAttribute('src', mapsEmbedSrc(mapsUrl));
  }
}

function applyDressCards(c, root, opt) {
  const cards = root.querySelectorAll('.dress__card');
  if (cards[0]) {
    setImg('img', c.padrinhosImage, cards[0], opt);
    setText('h3', c.padrinhosTitle, cards[0], opt);
    setText('p', c.padrinhosText, cards[0], opt);
  }
  if (cards[1]) {
    setImg('img', c.paisImage, cards[1], opt);
    setText('h3', c.paisTitle, cards[1], opt);
    setText('p', c.paisText, cards[1], opt);
  }
  if (cards[2]) {
    const photo = cards[2].querySelector('.dress__photo') || cards[2].querySelector('img');
    if (photo) {
      const src = c.madrinhasImage || c.madrinhaRosaImage || '';
      if (src) photo.setAttribute('src', src);
      else if (opt.clearEmpty) photo.removeAttribute('src');
    }
    setText('h3', c.madrinhasTitle, cards[2], opt);
    const lead = cards[2].querySelector('p');
    if (lead) {
      if (c.madrinhasText) lead.textContent = c.madrinhasText;
      else if (opt.clearEmpty) lead.textContent = '';
    }
    const dots = cards[2].querySelectorAll('.dress__dot');
    const vipImages = [
      c.madrinhaRosaImage,
      c.madrinhaSalmaoImage,
      c.madrinhaCoralImage,
      c.madrinhaTerracotaImage,
    ];
    dots.forEach((dot, i) => {
      if (vipImages[i]) dot.setAttribute('data-image', vipImages[i]);
    });
  }
}

function applyBranding(c, opt) {
  const left = c.initialLeft || '';
  const right = c.initialRight || '';
  document.querySelectorAll('[data-initial-left]').forEach((el) => {
    if (left) el.textContent = left;
    else if (opt.clearEmpty) el.textContent = '';
  });
  document.querySelectorAll('[data-initial-right]').forEach((el) => {
    if (right) el.textContent = right;
    else if (opt.clearEmpty) el.textContent = '';
  });
  const logo = document.querySelector('.logo__mark');
  if (logo && (left || right || opt.clearEmpty)) {
    logo.innerHTML = `${escapeHtml(left || '')}<em>&amp;</em>${escapeHtml(right || '')}`;
  }
  const footerMark = document.querySelector('.footer__mark');
  if (footerMark && (left || right || opt.clearEmpty)) {
    footerMark.innerHTML = `${escapeHtml(left || '')} <em>&amp;</em> ${escapeHtml(right || '')}`;
  }
  setText('.footer__date', c.footerDate, document, opt);
  setText('.footer__note', c.footerNote, document, opt);
  setText('.atmosphere__text', c.atmosphereText, document, opt);
  setImg('.atmosphere__bg img', c.atmosphereImage, document, opt);
  const atmosphere = document.querySelector('.atmosphere');
  if (atmosphere) {
    const filled = Boolean(
      String(c.atmosphereText || '').trim() || String(c.atmosphereImage || '').trim()
    );
    if (opt.clearEmpty) atmosphere.hidden = !filled;
  }
}

function setVipColorPicker(enabled) {
  document.querySelectorAll('.dress__picker, .dress__card--madrinha .dress__picker').forEach((el) => {
    el.hidden = !enabled;
  });
  document.querySelectorAll('.dress__card--madrinha').forEach((card) => {
    card.classList.toggle('is-vip-locked', !enabled);
  });
}

function applySectionContent(key, content, { clearEmpty = false } = {}) {
  const c = content || {};
  const root = sectionRoot(key);
  if (!root) return;
  const opt = { clearEmpty };

  switch (key) {
    case 'hero':
      setText('.hero__eyebrow', c.eyebrow, root, opt);
      setText('.hero__title .line:first-child span', c.titleLeft, root, opt);
      setText('.hero__title .line:last-child span', c.titleRight, root, opt);
      setText('.hero__meta', c.dateText, root, opt);
      setText('.hero__cta', c.ctaLabel, root, opt);
      setImg('.hero__bg img', c.image, root, opt);
      if (c.marqueeText || clearEmpty) applyMarquee(c.marqueeText || '', clearEmpty);
      break;
    case 'boas-vindas':
      setText('.eyebrow', c.eyebrow, root, opt);
      setText('h2', c.title, root, opt);
      setHtmlParagraphs('.story__body', c.body, root, opt);
      break;
    case 'manifesto':
      if (c.title) {
        const mark = root.querySelector('.manifesto__text');
        if (mark) {
          const safe = escapeHtml(c.title);
          mark.innerHTML = /\bsim\b/i.test(c.title)
            ? safe.replace(/\bsim\b/gi, '<mark>$&</mark>')
            : safe;
        }
      } else if (clearEmpty) {
        const mark = root.querySelector('.manifesto__text');
        if (mark) mark.textContent = '';
      }
      setImg('.manifesto__img img', c.image, root, opt);
      if (c.eventDate) {
        root.setAttribute('data-event-date', c.eventDate);
        window.dispatchEvent(
          new CustomEvent('casebem:event-date', { detail: { eventDate: c.eventDate } })
        );
      }
      break;
    case 'o-casal':
      setText('.story__intro .eyebrow', c.eyebrow, root, opt);
      setText('.story__intro h2', c.title, root, opt);
      setHtmlParagraphs('.story__body--couple', c.body, root, opt);
      const figs = root.querySelectorAll('.story__portrait');
      if (figs[0]) {
        setImg('img', c.imageLeft, figs[0], opt);
        setText('figcaption', c.nameLeft, figs[0], opt);
      }
      if (figs[1]) {
        setImg('img', c.imageRight, figs[1], opt);
        setText('figcaption', c.nameRight, figs[1], opt);
      }
      break;
    case 'o-dia':
      setText('.eyebrow', c.eyebrow, root, opt);
      setText('.how__title', c.title, root, opt);
      const steps = root.querySelectorAll('.how__step');
      const frames = root.querySelectorAll('.how__frame img');
      const stepData = [
        [c.step1Title, c.step1Text, c.step1Image],
        [c.step2Title, c.step2Text, c.step2Image],
        [c.step3Title, c.step3Text, c.step3Image],
      ];
      stepData.forEach(([title, text, image], i) => {
        if (steps[i]) {
          setText('strong', title, steps[i], opt);
          setText('p', text, steps[i], opt);
        }
        if (frames[i]) {
          if (image) frames[i].setAttribute('src', image);
          else if (clearEmpty) frames[i].removeAttribute('src');
        }
      });
      break;
    case 'local':
      setText('.eyebrow', c.eyebrow, root, opt);
      setText('h2', c.title, root, opt);
      setText('.local__place', c.placeText, root, opt);
      setText('.local__hint', c.hintText, root, opt);
      applyMapsLinks(c.mapsUrl || '', root);
      break;
    case 'dress-code':
      setText('.eyebrow', c.eyebrow, root, opt);
      setText('h2', c.title, root, opt);
      setText('.dress__rule', c.ruleText, root, opt);
      applyDressCards(c, root, opt);
      break;
    case 'rodape':
      applyBranding(c, opt);
      break;
    case 'manual-convidado':
      setText('.eyebrow', c.eyebrow, root, opt);
      setText('h2', c.title, root, opt);
      setText('.manual__lead', c.lead, root, opt);
      setImg('.manual__figure img', c.image, root, opt);
      break;
    case 'confirmar-presenca':
      setText('.eyebrow', c.eyebrow, root, opt);
      setText('h2', c.title, root, opt);
      setText('.rsvp__lead', c.lead, root, opt);
      break;
    case 'presentes':
      setText('.eyebrow', c.eyebrow, root, opt);
      setText('h2', c.title, root, opt);
      {
        const lead = root.querySelector('.gifts__lead') || root.querySelector('p');
        if (lead && !lead.closest('article')) {
          if (c.lead) lead.textContent = c.lead;
          else if (clearEmpty) lead.textContent = '';
        }
      }
      break;
    case 'mural-recados':
      setText('.eyebrow', c.eyebrow, root, opt);
      setText('h2', c.title, root, opt);
      {
        const lead = root.querySelector('.messages__lead') || root.querySelector('p');
        if (lead && !lead.closest('form')) {
          if (c.lead) lead.textContent = c.lead;
          else if (clearEmpty) lead.textContent = '';
        }
      }
      break;
    default:
      break;
  }
}

export async function applySitePage(fetchFn = fetch, weddingKey = weddingKeyFromPathname(location.pathname)) {
  try {
    const q = weddingKey ? `?w=${encodeURIComponent(weddingKey)}` : '';
    const [pageRes, metaRes] = await Promise.all([
      fetchFn(`/api/site-page${q}`),
      fetchFn(`/api/wedding${q}`),
    ]);
    const data = await pageRes.json().catch(() => ({}));
    const meta = await metaRes.json().catch(() => ({}));
    if (!pageRes.ok || !data.ok) return;

    const clearEmpty = Boolean(weddingKey && weddingKey !== PUBLISHED_WEDDING_KEY);
    const isVip =
      String(meta.plan || '').toLowerCase() === 'vip' || weddingKey === PUBLISHED_WEDDING_KEY;
    setVipColorPicker(isVip);

    const byKey = new Map((data.sections || []).map((s) => [s.sectionKey, s]));
    const known = [
      'hero',
      'boas-vindas',
      'manifesto',
      'o-casal',
      'o-dia',
      'local',
      'dress-code',
      'manual-convidado',
      'confirmar-presenca',
      'presentes',
      'mural-recados',
      'rodape',
    ];

    for (const key of known) {
      const root = sectionRoot(key);
      if (!root && key !== 'rodape') continue;
      const section = byKey.get(key);
      const active = Boolean(section);
      const filled = sectionHasFilledContent(section?.content);
      const on = clearEmpty ? active && filled : active;
      if (root) root.hidden = !on;
      if (key === 'hero') {
        const marquee = document.querySelector('.marquee');
        if (marquee) marquee.hidden = !on;
      }
      if (key === 'rodape') {
        const footer = document.querySelector('.footer');
        if (footer && clearEmpty) footer.hidden = !on;
      }
      document.querySelectorAll(`a[href="#${CSS.escape(key)}"]`).forEach((a) => {
        a.hidden = !on;
      });
    }

    for (const section of data.sections || []) {
      applySectionContent(section.sectionKey, section.content, { clearEmpty });
    }

    // Iniciais: conteúdo do rodapé, senão nomes do casal / tenant
    const rodape = byKey.get('rodape')?.content || {};
    const couple = byKey.get('o-casal')?.content || {};
    if (!String(rodape.initialLeft || '').trim() || !String(rodape.initialRight || '').trim()) {
      const fromCouple = String(meta.coupleNames || '')
        .split('&')
        .map((s) => s.trim())
        .filter(Boolean);
      applyBranding(
        {
          ...rodape,
          initialLeft:
            rodape.initialLeft ||
            couple.nameLeft?.[0] ||
            fromCouple[0]?.[0] ||
            '',
          initialRight:
            rodape.initialRight ||
            couple.nameRight?.[0] ||
            fromCouple[1]?.[0] ||
            '',
        },
        { clearEmpty: false }
      );
    }

    // Maps / Como chegar: só com link preenchido na seção Local
    const local = byKey.get('local')?.content || {};
    applyMapsLinks(String(local.mapsUrl || '').trim(), document.getElementById('local'));

    if (meta.coupleNames) document.title = meta.coupleNames;
  } catch {
    // mantém HTML estático
  }
}
