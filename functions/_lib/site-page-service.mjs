/**
 * Construtor Nossa página — seções editáveis do site do casamento.
 */

import { WEDDING_KEY } from './messages-validators.mjs';

const MAX_IMAGE = 180_000;

/** Campos VIP (seleção de cores das madrinhas). */
export const VIP_SITE_FIELDS = new Set([
  'madrinhaRosaImage',
  'madrinhaSalmaoImage',
  'madrinhaCoralImage',
  'madrinhaTerracotaImage',
]);

/** Catálogo fixo das seções (espelha a página Dani & Carine). */
export const SITE_SECTION_DEFS = [
  {
    key: 'hero',
    label: 'Hero / capa',
    sortOrder: 10,
    fields: ['eyebrow', 'titleLeft', 'titleRight', 'dateText', 'ctaLabel', 'image', 'marqueeText'],
  },
  {
    key: 'boas-vindas',
    label: 'Boas-vindas',
    sortOrder: 20,
    fields: ['eyebrow', 'title', 'body'],
  },
  {
    key: 'manifesto',
    label: 'Manifesto / contagem',
    sortOrder: 30,
    fields: ['title', 'image', 'eventDate'],
  },
  {
    key: 'o-casal',
    label: 'O casal',
    sortOrder: 40,
    fields: ['eyebrow', 'title', 'body', 'nameLeft', 'nameRight', 'imageLeft', 'imageRight'],
  },
  {
    key: 'o-dia',
    label: 'O dia (momentos)',
    sortOrder: 50,
    fields: [
      'eyebrow',
      'title',
      'step1Title',
      'step1Text',
      'step1Image',
      'step2Title',
      'step2Text',
      'step2Image',
      'step3Title',
      'step3Text',
      'step3Image',
    ],
  },
  {
    key: 'local',
    label: 'Local',
    sortOrder: 60,
    fields: ['eyebrow', 'title', 'placeText', 'hintText', 'mapsUrl'],
  },
  {
    key: 'dress-code',
    label: 'Dress code',
    sortOrder: 70,
    fields: [
      'eyebrow',
      'title',
      'ruleText',
      'padrinhosTitle',
      'padrinhosText',
      'padrinhosImage',
      'paisTitle',
      'paisText',
      'paisImage',
      'madrinhasTitle',
      'madrinhasText',
      'madrinhasImage',
      'madrinhaRosaImage',
      'madrinhaSalmaoImage',
      'madrinhaCoralImage',
      'madrinhaTerracotaImage',
    ],
    vipFields: [
      'madrinhaRosaImage',
      'madrinhaSalmaoImage',
      'madrinhaCoralImage',
      'madrinhaTerracotaImage',
    ],
  },
  {
    key: 'manual-convidado',
    label: 'Manual do convidado',
    sortOrder: 80,
    fields: ['eyebrow', 'title', 'lead', 'image'],
  },
  {
    key: 'confirmar-presenca',
    label: 'Confirmar presença',
    sortOrder: 90,
    fields: ['eyebrow', 'title', 'lead', 'deadlineText'],
  },
  {
    key: 'presentes',
    label: 'Presentes',
    sortOrder: 100,
    fields: ['eyebrow', 'title', 'lead'],
  },
  {
    key: 'mural-recados',
    label: 'Mural de recados',
    sortOrder: 110,
    fields: ['eyebrow', 'title', 'lead'],
  },
  {
    key: 'rodape',
    label: 'Rodapé e identidade',
    sortOrder: 120,
    fields: [
      'initialLeft',
      'initialRight',
      'footerDate',
      'footerNote',
      'atmosphereText',
      'atmosphereImage',
    ],
  },
];

