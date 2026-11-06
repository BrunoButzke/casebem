/**
 * RSVP fechado — whitelist Free-tier
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nameKey,
  assertGuestAllowed,
  getRsvpMode,
  setRsvpMode,
  addGuests,
} from '../functions/_lib/rsvp-guest-list.mjs';

test('nameKey: normaliza espaços e case', () => {
  assert.equal(nameKey('  Maria   Silva '), 'maria silva');
  assert.equal(nameKey('MARIA SILVA'), nameKey('maria silva'));
});

function mockDb({ mode = 'open', guests = new Map() } = {}) {
  return {
    data: { mode, guests },
    prepare(sql) {
      const self = this;
      return {
        _params: [],
        bind(...params) {
          this._params = params;
          return this;
        },
        async first() {
          if (sql.includes('FROM wedding_settings')) {
            return { rsvp_mode: self.data.mode };
          }
          if (sql.includes('FROM rsvp_guest_list') && sql.includes('name_key')) {
            const key = this._params[1];
            const hit = [...self.data.guests.values()].find((g) => g.name_key === key);
            return hit ? { id: hit.id } : null;
          }
          return null;
        },
        async all() {
          return { results: [...self.data.guests.values()] };
        },
        async run() {
          if (sql.includes('INSERT INTO wedding_settings') || sql.includes('ON CONFLICT(wedding_key)')) {
            self.data.mode = this._params[1];
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('INSERT INTO rsvp_guest_list')) {
            const [id, , display, key] = this._params;
            for (const g of self.data.guests.values()) {
              if (g.name_key === key) {
                throw new Error('UNIQUE constraint failed: rsvp_guest_list.wedding_key, name_key');
              }
            }
            self.data.guests.set(id, {
              id,
              display_name: display,
              name_key: key,
              created_at: this._params[4],
            });
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 1 } };
        },
      };
    },
  };
}

test('assertGuestAllowed: open permite qualquer nome', async () => {
  const db = mockDb({ mode: 'open' });
  const r = await assertGuestAllowed(db, 'Qualquer Pessoa');
  assert.equal(r.allowed, true);
  assert.equal(r.mode, 'open');
});

test('assertGuestAllowed: closed bloqueia fora da lista', async () => {
  const db = mockDb({ mode: 'closed' });
  const r = await assertGuestAllowed(db, 'Fora Da Lista');
  assert.equal(r.allowed, false);
  assert.equal(r.error, 'GUEST_NOT_ON_LIST');
});

test('assertGuestAllowed: closed libera nome na lista (case-insensitive)', async () => {
  const db = mockDb({ mode: 'closed' });
  await addGuests(db, ['Maria Silva']);
  const r = await assertGuestAllowed(db, '  maria   silva ');
  assert.equal(r.allowed, true);
});

test('setRsvpMode + getRsvpMode', async () => {
  const db = mockDb({ mode: 'open' });
  await setRsvpMode(db, 'closed');
  assert.equal(await getRsvpMode(db), 'closed');
});

test('addGuests: ignora duplicata via UNIQUE', async () => {
  const db = mockDb();
  const first = await addGuests(db, ['Ana']);
  const second = await addGuests(db, ['Ana', 'Bruno']);
  assert.equal(first.added, 1);
  assert.equal(second.added, 1);
  assert.equal(second.skipped, 1);
});
