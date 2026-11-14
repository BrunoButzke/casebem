/**
 * Visual theme — app dos desafios + cartão fidelidade
 */

import { WEDDING_KEY } from './challenges-validators.mjs';

const DEFAULT_THEME = {
  weddingKey: WEDDING_KEY,
  appBgFrom: '#f8f0ef',
  appBgMid: '#f4f6f0',
  appBgTo: '#f8f3ec',
  appRose: '#d47a86',
  appRoseDeep: '#c45d6c',
  appInk: '#4a3a38',
  appMuted: '#7d6e6a',
  cardTitle: 'CARTÃO FIDELIDADE DO AMOR',
  cardBg: '#fdfbf8',
  cardAccent: '#d66d81',
  cardAccentSoft: '#f9e4e8',
  cardText: '#7d6e6a',
  cardBorder: '#e8b4bc',
  cardSlots: 5,
  cardRewardLabel: 'drinks secretos liberados!',
  cardBarHint: 'Mostre este cartão no bar',
  cardFooterTemplate: 'Faltam {n} pontos para o próximo drink 🍸',
  updatedAt: null,
};

let memoryTheme = null;

export function resetMemoryDesafioThemeForTests() {
  memoryTheme = null;
}

export function getDefaultDesafioTheme() {
  return { ...DEFAULT_THEME };
}