const DEFAULT_CONTENT = {
  hero: {
    eyebrow: 'Florianópolis · Lagoa da Conceição',
    titleLeft: 'Dani',
    titleRight: 'Carine',
    dateText: '21 de novembro · 8h',
    ctaLabel: 'O grande dia',
    image: '/images/hero-casal.jpg',
    marqueeText: 'Lagoa · Florianópolis · Para sempre · Indaiá · Amanhecer · Canto da Lagoa · Dani & Carine',
  },
  'boas-vindas': {
    eyebrow: 'Bem-vindos',
    title: 'Sejam muito bem-vindos ao nosso cantinho especial!',
    body:
      'Criamos este site para compartilhar com vocês todos os detalhes do nosso grande dia.\n\nEstamos ansiosos para celebrar esse dia tão especial com vocês!',
  },
  manifesto: {
    title: 'Um sim ao amanhecer.',
    image: '/images/indaia-noite.jpg',
    eventDate: '2026-11-21T08:00:00-03:00',
  },
  'o-casal': {
    eyebrow: 'Nossa história',
    title: 'O casal',
    body:
      'Acreditamos que o amor é um ato de sonhar — sonhar com uma vida compartilhada, construída com companheirismo, respeito e amizade.',
    nameLeft: 'Dani',
    nameRight: 'Carine',
    imageLeft: '/images/casal-dani.png',
    imageRight: '/images/casal-carine.png',
  },
  'o-dia': {
    eyebrow: 'O dia',
    title: 'Três momentos',
    step1Title: 'Cerimônia',
    step1Text: '21 de novembro · 8h',
    step1Image: '/images/cerimonia-altar.png',
    step2Title: 'Brunch',
    step2Text: 'Buffet de café da manhã',
    step2Image: '/images/brunch-saloes.png',
    step3Title: 'Festa',
    step3Text: 'Indaiá Eventos',
    step3Image: '/images/festa-danca.jpg',
  },
  local: {
    eyebrow: 'Local',
    title: 'Indaiá Eventos',
    placeText: 'Canto da Lagoa · Florianópolis',
    hintText: 'Lagoa da Conceição',
    mapsUrl:
      'https://www.google.com/maps/search/?api=1&query=Indai%C3%A1+Eventos+Canto+da+Lagoa+Florian%C3%B3polis',
  },
  'dress-code': {
    eyebrow: 'Dress code',
    title: 'Social completo',
    ruleText: 'Branco proibido',
    padrinhosTitle: 'Padrinhos',
    padrinhosText: 'Cinza claro · gravata verde',
    padrinhosImage: '/images/dress-padrinho.jpg',
    paisTitle: 'Pais',
    paisText: 'Cinza escuro · gravata salmão',
    paisImage: '/images/dress-pais.jpg',
    madrinhasTitle: 'Madrinhas',
    madrinhasText: 'Toque na cor para ver o vestido',
    madrinhasImage: '/images/madrinha-rosa.jpg',
    madrinhaRosaImage: '/images/madrinha-rosa.jpg',
    madrinhaSalmaoImage: '/images/madrinha-salmao.jpg',
    madrinhaCoralImage: '/images/madrinha-coral.jpg',
    madrinhaTerracotaImage: '/images/madrinha-terracota.jpg',
  },
  'manual-convidado': {
    eyebrow: 'Para os convidados',
    title: 'Manual do convidado',
    lead: 'Um guia carinhoso com o que importa no nosso grande dia.',
    image: '/images/manual-convidado.png',
  },
  'confirmar-presenca': {
    eyebrow: 'Confirme sua presença',
    title: 'Você vai estar com a gente?',
    lead: 'Sua presença é o nosso maior presente. Confirme até 15 de novembro.',
    deadlineText: '15 de novembro',
  },
  presentes: {
    eyebrow: 'Lista',
    title: 'Presentes',
    lead: 'Escolha com carinho — o valor vira Pix para nós.',
  },
  'mural-recados': {
    eyebrow: 'Mural',
    title: 'Recados',
    lead: 'Deixe uma mensagem carinhosa para o casal.',
  },
  rodape: {
    initialLeft: 'D',
    initialRight: 'C',
    footerDate: '21 · 11 · 2026',
    footerNote: 'Imagens geradas com base nas fotos do casal',
    atmosphereText: 'Florianópolis · Lagoa da Conceição',
    atmosphereImage: '/images/indaia-noite.jpg',
  },
};

/** @type {Map<string, object[]>} */
let memorySections = new Map();

export function resetSiteSectionsForTests() {
  memorySections = new Map();
}

function parseContent(raw) {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function rowToSection(row, def) {
  return {
    id: row.id,
    sectionKey: row.section_key || row.sectionKey || def?.key,
    label: row.label || def?.label || row.section_key,
    active: row.active === undefined ? true : Boolean(Number(row.active)),
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? def?.sortOrder ?? 0),
    content: parseContent(row.content_json ?? row.contentJson ?? row.content),
    fields: def?.fields || [],
    vipFields: def?.vipFields || [],
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}

export function sectionHasFilledContent(content) {
  if (!content || typeof content !== 'object') return false;
  return Object.values(content).some((v) => String(v ?? '').trim().length > 0);
}

export function siteHasFilledContent(sections) {
  return (sections || []).some((s) => sectionHasFilledContent(s?.content));
}

function seedContentForWedding(weddingKey, sectionKey) {
  if (weddingKey === WEDDING_KEY) return DEFAULT_CONTENT[sectionKey] || {};
  return {};
}

function seedActiveForWedding(weddingKey) {
  // Casal parceiro já publicado: seções ativas. Novos tenants: desmarcadas.
  return weddingKey === WEDDING_KEY ? 1 : 0;
}

function defaultsForWedding(weddingKey) {
  const active = seedActiveForWedding(weddingKey);
  return SITE_SECTION_DEFS.map((def) => ({
    id: `${weddingKey}:${def.key}`,
    section_key: def.key,
    label: def.label,
    active,
    sort_order: def.sortOrder,
    content_json: JSON.stringify(seedContentForWedding(weddingKey, def.key)),
    updated_at: new Date().toISOString(),
  }));
}

async function ensureSeeded(db, weddingKey) {
  if (!db) {
    if (!memorySections.has(weddingKey)) {
      memorySections.set(weddingKey, defaultsForWedding(weddingKey));
    }
    return;
  }
  const existing = await db
    .prepare(`SELECT COUNT(*) AS c FROM site_sections WHERE wedding_key = ?`)
    .bind(weddingKey)
    .first();
  if (Number(existing?.c || 0) > 0) return;

  const now = new Date().toISOString();
  const active = seedActiveForWedding(weddingKey);
  for (const def of SITE_SECTION_DEFS) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO site_sections
          (id, wedding_key, section_key, label, active, sort_order, content_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `${weddingKey}:${def.key}`,
        weddingKey,
        def.key,
        def.label,
        active,
        def.sortOrder,
        JSON.stringify(seedContentForWedding(weddingKey, def.key)),
        now
      )
      .run();
  }
}

