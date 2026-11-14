/**
 * Validators — admin desafios (quiz, foto, cartões de selos)
 */

import { slugifyId } from './catalog-service.mjs';

export const WEDDING_KEY = 'dani-carine';

export const CHALLENGE_LIMITS = {
  PROMPT_MIN: 2,
  PROMPT_MAX: 200,
  TITLE_MIN: 2,
  TITLE_MAX: 100,
  NAME_MIN: 2,
  NAME_MAX: 80,
  REWARD_MIN: 2,
  REWARD_MAX: 200,
  BAR_HINT_MIN: 2,
  BAR_HINT_MAX: 120,
  FOOTER_MIN: 2,
  FOOTER_MAX: 160,
  OPTIONS_MIN: 2,
  OPTIONS_MAX: 4,
  POINTS_MIN: 1,
  POINTS_MAX: 999,
  STAMPS_MIN: 1,
  STAMPS_MAX: 50,
  ID_MIN: 2,
  ID_MAX: 40,
};

export const DEFAULT_STAMP_CARD_PALETTE = {
  cardBg: '#fdfbf8',
  cardAccent: '#d66d81',
  cardAccentSoft: '#f9e4e8',
  cardText: '#7d6e6a',
  cardBorder: '#e8b4bc',
  barHint: 'Mostre este cartão no bar',
  footerTemplate: 'Faltam {n} pontos para o próximo drink 🍸',
};

export const DEFAULT_FILL_MODE = 'stamp';
export const DEFAULT_POINTS_PER_SLOT = 10;

function parseFillMode(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_FILL_MODE;
  const v = String(raw).trim();
  if (v === 'stamp' || v === 'points') return v;
  return null;
}

function parsePointsPerSlot(raw, errors, { fallback = false } = {}) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return fallback ? DEFAULT_POINTS_PER_SLOT : undefined;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < CHALLENGE_LIMITS.POINTS_MIN || n > CHALLENGE_LIMITS.POINTS_MAX) {
    errors.push('pointsPerSlot inválido');
    return null;
  }
  return n;
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isHex(v) {
  return typeof v === 'string' && HEX.test(v.trim());
}

function parsePaletteFields(body, { required = false } = {}) {
  const errors = [];
  const out = {};
  const colorKeys = ['cardBg', 'cardAccent', 'cardAccentSoft', 'cardText', 'cardBorder'];

  for (const key of colorKeys) {
    if (body?.[key] !== undefined) {
      const v = String(body[key] || '').trim();
      if (!isHex(v)) errors.push(`${key} inválido (use #RGB ou #RRGGBB)`);
      else out[key] = v.toLowerCase();
    } else if (required) {
      out[key] = DEFAULT_STAMP_CARD_PALETTE[key];
    }
  }

  if (body?.barHint !== undefined) {
    const t = String(body.barHint || '').trim();
    if (t.length < CHALLENGE_LIMITS.BAR_HINT_MIN || t.length > CHALLENGE_LIMITS.BAR_HINT_MAX) {
      errors.push('barHint inválido');
    } else out.barHint = t;
  } else if (required) {
    out.barHint = DEFAULT_STAMP_CARD_PALETTE.barHint;
  }

  if (body?.footerTemplate !== undefined) {
    const t = String(body.footerTemplate || '').trim();
    if (t.length < CHALLENGE_LIMITS.FOOTER_MIN || t.length > CHALLENGE_LIMITS.FOOTER_MAX) {
      errors.push('footerTemplate inválido');
    } else out.footerTemplate = t;
  } else if (required) {
    out.footerTemplate = DEFAULT_STAMP_CARD_PALETTE.footerTemplate;
  }

  return { errors, data: out };
}

