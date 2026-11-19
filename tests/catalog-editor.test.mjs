/**
 * Catálogo editável D1 — Free-tier
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GIFTS_CATALOG } from '../data/gifts-catalog.mjs';
import {
  seedCatalogIfEmpty,
  getActiveCatalog,
  updateGift,
  validateGiftPatch,
  calculateTotalFromCatalog,
} from '../functions/_lib/catalog-service.mjs';

const DEFAULT_WK = 'dani-carine';

function mockCatalogDb(initialRows = []) {
  const rows = new Map(initialRows.map((r) => [r.id, { wedding_key: DEFAULT_WK, ...r }]));
  return {
    rows,
    prepare(sql) {
      return {
        _p: [],
        bind(...p) {
          this._p = p;
          return this;
        },
        async first() {
          if (sql.includes('COUNT(*)')) {
            const wk = sql.includes('wedding_key = ?') ? this._p[0] : null;
            let list = [...rows.values()];
            if (wk) list = list.filter((r) => (r.wedding_key || DEFAULT_WK) === wk);
            return { c: list.length };
          }
          if (sql.includes('FROM gifts_catalog WHERE id')) {
            const id = this._p[0];
            const wk = sql.includes('wedding_key = ?') ? this._p[1] : null;
            const row = rows.get(id);
            if (!row) return null;
            if (wk && (row.wedding_key || DEFAULT_WK) !== wk) return null;
            return row;
          }
          return null;
        },
        async all() {
          let list = [...rows.values()];
          const wk = sql.includes('wedding_key = ?') ? this._p[0] : null;
          if (wk) list = list.filter((r) => (r.wedding_key || DEFAULT_WK) === wk);
          if (sql.includes('WHERE') && sql.includes('active = 1')) {
            list = list.filter((r) => r.active === 1);
          }
          list.sort((a, b) => (a.sort_order - b.sort_order) || a.id.localeCompare(b.id));
          return { results: list };
        },
        async run() {
          if (sql.includes('INSERT INTO gifts_catalog')) {
            const hasWk = sql.includes('wedding_key');
            if (hasWk && sql.includes('image_data')) {
              const [id, wedding_key, name, description, price, image, imageData, mode, active, sort, updated] =
                this._p;
              rows.set(id, {
                id,
                wedding_key,
                name,
                description,
                price_in_cents: price,
                image_url: image,
                image_data: imageData,
                mode,
                active: active ?? 1,
                sort_order: sort,
                updated_at: updated,
              });
            } else if (hasWk) {
              const [id, wedding_key, name, description, price, image, mode, sort, updated] = this._p;
              rows.set(id, {
                id,
                wedding_key,
                name,
                description,
                price_in_cents: price,
                image_url: image,
                mode,
                active: 1,
                sort_order: sort,
                updated_at: updated,
              });
            }
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('UPDATE gifts_catalog')) {
            const tail = sql.includes('wedding_key = ?') ? 2 : 1;
            const id = this._p[this._p.length - tail];
            const wk = tail === 2 ? this._p[this._p.length - 1] : null;
            const cur = rows.get(id);
            if (!cur || (wk && (cur.wedding_key || DEFAULT_WK) !== wk)) {
              return { success: true, meta: { changes: 0 } };
            }
            const [
              name,
              description,
              price,
              image,
              imageData,
              mode,
              active,
              sort,
              updated,
            ] = this._p.slice(0, this._p.length - tail);
            rows.set(id, {
              ...cur,
              name,
              description,
              price_in_cents: price,
              image_url: image,
              image_data: imageData,
              mode,
              active,
              sort_order: sort,
              updated_at: updated,
            });
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 0 } };
        },
      };
    },
  };
}

test('validateGiftPatch: rejeita preço < 99', () => {
  const r = validateGiftPatch({ priceInCents: 50 });
  assert.equal(r.valid, false);
});

test('seedCatalogIfEmpty: popula a partir do estático', async () => {
  const db = mockCatalogDb();
  const r = await seedCatalogIfEmpty(db);
  assert.equal(r.seeded, true);
  assert.equal(r.count, GIFTS_CATALOG.length);
  const again = await seedCatalogIfEmpty(db);
  assert.equal(again.seeded, false);
});

test('getActiveCatalog: omite inativos', async () => {
  const db = mockCatalogDb();
  await seedCatalogIfEmpty(db);
  await updateGift(db, 'danca', { active: false });
  const active = await getActiveCatalog(db);
  assert.equal(active.some((g) => g.id === 'danca'), false);
  assert.ok(active.some((g) => g.id === 'spa'));
});

test('updateGift: altera preço em centavos', async () => {
  const db = mockCatalogDb();
  await seedCatalogIfEmpty(db);
  const gift = await updateGift(db, 'spa', { priceInCents: 33300, name: 'Spa premium' });
  assert.equal(gift.priceInCents, 33300);
  assert.equal(gift.name, 'Spa premium');
});

test('calculateTotalFromCatalog: usa preço do catálogo vivo', () => {
  const catalog = [{ id: 'x', priceInCents: 1000 }];
  const total = calculateTotalFromCatalog([{ giftId: 'x', quantity: 3 }], catalog);
  assert.equal(total, 3000);
});

test('getActiveCatalog: sem DB retorna estático', async () => {
  const catalog = await getActiveCatalog(null);
  assert.equal(catalog.length, GIFTS_CATALOG.length);
});
