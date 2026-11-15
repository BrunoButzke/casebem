import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGift,
  listCatalogAdmin,
  updateGift,
  resetMemoryCatalogForTests,
} from '../functions/_lib/catalog-service.mjs';

test('account B cannot read or patch account A gifts', async () => {
  resetMemoryCatalogForTests();
  const a = await createGift(null, 'acc-a', {
    name: 'Lua de mel A',
    description: 'Viagem',
    priceInCents: 15000,
    mode: 'fixed',
  });
  const listB = await listCatalogAdmin(null, 'acc-b');
  assert.equal(listB.some((g) => g.id === a.id), false);
  await assert.rejects(() => updateGift(null, 'acc-b', a.id, { name: 'Hack' }), {
    message: 'GIFT_NOT_FOUND',
  });
});

function mockUniqueGiftsDb() {
  const rows = new Map();
  return {
    prepare(sql) {
      return {
        _p: [],
        bind(...p) {
          this._p = p;
          return this;
        },
        async first() {
          if (sql.includes('FROM gifts_catalog WHERE id')) {
            return rows.get(this._p[0]) || null;
          }
          return null;
        },
        async run() {
          if (sql.includes('INSERT INTO gifts_catalog')) {
            const [
              id,
              name,
              description,
              price,
              image,
              imageData,
              mode,
              active,
              sort,
              updated,
              accountId,
            ] = this._p;
            if (rows.has(id)) {
              throw new Error('UNIQUE constraint failed: gifts_catalog.id');
            }
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
          }
          return { success: true };
        },
      };
    },
  };
}

test('two accounts can create similarly named gifts without 409', async () => {
  const db = mockUniqueGiftsDb();
  const body = {
    name: 'Lua de mel',
    description: 'Viagem',
    priceInCents: 15000,
    mode: 'fixed',
  };
  const a = await createGift(db, 'acc-a', body);
  const b = await createGift(db, 'acc-b', body);
  assert.equal(a.id, 'lua-de-mel');
  assert.notEqual(b.id, a.id);
  assert.match(b.id, /^lua-de-mel-/);
});
