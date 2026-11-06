/**
 * RSVP API Handler
 * Cloudflare Pages Function for /api/rsvp
 */

import { 
  validateRsvpCreate, 
  validateRsvpUpdate, 
  validateIdempotencyKey,
  LIMITS 
} from '../_lib/rsvp-validators.mjs';
import {
  createRsvp,
  getRsvpByToken,
  updateRsvpByToken,
  checkRateLimit,
} from '../_lib/rsvp-service.mjs';

/**
 * Get allowed origins for CORS (same-origin only)
 * In production: actual domain (e.g., casebem.pages.dev, casebem.com)
 * In development: localhost
 */
function getAllowedOrigins(request) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin; // e.g., https://casebem.pages.dev
  
  // Also allow common production domains if they exist
  const allowedOrigins = [
    origin,
    'https://casebem.pages.dev',
    'https://www.casebem.pages.dev',
  ];
  
  // Development: allow localhost
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    allowedOrigins.push(origin);
  }
  
  return allowedOrigins;
}

/**
 * Validate Origin header against allowed list
 */
function validateOrigin(request) {
  const requestOrigin = request.headers.get('Origin');
  
  // If no Origin header (same-origin requests may omit it), allow
  if (!requestOrigin) {
    return true;
  }
  
  const allowedOrigins = getAllowedOrigins(request);
  return allowedOrigins.includes(requestOrigin);
}

/**
 * Get CORS headers for specific origin
 */
function getCorsHeaders(request) {
  const requestOrigin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(request);
  
  const origin = allowedOrigins.includes(requestOrigin) 
    ? requestOrigin 
    : getAllowedOrigins(request)[0];
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function getJsonHeaders(request) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    ...getCorsHeaders(request),
  };
}

function jsonResponse(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: getJsonHeaders(request),
  });
}

function errorResponse(request, error, status = 400, details = null) {
  const body = { error };
  if (details) body.details = details;
  return jsonResponse(request, body, status);
}

function extractBearerToken(request) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  return auth.substring(7);
}

/**
 * Get client IP from Cloudflare headers
 * CF-Connecting-IP is the real client IP (cannot be spoofed)
 * X-Forwarded-For fallback only for local dev
 */
function getClientIp(request) {
  // Production: always use CF-Connecting-IP (Cloudflare sets this)
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) {
    return cfIp;
  }
  
  // Development fallback: X-Forwarded-For (best effort, can be spoofed)
  const xffIp = request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim();
  if (xffIp) {
    return xffIp;
  }
  
  return '0.0.0.0';
}

async function handlePost(request, env) {
  // Validate Content-Length before reading body
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > LIMITS.BODY_SIZE_MAX) {
    return errorResponse(request, 'Request body muito grande', 413);
  }

  const contentType = request.headers.get('Content-Type');
  if (!contentType || !contentType.includes('application/json')) {
    return errorResponse(request, 'Content-Type deve ser application/json', 400);
  }

  // Validate Idempotency-Key header (required)
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey) {
    return errorResponse(request, 'Header Idempotency-Key é obrigatório', 400);
  }

  const idempKeyValidation = validateIdempotencyKey(idempotencyKey);
  if (!idempKeyValidation.valid) {
    return errorResponse(request, idempKeyValidation.error, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, 'JSON inválido', 400);
  }

  const validation = validateRsvpCreate(body);
  if (!validation.valid) {
    return errorResponse(request, 'Dados inválidos', 400, validation.errors);
  }

  try {
    // Rate limit with HMAC
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(env.DB, ip, env.RSVP_HASH_KEY, 10);
    
    if (!rateLimit.allowed) {
      return errorResponse(
        request,
        'Muitas requisições. Tente novamente em alguns minutos.',
        429
      );
    }

    // Create RSVP with idempotency and encryption
    const rsvp = await createRsvp(
      env.DB, 
      validation.data, 
      idempotencyKey, 
      env.RSVP_TOKEN_KEY
    );
    return jsonResponse(request, rsvp, 201);
  } catch (error) {
    console.error('Failed to create RSVP:', error);
    
    if (error.message === 'IDEMPOTENCY_CONFLICT') {
      return errorResponse(
        request,
        'Conflito: mesma chave de idempotência com dados diferentes',
        409
      );
    }
    
    return errorResponse(request, 'Erro ao criar confirmação', 500);
  }
}

