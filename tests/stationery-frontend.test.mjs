/**
 * initStationery — lista + copiar
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { initStationery } from '../src/dani-carine/stationery.mjs';

test('initStationery renderiza templates da API', async () => {
  const window = new Window({ url: 'https://casebem.com/dani-carine/' });
  const { document } = window;
  document.body.innerHTML = `
    <section id="convite">
      <div id="stationery-list"><article><h3>Antigo</h3></article></div>
    </section>
  `;
  global.document = document;

  await initStationery(async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      templates: [
        {
          id: 'convite',
          title: 'Convite WhatsApp',
          kind: 'whatsapp',
          text: 'Você está convidado',
          shareUrl: 'https://wa.me/?text=convite',
        },
      ],
    }),
  }));

  assert.match(document.getElementById('stationery-list').textContent, /Convite WhatsApp/);
  assert.ok(document.querySelector('a.stationery__wa[href*="wa.me"]'));

  delete global.document;
});

test('initStationery mantém HTML se API falhar', async () => {
  const window = new Window({ url: 'https://casebem.com/dani-carine/' });
  const { document } = window;
  document.body.innerHTML = `
    <section id="convite">
      <div id="stationery-list"><article><h3>Fallback</h3></article></div>
    </section>
  `;
  global.document = document;

  await initStationery(async () => {
    throw new Error('offline');
  });
  assert.match(document.getElementById('stationery-list').textContent, /Fallback/);
  delete global.document;
});
