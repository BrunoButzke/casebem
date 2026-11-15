/**
 * Catálogo editável D1 — Free-tier
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GIFTS_CATALOG } from '../data/gifts-catalog.mjs';
import { PARTNER_ACCOUNT_ID } from '../functions/_lib/auth-service.mjs';
import {
  seedCatalogIfEmpty,
  getActiveCatalog,
  updateGift,
  validateGiftPatch,
  calculateTotalFromCatalog,
  resetMemoryCatalogForTests,
} from '../functions/_lib/catalog-service.mjs';

function rowMatchesAccount(row, accountId) {
  return !accountId || !row.account_id || row.account_id === accountId;
}

function mockCatalogDb(initialRows = []) {
  const rows = new Map(initialRows.map((r) => [r.id, { ...r }]));
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
            const accountId = this._p[0];
            if (sql.includes('account_id') && accountId != null) {
              const c = [...rows.values()].filter((r) => rowMatchesAccount(r, accountId)).length;
              return { c };
            }
            return { c: rows.size };
          }
          if (sql.includes('FROM gifts_catalog WHERE id')) {
            const [id, accountId] = this._p;
            const row = rows.get(id);
            if (!row || !rowMatchesAccount(row, accountId)) return null;
            return row;
          }
          return null;
        },
        async all() {
          let list = [...rows.values()];
          const accountId = this._p[0];
          if (sql.includes('account_id') && accountId != null) {
            list = list.filter((r) => rowMatchesAccount(r, accountId));
          }
          if (sql.includes('active = 1')) {
            list = list.filter((r) => r.active === 1);
          }
          list.sort((a, b) => (a.sort_order - b.sort_order) || a.id.localeCompare(b.id));
          return { results: list };
        },
        async run() {
          if (sql.includes('INSERT INTO gifts_catalog')) {
            if (this._p.length >= 11) {
              const [id, name, description, price, image, imageData, mode, active, sort, updated, accountId] =
                this._p;
              rows.set(id, {
                id,
                name,
                description,
                price_in_cents: price,
                image_url: image,
                image_data: imageData,
                mode,
                active,
                sort_order: sort,
                updated_at: updated,
                account_id: accountId,
              });
            } else {
              const [id, name, description, price, image, mode, sort, updated, accountId] = this._p;
              rows.set(id, {
                id,
                name,
                description,
                price_in_cents: price,
                image_url: image,
                mode,
                active: 1,
                sort_order: sort,
                updated_at: updated,
                account_id: accountId,
              });
            }
            return { success: true, meta: { changes: 1 } };
          }
          if (sql.includes('UPDATE gifts_catalog')) {
            const [name, description, price, image, imageData, mode, active, sort, updated, id, accountId] =
              this._p;
            const cur = rows.get(id);
            if (!cur || !rowMatchesAccount(cur, accountId)) {
              return { success: true, meta: { changes: 0 } };
            }
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
  const r = await seedCatalogIfEmpty(db, PARTNER_ACCOUNT_ID);
  assert.equal(r.seeded, true);
  assert.equal(r.count, GIFTS_CATALOG.length);
  const again = await seedCatalogIfEmpty(db, PARTNER_ACCOUNT_ID);
  assert.equal(again.seeded, false);
});

test('getActiveCatalog: omite inativos', async () => {
  const db = mockCatalogDb();
  await seedCatalogIfEmpty(db, PARTNER_ACCOUNT_ID);
  await updateGift(db, PARTNER_ACCOUNT_ID, 'danca', { active: false });
  const active = await getActiveCatalog(db, PARTNER_ACCOUNT_ID);
  assert.equal(active.some((g) => g.id === 'danca'), false);
  assert.ok(active.some((g) => g.id === 'spa'));
});

test('updateGift: altera preço em centavos', async () => {
  const db = mockCatalogDb();
  await seedCatalogIfEmpty(db, PARTNER_ACCOUNT_ID);
  const gift = await updateGift(db, PARTNER_ACCOUNT_ID, 'spa', {
    priceInCents: 33300,
    name: 'Spa premium',
  });
  assert.equal(gift.priceInCents, 33300);
  assert.equal(gift.name, 'Spa premium');
});

test('calculateTotalFromCatalog: usa preço do catálogo vivo', () => {
  const catalog = [{ id: 'x', priceInCents: 1000 }];
  const total = calculateTotalFromCatalog([{ giftId: 'x', quantity: 3 }], catalog);
  assert.equal(total, 3000);
});

test('getActiveCatalog: sem DB retorna estático', async () => {
  resetMemoryCatalogForTests();
  const catalog = await getActiveCatalog(null, PARTNER_ACCOUNT_ID);
  assert.equal(catalog.length, GIFTS_CATALOG.length);
});