async function handleGet(request, env) {
  const token = extractBearerToken(request);
  
  if (!token) {
    return errorResponse(request, 'Token de autorização inválido', 401);
  }

  try {
    const rsvp = await getRsvpByToken(env.DB, token);
    
    if (!rsvp) {
      // Invalid/unknown token = 401 Unauthorized (not 404)
      return errorResponse(request, 'Token de autorização inválido', 401);
    }

    return jsonResponse(request, rsvp, 200);
  } catch (error) {
    console.error('Failed to get RSVP:', error);
    return errorResponse(request, 'Erro ao buscar confirmação', 500);
  }
}

async function handlePut(request, env) {
  const token = extractBearerToken(request);
  
  if (!token) {
    return errorResponse(request, 'Token de autorização inválido', 401);
  }

  // Validate Content-Length
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > LIMITS.BODY_SIZE_MAX) {
    return errorResponse(request, 'Request body muito grande', 413);
  }

  const contentType = request.headers.get('Content-Type');
  if (!contentType || !contentType.includes('application/json')) {
    return errorResponse(request, 'Content-Type deve ser application/json', 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, 'JSON inválido', 400);
  }

  const validation = validateRsvpUpdate(body);
  if (!validation.valid) {
    return errorResponse(request, 'Dados inválidos', 400, validation.errors);
  }

  try {
    // Rate limit PUT requests too
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(env.DB, ip, env.RSVP_HASH_KEY, 10);
    
    if (!rateLimit.allowed) {
      return errorResponse(
        request,
        'Muitas requisições. Tente novamente em alguns minutos.',
        429
      );
    }

    const rsvp = await updateRsvpByToken(env.DB, token, validation.data);
    
    if (!rsvp) {
      // Invalid/unknown token = 401 Unauthorized (not 404)
      return errorResponse(request, 'Token de autorização inválido', 401);
    }

    return jsonResponse(request, rsvp, 200);
  } catch (error) {
    console.error('Failed to update RSVP:', error);
    return errorResponse(request, 'Erro ao atualizar confirmação', 500);
  }
}

function handleOptions(request) {
  // Validate Origin BEFORE any other checks (including DB)
  if (!validateOrigin(request)) {
    return new Response('Forbidden', {
      status: 403,
      headers: getCorsHeaders(request),
    });
  }

  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  const method = request.method;

  // OPTIONS preflight: validate Origin BEFORE DB check
  if (method === 'OPTIONS') {
    return handleOptions(request);
  }

  // Validate Origin for all other methods
  if (!validateOrigin(request)) {
    return new Response(JSON.stringify({ error: 'Origin não permitido' }), {
      status: 403,
      headers: getJsonHeaders(request),
    });
  }

  // Check required environment variables
  if (!env.DB) {
    console.error('DB binding not found');
    return errorResponse(
      request,
      'Serviço temporariamente indisponível. Tente novamente mais tarde.',
      503
    );
  }

  if (!env.RSVP_TOKEN_KEY) {
    console.error('RSVP_TOKEN_KEY not configured');
    return errorResponse(
      request,
      'Serviço temporariamente indisponível. Configuração incompleta.',
      503
    );
  }

  if (!env.RSVP_HASH_KEY) {
    console.error('RSVP_HASH_KEY not configured');
    return errorResponse(
      request,
      'Serviço temporariamente indisponível. Configuração incompleta.',
      503
    );
  }

  if (method === 'POST') {
    return handlePost(request, env);
  }

  if (method === 'GET') {
    return handleGet(request, env);
  }

  if (method === 'PUT') {
    return handlePut(request, env);
  }

  return errorResponse(request, 'Método não suportado', 405);
}