function sanitizeContent(input, fields) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  const allowed = new Set(fields || []);
  for (const key of allowed) {
    if (!(key in src)) continue;
    let val = src[key];
    if (val == null) {
      out[key] = '';
      continue;
    }
    val = String(val).trim();
    if (key.toLowerCase().includes('image') || key === 'image') {
      if (val.startsWith('data:image/')) {
        if (val.length > MAX_IMAGE) {
          const err = new Error('IMAGE_TOO_LARGE');
          err.details = 'Imagem grande demais. Comprima e tente de novo.';
          throw err;
        }
      } else if (val && !val.startsWith('/') && !val.startsWith('https://')) {
        const err = new Error('IMAGE_INVALID');
        err.details = 'Imagem deve ser upload ou URL /https.';
        throw err;
      }
    }
    if (key === 'mapsUrl' && val && !val.startsWith('https://') && !val.startsWith('http://')) {
      const err = new Error('URL_INVALID');
      err.details = 'URL do Maps inválida.';
      throw err;
    }
    const max =
      key === 'body' ? 4000 : key === 'marqueeText' ? 800 : key === 'mapsUrl' ? 800 : 500;
    out[key] = val.slice(0, max);
  }
  return out;
}

export async function listSiteSectionsAdmin(db, weddingKey = WEDDING_KEY) {
  await ensureSeeded(db, weddingKey);
  if (!db) {
    return (memorySections.get(weddingKey) || [])
      .map((row) => {
        const def = SITE_SECTION_DEFS.find((d) => d.key === row.section_key);
        return rowToSection(row, def);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  const result = await db
    .prepare(
      `SELECT id, wedding_key, section_key, label, active, sort_order, content_json, updated_at
       FROM site_sections
       WHERE wedding_key = ?
       ORDER BY sort_order ASC, section_key ASC`
    )
    .bind(weddingKey)
    .all();
  return (result?.results || []).map((row) => {
    const def = SITE_SECTION_DEFS.find((d) => d.key === row.section_key);
    return rowToSection(row, def);
  });
}

/** Público: só seções ativas + conteúdo. */
export async function listSiteSectionsPublic(db, weddingKey = WEDDING_KEY) {
  const all = await listSiteSectionsAdmin(db, weddingKey);
  return all
    .filter((s) => s.active)
    .map((s) => ({
      sectionKey: s.sectionKey,
      content: s.content,
      sortOrder: s.sortOrder,
    }));
}

export async function updateSiteSection(db, sectionKey, patch, weddingKey = WEDDING_KEY) {
  await ensureSeeded(db, weddingKey);
  const key = String(sectionKey || '').trim();
  const def = SITE_SECTION_DEFS.find((d) => d.key === key);
  if (!def) {
    const err = new Error('SECTION_NOT_FOUND');
    err.details = 'Seção inválida.';
    throw err;
  }

  const list = await listSiteSectionsAdmin(db, weddingKey);
  const current = list.find((s) => s.sectionKey === key);
  if (!current) {
    const err = new Error('SECTION_NOT_FOUND');
    err.details = 'Seção não encontrada.';
    throw err;
  }

  let active = current.active;
  if (patch?.active !== undefined) active = Boolean(patch.active);

  let content = current.content;
  if (patch?.content !== undefined) {
    content = { ...content, ...sanitizeContent(patch.content, def.fields) };
  }

  const now = new Date().toISOString();
  const contentJson = JSON.stringify(content);

  if (!db) {
    const rows = memorySections.get(weddingKey) || [];
    memorySections.set(
      weddingKey,
      rows.map((r) =>
        r.section_key === key
          ? { ...r, active: active ? 1 : 0, content_json: contentJson, updated_at: now }
          : r
      )
    );
    return (await listSiteSectionsAdmin(db, weddingKey)).find((s) => s.sectionKey === key);
  }

  await db
    .prepare(
      `UPDATE site_sections
       SET active = ?, content_json = ?, updated_at = ?
       WHERE wedding_key = ? AND section_key = ?`
    )
    .bind(active ? 1 : 0, contentJson, now, weddingKey, key)
    .run();

  return (await listSiteSectionsAdmin(db, weddingKey)).find((s) => s.sectionKey === key);
}