function normalizeOptions(raw) {
  return (Array.isArray(raw) ? raw : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .slice(0, CHALLENGE_LIMITS.OPTIONS_MAX);
}

function parseId(body, fallbackText) {
  const idRaw = body?.id != null ? String(body.id).trim() : '';
  return idRaw || slugifyId(fallbackText || 'item');
}

function validateId(id, errors) {
  if (
    id.length < CHALLENGE_LIMITS.ID_MIN ||
    id.length > CHALLENGE_LIMITS.ID_MAX ||
    !/^[a-z0-9][a-z0-9-]*$/.test(id)
  ) {
    errors.push('id inválido (a-z, 0-9, hífen)');
  }
}

function parsePoints(value, errors) {
  const points = Number(value);
  if (
    !Number.isInteger(points) ||
    points < CHALLENGE_LIMITS.POINTS_MIN ||
    points > CHALLENGE_LIMITS.POINTS_MAX
  ) {
    errors.push('points inválido');
    return null;
  }
  return points;
}

function parseSortOrder(body) {
  return Number.isInteger(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0;
}

export function validateQuestionCreate(body) {
  const errors = [];
  const prompt = String(body?.prompt || '').trim();
  const options = normalizeOptions(body?.options);
  const correctIndex = Number(body?.correctIndex);
  const points = parsePoints(body?.points, errors);
  const id = parseId(body, prompt);

  validateId(id, errors);
  if (prompt.length < CHALLENGE_LIMITS.PROMPT_MIN || prompt.length > CHALLENGE_LIMITS.PROMPT_MAX) {
    errors.push('prompt inválido');
  }
  if (options.length < CHALLENGE_LIMITS.OPTIONS_MIN || options.length > CHALLENGE_LIMITS.OPTIONS_MAX) {
    errors.push('informe de 2 a 4 respostas');
  }
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    errors.push('resposta correta inválida');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      id,
      prompt,
      options,
      correctIndex,
      points: points ?? Number(body?.points),
      active: body?.active !== false,
      sortOrder: parseSortOrder(body),
    },
  };
}

export function validateQuestionPatch(body) {
  const errors = [];
  const out = {};

  if (body.prompt !== undefined) {
    const prompt = String(body.prompt || '').trim();
    if (prompt.length < CHALLENGE_LIMITS.PROMPT_MIN || prompt.length > CHALLENGE_LIMITS.PROMPT_MAX) {
      errors.push('prompt inválido');
    } else out.prompt = prompt;
  }

  if (body.options !== undefined || body.correctIndex !== undefined) {
    if (body.options !== undefined) {
      const options = normalizeOptions(body.options);
      if (options.length < CHALLENGE_LIMITS.OPTIONS_MIN || options.length > CHALLENGE_LIMITS.OPTIONS_MAX) {
        errors.push('informe de 2 a 4 respostas');
      } else out.options = options;
    }
    if (body.correctIndex !== undefined) {
      const correctIndex = Number(body.correctIndex);
      const len = out.options?.length;
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        errors.push('resposta correta inválida');
      } else if (len != null && correctIndex >= len) {
        errors.push('resposta correta inválida');
      } else {
        out.correctIndex = correctIndex;
      }
    }
  }

  if (body.points !== undefined) {
    const points = parsePoints(body.points, errors);
    if (points != null) out.points = points;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') errors.push('active deve ser boolean');
    else out.active = body.active;
  }

  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
      errors.push('sortOrder inválido');
    } else out.sortOrder = sortOrder;
  }

  return { valid: errors.length === 0, errors, data: out };
}

export function validatePhotoMissionCreate(body) {
  const errors = [];
  const title = String(body?.title || '').trim();
  const points = parsePoints(body?.points, errors);
  const id = parseId(body, title);

  validateId(id, errors);
  if (title.length < CHALLENGE_LIMITS.TITLE_MIN || title.length > CHALLENGE_LIMITS.TITLE_MAX) {
    errors.push('title inválido');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      id,
      title,
      points: points ?? Number(body?.points),
      awardsStamp: Boolean(body?.awardsStamp),
      active: body?.active !== false,
      sortOrder: parseSortOrder(body),
    },
  };
}

