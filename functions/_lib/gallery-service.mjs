import { WEDDING_KEY as DEFAULT_WEDDING_KEY } from './challenges-validators.mjs';

function resolveWeddingKey(weddingKey) {
  const k = String(weddingKey || DEFAULT_WEDDING_KEY).trim();
  return k || DEFAULT_WEDDING_KEY;
}


export const GALLERY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i;

let memoryGallery = [];
let memoryObjects = new Map();

export function resetMemoryGalleryForTests() {
  memoryGallery = [];
  memoryObjects = new Map();
}

export function galleryImagePath(id) {
  return `/api/desafio/gallery/${encodeURIComponent(id)}/image`;
}

function throwValidation(errors) {
  const err = new Error('VALIDATION');
  err.details = errors;
  throw err;
}

function newId() {
  return `gal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function extensionFor(contentType) {
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/webp') return '.webp';
  return '.jpg';
}

function objectKeyFor(id, contentType) {
  return `desafio/${DEFAULT_WEDDING_KEY}/${id}${extensionFor(contentType)}`;
}

export function decodeDataUrl(preview) {
  const m = String(preview || '').trim().match(DATA_URL);
  if (!m) return null;
  const type = m[1].toLowerCase() === 'jpg' ? 'image/jpeg' : `image/${m[1].toLowerCase()}`;
  const b64 = m[2].replace(/\s/g, '');
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (!bytes.length) return null;
    return { bytes, contentType: type };
  } catch {
    return null;
  }
}

function sniffContentType(bytes, fallback = 'image/jpeg') {
  if (!bytes || bytes.length < 12) return fallback;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57) {
    return 'image/webp';
  }
  return fallback;
}

export function validateGalleryMeta(body) {
  const errors = [];
  const guestName = String(body?.guestName || '').trim();
  const missionId = String(body?.missionId || '').trim();
  const title = String(body?.title || '').trim();
  if (guestName.length < 2 || guestName.length > 80) errors.push('guestName inválido');
  if (missionId.length < 2 || missionId.length > 40) errors.push('missionId inválido');
  if (title.length < 2 || title.length > 100) errors.push('title inválido');
  return { valid: errors.length === 0, errors, data: { guestName, missionId, title } };
}

export async function parseGalleryUpload(request) {
  const ct = String(request.headers.get('content-type') || '');
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file') || form.get('photo');
    const bytes = file && typeof file.arrayBuffer === 'function' ? new Uint8Array(await file.arrayBuffer()) : null;
    return {
      guestName: String(form.get('guestName') || ''),
      missionId: String(form.get('missionId') || ''),
      title: String(form.get('title') || ''),
      bytes,
      contentType: file?.type || 'image/jpeg',
    };
  }
  const json = await request.json().catch(() => ({}));
  const decoded = decodeDataUrl(json?.preview);
  return {
    guestName: json?.guestName,
    missionId: json?.missionId,
    title: json?.title,
    bytes: decoded?.bytes || json?.bytes || null,
    contentType: decoded?.contentType || json?.contentType || 'image/jpeg',
  };
}

function toMeta(row) {
  const id = row.id;
  return {
    id,
    guestName: row.guestName ?? row.guest_name,
    missionId: row.missionId ?? row.mission_id,
    title: row.title,
    createdAt: row.createdAt ?? row.created_at,
    preview: galleryImagePath(id),
  };
}

function sortByCreated(a, b) {
  return String(a.createdAt || a.created_at).localeCompare(String(b.createdAt || b.created_at)) || a.id.localeCompare(b.id);
}

async function putObject(bucket, key, bytes, contentType) {
  if (bucket) {
    await bucket.put(key, bytes, { httpMetadata: { contentType } });
    return;
  }
  memoryObjects.set(key, { bytes, contentType });
}

async function getObject(bucket, key) {
  if (!key) return null;
  if (bucket) {
    const obj = await bucket.get(key);
    if (!obj) return null;
    return {
      bytes: new Uint8Array(await obj.arrayBuffer()),
      contentType: obj.httpMetadata?.contentType || 'image/jpeg',
    };
  }
  return memoryObjects.get(key) || null;
}

async function deleteObject(bucket, key) {
  if (!key) return;
  if (bucket) await bucket.delete(key);
  else memoryObjects.delete(key);
}

async function existingRows(db, guestName, missionId) {
  if (!db) return memoryGallery.filter((p) => p.guestName === guestName && p.missionId === missionId);
  const rows = await db
    .prepare(
      `SELECT id, object_key FROM desafio_gallery
       WHERE wedding_key = ? AND guest_name = ? AND mission_id = ?`
    )
    .bind(DEFAULT_WEDDING_KEY, guestName, missionId)
    .all();
  return rows?.results || [];
}

export async function listGalleryPhotos(db, weddingKey = DEFAULT_WEDDING_KEY) {
  const weddingKeyResolved = resolveWeddingKey(weddingKey);
  if (!db) return [...memoryGallery].sort(sortByCreated).map(toMeta);
  const rows = await db
    .prepare(
      `SELECT id, wedding_key, guest_name, mission_id, title, created_at
       FROM desafio_gallery
       WHERE wedding_key = ?
       ORDER BY created_at ASC, id ASC`
    )
    .bind(weddingKeyResolved)
    .all();
  return (rows?.results || []).map(toMeta);
}

export async function getGalleryPhoto(db, id, weddingKey = DEFAULT_WEDDING_KEY) {
  const weddingKeyResolved = resolveWeddingKey(weddingKey);
  if (!id) throw new Error('INVALID_ID');
  if (!db) {
    const row = memoryGallery.find((p) => p.id === id);
    if (!row) throw new Error('NOT_FOUND');
    return toMeta(row);
  }
  const row = await db
    .prepare(
      `SELECT id, wedding_key, guest_name, mission_id, title, created_at
       FROM desafio_gallery WHERE id = ? AND wedding_key = ?`
    )
    .bind(id, weddingKeyResolved)
    .first();
  if (!row) throw new Error('NOT_FOUND');
  return toMeta(row);
}

export async function getGalleryImage(db, id, bucket, weddingKey = DEFAULT_WEDDING_KEY) {
  const weddingKeyResolved = resolveWeddingKey(weddingKey);
  if (!id) throw new Error('INVALID_ID');
  if (!db) {
    const row = memoryGallery.find((p) => p.id === id);
    if (!row) throw new Error('NOT_FOUND');
    const stored = await getObject(bucket, row.objectKey);
    if (stored) return stored;
    const decoded = decodeDataUrl(row.preview);
    if (decoded) return decoded;
    throw new Error('NOT_FOUND');
  }
  const row = await db
    .prepare(
      `SELECT id, object_key, preview FROM desafio_gallery WHERE id = ? AND wedding_key = ?`
    )
    .bind(id, weddingKeyResolved)
    .first();
  if (!row) throw new Error('NOT_FOUND');
  const stored = await getObject(bucket, row.object_key);
  if (stored) return stored;
  const decoded = decodeDataUrl(row.preview);
  if (decoded) return decoded;
  throw new Error('NOT_FOUND');
}

export async function upsertGalleryPhoto(db, body, bucket, weddingKey = DEFAULT_WEDDING_KEY) {
  const weddingKeyResolved = resolveWeddingKey(weddingKey);
  const meta = validateGalleryMeta(body);
  if (!meta.valid) throwValidation(meta.errors);

  let bytes = body?.bytes;
  if (bytes && !(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  if (!bytes) {
    const decoded = decodeDataUrl(body?.preview);
    bytes = decoded?.bytes;
    if (decoded?.contentType) body.contentType = decoded.contentType;
  }
  if (!bytes?.length) throwValidation(['imagem inválida']);
  if (bytes.length > GALLERY_IMAGE_MAX_BYTES) throwValidation(['imagem grande demais']);

  const contentType = sniffContentType(bytes, body?.contentType || 'image/jpeg');
  if (!contentType.startsWith('image/')) throwValidation(['imagem inválida']);
  if (db && !bucket) throw new Error('GALLERY_UNAVAILABLE');

  const d = meta.data;
  const now = new Date().toISOString();
  const id = newId();
  const objectKey = objectKeyFor(id, contentType);
  const previous = await existingRows(db, d.guestName, d.missionId);

  await putObject(bucket, objectKey, bytes, contentType);

  const row = {
    id,
    weddingKey: weddingKeyResolved,
    guestName: d.guestName,
    missionId: d.missionId,
    title: d.title,
    objectKey,
    createdAt: now,
  };

  if (!db) {
    memoryGallery = memoryGallery.filter((p) => !(p.guestName === d.guestName && p.missionId === d.missionId));
    memoryGallery.push(row);
    await Promise.all(previous.map((old) => deleteObject(bucket, old.objectKey || old.object_key)));
    return toMeta(row);
  }

  await db
    .prepare(`DELETE FROM desafio_gallery WHERE wedding_key = ? AND guest_name = ? AND mission_id = ?`)
    .bind(weddingKeyResolved, d.guestName, d.missionId)
    .run();
  await db
    .prepare(
      `INSERT INTO desafio_gallery (id, wedding_key, guest_name, mission_id, title, preview, object_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, weddingKeyResolved, d.guestName, d.missionId, d.title, '', objectKey, now)
    .run();
  await Promise.all(previous.map((old) => deleteObject(bucket, old.object_key)));
  return toMeta(row);
}

