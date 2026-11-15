/**
 * Messages API Handler
 * Cloudflare Pages Function for /api/messages
 * Public guestbook independent of gift purchases
 */

import { 
  validateMessageCreate, 
  validateIdempotencyKey,
  LIMITS 
} from '../_lib/messages-validators.mjs';
import {
  createMessage,
  getMessages,
  checkRateLimit,
} from '../_lib/messages-service.mjs';
import { slugFromRequest, resolvePublicSlugOrPartner } from '../_lib/public-slug.mjs';

/**
 * Get allowed origins for CORS (same-origin only)
 * Reuses RSVP CORS policy
 */
function getAllowedOrigins(request) {
  const requestUrl = new URL(request.url);
  const requestOrigin = requestUrl.origin;
  const hostname = requestUrl.hostname;
  
  const allowedOrigins = [requestOrigin];
  
  // Production: casebem.pages.dev and preview branches
  if (hostname === 'casebem.pages.dev' || hostname.endsWith('.casebem.pages.dev')) {
    allowedOrigins.push(
      'https://casebem.pages.dev',
      'https://www.casebem.pages.dev',
      'https://casebem.com',
      'https://www.casebem.com'
    );
    const requestOriginParsed = request.headers.get('Origin');
    if (requestOriginParsed && requestOriginParsed.startsWith('https://') && 
        (requestOriginParsed.includes('.casebem.pages.dev') || requestOriginParsed.includes('casebem.pages.dev'))) {
      allowedOrigins.push(requestOriginParsed);
    }
  }
  
  // Production: casebem.com apex/www
  if (hostname === 'casebem.com' || hostname === 'www.casebem.com') {
    allowedOrigins.push(
      'https://casebem.com',
      'https://www.casebem.com',
      'https://casebem.pages.dev'
    );
  }
  
  // Development: localhost only
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    allowedOrigins.push(
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    );
  }
  
  return [...new Set(allowedOrigins)];
}

function validateOrigin(request) {
  const requestOrigin = request.headers.get('Origin');
  
  // If no Origin header (same-origin requests may omit it), allow
  if (!requestOrigin) {
    return true;
  }
  
  const allowedOrigins = getAllowedOrigins(request);
  return allowedOrigins.includes(requestOrigin);
}

function getCorsHeaders(request) {
  const requestOrigin = request.headers.get('Origin');
  const allowedOrigins = getAllowedOrigins(request);
  
  const origin = allowedOrigins.includes(requestOrigin) 
    ? requestOrigin 
    : getAllowedOrigins(request)[0];
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
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

/**
 * Get client IP from Cloudflare headers
 */
function getClientIp(request) {
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) {
    return cfIp;
  }
  
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

  const slug = slugFromRequest(request, body);
  const resolved = await resolvePublicSlugOrPartner(env.DB || null, slug);
  if (!resolved.ok) {
    return errorResponse(request, resolved.error, resolved.status);
  }

  const { slug: _slug, ...payload } = body;
  const validation = validateMessageCreate(payload);
  if (!validation.valid) {
    return errorResponse(request, 'Dados inválidos', 400, validation.errors);
  }

  if (!env.DB) {
    return errorResponse(
      request,
      'Serviço temporariamente indisponível. Tente novamente mais tarde.',
      503
    );
  }

  try {
    // Rate limit (5 per hour for messages)
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(env.DB, ip, env.RSVP_SECRET, 5);
    
    if (!rateLimit.allowed) {
      return errorResponse(
        request,
        'Muitas requisições. Tente novamente em alguns minutos.',
        429
      );
    }

    // Create message with idempotency
    const message = await createMessage(
      env.DB,
      validation.data,
      idempotencyKey,
      env.RSVP_SECRET,
      resolved.account.id
    );

    // Best-effort e-mail (Resend free). Sem key = no-op, zero custo Cloudflare.
    try {
      const { sendAdminNotification } = await import('../_lib/notify-email.mjs');
      await sendAdminNotification(env, {
        subject: `[CaseBem] Novo recado de ${message.guestName}`,
        text: `${message.guestName} escreveu:\n\n${message.message}`,
      });
    } catch {
      /* ignore */
    }
    
    const { weddingKey: _weddingKey, ...publicMessage } = message;
    return jsonResponse(request, publicMessage, 201);
  } catch (error) {
    console.error('Failed to create message:', error);
    
    if (error.message === 'IDEMPOTENCY_CONFLICT') {
      return errorResponse(
        request,
        'Conflito: mesma chave de idempotência com dados diferentes',
        409
      );
    }
    
    return errorResponse(request, 'Erro ao criar mensagem', 500);
  }
}

async function handleGet(request, env) {
  // Parse query parameters
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const cursorParam = url.searchParams.get('cursor');
  
  // Validate limit (3-50, default 12)
  let limit = 12;
  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);
    if (isNaN(parsedLimit) || parsedLimit < 3 || parsedLimit > 50) {
      return errorResponse(request, 'Limit deve estar entre 3-50', 400);
    }
    limit = parsedLimit;
  }

  try {
    const slug = slugFromRequest(request);
    const resolved = await resolvePublicSlugOrPartner(env.DB || null, slug);
    if (!resolved.ok) {
      return errorResponse(request, resolved.error, resolved.status);
    }
    const result = await getMessages(env.DB || null, limit, cursorParam, resolved.account.id);
    return jsonResponse(request, result, 200);
  } catch (error) {
    console.error('Failed to get messages:', error);
    
    if (error.message === 'INVALID_CURSOR') {
      return errorResponse(request, 'Cursor inválido', 400);
    }
    
    return errorResponse(request, 'Erro ao buscar mensagens', 500);
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

export async function onRequestGet(context) {
  return onRequest(context);
}

export async function onRequestPost(context) {
  return onRequest(context);
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

  if (method === 'GET') {
    return handleGet(request, env);
  }

  if (!env.RSVP_SECRET) {
    console.error('RSVP_SECRET not configured');
    return errorResponse(
      request,
      'Serviço temporariamente indisponível. Configuração incompleta.',
      503
    );
  }

  if (method === 'POST') {
    return handlePost(request, env);
  }

  return errorResponse(request, 'Método não suportado', 405);
}
