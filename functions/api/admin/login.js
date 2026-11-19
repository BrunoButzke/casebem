/**
 * POST /api/admin/login
 * 1. Super admin (e-mail plataforma)
 * 2. Membro Noiva/Noivo cadastrado em Acessos (admin_members)
 */

import { mintTenantToken } from '../../_lib/admin-auth.mjs';
import { isSuperAdminCredentials, loginSuperAdmin } from '../../_lib/super-admin.mjs';
import { authenticateAdminMember } from '../../_lib/admin-members-service.mjs';
import { pathsForTenantId } from '../../_lib/tenant-service.mjs';
import { getCorsHeaders, validateOrigin } from '../../_lib/http-helpers.mjs';

function json(headers, body, status = 200) {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(body, { status, headers });
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: getCorsHeaders(context.request) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = getCorsHeaders(request);

  const originCheck = validateOrigin(request);
  if (!originCheck.valid) {
    return json(headers, { ok: false, error: 'ORIGIN_DENIED', message: originCheck.error }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(headers, { ok: false, error: 'INVALID_JSON' }, 400);
  }

  if (isSuperAdminCredentials(body?.user, body?.pass)) {
    const result = loginSuperAdmin(env, body?.user, body?.pass);
    if (!result.ok) {
      return json(headers, { ok: false, error: result.error, message: result.message }, result.status);
    }
    return json(headers, { ok: true, token: result.token, role: result.role });
  }

  try {
    const memberAuth = await authenticateAdminMember(env.DB || null, body?.user, body?.pass);
    if (memberAuth.ok) {
      const secret = env?.ADMIN_PANEL_SECRET;
      if (!secret || typeof secret !== 'string' || secret.length < 16) {
        return json(
          headers,
          {
            ok: false,
            error: 'ADMIN_NOT_CONFIGURED',
            message: 'Painel admin não configurado (defina ADMIN_PANEL_SECRET com ≥16 chars).',
          },
          503
        );
      }
      const paths = pathsForTenantId(memberAuth.weddingKey);
      const token = await mintTenantToken(secret, memberAuth.weddingKey);
      return json(headers, {
        ok: true,
        token,
        role: 'tenant',
        memberRole: memberAuth.member.role,
        weddingKey: memberAuth.weddingKey,
        adminPath: paths.adminPath,
        sitePath: paths.sitePath,
      });
    }
  } catch (err) {
    console.error('authenticateAdminMember failed', err?.message || err);
  }

  return json(
    headers,
    {
      ok: false,
      error: 'UNAUTHORIZED',
      message: 'E-mail ou senha não conferem. Use o acesso cadastrado em Acessos.',
    },
    401
  );
}
