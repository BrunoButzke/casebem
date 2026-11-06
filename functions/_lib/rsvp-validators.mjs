/**
 * Validators for RSVP system
 * Wedding: Dani & Carine
 */

export const WEDDING_KEY = 'dani-carine';

export const LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 100,
  ADULTS_MIN: 0,
  ADULTS_MAX: 10,
  CHILDREN_MIN: 0,
  CHILDREN_MAX: 10,
  OBSERVATIONS_MAX: 500,
  IDEMPOTENCY_KEY_MAX: 128,
  BODY_SIZE_MAX: 8192, // 8KB
};

/**
 * Validate idempotency key format
 * Safe opaque string, no special chars that could cause issues
 */
export function validateIdempotencyKey(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Idempotency-Key deve ser uma string' };
  }

  if (key.length > LIMITS.IDEMPOTENCY_KEY_MAX) {
    return { 
      valid: false, 
      error: `Idempotency-Key não pode exceder ${LIMITS.IDEMPOTENCY_KEY_MAX} caracteres` 
    };
  }

  // Safe opaque format: alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    return { 
      valid: false, 
      error: 'Idempotency-Key deve conter apenas letras, números, hífens e underscores' 
    };
  }

  return { valid: true, value: key };
}

/**
 * Normalize guest name: trim and collapse multiple spaces
 */
export function normalizeName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Validate guest name
 */
export function validateName(name) {
  const normalized = normalizeName(name);
  
  if (!normalized) {
    return { valid: false, error: 'Nome é obrigatório' };
  }
  
  const length = normalized.length;
  if (length < LIMITS.NAME_MIN || length > LIMITS.NAME_MAX) {
    return { 
      valid: false, 
      error: `Nome deve ter entre ${LIMITS.NAME_MIN}-${LIMITS.NAME_MAX} caracteres` 
    };
  }
  
  return { valid: true, value: normalized };
}

/**
 * Validate attending boolean
 */
export function validateAttending(attending) {
  if (typeof attending !== 'boolean') {
    return { valid: false, error: 'Presença deve ser true (SIM) ou false (NÃO)' };
  }
  return { valid: true, value: attending };
}

/**
 * Validate integer count within range
 */
function validateCount(value, name, min, max) {
  if (!Number.isInteger(value)) {
    return { valid: false, error: `${name} deve ser um número inteiro` };
  }
  
  if (value < min || value > max) {
    return { valid: false, error: `${name} deve estar entre ${min}-${max}` };
  }
  
  return { valid: true, value };
}

/**
 * Validate adults count
 */
export function validateAdultsCount(count) {
  return validateCount(count, 'Número de adultos', LIMITS.ADULTS_MIN, LIMITS.ADULTS_MAX);
}

/**
 * Validate children count
 */
export function validateChildrenCount(count) {
  return validateCount(count, 'Número de crianças', LIMITS.CHILDREN_MIN, LIMITS.CHILDREN_MAX);
}

/**
 * Validate observations text
 */
export function validateObservations(observations) {
  if (observations === null || observations === undefined || observations === '') {
    return { valid: true, value: null };
  }
  
  if (typeof observations !== 'string') {
    return { valid: false, error: 'Observações devem ser texto' };
  }
  
  if (observations.length > LIMITS.OBSERVATIONS_MAX) {
    return { 
      valid: false, 
      error: `Observações não podem exceder ${LIMITS.OBSERVATIONS_MAX} caracteres` 
    };
  }
  
  return { valid: true, value: observations };
}

/**
 * Validate consent given
 */
export function validateConsent(consent) {
  if (consent !== true) {
    return { 
      valid: false, 
      error: 'Consentimento é obrigatório para armazenar seus dados' 
    };
  }
  return { valid: true, value: true };
}

/**
 * Validate complete RSVP create payload
 */
export function validateRsvpCreate(data) {
  // Guard against null/undefined/non-object input
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { 
      valid: false, 
      errors: { _: 'Dados inválidos: esperado objeto JSON' } 
    };
  }

  // Reject unknown fields
  const allowedFields = ['guestName', 'attending', 'adultsCount', 'childrenCount', 'observations', 'consentGiven'];
  const unknownFields = Object.keys(data).filter(k => !allowedFields.includes(k));
  if (unknownFields.length > 0) {
    return {
      valid: false,
      errors: { _: `Campos não permitidos: ${unknownFields.join(', ')}` }
    };
  }

  const errors = {};
  const validated = {};
  
  const name = validateName(data.guestName);
  if (!name.valid) {
    errors.guestName = name.error;
  } else {
    validated.guestName = name.value;
  }
  
  const attending = validateAttending(data.attending);
  if (!attending.valid) {
    errors.attending = attending.error;
  } else {
    validated.attending = attending.value;
  }
  
  const adults = validateAdultsCount(data.adultsCount);
  if (!adults.valid) {
    errors.adultsCount = adults.error;
  } else {
    validated.adultsCount = adults.value;
  }
  
  const children = validateChildrenCount(data.childrenCount);
  if (!children.valid) {
    errors.childrenCount = children.error;
  } else {
    validated.childrenCount = children.value;
  }
  
  const observations = validateObservations(data.observations);
  if (!observations.valid) {
    errors.observations = observations.error;
  } else {
    validated.observations = observations.value;
  }
  
  const consent = validateConsent(data.consentGiven);
  if (!consent.valid) {
    errors.consentGiven = consent.error;
  } else {
    validated.consentGiven = consent.value;
  }
  
  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true, data: validated };
}

/**
 * Validate RSVP update payload (partial fields)
 */
export function validateRsvpUpdate(data) {
  // Guard against null/undefined/non-object input
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { 
      valid: false, 
      errors: { _: 'Dados inválidos: esperado objeto JSON' } 
    };
  }

  const errors = {};
  const validated = {};
  
  if ('attending' in data) {
    const attending = validateAttending(data.attending);
    if (!attending.valid) {
      errors.attending = attending.error;
    } else {
      validated.attending = attending.value;
    }
  }
  
  if ('adultsCount' in data) {
    const adults = validateAdultsCount(data.adultsCount);
    if (!adults.valid) {
      errors.adultsCount = adults.error;
    } else {
      validated.adultsCount = adults.value;
    }
  }
  
  if ('childrenCount' in data) {
    const children = validateChildrenCount(data.childrenCount);
    if (!children.valid) {
      errors.childrenCount = children.error;
    } else {
      validated.childrenCount = children.value;
    }
  }
  
  if ('observations' in data) {
    const observations = validateObservations(data.observations);
    if (!observations.valid) {
      errors.observations = observations.error;
    } else {
      validated.observations = observations.value;
    }
  }
  
  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }
  
  if (Object.keys(validated).length === 0) {
    return { valid: false, errors: { _: 'Nenhum campo para atualizar' } };
  }
  
  return { valid: true, data: validated };
}
