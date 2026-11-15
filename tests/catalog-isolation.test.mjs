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