export function validatePhotoMissionPatch(body) {
  const errors = [];
  const out = {};

  if (body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (title.length < CHALLENGE_LIMITS.TITLE_MIN || title.length > CHALLENGE_LIMITS.TITLE_MAX) {
      errors.push('title inválido');
    } else out.title = title;
  }

  if (body.points !== undefined) {
    const points = parsePoints(body.points, errors);
    if (points != null) out.points = points;
  }

  if (body.awardsStamp !== undefined) {
    if (typeof body.awardsStamp !== 'boolean') errors.push('awardsStamp deve ser boolean');
    else out.awardsStamp = body.awardsStamp;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') errors.push('active deve ser boolean');
    else out.active = body.active;
  }

  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
      errors.push('sortOrder inválido');
    } else out.sortOrder = sortOrder;
  }

  return { valid: errors.length === 0, errors, data: out };
}

export function validateStampCardCreate(body) {
  const errors = [];
  const name = String(body?.name || '').trim();
  const rewardText = String(body?.rewardText || '').trim();
  const stampsRequired = Number(body?.stampsRequired);
  const id = parseId(body, name);
  const palette = parsePaletteFields(body, { required: true });

  validateId(id, errors);
  if (name.length < CHALLENGE_LIMITS.NAME_MIN || name.length > CHALLENGE_LIMITS.NAME_MAX) {
    errors.push('name inválido');
  }
  if (
    !Number.isInteger(stampsRequired) ||
    stampsRequired < CHALLENGE_LIMITS.STAMPS_MIN ||
    stampsRequired > CHALLENGE_LIMITS.STAMPS_MAX
  ) {
    errors.push('stampsRequired inválido');
  }
  if (rewardText.length < CHALLENGE_LIMITS.REWARD_MIN || rewardText.length > CHALLENGE_LIMITS.REWARD_MAX) {
    errors.push('rewardText inválido');
  }
  errors.push(...palette.errors);

  const fillMode = parseFillMode(body?.fillMode);
  if (!fillMode) errors.push('fillMode inválido');
  const pointsPerSlot = parsePointsPerSlot(body?.pointsPerSlot, errors, { fallback: true });

  return {
    valid: errors.length === 0,
    errors,
    data: {
      id,
      name,
      stampsRequired,
      rewardText,
      fillMode: fillMode || DEFAULT_FILL_MODE,
      pointsPerSlot: pointsPerSlot ?? DEFAULT_POINTS_PER_SLOT,
      ...palette.data,
      active: body?.active !== false,
      sortOrder: parseSortOrder(body),
    },
  };
}

export function validateStampCardPatch(body) {
  const errors = [];
  const out = {};
  const palette = parsePaletteFields(body, { required: false });

  if (body.name !== undefined) {
    const name = String(body.name || '').trim();
    if (name.length < CHALLENGE_LIMITS.NAME_MIN || name.length > CHALLENGE_LIMITS.NAME_MAX) {
      errors.push('name inválido');
    } else out.name = name;
  }

  if (body.stampsRequired !== undefined) {
    const stampsRequired = Number(body.stampsRequired);
    if (
      !Number.isInteger(stampsRequired) ||
      stampsRequired < CHALLENGE_LIMITS.STAMPS_MIN ||
      stampsRequired > CHALLENGE_LIMITS.STAMPS_MAX
    ) {
      errors.push('stampsRequired inválido');
    } else out.stampsRequired = stampsRequired;
  }

  if (body.rewardText !== undefined) {
    const rewardText = String(body.rewardText || '').trim();
    if (rewardText.length < CHALLENGE_LIMITS.REWARD_MIN || rewardText.length > CHALLENGE_LIMITS.REWARD_MAX) {
      errors.push('rewardText inválido');
    } else out.rewardText = rewardText;
  }

  if (body.fillMode !== undefined) {
    const fillMode = parseFillMode(body.fillMode);
    if (!fillMode) errors.push('fillMode inválido');
    else out.fillMode = fillMode;
  }

  if (body.pointsPerSlot !== undefined) {
    const pointsPerSlot = parsePointsPerSlot(body.pointsPerSlot, errors);
    if (pointsPerSlot != null) out.pointsPerSlot = pointsPerSlot;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') errors.push('active deve ser boolean');
    else out.active = body.active;
  }

  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
      errors.push('sortOrder inválido');
    } else out.sortOrder = sortOrder;
  }

  errors.push(...palette.errors);
  Object.assign(out, palette.data);

  return { valid: errors.length === 0, errors, data: out };
}
