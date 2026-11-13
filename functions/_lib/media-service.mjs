/**
 * Playlist / vídeo YouTube — D1 Free-tier (sem seed obrigatório).
 */

/**
 * Extrai videoId de URLs youtube.com / youtu.be / embed.
 * @param {string} raw
 * @returns {string|null}
 */
export function extractYoutubeId(raw) {
  const url = String(raw || '').trim();
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0] || '';
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
        const id = parts[1] || '';
        return /^[\w-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function youtubeEmbedUrl(videoId) {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}

function rowToItem(row) {
  const youtubeUrl = row.youtube_url || '';
  const videoId = extractYoutubeId(youtubeUrl);
  return {
    id: row.id,
    title: row.title,
    youtubeUrl,
    videoId,
    embedUrl: videoId ? youtubeEmbedUrl(videoId) : null,
    active: row.active === undefined ? true : Boolean(row.active),
    sortOrder: row.sort_order ?? 0,
    updatedAt: row.updated_at || null,
  };
}

function slugify(name) {
  const base = String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return base || 'video';
}

export async function getActiveMedia(db) {
  if (!db) return [];
  try {
    const rows = await db
      .prepare(
        `SELECT id, title, youtube_url, active, sort_order, updated_at
         FROM media_playlist
         WHERE active = 1
         ORDER BY sort_order ASC, id ASC`
      )
      .all();
    return (rows?.results || []).map(rowToItem).filter((i) => i.videoId);
  } catch {
    return [];
  }
}

export async function listMediaAdmin(db) {
  const rows = await db
    .prepare(
      `SELECT id, title, youtube_url, active, sort_order, updated_at
       FROM media_playlist
       ORDER BY sort_order ASC, id ASC`
    )
    .all();
  return (rows?.results || []).map(rowToItem);
}

export function validateMediaCreate(body) {
  const errors = [];
  const out = {};
  const title = String(body?.title || '').trim();
  if (title.length < 2 || title.length > 120) errors.push('title inválido');
  else out.title = title;

  const youtubeUrl = String(body?.youtubeUrl || '').trim();
  const videoId = extractYoutubeId(youtubeUrl);
  if (!videoId) errors.push('youtubeUrl inválida (use youtube.com ou youtu.be)');
  else out.youtubeUrl = youtubeUrl;

  if (body?.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
      errors.push('sortOrder inválido');
    } else out.sortOrder = sortOrder;
  } else out.sortOrder = 0;

  return { valid: errors.length === 0, errors, data: out };
}

export function validateMediaPatch(body) {
  const errors = [];
  const out = {};
  if (body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (title.length < 2 || title.length > 120) errors.push('title inválido');
    else out.title = title;
  }
  if (body.youtubeUrl !== undefined) {
    const youtubeUrl = String(body.youtubeUrl || '').trim();
    if (!extractYoutubeId(youtubeUrl)) errors.push('youtubeUrl inválida');
    else out.youtubeUrl = youtubeUrl;
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

export async function createMediaItem(db, body) {
  const validation = validateMediaCreate(body);
  if (!validation.valid) {
    const err = new Error('VALIDATION');
    err.details = validation.errors;
    throw err;
  }
  const d = validation.data;
  let id = slugify(d.title);
  const existing = await db.prepare(`SELECT id FROM media_playlist WHERE id = ?`).bind(id).first();
  if (existing) id = `${id.slice(0, 28)}-${Math.random().toString(36).slice(2, 6)}`;

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO media_playlist (id, title, youtube_url, active, sort_order, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`
    )
    .bind(id, d.title, d.youtubeUrl, d.sortOrder ?? 0, now)
    .run();

  return rowToItem({
    id,
    title: d.title,
    youtube_url: d.youtubeUrl,
    active: 1,
    sort_order: d.sortOrder ?? 0,
    updated_at: now,
  });
}

export async function updateMediaItem(db, itemId, patch) {
  if (!itemId || typeof itemId !== 'string') throw new Error('INVALID_ID');
  const existing = await db
    .prepare(`SELECT id FROM media_playlist WHERE id = ?`)
    .bind(itemId)
    .first();
  if (!existing) throw new Error('MEDIA_NOT_FOUND');

  const validation = validateMediaPatch(patch);
  if (!validation.valid) {
    const err = new Error('VALIDATION');
    err.details = validation.errors;
    throw err;
  }
  const d = validation.data;
  if (Object.keys(d).length === 0) throw new Error('EMPTY_PATCH');

  const now = new Date().toISOString();
  const row = await db
    .prepare(
      `SELECT id, title, youtube_url, active, sort_order FROM media_playlist WHERE id = ?`
    )
    .bind(itemId)
    .first();

  const next = {
    title: d.title ?? row.title,
    youtube_url: d.youtubeUrl ?? row.youtube_url,
    active: d.active !== undefined ? (d.active ? 1 : 0) : row.active,
    sort_order: d.sortOrder ?? row.sort_order,
  };

  await db
    .prepare(
      `UPDATE media_playlist
       SET title = ?, youtube_url = ?, active = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(next.title, next.youtube_url, next.active, next.sort_order, now, itemId)
    .run();

  return rowToItem({ ...next, id: itemId, updated_at: now });
}