function rowToTheme(row) {
  if (!row) return { ...DEFAULT_THEME };
  return {
    weddingKey: row.wedding_key ?? row.weddingKey ?? WEDDING_KEY,
    appBgFrom: row.app_bg_from ?? row.appBgFrom ?? DEFAULT_THEME.appBgFrom,
    appBgMid: row.app_bg_mid ?? row.appBgMid ?? DEFAULT_THEME.appBgMid,
    appBgTo: row.app_bg_to ?? row.appBgTo ?? DEFAULT_THEME.appBgTo,
    appRose: row.app_rose ?? row.appRose ?? DEFAULT_THEME.appRose,
    appRoseDeep: row.app_rose_deep ?? row.appRoseDeep ?? DEFAULT_THEME.appRoseDeep,
    appInk: row.app_ink ?? row.appInk ?? DEFAULT_THEME.appInk,
    appMuted: row.app_muted ?? row.appMuted ?? DEFAULT_THEME.appMuted,
    cardTitle: row.card_title ?? row.cardTitle ?? DEFAULT_THEME.cardTitle,
    cardBg: row.card_bg ?? row.cardBg ?? DEFAULT_THEME.cardBg,
    cardAccent: row.card_accent ?? row.cardAccent ?? DEFAULT_THEME.cardAccent,
    cardAccentSoft: row.card_accent_soft ?? row.cardAccentSoft ?? DEFAULT_THEME.cardAccentSoft,
    cardText: row.card_text ?? row.cardText ?? DEFAULT_THEME.cardText,
    cardBorder: row.card_border ?? row.cardBorder ?? DEFAULT_THEME.cardBorder,
    cardSlots: Number(row.card_slots ?? row.cardSlots ?? DEFAULT_THEME.cardSlots),
    cardRewardLabel: row.card_reward_label ?? row.cardRewardLabel ?? DEFAULT_THEME.cardRewardLabel,
    cardBarHint: row.card_bar_hint ?? row.cardBarHint ?? DEFAULT_THEME.cardBarHint,
    cardFooterTemplate:
      row.card_footer_template ?? row.cardFooterTemplate ?? DEFAULT_THEME.cardFooterTemplate,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isHex(v) {
  return typeof v === 'string' && HEX.test(v.trim());
}

export function validateDesafioThemePatch(body) {
  const errors = [];
  const out = {};

  const colorFields = [
    ['appBgFrom', 'appBgFrom'],
    ['appBgMid', 'appBgMid'],
    ['appBgTo', 'appBgTo'],
    ['appRose', 'appRose'],
    ['appRoseDeep', 'appRoseDeep'],
    ['appInk', 'appInk'],
    ['appMuted', 'appMuted'],
    ['cardBg', 'cardBg'],
    ['cardAccent', 'cardAccent'],
    ['cardAccentSoft', 'cardAccentSoft'],
    ['cardText', 'cardText'],
    ['cardBorder', 'cardBorder'],
  ];

  for (const [key] of colorFields) {
    if (body[key] !== undefined) {
      const v = String(body[key] || '').trim();
      if (!isHex(v)) errors.push(`${key} inválido (use #RGB ou #RRGGBB)`);
      else out[key] = v.toLowerCase();
    }
  }

  if (body.cardTitle !== undefined) {
    const t = String(body.cardTitle || '').trim();
    if (t.length < 2 || t.length > 80) errors.push('cardTitle inválido');
    else out.cardTitle = t;
  }
  if (body.cardRewardLabel !== undefined) {
    const t = String(body.cardRewardLabel || '').trim();
    if (t.length < 2 || t.length > 120) errors.push('cardRewardLabel inválido');
    else out.cardRewardLabel = t;
  }
  if (body.cardBarHint !== undefined) {
    const t = String(body.cardBarHint || '').trim();
    if (t.length < 2 || t.length > 120) errors.push('cardBarHint inválido');
    else out.cardBarHint = t;
  }
  if (body.cardFooterTemplate !== undefined) {
    const t = String(body.cardFooterTemplate || '').trim();
    if (t.length < 2 || t.length > 160) errors.push('cardFooterTemplate inválido');
    else out.cardFooterTemplate = t;
  }
  if (body.cardSlots !== undefined) {
    const n = Number(body.cardSlots);
    if (!Number.isInteger(n) || n < 1 || n > 12) errors.push('cardSlots inválido (1–12)');
    else out.cardSlots = n;
  }

  return { valid: errors.length === 0, errors, data: out };
}

export async function getDesafioTheme(db) {
  if (!db) {
    if (!memoryTheme) memoryTheme = { ...DEFAULT_THEME };
    return { ...memoryTheme };
  }

  try {
    const row = await db
      .prepare(`SELECT * FROM desafio_theme WHERE wedding_key = ?`)
      .bind(WEDDING_KEY)
      .first();
    if (!row) {
      const now = new Date().toISOString();
      await db
        .prepare(`INSERT INTO desafio_theme (wedding_key, updated_at) VALUES (?, ?)`)
        .bind(WEDDING_KEY, now)
        .run();
      return { ...DEFAULT_THEME, updatedAt: now };
    }
    return rowToTheme(row);
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export async function updateDesafioTheme(db, patch) {
  const validation = validateDesafioThemePatch(patch || {});
  if (!validation.valid) {
    const err = new Error('VALIDATION');
    err.details = validation.errors;
    throw err;
  }
  const d = validation.data;
  if (Object.keys(d).length === 0) throw new Error('EMPTY_PATCH');

  const current = await getDesafioTheme(db);
  const next = { ...current, ...d, updatedAt: new Date().toISOString() };

  if (!db) {
    memoryTheme = next;
    return { ...next };
  }

  await db
    .prepare(
      `INSERT INTO desafio_theme (
        wedding_key, app_bg_from, app_bg_mid, app_bg_to, app_rose, app_rose_deep, app_ink, app_muted,
        card_title, card_bg, card_accent, card_accent_soft, card_text, card_border, card_slots,
        card_reward_label, card_bar_hint, card_footer_template, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(wedding_key) DO UPDATE SET
        app_bg_from = excluded.app_bg_from,
        app_bg_mid = excluded.app_bg_mid,
        app_bg_to = excluded.app_bg_to,
        app_rose = excluded.app_rose,
        app_rose_deep = excluded.app_rose_deep,
        app_ink = excluded.app_ink,
        app_muted = excluded.app_muted,
        card_title = excluded.card_title,
        card_bg = excluded.card_bg,
        card_accent = excluded.card_accent,
        card_accent_soft = excluded.card_accent_soft,
        card_text = excluded.card_text,
        card_border = excluded.card_border,
        card_slots = excluded.card_slots,
        card_reward_label = excluded.card_reward_label,
        card_bar_hint = excluded.card_bar_hint,
        card_footer_template = excluded.card_footer_template,
        updated_at = excluded.updated_at`
    )
    .bind(
      WEDDING_KEY,
      next.appBgFrom,
      next.appBgMid,
      next.appBgTo,
      next.appRose,
      next.appRoseDeep,
      next.appInk,
      next.appMuted,
      next.cardTitle,
      next.cardBg,
      next.cardAccent,
      next.cardAccentSoft,
      next.cardText,
      next.cardBorder,
      next.cardSlots,
      next.cardRewardLabel,
      next.cardBarHint,
      next.cardFooterTemplate,
      next.updatedAt
    )
    .run();

  return next;
}

/** CSS custom properties for the games SPA */
export function themeToCssVars(theme) {
  const t = theme || DEFAULT_THEME;
  return {
    '--blush': t.appBgFrom,
    '--mint-mist': t.appBgMid,
    '--peach': t.appBgTo,
    '--rose': t.appRose,
    '--rose-deep': t.appRoseDeep,
    '--ink': t.appInk,
    '--muted': t.appMuted,
    '--card-loyalty-bg': t.cardBg,
    '--card-loyalty-accent': t.cardAccent,
    '--card-loyalty-accent-soft': t.cardAccentSoft,
    '--card-loyalty-text': t.cardText,
    '--card-loyalty-border': t.cardBorder,
  };
}
