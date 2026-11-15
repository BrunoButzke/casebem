/**
 * Lista de convidados + grupos — D1 + seed/memory fallback (Cloudflare Free).
 */

import { WEDDING_KEY, normalizeName } from './rsvp-validators.mjs';
import { GUEST_LIST_SEED } from '../../data/guest-list-seed.mjs';
import { PARTNER_ACCOUNT_ID } from './auth-service.mjs';

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

function weddingKeyFor(accountId) {
  return accountId === PARTNER_ACCOUNT_ID ? WEDDING_KEY : accountId;
}

function requireAccountId(accountId) {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('ACCOUNT_ID_REQUIRED');
  }
  return accountId;
}

/** @type {Map<string, Array>} */
let memoryGuests = new Map();
/** @type {Map<string, Array>} */
let memoryGroups = new Map();
/** @type {Map<string, string>} */
let memoryRsvpMode = new Map();

function seedMemoryGuests() {
  const now = new Date().toISOString();
  return GUEST_LIST_SEED.map((display) => {
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

function ensureMemoryGroups(accountId) {
  const id = requireAccountId(accountId);
  if (!memoryGroups.has(id)) memoryGroups.set(id, []);
  return memoryGroups.get(id);
}

function ensureMemoryGuests(accountId) {
  const id = requireAccountId(accountId);
  if (!memoryGuests.has(id)) {
    memoryGuests.set(id, id === PARTNER_ACCOUNT_ID ? seedMemoryGuests() : []);
  }
  return memoryGuests.get(id);
}

function syncMemoryGroupNames(accountId) {
  const groups = ensureMemoryGroups(accountId);
  const byId = new Map(groups.map((g) => [g.id, g.name]));
  for (const guest of ensureMemoryGuests(accountId)) {
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
  memoryGuests = new Map();
  memoryGroups = new Map();
  memoryRsvpMode = new Map();
}

export async function seedGuestListIfEmpty(db, accountId = PARTNER_ACCOUNT_ID) {
  const id = requireAccountId(accountId);
  if (!db) return { seeded: false, count: ensureMemoryGuests(id).length };
  const countRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM rsvp_guest_list WHERE account_id = ?`)
    .bind(id)
    .first();
  const count = Number(countRow?.c || 0);
  if (count > 0) return { seeded: false, count };
  if (id !== PARTNER_ACCOUNT_ID) return { seeded: false, count: 0 };
  return { seeded: true, ...(await addGuests(db, GUEST_LIST_SEED, { accountId: id })) };
}

export async function getRsvpMode(db, accountId = PARTNER_ACCOUNT_ID) {
  const id = requireAccountId(accountId);
  if (!db) return memoryRsvpMode.get(id) === 'open' ? 'open' : 'closed';
  const row = await db
    .prepare(`SELECT rsvp_mode FROM wedding_settings WHERE account_id = ?`)
    .bind(id)
    .first();
  // Default: só da lista (closed) quando não há registro
  if (!row) return 'closed';
  return row.rsvp_mode === 'open' ? 'open' : 'closed';
}

export async function setRsvpMode(db, mode, accountId = PARTNER_ACCOUNT_ID) {
  const id = requireAccountId(accountId);
  if (mode !== 'open' && mode !== 'closed') {
    throw new Error('INVALID_RSVP_MODE');
  }
  const now = new Date().toISOString();
  if (!db) {
    memoryRsvpMode.set(id, mode);
    return { rsvpMode: mode, updatedAt: now };
  }
  await db
    .prepare(
      `INSERT INTO wedding_settings (wedding_key, rsvp_mode, updated_at, account_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(wedding_key) DO UPDATE SET
         rsvp_mode = excluded.rsvp_mode,
         updated_at = excluded.updated_at,
         account_id = excluded.account_id`
    )
    .bind(weddingKeyFor(id), mode, now, id)
    .run();
  return { rsvpMode: mode, updatedAt: now };
}

export async function listGroups(db, accountId = PARTNER_ACCOUNT_ID) {
  const id = requireAccountId(accountId);
  if (!db) {
    return [...ensureMemoryGroups(id)].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
  }
  const rows = await db
    .prepare(
      `SELECT id, name, created_at
       FROM guest_groups
       WHERE account_id = ?
       ORDER BY name COLLATE NOCASE ASC`
    )
    .bind(id)
    .all();
  return (rows?.results || []).map(mapGroupRow);
}

export async function createGroup(db, name, accountId = PARTNER_ACCOUNT_ID) {
  const id = requireAccountId(accountId);
  const display = normalizeGroupName(name);
  const groupId = crypto.randomUUID();
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemoryGroups(id);
    if (mem.some((g) => g.name.toLowerCase() === display.toLowerCase())) {
      throw new Error('GROUP_EXISTS');
    }
    const group = { id: groupId, name: display, createdAt: now };
    mem.push(group);
    return group;
  }

  try {
    await db
      .prepare(
        `INSERT INTO guest_groups (id, wedding_key, name, created_at, account_id)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(groupId, weddingKeyFor(id), display, now, id)
      .run();
  } catch (err) {
    if (err?.message?.includes('UNIQUE')) throw new Error('GROUP_EXISTS');
    throw err;
  }
  return { id: groupId, name: display, createdAt: now };
}

export async function deleteGroup(db, groupId, accountId = PARTNER_ACCOUNT_ID) {
  const id = requireAccountId(accountId);
  if (!groupId || typeof groupId !== 'string') throw new Error('INVALID_GROUP_ID');

  if (!db) {
    const mem = ensureMemoryGroups(id);
    const idx = mem.findIndex((g) => g.id === groupId);
    if (idx < 0) throw new Error('GROUP_NOT_FOUND');
    mem.splice(idx, 1);
    for (const guest of ensureMemoryGuests(id)) {
      if (guest.groupId === groupId) {
        guest.groupId = null;
        guest.groupName = null;
      }
    }
    return { id: groupId, removed: true };
  }

  await db
    .prepare(`UPDATE rsvp_guest_list SET group_id = NULL WHERE account_id = ? AND group_id = ?`)
    .bind(id, groupId)
    .run();

  const result = await db
    .prepare(`DELETE FROM guest_groups WHERE id = ? AND account_id = ?`)
    .bind(groupId, id)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('GROUP_NOT_FOUND');
  return { id: groupId, removed: true };
}

async function assertGroupExists(db, groupId, accountId) {
  if (groupId == null || groupId === '') return null;
  const id = requireAccountId(accountId);
  if (!db) {
    const g = ensureMemoryGroups(id).find((x) => x.id === groupId);
    if (!g) throw new Error('GROUP_NOT_FOUND');
    return g;
  }
  const row = await db
    .prepare(`SELECT id, name FROM guest_groups WHERE id = ? AND account_id = ?`)
    .bind(groupId, id)
    .first();
  if (!row) throw new Error('GROUP_NOT_FOUND');
  return mapGroupRow(row);
}

export async function listGuestList(db, accountId) {
  const id = requireAccountId(accountId);
  if (!db) {
    syncMemoryGroupNames(id);
    return [...ensureMemoryGuests(id)].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' })
    );
  }

  await seedGuestListIfEmpty(db, id);

  const rows = await db
    .prepare(
      `SELECT g.id, g.display_name, g.name_key, g.created_at, g.attending, g.responded_at,
              g.group_id, gr.name AS group_name
       FROM rsvp_guest_list g
       LEFT JOIN guest_groups gr ON gr.id = g.group_id AND gr.account_id = g.account_id
       WHERE g.account_id = ?
       ORDER BY g.display_name COLLATE NOCASE ASC`
    )
    .bind(id)
    .all();

  return (rows?.results || []).map(mapGuestRow);
}

/**
 * Partial search by name (e.g. "Bruno" → "Bruno Butzke e Familia").
 */
export async function searchGuests(db, query, accountId = PARTNER_ACCOUNT_ID) {
  const id = requireAccountId(accountId);
  const q = nameKey(query || '');
  if (q.length < 2) return [];

  if (!db) {
    return ensureMemoryGuests(id)
      .filter((g) => g.nameKey.includes(q))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' }))
      .slice(0, 20);
  }

  await seedGuestListIfEmpty(db, id);

  const rows = await db
    .prepare(
      `SELECT id, display_name, name_key, created_at, attending, responded_at, group_id
       FROM rsvp_guest_list
       WHERE account_id = ? AND name_key LIKE ?
       ORDER BY display_name COLLATE NOCASE ASC
       LIMIT 20`
    )
    .bind(id, `%${q}%`)
    .all();

  return (rows?.results || []).map(mapGuestRow);
}

/**
 * Atualiza status na lista após confirmação (sim/não) pelo nome.
 */
export async function markGuestResponse(db, guestName, attending, accountId = PARTNER_ACCOUNT_ID) {
  const id = requireAccountId(accountId);
  const key = nameKey(guestName || '');
  if (key.length < 2) return { updated: false };
  const now = new Date().toISOString();
  const attendingVal = attending ? 1 : 0;

  if (!db) {
    const mem = ensureMemoryGuests(id);
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
       WHERE account_id = ? AND name_key = ?`
    )
    .bind(attendingVal, now, id, key)
    .run();

  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  return { updated: changes > 0 };
}

/**
 * Admin: set attending by id. attending = true | false | null (pendente).
 */
export async function setGuestAttending(db, guestId, attending, accountId = PARTNER_ACCOUNT_ID) {
  const id = requireAccountId(accountId);
  if (!guestId || typeof guestId !== 'string') throw new Error('INVALID_GUEST_ID');
  if (!(attending === true || attending === false || attending === null)) {
    throw new Error('INVALID_ATTENDING');
  }
  const now = attending === null ? null : new Date().toISOString();
  const attendingVal = attending === null ? null : attending ? 1 : 0;

  if (!db) {
    const g = ensureMemoryGuests(id).find((x) => x.id === guestId);
    if (!g) throw new Error('GUEST_NOT_FOUND');
    g.attending = attending;
    g.respondedAt = now;
    return { updated: true, guest: mapGuestRow(g) };
  }

  const result = await db
    .prepare(
      `UPDATE rsvp_guest_list
       SET attending = ?, responded_at = ?
       WHERE id = ? AND account_id = ?`
    )
    .bind(attendingVal, now, guestId, id)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('GUEST_NOT_FOUND');
  return { updated: true };
}

export async function setGuestGroup(db, guestId, groupId, accountId = PARTNER_ACCOUNT_ID) {
  const id = requireAccountId(accountId);
  if (!guestId || typeof guestId !== 'string') throw new Error('INVALID_GUEST_ID');
  const resolved = groupId ? await assertGroupExists(db, groupId, id) : null;
  const nextId = resolved ? resolved.id : null;

  if (!db) {
    const g = ensureMemoryGuests(id).find((x) => x.id === guestId);
    if (!g) throw new Error('GUEST_NOT_FOUND');
    g.groupId = nextId;
    g.groupName = resolved?.name || null;
    return { updated: true, guest: mapGuestRow(g) };
  }

  const result = await db
    .prepare(
      `UPDATE rsvp_guest_list
       SET group_id = ?
       WHERE id = ? AND account_id = ?`
    )
    .bind(nextId, guestId, id)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('GUEST_NOT_FOUND');
  return { updated: true };
}

/**
 * Upsert many names. Returns { added, skipped }.
 * @param {{ groupId?: string|null, accountId: string }} opts
 */
export async function addGuests(db, names, opts = {}) {
  const accountId = requireAccountId(opts.accountId);
  if (!Array.isArray(names) || names.length === 0) {
    throw new Error('EMPTY_GUEST_LIST');
  }
  if (names.length > 500) {
    throw new Error('GUEST_LIST_TOO_LARGE');
  }

  const groupId = opts.groupId || null;
  const group = groupId ? await assertGroupExists(db, groupId, accountId) : null;

  let added = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  if (!db) {
    const mem = ensureMemoryGuests(accountId);
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
          `INSERT INTO rsvp_guest_list (id, wedding_key, display_name, name_key, created_at, group_id, account_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, weddingKeyFor(accountId), display, key, now, group?.id || null, accountId)
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

export async function removeGuest(db, guestId, accountId = PARTNER_ACCOUNT_ID) {
  const id = requireAccountId(accountId);
  if (!guestId || typeof guestId !== 'string') {
    throw new Error('INVALID_GUEST_ID');
  }

  if (!db) {
    const mem = ensureMemoryGuests(id);
    const idx = mem.findIndex((g) => g.id === guestId);
    if (idx < 0) throw new Error('GUEST_NOT_FOUND');
    mem.splice(idx, 1);
    return { id: guestId, removed: true };
  }

  const result = await db
    .prepare(`DELETE FROM rsvp_guest_list WHERE id = ? AND account_id = ?`)
    .bind(guestId, id)
    .run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes === 0) throw new Error('GUEST_NOT_FOUND');
  return { id: guestId, removed: true };
}

/**
 * If mode is closed, guest name must exist on list.
 */
export async function assertGuestAllowed(db, guestName, accountId = PARTNER_ACCOUNT_ID) {
  const id = requireAccountId(accountId);
  const mode = await getRsvpMode(db, id);
  if (mode !== 'closed') {
    return { allowed: true, mode };
  }

  const key = nameKey(guestName);

  if (!db) {
    const hit = ensureMemoryGuests(id).find((g) => g.nameKey === key);
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
       WHERE account_id = ? AND name_key = ?
       LIMIT 1`
    )
    .bind(id, key)
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
