import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { initMedia } from '../src/dani-carine/media.mjs';

test('initMedia mostra embed quando API retorna itens', async () => {
  const window = new Window({ url: 'https://casebem.com/dani-carine/' });
  const { document } = window;
  document.body.innerHTML = `
    <section id="playlist" hidden>
      <div id="playlist-mount"></div>
    </section>
  `;
  global.document = document;

  await initMedia(async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      items: [
        {
          id: 'v1',
          title: 'Música 1',
          youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          videoId: 'dQw4w9WgXcQ',
          embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
        },
      ],
    }),
  }));

  assert.equal(document.getElementById('playlist').hidden, false);
  assert.ok(document.querySelector('iframe'));
  delete global.document;
});

test('initMedia esconde seção se vazio', async () => {
  const window = new Window({ url: 'https://casebem.com/dani-carine/' });
  const { document } = window;
  document.body.innerHTML = `
    <section id="playlist">
      <div id="playlist-mount"></div>
    </section>
  `;
  global.document = document;
  await initMedia(async () => ({
    ok: true,
    json: async () => ({ ok: true, items: [] }),
  }));
  assert.equal(document.getElementById('playlist').hidden, true);
  delete global.document;
});
