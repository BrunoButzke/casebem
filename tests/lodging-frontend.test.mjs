/**
 * initLodging — renderiza tips da API
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { initLodging } from '../src/dani-carine/lodging.mjs';

test('initLodging preenche lista a partir da API', async () => {
  const window = new Window({ url: 'https://casebem.com/dani-carine/' });
  const { document } = window;
  document.body.innerHTML = `
    <section id="hospedagem">
      <div id="lodging-list"><article class="lodging__item"><h3>Antigo</h3></article></div>
    </section>
  `;
  global.document = document;

  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      tips: [
        {
          id: 't1',
          name: 'Hotel Lagoa',
          description: 'Perto do Indaiá',
          area: 'Lagoa',
          mapsUrl: 'https://maps.google.com/?q=lagoa',
          websiteUrl: '',
        },
      ],
    }),
  });

  await initLodging(fetchImpl);
  const items = document.querySelectorAll('.lodging__item');
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /Hotel Lagoa/);
  assert.match(items[0].innerHTML, /maps\.google/);

  delete global.document;
});

test('initLodging mantém HTML se API falhar', async () => {
  const window = new Window({ url: 'https://casebem.com/dani-carine/' });
  const { document } = window;
  document.body.innerHTML = `
    <section id="hospedagem">
      <div id="lodging-list"><article class="lodging__item"><h3>Fallback</h3></article></div>
    </section>
  `;
  global.document = document;

  await initLodging(async () => {
    throw new Error('offline');
  });
  assert.match(document.getElementById('lodging-list').textContent, /Fallback/);
  delete global.document;
});
