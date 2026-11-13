/**
 * Lista de convidados + grupos — D1 + seed/memory fallback (Cloudflare Free).
 */

import { WEDDING_KEY, normalizeName } from './rsvp-validators.mjs';
import { GUEST_LIST_SEED } from '../../data/guest-list-seed.mjs';

/**
 * Canonical key for matching invite names (case/accents-insensitive-ish).
 */
export function nameKey(name) {
  return normalizeName(name)
    .normalize('NFC')
    .toLowerCase();
}

/** Parse nomes colados: vírgula, ponto-e-vírgula ou Enter */
export function parseGuestNamesInput(text) {
  return String(text || '')
    .split(/[,;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** In-memory store for local Vite / no-D1 */
let memoryGuests = null;
let memoryGroups = null;
let memoryRsvpMode = 'closed';

function ensureMemoryGroups() {
  if (!memoryGroups) memoryGroups = [];
  return memoryGroups;
}

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
        groupId: null,
        groupName: null,
      };
    });
  }
  return memoryGuests;
}

function syncMemoryGroupNames() {
  const groups = ensureMemoryGroups();
  const byId = new Map(groups.map((g) => [g.id, g.name]));
  for (const guest of ensureMemoryGuests()) {
    guest.groupName = guest.groupId ? byId.get(guest.groupId) || null : null;
  }
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
    groupId: r.group_id ?? r.groupId ?? null,
    groupName: r.group_name ?? r.groupName ?? null,
  };
}

function mapGroupRow(r) {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.created_at ?? r.createdAt,
  };
}

function normalizeGroupName(name) {
  const n = normalizeName(String(name || ''));
  if (n.length < 1 || n.length > 80) throw new Error('INVALID_GROUP_NAME');
  return n;
}

export function resetMemoryGuestsForTests() {
  memoryGuests = null;
  memoryGroups = null;
  memoryRsvpMode = 'closed';
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
  if (!db) return memoryRsvpMode === 'closed' ? 'closed' : 'open';
  const row = await db
    .prepare(`SELECT rsvp_mode FROM wedding_settings WHERE wedding_key = ?`)
    .bind(WEDDING_KEY)
    .first();
  // Default: só da lista (closed) quando não há registro
  if (!row) return 'closed';
  return row.rsvp_mode === 'open' ? 'open' : 'closed';
}

