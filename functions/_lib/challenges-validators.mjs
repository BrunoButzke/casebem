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
  OPTIONS_MIN: 2,
  OPTIONS_MAX: 4,
  POINTS_MIN: 1,
  POINTS_MAX: 999,
  STAMPS_MIN: 1,
  STAMPS_MAX: 50,
  ID_MIN: 2,
  ID_MAX: 40,
};

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

  return {
    valid: errors.length === 0,
    errors,
    data: {
      id,
      name,
      stampsRequired,
      rewardText,
      active: body?.active !== false,
      sortOrder: parseSortOrder(body),
    },
  };
}

export function validateStampCardPatch(body) {
  const errors = [];
  const out = {};

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
