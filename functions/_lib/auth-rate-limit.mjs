const AUTH_LIMIT = 10;
const memoryCounts = new Map();

export function resetAuthRateLimitForTests() {
  memoryCounts.clear();
}

function hourWindow() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

function memoryCheck(ip, limit) {
  const key = `${ip}:${hourWindow()}`;
  const count = (memoryCounts.get(key) || 0) + 1;
  memoryCounts.set(key, count);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

async function hashIp(ip) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(ip || '0.0.0.0')));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function clientIp(request) {
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) return cfIp;
  const xffIp = request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim();
  if (xffIp) return xffIp;
  return '0.0.0.0';
}

export async function checkAuthRateLimit(db, ip, { limit = AUTH_LIMIT } = {}) {
  const ipKey = String(ip || '0.0.0.0');
  if (!db) return memoryCheck(ipKey, limit);
  try {
    const ipHash = await hashIp(ipKey);
    const windowStart = hourWindow();
    const rateLimitId = `auth:${ipHash}:${windowStart}`;
    const timestamp = new Date().toISOString();
    const upsert = await db
      .prepare(
        `INSERT INTO rate_limits (id, wedding_key, ip_hash, window_start, request_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(id) DO UPDATE
         SET request_count = request_count + 1, updated_at = ?
         WHERE request_count < ?
         RETURNING request_count`
      )
      .bind(rateLimitId, 'auth', ipHash, windowStart, timestamp, timestamp, timestamp, limit)
      .first();
    if (!upsert) return { allowed: false, remaining: 0 };
    return { allowed: true, remaining: Math.max(0, limit - Number(upsert.request_count)) };
  } catch {
    return memoryCheck(ipKey, limit);
  }
}