export async function setRsvpMode(db, mode) {
  if (mode !== 'open' && mode !== 'closed') {
    throw new Error('INVALID_RSVP_MODE');
  }
  const now = new Date().toISOString();
  if (!db) {
    memoryRsvpMode = mode;
    return { rsvpMode: mode, updatedAt: now };
  }
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

export async function listGroups(db) {
  if (!db) {
    return [...ensureMemoryGroups()].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
  }
  const rows = await db
    .prepare(
      `SELECT id, name, created_at
       FROM guest_groups
       WHERE wedding_key = ?
       ORDER BY name COLLATE NOCASE ASC`
    )
    .bind(WEDDING_KEY)
    .all();
  return (rows?.results || []).map(mapGroupRow);
}

export async function createGroup(db, name) {
  const display = normalizeGroupName(name);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemoryGroups();
    if (mem.some((g) => g.name.toLowerCase() === display.toLowerCase())) {
      throw new Error('GROUP_EXISTS');
    }
    const group = { id, name: display, createdAt: now };
    mem.push(group);
    return group;
  }

  try {
    await db
      .prepare(
        `INSERT INTO guest_groups (id, wedding_key, name, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(id, WEDDING_KEY, display, now)
      .run();
  } catch (err) {
    if (err?.message?.includes('UNIQUE')) throw new Error('GROUP_EXISTS');
    throw err;
  }
  return { id, name: display, createdAt: now };
}

export async function deleteGroup(db, groupId) {
  if (!groupId || typeof groupId !== 'string') throw new Error('INVALID_GROUP_ID');

  if (!db) {
    const mem = ensureMemoryGroups();
    const idx = mem.findIndex((g) => g.id === groupId);
    if (idx < 0) throw new Error('GROUP_NOT_FOUND');
    mem.splice(idx, 1);
    for (const guest of ensureMemoryGuests()) {
      if (guest.groupId === groupId) {
        guest.groupId = null;
        guest.groupName = null;
      }
    }
    return { id: groupId, removed: true };
  }

  await db
    .prepare(`UPDATE rsvp_guest_list SET group_id = NULL WHERE wedding_key = ? AND group_id = ?`)
    .bind(WEDDING_KEY, groupId)
    .run();

  const result = await db
    .prepare(`DELETE FROM guest_groups WHERE id = ? AND wedding_key = ?`)
    .bind(groupId, WEDDING_KEY)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('GROUP_NOT_FOUND');
  return { id: groupId, removed: true };
}

async function assertGroupExists(db, groupId) {
  if (groupId == null || groupId === '') return null;
  if (!db) {
    const g = ensureMemoryGroups().find((x) => x.id === groupId);
    if (!g) throw new Error('GROUP_NOT_FOUND');
    return g;
  }
  const row = await db
    .prepare(`SELECT id, name FROM guest_groups WHERE id = ? AND wedding_key = ?`)
    .bind(groupId, WEDDING_KEY)
    .first();
  if (!row) throw new Error('GROUP_NOT_FOUND');
  return mapGroupRow(row);
}

export async function listGuestList(db) {
  if (!db) {
    syncMemoryGroupNames();
    return [...ensureMemoryGuests()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' })
    );
  }

  await seedGuestListIfEmpty(db);

  const rows = await db
    .prepare(
      `SELECT g.id, g.display_name, g.name_key, g.created_at, g.attending, g.responded_at,
              g.group_id, gr.name AS group_name
       FROM rsvp_guest_list g
       LEFT JOIN guest_groups gr ON gr.id = g.group_id AND gr.wedding_key = g.wedding_key
       WHERE g.wedding_key = ?
       ORDER BY g.display_name COLLATE NOCASE ASC`
    )
    .bind(WEDDING_KEY)
    .all();

  return (rows?.results || []).map(mapGuestRow);
}

/**
 * Partial search by name (e.g. "Bruno" → "Bruno Butzke e Familia").
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
      `SELECT id, display_name, name_key, created_at, attending, responded_at, group_id
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
 * Atualiza status na lista após confirmação (sim/não) pelo nome.
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
 * Admin: set attending by id. attending = true | false | null (pendente).
 */
export async function setGuestAttending(db, guestId, attending) {
  if (!guestId || typeof guestId !== 'string') throw new Error('INVALID_GUEST_ID');
  if (!(attending === true || attending === false || attending === null)) {
    throw new Error('INVALID_ATTENDING');
  }
  const now = attending === null ? null : new Date().toISOString();
  const attendingVal = attending === null ? null : attending ? 1 : 0;

  if (!db) {
    const g = ensureMemoryGuests().find((x) => x.id === guestId);
    if (!g) throw new Error('GUEST_NOT_FOUND');
    g.attending = attending;
    g.respondedAt = now;
    return { updated: true, guest: mapGuestRow(g) };
  }

  const result = await db
    .prepare(
      `UPDATE rsvp_guest_list
       SET attending = ?, responded_at = ?
       WHERE id = ? AND wedding_key = ?`
    )
    .bind(attendingVal, now, guestId, WEDDING_KEY)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('GUEST_NOT_FOUND');
  return { updated: true };
}

export async function setGuestGroup(db, guestId, groupId) {
  if (!guestId || typeof guestId !== 'string') throw new Error('INVALID_GUEST_ID');
  const resolved = groupId ? await assertGroupExists(db, groupId) : null;
  const nextId = resolved ? resolved.id : null;

  if (!db) {
    const g = ensureMemoryGuests().find((x) => x.id === guestId);
    if (!g) throw new Error('GUEST_NOT_FOUND');
    g.groupId = nextId;
    g.groupName = resolved?.name || null;
    return { updated: true, guest: mapGuestRow(g) };
  }

  const result = await db
    .prepare(
      `UPDATE rsvp_guest_list
       SET group_id = ?
       WHERE id = ? AND wedding_key = ?`
    )
    .bind(nextId, guestId, WEDDING_KEY)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('GUEST_NOT_FOUND');
  return { updated: true };
}

/**
 * Upsert many names. Returns { added, skipped }.
 * @param {{ groupId?: string|null }} [opts]
 */
export async function addGuests(db, names, opts = {}) {
  if (!Array.isArray(names) || names.length === 0) {
    throw new Error('EMPTY_GUEST_LIST');
  }
  if (names.length > 500) {
    throw new Error('GUEST_LIST_TOO_LARGE');
  }

  const groupId = opts.groupId || null;
  const group = groupId ? await assertGroupExists(db, groupId) : null;

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
        groupId: group?.id || null,
        groupName: group?.name || null,
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
          `INSERT INTO rsvp_guest_list (id, wedding_key, display_name, name_key, created_at, group_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(id, WEDDING_KEY, display, key, now, group?.id || null)
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
          'Confirmação fechada: este nome não está na lista de convidados. Confira a escrita ou fale com os noivos.',
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
        'Confirmação fechada: este nome não está na lista de convidados. Confira a escrita ou fale com os noivos.',
    };
  }

  return { allowed: true, mode };
}

/** Contadores a partir da lista (fonte única no painel). */
export function summarizeGuestList(guests) {
  const list = Array.isArray(guests) ? guests : [];
  let confirmed = 0;
  let declined = 0;
  let pending = 0;
  for (const g of list) {
    if (g.attending === true) confirmed++;
    else if (g.attending === false) declined++;
    else pending++;
  }
  return {
    guestListCount: list.length,
    attendingCount: confirmed,
    declinedCount: declined,
    pendingCount: pending,
  };
}
