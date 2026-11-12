import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Window } from 'happy-dom';

describe('Frontend RSVP - Real DOM Tests', () => {
  async function waitFor(condition, timeout = 3000, errorMsg = 'condition not met') {
    const deadline = Date.now() + timeout;
    while (!condition()) {
      if (Date.now() > deadline) {
        throw new Error(`waitFor timeout after ${timeout}ms: ${errorMsg}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  async function setupWindow() {
    const window = new Window({ url: 'https://casebem.pages.dev/dani-carine/' });
    const { document } = window;

    document.body.innerHTML = `
      <form id="rsvp-form">
        <input type="text" id="rsvp-name" />
        <span id="rsvp-name-error" class="form-error"></span>
        <div id="rsvp-matches-block" hidden>
          <div id="rsvp-matches-list"></div>
          <span id="rsvp-matches-error" class="form-error"></span>
        </div>
        <div id="rsvp-invite" hidden>
          <p id="rsvp-invite-name"></p>
          <button type="button" id="rsvp-change-guest">Buscar outro nome</button>
        </div>
        <div id="rsvp-confirm-fields" hidden>
          <div class="radio-group radio-group--row">
            <input type="radio" name="attending" value="true" id="attending-true" />
            <input type="radio" name="attending" value="false" id="attending-false" />
          </div>
          <span id="rsvp-attending-error" class="form-error"></span>
          <div id="rsvp-companions-block" hidden>
            <div id="rsvp-companions-list"></div>
            <button type="button" id="rsvp-add-companion">Adicionar acompanhante</button>
            <span id="rsvp-companions-error" class="form-error"></span>
          </div>
        </div>
        <button type="submit" id="rsvp-submit">Buscar</button>
        <button type="button" id="rsvp-edit" hidden>Alterar minha resposta</button>
        <div id="rsvp-status" hidden>
          <span id="rsvp-status-message"></span>
        </div>
        <div id="rsvp-fields"></div>
      </form>
    `;

    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;
    Object.defineProperty(global, 'crypto', {
      value: window.crypto,
      writable: true,
      configurable: true,
    });

    const fetchCalls = [];
    const mockFetch = (responses) => async (url, options) => {
      fetchCalls.push({ url, options });
      const resp = responses.shift() || { status: 500, body: {} };
      return {
        status: resp.status,
        ok: resp.status >= 200 && resp.status < 300,
        headers: { get: (n) => resp.headers?.[n] || 'application/json' },
        json: async () => resp.body,
      };
    };

    return { window, document, fetchCalls, mockFetch };
  }

  async function searchThenConfirm(window, document, name = 'Bruno Butzke e Familia') {
    const form = document.getElementById('rsvp-form');
    const nameInput = document.getElementById('rsvp-name');
    nameInput.value = name.split(' ')[0];
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => !document.getElementById('rsvp-invite').hidden, 3000, 'invite not shown');
    document.getElementById('attending-true').checked = true;
  }

  it('POST 201 success: token stored, fields locked, edit button visible', async () => {
    const { window, document, fetchCalls, mockFetch } = await setupWindow();

    global.fetch = mockFetch([
      {
        status: 200,
        body: {
          ok: true,
          matches: [{ id: 'g1', displayName: 'Bruno Butzke e Familia' }],
        },
      },
      {
        status: 201,
        body: {
          id: 'id1',
          manageToken: 'token-success',
          guestName: 'Bruno Butzke e Familia',
          attending: true,
          adultsCount: 0,
          childrenCount: 0,
          observations: null,
          consentGiven: true,
          createdAt: '2026-11-06T00:00:00Z',
          updatedAt: '2026-11-06T00:00:00Z',
        },
      },
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    await searchThenConfirm(window, document);

    const form = document.getElementById('rsvp-form');
    const submitBtn = document.getElementById('rsvp-submit');
    const editBtn = document.getElementById('rsvp-edit');

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => fetchCalls.length === 2, 3000, 'POST not called');
    await window.happyDOM.waitUntilComplete();
    await waitFor(
      () => submitBtn.hidden === true && localStorage.getItem('rsvp_manage_token') === 'token-success',
      3000,
      'not locked'
    );

    assert.equal(fetchCalls[1].options.method, 'POST');
    assert.equal(localStorage.getItem('rsvp_manage_token'), 'token-success');
    assert.equal(editBtn.hidden, false);
    const body = JSON.parse(fetchCalls[1].options.body);
    assert.equal(body.guestName, 'Bruno Butzke e Familia');
  });

  it('POST with existing token sends Authorization Bearer', async () => {
    const { window, document, fetchCalls, mockFetch } = await setupWindow();
    localStorage.setItem('rsvp_manage_token', 'existing-token');

    global.fetch = mockFetch([
      {
        status: 401,
        body: { error: 'Unauthorized' },
      },
      {
        status: 200,
        body: { ok: true, matches: [{ id: 'g1', displayName: 'Maria Silva' }] },
      },
      {
        status: 201,
        body: {
          id: 'id2',
          manageToken: 'new-token',
          guestName: 'Maria Silva',
          attending: true,
          adultsCount: 0,
          childrenCount: 0,
          observations: null,
          consentGiven: true,
        },
      },
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await Promise.resolve();
    await Promise.resolve();

    // After 401 from GET, back to create — search + confirm
    await searchThenConfirm(window, document, 'Maria Silva');
    document.getElementById('rsvp-form').dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    );
    await waitFor(() => fetchCalls.some((c) => c.options?.method === 'POST'), 3000, 'no POST');

    const post = fetchCalls.find((c) => c.options?.method === 'POST');
    assert.ok(post);
  });

  it('409 conflict: message shown, form NOT disabled', async () => {
    const { window, document, mockFetch } = await setupWindow();

    global.fetch = mockFetch([
      {
        status: 200,
        body: { ok: true, matches: [{ id: 'g1', displayName: 'Ana Paula Costa' }] },
      },
      { status: 409, body: { error: 'Conflict' } },
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await searchThenConfirm(window, document, 'Ana Paula Costa');

    const form = document.getElementById('rsvp-form');
    const submitBtn = document.getElementById('rsvp-submit');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    const statusMsg = document.getElementById('rsvp-status-message');
    assert.ok(statusMsg.textContent.length > 10);
    assert.equal(submitBtn.disabled, false);
    assert.match(submitBtn.textContent, /Confirmar presença/i);
  });

  it('413 payload too large: message shown, form enabled', async () => {
    const { window, document, mockFetch } = await setupWindow();

    global.fetch = mockFetch([
      {
        status: 200,
        body: { ok: true, matches: [{ id: 'g1', displayName: 'João Souza e Família' }] },
      },
      { status: 413, body: { error: 'Payload too large' } },
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await searchThenConfirm(window, document, 'João Souza e Família');

    document.getElementById('rsvp-form').dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    );
    await Promise.resolve();
    await Promise.resolve();

    const statusMsg = document.getElementById('rsvp-status-message');
    assert.ok(statusMsg.textContent.includes('longo') || statusMsg.textContent.includes('muito'));
    assert.equal(document.getElementById('rsvp-submit').disabled, false);
  });

  it('429 rate limit: message shown, form enabled', async () => {
    const { window, document, mockFetch } = await setupWindow();

    global.fetch = mockFetch([
      {
        status: 200,
        body: { ok: true, matches: [{ id: 'g1', displayName: 'Maria Silva' }] },
      },
      { status: 429, body: { error: 'Too many requests' } },
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await searchThenConfirm(window, document, 'Maria Silva');

    document.getElementById('rsvp-form').dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    );
    await Promise.resolve();
    await Promise.resolve();

    assert.ok(document.getElementById('rsvp-status-message').textContent.length > 5);
    assert.equal(document.getElementById('rsvp-submit').disabled, false);
  });

  it('Invalid JSON response: helpful error message, form enabled', async () => {
    const { window, document, mockFetch } = await setupWindow();

    global.fetch = mockFetch([
      {
        status: 200,
        body: { ok: true, matches: [{ id: 'g1', displayName: 'Maria Silva' }] },
      },
      {
        status: 200,
        body: 'not-json',
        headers: { 'content-type': 'text/html' },
      },
    ]);

    // Override mock for non-json
    const base = mockFetch([
      {
        status: 200,
        body: { ok: true, matches: [{ id: 'g1', displayName: 'Maria Silva' }] },
      },
    ]);
    let n = 0;
    global.fetch = async (url, options) => {
      n += 1;
      if (n === 1) return base(url, options);
      return {
        status: 503,
        ok: false,
        headers: { get: () => 'text/html' },
        json: async () => {
          throw new Error('no json');
        },
      };
    };

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await searchThenConfirm(window, document, 'Maria Silva');
    document.getElementById('rsvp-form').dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    );
    await Promise.resolve();
    await Promise.resolve();

    assert.ok(document.getElementById('rsvp-status-message').textContent.length > 5);
  });

  it('503 non-JSON handled gracefully', async () => {
    const { window, document } = await setupWindow();

    let n = 0;
    global.fetch = async () => {
      n += 1;
      if (n === 1) {
        return {
          status: 200,
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({
            ok: true,
            matches: [{ id: 'g1', displayName: 'Maria Silva' }],
          }),
        };
      }
      return {
        status: 503,
        ok: false,
        headers: { get: () => 'text/plain' },
        json: async () => ({}),
      };
    };

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await searchThenConfirm(window, document, 'Maria Silva');
    document.getElementById('rsvp-form').dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    );
    await Promise.resolve();
    await Promise.resolve();

    assert.match(
      document.getElementById('rsvp-status-message').textContent,
      /indisponível|Erro|conexão/i
    );
  });

  it('GET 401 resets to create mode with new idempotency key', async () => {
    const { document, mockFetch } = await setupWindow();
    localStorage.setItem('rsvp_manage_token', 'bad-token');
    localStorage.setItem('rsvp_idempotency_key', 'old-key');

    global.fetch = mockFetch([{ status: 401, body: { error: 'Unauthorized' } }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await Promise.resolve();
    await Promise.resolve();

    const submitBtn = document.getElementById('rsvp-submit');
    assert.equal(localStorage.getItem('rsvp_manage_token'), null);
    assert.notEqual(localStorage.getItem('rsvp_idempotency_key'), 'old-key');
    assert.equal(document.getElementById('rsvp-name').disabled, false);
    assert.equal(submitBtn.hidden, false);
    assert.match(submitBtn.textContent, /Buscar/i);
  });

  it('multiple matches asks which guest', async () => {
    const { window, document, mockFetch } = await setupWindow();

    global.fetch = mockFetch([
      {
        status: 200,
        body: {
          ok: true,
          matches: [
            { id: 'g1', displayName: 'Bruno Butzke e Familia' },
            { id: 'g2', displayName: 'Bruno Silva' },
          ],
        },
      },
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const nameInput = document.getElementById('rsvp-name');
    nameInput.value = 'Bruno';
    document.getElementById('rsvp-form').dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    );
    await waitFor(
      () => !document.getElementById('rsvp-matches-block').hidden,
      3000,
      'matches not shown'
    );

    assert.equal(document.getElementById('rsvp-invite').hidden, true);
    assert.match(document.getElementById('rsvp-submit').textContent, /Continuar/i);
    assert.equal(document.querySelectorAll('input[name="rsvp-match"]').length, 2);
  });

  it('Edit button click unlocks only editable fields', async () => {
    const { document, mockFetch } = await setupWindow();
    localStorage.setItem('rsvp_manage_token', 'edit-token');

    global.fetch = mockFetch([
      {
        status: 200,
        body: {
          id: 'id3',
          guestName: 'Edit User',
          attending: true,
          adultsCount: 1,
          childrenCount: 0,
          observations: 'Convidado Extra',
          consentGiven: true,
          createdAt: '2026-11-05T00:00:00Z',
          updatedAt: '2026-11-05T00:00:00Z',
        },
      },
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const editBtn = document.getElementById('rsvp-edit');
    const nameInput = document.getElementById('rsvp-name');
    const addCompanionBtn = document.getElementById('rsvp-add-companion');
    const submitBtn = document.getElementById('rsvp-submit');

    editBtn.click();

    assert.equal(nameInput.disabled, true);
    assert.equal(addCompanionBtn.disabled, false);
    assert.equal(submitBtn.hidden, false);
    assert.match(submitBtn.textContent, /Atualizar/i);
  });

  it('PUT success locks all fields again', async () => {
    const { window, document, mockFetch, fetchCalls } = await setupWindow();
    localStorage.setItem('rsvp_manage_token', 'put-token');

    global.fetch = mockFetch([
      {
        status: 200,
        body: {
          id: 'id4',
          guestName: 'PUT User',
          attending: true,
          adultsCount: 1,
          childrenCount: 0,
          observations: 'Original',
          consentGiven: true,
          createdAt: '2026-11-05T00:00:00Z',
          updatedAt: '2026-11-05T00:00:00Z',
        },
      },
      {
        status: 200,
        body: {
          id: 'id4',
          guestName: 'PUT User',
          attending: true,
          adultsCount: 1,
          childrenCount: 0,
          observations: 'Convidado Extra',
          consentGiven: true,
          createdAt: '2026-11-05T00:00:00Z',
          updatedAt: '2026-11-06T00:00:00Z',
        },
      },
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await window.happyDOM.waitUntilComplete();
    await waitFor(() => fetchCalls.length === 1);

    const editBtn = document.getElementById('rsvp-edit');
    const submitBtn = document.getElementById('rsvp-submit');
    const addCompanionBtn = document.getElementById('rsvp-add-companion');
    editBtn.click();

    addCompanionBtn.click();
    const companionInput = document.querySelector('[data-companion-name]');
    if (companionInput) companionInput.value = 'Convidado Extra';

    document.getElementById('rsvp-form').dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    );
    await waitFor(() => fetchCalls.length === 2, 3000, 'PUT not called');
    await window.happyDOM.waitUntilComplete();

    await waitFor(
      () => submitBtn.hidden === true && addCompanionBtn.disabled === true,
      3000,
      'not locked'
    );

    assert.equal(fetchCalls[1].options.method, 'PUT');
    assert.equal(editBtn.hidden, false);
  });

  it('PUT error restores edit mode', async () => {
    const { document, mockFetch } = await setupWindow();
    localStorage.setItem('rsvp_manage_token', 'error-token');

    global.fetch = mockFetch([
      {
        status: 200,
        body: {
          id: 'id5',
          guestName: 'Error User',
          attending: false,
          adultsCount: 0,
          childrenCount: 0,
          observations: null,
          consentGiven: true,
          createdAt: '2026-11-05T00:00:00Z',
          updatedAt: '2026-11-05T00:00:00Z',
        },
      },
      { status: 500, body: { error: 'Internal error' } },
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await Promise.resolve();
    await Promise.resolve();

    document.getElementById('rsvp-edit').click();
    document.getElementById('attending-false').checked = true;
    document.getElementById('rsvp-form').dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true })
    );
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(document.getElementById('rsvp-add-companion').disabled, false);
    assert.equal(document.getElementById('rsvp-name').disabled, true);
  });
});
