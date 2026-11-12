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
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  async function setupWindow() {
    const window = new Window({ url: 'https://casebem.pages.dev/dani-carine/' });
    const { document } = window;
    
    // Minimal form HTML aligned with simplified RSVP UI
    document.body.innerHTML = `
      <form id="rsvp-form">
        <input type="text" id="rsvp-name" />
        <div class="radio-group radio-group--row">
          <input type="radio" name="attending" value="true" id="attending-true" />
          <input type="radio" name="attending" value="false" id="attending-false" />
        </div>
        <div id="rsvp-companions-block" hidden>
          <div id="rsvp-companions-list"></div>
          <button type="button" id="rsvp-add-companion">Adicionar acompanhante</button>
          <span id="rsvp-companions-error" class="form-error"></span>
        </div>
        <button type="submit" id="rsvp-submit">Confirmar presença</button>
        <button type="button" id="rsvp-edit" hidden>Alterar minha resposta</button>
        <div id="rsvp-status" hidden>
          <span id="rsvp-status-message"></span>
        </div>
        <div id="rsvp-fields"></div>
        <span id="rsvp-name-error" class="form-error"></span>
        <span id="rsvp-attending-error" class="form-error"></span>
      </form>
    `;

    // Setup globals
    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;
    Object.defineProperty(global, 'crypto', {
      value: window.crypto,
      writable: true,
      configurable: true
    });

    const fetchCalls = [];
    const mockFetch = (responses) => async (url, options) => {
      fetchCalls.push({ url, options });
      const resp = responses.shift() || { status: 500, json: async () => ({}) };
      return {
        status: resp.status,
        ok: resp.status >= 200 && resp.status < 300,
        headers: { get: (n) => resp.headers?.[n] || 'application/json' },
        json: async () => resp.body,
      };
    };

    return { window, document, fetchCalls, mockFetch };
  }

  it('POST 201 success: token stored, fields locked, edit button visible', async () => {
    const { window, document, fetchCalls, mockFetch } = await setupWindow();
    
    global.fetch = mockFetch([{
      status: 201,
      body: {
        id: 'id1',
        manageToken: 'token-success',
        guestName: 'Test User',
        attending: true,
        adultsCount: 2,
        childrenCount: 0,
        observations: null,
        consentGiven: true,
        createdAt: '2026-11-06T00:00:00Z',
        updatedAt: '2026-11-06T00:00:00Z'
      }
    }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = document.getElementById('rsvp-form');
    const nameInput = document.getElementById('rsvp-name');
    const attendingTrue = document.getElementById('attending-true');
    const addCompanionBtn = document.getElementById('rsvp-add-companion');
    const submitBtn = document.getElementById('rsvp-submit');
    const editBtn = document.getElementById('rsvp-edit');

    nameInput.value = 'Test User';
    attendingTrue.checked = true;

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    
    // Wait for fetch to complete
    await waitFor(() => fetchCalls.length === 1, 3000, 'fetch not called');
    
    // Wait for all async tasks and DOM updates to settle
    await window.happyDOM.waitUntilComplete();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify state is stable
    await waitFor(() => {
      return submitBtn.hidden === true && 
             localStorage.getItem('rsvp_manage_token') === 'token-success';
    }, 3000, `submitBtn.hidden=${submitBtn.hidden}, token=${localStorage.getItem('rsvp_manage_token')}`);

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].options.method, 'POST');
    
    // Token stored
    assert.equal(localStorage.getItem('rsvp_manage_token'), 'token-success');
    
    // Idempotency key cleared
    assert.equal(localStorage.getItem('rsvp_idempotency_key'), null);
    
    // Fields locked
    assert.equal(nameInput.disabled, true);
    assert.equal(addCompanionBtn.disabled, true);
    
    // Buttons
    assert.equal(submitBtn.hidden, true);
    assert.equal(editBtn.hidden, false);
  });

  it('POST with existing token sends Authorization Bearer', async () => {
    const { document, fetchCalls, mockFetch } = await setupWindow();
    localStorage.setItem('rsvp_manage_token', 'existing-token');
    
    global.fetch = mockFetch([
      {
        // GET from fetchRsvp()
        status: 200,
        body: {
          id: 'id2',
          guestName: 'Retry User',
          attending: false,
          adultsCount: 0,
          childrenCount: 0,
          observations: null,
          consentGiven: true,
          createdAt: '2026-11-06T00:00:00Z',
          updatedAt: '2026-11-06T00:00:00Z'
        }
      },
      {
        // POST from form submit
        status: 201,
        body: {
          id: 'id2',
          manageToken: 'existing-token',
          guestName: 'Retry User',
          attending: false,
          adultsCount: 0,
          childrenCount: 0,
          observations: null,
          consentGiven: true,
          createdAt: '2026-11-06T00:00:00Z',
          updatedAt: '2026-11-06T00:00:00Z'
        }
      }
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = document.getElementById('rsvp-form');
    const nameInput = document.getElementById('rsvp-name');
    const attendingFalse = document.getElementById('attending-false');

    nameInput.value = 'Retry User';
    attendingFalse.checked = true;

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(fetchCalls[0].options.headers['Authorization'], 'Bearer existing-token');
  });

  it('409 conflict: message shown, key preserved, form NOT disabled', async () => {
    const { document, mockFetch } = await setupWindow();
    localStorage.setItem('rsvp_idempotency_key', 'conflict-key');
    
    global.fetch = mockFetch([{
      status: 409,
      body: { error: 'Conflict' }
    }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = document.getElementById('rsvp-form');
    const nameInput = document.getElementById('rsvp-name');
    const submitBtn = document.getElementById('rsvp-submit');
    
    nameInput.value = 'Conflict';
    document.getElementById('attending-true').checked = true;

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    const statusDiv = document.getElementById('rsvp-status');
    const statusMsg = document.getElementById('rsvp-status-message');
    
    assert.equal(statusDiv.hidden, false);
    assert.ok(statusMsg.textContent.includes('já confirmou') || statusMsg.textContent.includes('mesmo dispositivo'));
    assert.equal(localStorage.getItem('rsvp_idempotency_key'), 'conflict-key'); // Preserved
    
    // Form NOT disabled (setBusyState(false) called)
    assert.equal(submitBtn.disabled, false);
    assert.equal(nameInput.disabled, false);
    assert.match(submitBtn.textContent, /Confirmar presença/i);
  });

  it('413 payload too large: message shown, form enabled', async () => {
    const { document, mockFetch } = await setupWindow();
    
    global.fetch = mockFetch([{
      status: 413,
      body: { error: 'Payload too large' }
    }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = document.getElementById('rsvp-form');
    const nameInput = document.getElementById('rsvp-name');
    const submitBtn = document.getElementById('rsvp-submit');
    
    nameInput.value = '413 Test';
    document.getElementById('attending-true').checked = true;

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    const statusDiv = document.getElementById('rsvp-status');
    const statusMsg = document.getElementById('rsvp-status-message');
    
    assert.equal(statusDiv.hidden, false);
    assert.ok(statusMsg.textContent.includes('longo') || statusMsg.textContent.includes('muito'));
    
    assert.equal(submitBtn.disabled, false);
    assert.equal(nameInput.disabled, false);
  });

  it('429 rate limit: message shown, form enabled', async () => {
    const { document, mockFetch } = await setupWindow();
    
    global.fetch = mockFetch([{
      status: 429,
      body: { error: 'Too many requests' }
    }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = document.getElementById('rsvp-form');
    const nameInput = document.getElementById('rsvp-name');
    const submitBtn = document.getElementById('rsvp-submit');
    
    nameInput.value = '429 Test';
    document.getElementById('attending-true').checked = true;

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    const statusDiv = document.getElementById('rsvp-status');
    const statusMsg = document.getElementById('rsvp-status-message');
    
    assert.equal(statusDiv.hidden, false);
    assert.ok(statusMsg.textContent.includes('Muitas requisições') || statusMsg.textContent.includes('Aguarde'));
    
    // Form enabled (setBusyState(false) called)
    assert.equal(submitBtn.disabled, false);
    assert.equal(nameInput.disabled, false);
  });

  it('Invalid JSON response: helpful error message, form enabled', async () => {
    const { document } = await setupWindow();
    
    global.fetch = async () => ({
      status: 200,
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => { throw new SyntaxError('Unexpected token'); }
    });

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = document.getElementById('rsvp-form');
    const submitBtn = document.getElementById('rsvp-submit');
    
    document.getElementById('rsvp-name').value = 'JSON Test';
    document.getElementById('attending-true').checked = true;

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    const statusMsg = document.getElementById('rsvp-status-message');
    assert.ok(statusMsg.textContent.includes('inválida') || statusMsg.textContent.includes('servidor'));
    
    // Form enabled
    assert.equal(submitBtn.disabled, false);
  });

  it('503 non-JSON handled gracefully', async () => {
    const { document, mockFetch } = await setupWindow();
    
    global.fetch = mockFetch([{
      status: 503,
      headers: { 'content-type': 'text/html' },
      body: null // Will throw on json()
    }]);

    // Override json() to throw
    global.fetch = async () => ({
      status: 503,
      ok: false,
      headers: { get: () => 'text/html' },
      json: async () => { throw new Error('Not JSON'); }
    });

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = document.getElementById('rsvp-form');
    document.getElementById('rsvp-name').value = '503 Test';
    document.getElementById('attending-true').checked = true;

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    const statusMsg = document.getElementById('rsvp-status-message');
    assert.ok(statusMsg.textContent.includes('temporariamente indisponível') || statusMsg.textContent.includes('conexão'));
  });

  it('GET 401 resets to create mode with new idempotency key', async () => {
    const { document, mockFetch } = await setupWindow();
    localStorage.setItem('rsvp_manage_token', 'invalid-token');
    localStorage.setItem('rsvp_idempotency_key', 'old-key');
    
    global.fetch = mockFetch([{
      status: 401,
      body: { error: 'Unauthorized' }
    }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    
    await Promise.resolve();
    await Promise.resolve();

    const nameInput = document.getElementById('rsvp-name');
    const submitBtn = document.getElementById('rsvp-submit');
    
    assert.equal(localStorage.getItem('rsvp_manage_token'), null);
    assert.notEqual(localStorage.getItem('rsvp_idempotency_key'), 'old-key');
    assert.equal(nameInput.disabled, false);
    assert.equal(submitBtn.hidden, false);
    assert.match(submitBtn.textContent, /Confirmar presença/i);
  });

  it('Edit button click unlocks only editable fields', async () => {
    const { document, mockFetch } = await setupWindow();
    localStorage.setItem('rsvp_manage_token', 'edit-token');
    
    global.fetch = mockFetch([{
      status: 200,
      body: {
        id: 'id3',
        guestName: 'Edit User',
        attending: true,
        adultsCount: 1,
        childrenCount: 0,
        observations: 'Test',
        consentGiven: true,
        createdAt: '2026-11-05T00:00:00Z',
        updatedAt: '2026-11-05T00:00:00Z'
      }
    }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    
    // Wait for GET from fetchRsvp() to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const editBtn = document.getElementById('rsvp-edit');
    const nameInput = document.getElementById('rsvp-name');
    const addCompanionBtn = document.getElementById('rsvp-add-companion');
    const submitBtn = document.getElementById('rsvp-submit');

    editBtn.click();

    assert.equal(nameInput.disabled, true); // Locked
    assert.equal(addCompanionBtn.disabled, false); // Editable
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
          updatedAt: '2026-11-05T00:00:00Z'
        }
      },
      {
        status: 200,
        body: {
          id: 'id4',
          guestName: 'PUT User',
          attending: true,
          adultsCount: 3,
          childrenCount: 0,
          observations: 'Updated',
          consentGiven: true,
          createdAt: '2026-11-05T00:00:00Z',
          updatedAt: '2026-11-06T00:00:00Z'
        }
      }
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    
    // Wait for GET from fetchRsvp() to complete
    await window.happyDOM.waitUntilComplete();
    await waitFor(() => fetchCalls.length === 1);

    const editBtn = document.getElementById('rsvp-edit');
    const submitBtn = document.getElementById('rsvp-submit');
    const addCompanionBtn = document.getElementById('rsvp-add-companion');
    editBtn.click();

    addCompanionBtn.click();
    const companionInput = document.querySelector('[data-companion-name]');
    if (companionInput) companionInput.value = 'Convidado Extra';

    const form = document.getElementById('rsvp-form');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    
    // Wait for PUT to complete
    await waitFor(() => fetchCalls.length === 2, 3000, 'PUT not called');
    
    // Wait for all async tasks and DOM updates to settle
    await window.happyDOM.waitUntilComplete();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify state is stable
    await waitFor(() => {
      return submitBtn.hidden === true && addCompanionBtn.disabled === true;
    }, 3000, `submitBtn.hidden=${submitBtn.hidden}, addCompanionBtn.disabled=${addCompanionBtn.disabled}`);
    
    assert.equal(fetchCalls.length, 2);
    assert.equal(fetchCalls[1].options.method, 'PUT');
    assert.equal(addCompanionBtn.disabled, true); // Locked again
    assert.equal(submitBtn.hidden, true);
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
          updatedAt: '2026-11-05T00:00:00Z'
        }
      },
      {
        status: 500,
        body: { error: 'Internal error' }
      }
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    
    await Promise.resolve();
    await Promise.resolve();

    const editBtn = document.getElementById('rsvp-edit');
    editBtn.click();

    const form = document.getElementById('rsvp-form');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    
    await Promise.resolve();
    await Promise.resolve();

    const addCompanionBtn = document.getElementById('rsvp-add-companion');
    const nameInput = document.getElementById('rsvp-name');
    
    // Should restore edit mode (editable except name)
    assert.equal(addCompanionBtn.disabled, false);
    assert.equal(nameInput.disabled, true);
  });
});
