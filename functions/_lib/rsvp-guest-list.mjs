/**
 * RSVP closed-list helpers — D1 only (Cloudflare Free).
 */

import { WEDDING_KEY, normalizeName } from './rsvp-validators.mjs';

/**
 * Canonical key for matching invite names (case/accents-insensitive-ish).
 * Uses NFC + lower + collapse spaces. Does not strip all diacritics to keep
 * simple; admin should paste names as guests will type them.
 */
export function nameKey(name) {
  return normalizeName(name)
    .normalize('NFC')
    .toLowerCase();
}

export async function getRsvpMode(db) {
  const row = await db
    .prepare(`SELECT rsvp_mode FROM wedding_settings WHERE wedding_key = ?`)
    .bind(WEDDING_KEY)
    .first();
  return row?.rsvp_mode === 'closed' ? 'closed' : 'open';
}

export async function setRsvpMode(db, mode) {
  if (mode !== 'open' && mode !== 'closed') {
    throw new Error('INVALID_RSVP_MODE');
  }
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO wedding_settings (wedding_key, rsvp_mode, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(wedding_key) DO UPDATE SET
         rsvp_mode = excluded.rsvp_mode,
         updated_at = excluded.updated_at`
    )
    .bind(WEDDING_KEY, mode, now)
    .run();
  return { rsvpMode: mode, updatedAt: now };
}

export async function listGuestList(db) {
  const rows = await db
    .prepare(
      `SELECT id, display_name, name_key, created_at
       FROM rsvp_guest_list
       WHERE wedding_key = ?
       ORDER BY display_name COLLATE NOCASE ASC`
    )
    .bind(WEDDING_KEY)
    .all();

  return (rows?.results || []).map((r) => ({
    id: r.id,
    displayName: r.display_name,
    nameKey: r.name_key,
    createdAt: r.created_at,
  }));
}

/**
 * Upsert many names. Returns { added, skipped }.
 */
export async function addGuests(db, names) {
  if (!Array.isArray(names) || names.length === 0) {
    throw new Error('EMPTY_GUEST_LIST');
  }
  if (names.length > 500) {
    throw new Error('GUEST_LIST_TOO_LARGE');
  }

  let added = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const raw of names) {
    const display = normalizeName(String(raw || ''));
    if (display.length < 2 || display.length > 100) {
      skipped++;
      continue;
    }
    const key = nameKey(display);
    const id = crypto.randomUUID();
    try {
      await db
        .prepare(
          `INSERT INTO rsvp_guest_list (id, wedding_key, display_name, name_key, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(id, WEDDING_KEY, display, key, now)
        .run();
      added++;
    } catch (err) {
      if (err?.message?.includes('UNIQUE')) {
        skipped++;
      } else {
        throw err;
      }
    }
  }

  return { added, skipped };
}

export async function removeGuest(db, guestId) {
  if (!guestId || typeof guestId !== 'string') {
    throw new Error('INVALID_GUEST_ID');
  }
  const result = await db
    .prepare(`DELETE FROM rsvp_guest_list WHERE id = ? AND wedding_key = ?`)
    .bind(guestId, WEDDING_KEY)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('GUEST_NOT_FOUND');
  return { id: guestId, removed: true };
}

/**
 * If mode is closed, guest name must exist on list.
 * @returns {Promise<{allowed: true}|{allowed: false, error: string}>}
 */
export async function assertGuestAllowed(db, guestName) {
  const mode = await getRsvpMode(db);
  if (mode !== 'closed') {
    return { allowed: true, mode };
  }

  const key = nameKey(guestName);
  const row = await db
    .prepare(
      `SELECT id FROM rsvp_guest_list
       WHERE wedding_key = ? AND name_key = ?
       LIMIT 1`
    )
    .bind(WEDDING_KEY, key)
    .first();

  if (!row) {
    return {
      allowed: false,
      mode,
      error: 'GUEST_NOT_ON_LIST',
      message:
        'RSVP fechado: este nome não está na lista de convidados. Confira a escrita ou fale com os noivos.',
    };
  }

  return { allowed: true, mode };
}
