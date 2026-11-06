import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Window } from 'happy-dom';

describe('Frontend RSVP - Real DOM Tests', () => {
  async function setupWindow() {
    const window = new Window({ url: 'https://casebem.pages.dev/dani-carine/' });
    const { document } = window;
    
    // Minimal form HTML with all required IDs
    document.body.innerHTML = `
      <form id="rsvp-form">
        <input type="text" id="rsvp-name" />
        <div>
          <input type="radio" name="attending" value="true" id="attending-true" />
          <input type="radio" name="attending" value="false" id="attending-false" />
        </div>
        <input type="number" id="rsvp-adults" value="0" />
        <input type="number" id="rsvp-children" value="0" />
        <textarea id="rsvp-observations"></textarea>
        <span id="rsvp-observations-count">0/500</span>
        <input type="checkbox" id="rsvp-consent" />
        <button type="submit" id="rsvp-submit">Confirmar Presença</button>
        <button type="button" id="rsvp-edit" hidden>Editar</button>
        <div id="rsvp-status" hidden>
          <span id="rsvp-status-message"></span>
        </div>
        <div id="rsvp-fields"></div>
        <span id="rsvp-name-error"></span>
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
    const { document, fetchCalls, mockFetch } = await setupWindow();
    
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
    const adultsInput = document.getElementById('rsvp-adults');
    const consentCheckbox = document.getElementById('rsvp-consent');
    const attendingTrue = document.getElementById('attending-true');
    const submitBtn = document.getElementById('rsvp-submit');
    const editBtn = document.getElementById('rsvp-edit');

    nameInput.value = 'Test User';
    adultsInput.value = '2';
    consentCheckbox.checked = true;
    attendingTrue.checked = true;

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve(); // Queue microtask
    await Promise.resolve(); // Allow async handlers

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].options.method, 'POST');
    
    // Token stored
    assert.equal(localStorage.getItem('rsvp_manage_token'), 'token-success');
    
    // Idempotency key cleared
    assert.equal(localStorage.getItem('rsvp_idempotency_key'), null);
    
    // Fields locked
    assert.equal(nameInput.disabled, true);
    assert.equal(adultsInput.disabled, true);
    assert.equal(consentCheckbox.disabled, true);
    
    // Buttons
    assert.equal(submitBtn.hidden, true);
    assert.equal(editBtn.hidden, false);
  });

  it('POST with existing token sends Authorization Bearer', async () => {
    const { document, fetchCalls, mockFetch } = await setupWindow();
    localStorage.setItem('rsvp_manage_token', 'existing-token');
    
    global.fetch = mockFetch([{
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
    }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = document.getElementById('rsvp-form');
    const nameInput = document.getElementById('rsvp-name');
    const consentCheckbox = document.getElementById('rsvp-consent');
    const attendingFalse = document.getElementById('attending-false');

    nameInput.value = 'Retry User';
    consentCheckbox.checked = true;
    attendingFalse.checked = true;

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(fetchCalls[0].options.headers['Authorization'], 'Bearer existing-token');
  });

  it('409 conflict shows message, keeps idempotency key', async () => {
    const { document, mockFetch } = await setupWindow();
    localStorage.setItem('rsvp_idempotency_key', 'conflict-key');
    
    global.fetch = mockFetch([{
      status: 409,
      body: { error: 'Conflict' }
    }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = document.getElementById('rsvp-form');
    document.getElementById('rsvp-name').value = 'Conflict';
    document.getElementById('rsvp-consent').checked = true;
    document.getElementById('attending-true').checked = true;

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    const statusDiv = document.getElementById('rsvp-status');
    const statusMsg = document.getElementById('rsvp-status-message');
    
    assert.equal(statusDiv.hidden, false);
    assert.ok(statusMsg.textContent.includes('Conflito') || statusMsg.textContent.includes('idempotência'));
    assert.equal(localStorage.getItem('rsvp_idempotency_key'), 'conflict-key'); // Preserved
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
    document.getElementById('rsvp-consent').checked = true;
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
    assert.equal(submitBtn.textContent, 'Confirmar Presença');
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
    
    await Promise.resolve();
    await Promise.resolve();

    const editBtn = document.getElementById('rsvp-edit');
    const nameInput = document.getElementById('rsvp-name');
    const consentCheckbox = document.getElementById('rsvp-consent');
    const adultsInput = document.getElementById('rsvp-adults');
    const submitBtn = document.getElementById('rsvp-submit');

    editBtn.click();

    assert.equal(nameInput.disabled, true); // Locked
    assert.equal(consentCheckbox.disabled, true); // Locked
    assert.equal(adultsInput.disabled, false); // Editable
    assert.equal(submitBtn.hidden, false);
    assert.equal(submitBtn.textContent, 'Atualizar Confirmação');
  });

  it('PUT success locks all fields again', async () => {
    const { document, mockFetch } = await setupWindow();
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
    
    await Promise.resolve();
    await Promise.resolve();

    const editBtn = document.getElementById('rsvp-edit');
    editBtn.click();

    const adultsInput = document.getElementById('rsvp-adults');
    adultsInput.value = '3';

    const form = document.getElementById('rsvp-form');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    
    await Promise.resolve();
    await Promise.resolve();

    const submitBtn = document.getElementById('rsvp-submit');
    
    assert.equal(adultsInput.disabled, true); // Locked again
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

    const adultsInput = document.getElementById('rsvp-adults');
    const nameInput = document.getElementById('rsvp-name');
    
    // Should restore edit mode (editable except name/consent)
    assert.equal(adultsInput.disabled, false);
    assert.equal(nameInput.disabled, true);
  });
});
