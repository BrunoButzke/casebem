/**
 * RSVP closed-list helpers — D1 + seed/memory fallback (Cloudflare Free).
 */

import { WEDDING_KEY, normalizeName } from './rsvp-validators.mjs';
import { GUEST_LIST_SEED } from '../../data/guest-list-seed.mjs';

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

/** In-memory store for local Vite / no-D1 */
let memoryGuests = null;

function ensureMemoryGuests() {
  if (!memoryGuests) {
    const now = new Date().toISOString();
    memoryGuests = GUEST_LIST_SEED.map((display) => {
      const displayName = normalizeName(display);
      return {
        id: crypto.randomUUID(),
        displayName,
        nameKey: nameKey(displayName),
        createdAt: now,
        attending: null,
        respondedAt: null,
      };
    });
  }
  return memoryGuests;
}

function mapGuestRow(r) {
  return {
    id: r.id,
    displayName: r.display_name ?? r.displayName,
    nameKey: r.name_key ?? r.nameKey,
    createdAt: r.created_at ?? r.createdAt,
    attending:
      r.attending === null || r.attending === undefined
        ? null
        : Boolean(Number(r.attending)),
    respondedAt: r.responded_at ?? r.respondedAt ?? null,
  };
}

export function resetMemoryGuestsForTests() {
  memoryGuests = null;
}

export async function seedGuestListIfEmpty(db) {
  if (!db) return { seeded: false, count: ensureMemoryGuests().length };
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM rsvp_guest_list WHERE wedding_key = ?`)
    .bind(WEDDING_KEY)
    .first();
  const count = Number(countRow?.c || 0);
  if (count > 0) return { seeded: false, count };
  return { seeded: true, ...(await addGuests(db, GUEST_LIST_SEED)) };
}

export async function getRsvpMode(db) {
  if (!db) return 'open';
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
  if (!db) {
    return [...ensureMemoryGuests()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' })
    );
  }

  await seedGuestListIfEmpty(db);

  const rows = await db
    .prepare(
      `SELECT id, display_name, name_key, created_at, attending, responded_at
       FROM rsvp_guest_list
       WHERE wedding_key = ?
       ORDER BY display_name COLLATE NOCASE ASC`
    )
    .bind(WEDDING_KEY)
    .all();

  return (rows?.results || []).map(mapGuestRow);
}

/**
 * Partial search by name (e.g. "Bruno" → "Bruno Butzke e Familia").
 * @returns {Promise<Array<{id, displayName, nameKey, createdAt}>>}
 */
export async function searchGuests(db, query) {
  const q = nameKey(query || '');
  if (q.length < 2) return [];

  if (!db) {
    return ensureMemoryGuests()
      .filter((g) => g.nameKey.includes(q))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' }))
      .slice(0, 20);
  }

  await seedGuestListIfEmpty(db);

  const rows = await db
    .prepare(
      `SELECT id, display_name, name_key, created_at, attending, responded_at
       FROM rsvp_guest_list
       WHERE wedding_key = ? AND name_key LIKE ?
       ORDER BY display_name COLLATE NOCASE ASC
       LIMIT 20`
    )
    .bind(WEDDING_KEY, `%${q}%`)
    .all();

  return (rows?.results || []).map(mapGuestRow);
}

/**
 * Atualiza status na lista oculta após confirmação (sim/não).
 */
export async function markGuestResponse(db, guestName, attending) {
  const key = nameKey(guestName || '');
  if (key.length < 2) return { updated: false };
  const now = new Date().toISOString();
  const attendingVal = attending ? 1 : 0;

  if (!db) {
    const mem = ensureMemoryGuests();
    const g = mem.find((x) => x.nameKey === key);
    if (!g) return { updated: false };
    g.attending = Boolean(attending);
    g.respondedAt = now;
    return { updated: true, guest: mapGuestRow(g) };
  }

  const result = await db
    .prepare(
      `UPDATE rsvp_guest_list
       SET attending = ?, responded_at = ?
       WHERE wedding_key = ? AND name_key = ?`
    )
    .bind(attendingVal, now, WEDDING_KEY, key)
    .run();

  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  return { updated: changes > 0 };
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

  if (!db) {
    const mem = ensureMemoryGuests();
    for (const raw of names) {
      const display = normalizeName(String(raw || ''));
      if (display.length < 2 || display.length > 100) {
        skipped++;
        continue;
      }
      const key = nameKey(display);
      if (mem.some((g) => g.nameKey === key)) {
        skipped++;
        continue;
      }
      mem.push({
        id: crypto.randomUUID(),
        displayName: display,
        nameKey: key,
        createdAt: now,
        attending: null,
        respondedAt: null,
      });
      added++;
    }
    return { added, skipped };
  }

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

  if (!db) {
    const mem = ensureMemoryGuests();
    const idx = mem.findIndex((g) => g.id === guestId);
    if (idx < 0) throw new Error('GUEST_NOT_FOUND');
    mem.splice(idx, 1);
    return { id: guestId, removed: true };
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

  if (!db) {
    const hit = ensureMemoryGuests().find((g) => g.nameKey === key);
    if (!hit) {
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
