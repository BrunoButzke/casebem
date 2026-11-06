/**
 * Validators for Messages system (Mural de Recados)
 * Wedding: Dani & Carine
 */

export const WEDDING_KEY = 'dani-carine';

export const LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 100,
  MESSAGE_MIN: 3,
  MESSAGE_MAX: 500,
  IDEMPOTENCY_KEY_MAX: 128,
  BODY_SIZE_MAX: 8192, // 8KB
};

/**
 * Normalize guest name: trim and collapse multiple spaces
 */
export function normalizeGuestName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Normalize message: convert CRLF to LF, preserve other whitespace
 */
export function normalizeMessage(message) {
  if (typeof message !== 'string') return '';
  return message.replace(/\r\n/g, '\n');
}

/**
 * Validate guest name
 */
export function validateGuestName(name) {
  const normalized = normalizeGuestName(name);
  
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
 * Validate message text
 */
export function validateMessage(message) {
  const normalized = normalizeMessage(message);
  
  if (!normalized) {
    return { valid: false, error: 'Mensagem é obrigatório' };
  }
  
  const length = normalized.length;
  if (length < LIMITS.MESSAGE_MIN || length > LIMITS.MESSAGE_MAX) {
    return { 
      valid: false, 
      error: `Mensagem deve ter entre ${LIMITS.MESSAGE_MIN}-${LIMITS.MESSAGE_MAX} caracteres` 
    };
  }
  
  return { valid: true, value: normalized };
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
 * Validate complete message create payload
 */
export function validateMessageCreate(data) {
  // Guard against null/undefined/non-object input
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { 
      valid: false, 
      errors: { _: 'Dados inválidos: esperado objeto JSON' } 
    };
  }

  // Reject unknown fields (no payment/gift fields allowed)
  const allowedFields = ['guestName', 'message', 'consentGiven'];
  const unknownFields = Object.keys(data).filter(k => !allowedFields.includes(k));
  if (unknownFields.length > 0) {
    return {
      valid: false,
      errors: { _: `Campos não permitidos: ${unknownFields.join(', ')}` }
    };
  }

  const errors = {};
  const validated = {};
  
  const name = validateGuestName(data.guestName);
  if (!name.valid) {
    errors.guestName = name.error;
  } else {
    validated.guestName = name.value;
  }
  
  const message = validateMessage(data.message);
  if (!message.valid) {
    errors.message = message.error;
  } else {
    validated.message = message.value;
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