export async function deleteGalleryPhoto(db, query, bucket, weddingKey = DEFAULT_WEDDING_KEY) {
  const weddingKeyResolved = resolveWeddingKey(weddingKey);
  const id = String(query?.id || '').trim();
  const guestName = String(query?.guestName || '').trim();
  const missionId = String(query?.missionId || '').trim();

  if (!db) {
    const before = memoryGallery.length;
    const removed = memoryGallery.filter((p) => (id ? p.id === id : p.guestName === guestName && p.missionId === missionId));
    memoryGallery = memoryGallery.filter((p) => (id ? p.id !== id : !(p.guestName === guestName && p.missionId === missionId)));
    if (memoryGallery.length === before) throw new Error('NOT_FOUND');
    await Promise.all(removed.map((row) => deleteObject(bucket, row.objectKey)));
    return { removed: true };
  }

  let rows;
  if (id) {
    rows = await db
      .prepare(`SELECT id, object_key FROM desafio_gallery WHERE id = ? AND wedding_key = ?`)
      .bind(id, weddingKeyResolved)
      .all();
  } else if (guestName && missionId) {
    rows = await db
      .prepare(
        `SELECT id, object_key FROM desafio_gallery WHERE wedding_key = ? AND guest_name = ? AND mission_id = ?`
      )
      .bind(weddingKeyResolved, guestName, missionId)
      .all();
  } else {
    throw new Error('INVALID_ID');
  }

  const found = rows?.results || [];
  if (!found.length) throw new Error('NOT_FOUND');

  if (id) {
    await db.prepare(`DELETE FROM desafio_gallery WHERE id = ? AND wedding_key = ?`).bind(id, weddingKeyResolved).run();
  } else {
    await db
      .prepare(`DELETE FROM desafio_gallery WHERE wedding_key = ? AND guest_name = ? AND mission_id = ?`)
      .bind(weddingKeyResolved, guestName, missionId)
      .run();
  }
  await Promise.all(found.map((row) => deleteObject(bucket, row.object_key)));
  return { removed: true };
}

export function validateGalleryPhoto(body) {
  const meta = validateGalleryMeta(body);
  const decoded = decodeDataUrl(body?.preview);
  const hasBytes = Boolean(body?.bytes?.length || decoded);
  return {
    valid: meta.valid && hasBytes,
    errors: hasBytes ? meta.errors : [...meta.errors, 'imagem inválida'],
    data: { ...meta.data, preview: String(body?.preview || '') },
  };
}
