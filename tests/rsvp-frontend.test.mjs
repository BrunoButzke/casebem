import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

/**
 * Real frontend tests with executable DOM stub + event dispatch + fetch mock
 * Tests actual setupRsvp() controller behavior, NOT source inspection
 */

// Minimal DOM stub with event dispatch
class MockElement {
  constructor(id, tag = 'input') {
    this.id = id;
    this.tag = tag;
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.className = '';
    this.name = '';
    this.type = '';
    this._listeners = {};
  }

  addEventListener(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
  }

  dispatchEvent(event) {
    const handlers = this._listeners[event.type] || [];
    handlers.forEach(h => h(event));
  }

  closest(selector) {
    if (selector === '.form__group') {
      return { hidden: false };
    }
    return null;
  }

  scrollIntoView() {}

  querySelectorAll() {
    return [];
  }
}

class MockDocument {
  constructor() {
    this.elements = new Map();
    this.radios = { true: null, false: null };
  }

  getElementById(id) {
    if (!this.elements.has(id)) {
      this.elements.set(id, new MockElement(id));
    }
    return this.elements.get(id);
  }

  querySelector(selector) {
    if (selector.includes('input[name="attending"]')) {
      const value = selector.match(/value="(\w+)"/)?.[1];
      if (value && !this.radios[value]) {
        const radio = new MockElement(`attending-${value}`, 'input');
        radio.name = 'attending';
        radio.value = value;
        radio.type = 'radio';
        this.radios[value] = radio;
      }
      return this.radios[value];
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector === 'input[name="attending"]') {
      return [this.querySelector('input[name="attending"][value="true"]'), this.querySelector('input[name="attending"][value="false"]')];
    }
    if (selector.includes('input, textarea, button')) {
      return [
        this.getElementById('rsvp-name'),
        ...this.querySelectorAll('input[name="attending"]'),
        this.getElementById('rsvp-adults'),
        this.getElementById('rsvp-children'),
        this.getElementById('rsvp-observations'),
        this.getElementById('rsvp-consent'),
        this.getElementById('rsvp-submit'),
        this.getElementById('rsvp-edit'),
      ];
    }
    if (selector === '.form-error') {
      return [this.getElementById('rsvp-name-error')];
    }
    return [];
  }
}

function setupTestEnv() {
  const doc = new MockDocument();
  const storage = new Map();
  const fetchCalls = [];

  global.document = doc;
  global.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k),
  };
  Object.defineProperty(global, 'crypto', {
    value: { randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 9) },
    writable: true,
    configurable: true
  });

  const mockFetch = (responses) => {
    return async (url, options) => {
      fetchCalls.push({ url, options });
      const resp = responses.shift() || { status: 500, body: {} };
      return {
        status: resp.status,
        ok: resp.status >= 200 && resp.status < 300,
        headers: { get: (n) => resp.headers?.[n] || (resp.json ? 'application/json' : 'text/html') },
        json: async () => resp.body || {},
      };
    };
  };

  // Pre-create required elements so setupRsvp doesn't return early
  doc.getElementById('rsvp-form');
  doc.getElementById('rsvp-name');
  doc.getElementById('rsvp-adults');
  doc.getElementById('rsvp-children');
  doc.getElementById('rsvp-observations');
  doc.getElementById('rsvp-observations-count');
  doc.getElementById('rsvp-consent');
  doc.getElementById('rsvp-submit');
  doc.getElementById('rsvp-edit');
  doc.getElementById('rsvp-status');
  doc.getElementById('rsvp-status-message');
  doc.getElementById('rsvp-fields');
  doc.getElementById('rsvp-name-error');

  return { doc, storage, fetchCalls, mockFetch };
}

describe('Frontend RSVP Controller - Real Tests', () => {
  it('should persist manageToken after 201 POST success', async () => {
    const { doc, storage, mockFetch } = setupTestEnv();
    global.fetch = mockFetch([{ status: 201, body: { id: 'id1', manageToken: 'token-abc', guestName: 'Test', attending: true, adultsCount: 0, childrenCount: 0, consentGiven: true, createdAt: '2026-11-06T00:00:00Z', updatedAt: '2026-11-06T00:00:00Z' } }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = doc.getElementById('rsvp-form');
    doc.getElementById('rsvp-name').value = 'Test User';
    doc.getElementById('rsvp-consent').checked = true;
    doc.querySelector('input[name="attending"][value="true"]').checked = true;

    form.dispatchEvent({ type: 'submit', preventDefault: () => {} });
    await new Promise(r => setTimeout(r, 20));

    assert.equal(storage.get('rsvp_manage_token'), 'token-abc');
    assert.equal(storage.get('rsvp_idempotency_key'), null); // Cleared after success
  });

  it('should send POST with Authorization Bearer on retry when token exists', async () => {
    const { doc, storage, fetchCalls, mockFetch } = setupTestEnv();
    storage.set('rsvp_manage_token', 'existing-token');
    global.fetch = mockFetch([{ status: 201, body: { id: 'id2', manageToken: 'existing-token', guestName: 'Retry', attending: false, adultsCount: 0, childrenCount: 0, consentGiven: true, createdAt: '2026-11-06T00:00:00Z', updatedAt: '2026-11-06T00:00:00Z' } }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = doc.getElementById('rsvp-form');
    doc.getElementById('rsvp-name').value = 'Retry User';
    doc.getElementById('rsvp-consent').checked = true;
    doc.querySelector('input[name="attending"][value="false"]').checked = true;

    form.dispatchEvent({ type: 'submit', preventDefault: () => {} });
    await new Promise(r => setTimeout(r, 20));

    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].options.method, 'POST');
    assert.equal(fetchCalls[0].options.headers['Authorization'], 'Bearer existing-token');
    assert.ok(fetchCalls[0].options.headers['Idempotency-Key']);
  });

  it('should handle 503 non-JSON gracefully', async () => {
    const { doc, mockFetch } = setupTestEnv();
    global.fetch = mockFetch([{ status: 503, headers: { 'content-type': 'text/html' }, json: null }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = doc.getElementById('rsvp-form');
    doc.getElementById('rsvp-name').value = '503 Test';
    doc.getElementById('rsvp-consent').checked = true;
    doc.querySelector('input[name="attending"][value="true"]').checked = true;

    form.dispatchEvent({ type: 'submit', preventDefault: () => {} });
    await new Promise(r => setTimeout(r, 20));

    const statusMsg = doc.getElementById('rsvp-status-message');
    assert.ok(statusMsg.textContent.includes('temporariamente indisponível') || statusMsg.textContent.includes('conexão'));
  });

  it('should show 409 conflict message without bypassing', async () => {
    const { doc, storage, mockFetch } = setupTestEnv();
    storage.set('rsvp_idempotency_key', 'conflict-key');
    global.fetch = mockFetch([{ status: 409, body: { error: 'Conflict' } }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = doc.getElementById('rsvp-form');
    doc.getElementById('rsvp-name').value = 'Conflict';
    doc.getElementById('rsvp-consent').checked = true;
    doc.querySelector('input[name="attending"][value="true"]').checked = true;

    form.dispatchEvent({ type: 'submit', preventDefault: () => {} });
    await new Promise(r => setTimeout(r, 20));

    const statusDiv = doc.getElementById('rsvp-status');
    const statusMsg = doc.getElementById('rsvp-status-message');
    assert.equal(statusDiv.hidden, false);
    assert.ok(statusMsg.textContent.includes('Conflito') || statusMsg.textContent.includes('idempotência'));
    // Key persists for manual resolution
    assert.equal(storage.get('rsvp_idempotency_key'), 'conflict-key');
  });

  it('should lock all fields in view mode after POST success', async () => {
    const { doc, mockFetch } = setupTestEnv();
    global.fetch = mockFetch([{ status: 201, body: { id: 'id3', manageToken: 'token-locked', guestName: 'Locked', attending: true, adultsCount: 2, childrenCount: 0, consentGiven: true, createdAt: '2026-11-06T00:00:00Z', updatedAt: '2026-11-06T00:00:00Z' } }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();

    const form = doc.getElementById('rsvp-form');
    const nameInput = doc.getElementById('rsvp-name');
    const adultsInput = doc.getElementById('rsvp-adults');
    const submitBtn = doc.getElementById('rsvp-submit');
    const editBtn = doc.getElementById('rsvp-edit');

    nameInput.value = 'Locked User';
    adultsInput.value = '2';
    doc.getElementById('rsvp-consent').checked = true;
    doc.querySelector('input[name="attending"][value="true"]').checked = true;

    form.dispatchEvent({ type: 'submit', preventDefault: () => {} });
    await new Promise(r => setTimeout(r, 20));

    assert.equal(nameInput.disabled, true);
    assert.equal(adultsInput.disabled, true);
    assert.equal(submitBtn.hidden, true);
    assert.equal(editBtn.hidden, false);
  });

  it('should keep name/consent locked in edit mode after clicking edit', async () => {
    const { doc, storage, mockFetch } = setupTestEnv();
    storage.set('rsvp_manage_token', 'edit-token');
    global.fetch = mockFetch([{ status: 200, body: { id: 'id4', guestName: 'Edit User', attending: true, adultsCount: 1, childrenCount: 0, observations: 'Test', consentGiven: true, createdAt: '2026-11-05T00:00:00Z', updatedAt: '2026-11-05T00:00:00Z' } }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await new Promise(r => setTimeout(r, 20)); // Wait for GET

    const editBtn = doc.getElementById('rsvp-edit');
    const nameInput = doc.getElementById('rsvp-name');
    const consentCheckbox = doc.getElementById('rsvp-consent');
    const adultsInput = doc.getElementById('rsvp-adults');
    const submitBtn = doc.getElementById('rsvp-submit');

    // Click edit button
    editBtn.dispatchEvent({ type: 'click', preventDefault: () => {} });

    assert.equal(nameInput.disabled, true); // Locked
    assert.equal(consentCheckbox.disabled, true); // Locked
    assert.equal(adultsInput.disabled, false); // Editable
    assert.equal(submitBtn.hidden, false);
    assert.equal(submitBtn.textContent, 'Atualizar Confirmação');
  });

  it('should restore create mode on 401 error during GET', async () => {
    const { doc, storage, mockFetch } = setupTestEnv();
    storage.set('rsvp_manage_token', 'invalid-token');
    storage.set('rsvp_idempotency_key', 'old-key');
    global.fetch = mockFetch([{ status: 401, body: { error: 'Unauthorized' } }]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await new Promise(r => setTimeout(r, 20));

    const nameInput = doc.getElementById('rsvp-name');
    const submitBtn = doc.getElementById('rsvp-submit');

    assert.equal(storage.get('rsvp_manage_token'), null); // Token cleared
    assert.notEqual(storage.get('rsvp_idempotency_key'), 'old-key'); // Key rotated
    assert.equal(nameInput.disabled, false); // Unlocked for new create
    assert.equal(submitBtn.hidden, false);
    assert.equal(submitBtn.textContent, 'Confirmar Presença');
  });

  it('should send PUT with correct body after edit', async () => {
    const { doc, storage, fetchCalls, mockFetch } = setupTestEnv();
    storage.set('rsvp_manage_token', 'put-token');
    global.fetch = mockFetch([
      { status: 200, body: { id: 'id5', guestName: 'PUT User', attending: true, adultsCount: 1, childrenCount: 0, observations: 'Original', consentGiven: true, createdAt: '2026-11-05T00:00:00Z', updatedAt: '2026-11-05T00:00:00Z' } },
      { status: 200, body: { id: 'id5', guestName: 'PUT User', attending: true, adultsCount: 3, childrenCount: 1, observations: 'Updated', consentGiven: true, createdAt: '2026-11-05T00:00:00Z', updatedAt: '2026-11-06T00:00:00Z' } }
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await new Promise(r => setTimeout(r, 20)); // GET

    const editBtn = doc.getElementById('rsvp-edit');
    editBtn.dispatchEvent({ type: 'click', preventDefault: () => {} });

    const adultsInput = doc.getElementById('rsvp-adults');
    const childrenInput = doc.getElementById('rsvp-children');
    const observationsInput = doc.getElementById('rsvp-observations');
    adultsInput.value = '3';
    childrenInput.value = '1';
    observationsInput.value = 'Updated';

    const form = doc.getElementById('rsvp-form');
    form.dispatchEvent({ type: 'submit', preventDefault: () => {} });
    await new Promise(r => setTimeout(r, 20));

    assert.equal(fetchCalls.length, 2); // GET + PUT
    assert.equal(fetchCalls[1].options.method, 'PUT');
    const body = JSON.parse(fetchCalls[1].options.body);
    assert.equal(body.adultsCount, 3);
    assert.equal(body.childrenCount, 1);
    assert.equal(body.observations, 'Updated');
  });

  it('should restore edit mode on PUT error', async () => {
    const { doc, storage, mockFetch } = setupTestEnv();
    storage.set('rsvp_manage_token', 'error-token');
    global.fetch = mockFetch([
      { status: 200, body: { id: 'id6', guestName: 'Error User', attending: false, adultsCount: 0, childrenCount: 0, observations: null, consentGiven: true, createdAt: '2026-11-05T00:00:00Z', updatedAt: '2026-11-05T00:00:00Z' } },
      { status: 500, body: { error: 'Internal error' } }
    ]);

    const { setupRsvp } = await import('../src/dani-carine/rsvp.mjs?' + Math.random());
    setupRsvp();
    await new Promise(r => setTimeout(r, 20));

    const editBtn = doc.getElementById('rsvp-edit');
    editBtn.dispatchEvent({ type: 'click', preventDefault: () => {} });

    const form = doc.getElementById('rsvp-form');
    form.dispatchEvent({ type: 'submit', preventDefault: () => {} });
    await new Promise(r => setTimeout(r, 20));

    // Should restore edit mode (fields unlocked except name/consent)
    const adultsInput = doc.getElementById('rsvp-adults');
    const nameInput = doc.getElementById('rsvp-name');
    assert.equal(adultsInput.disabled, false); // Editable
    assert.equal(nameInput.disabled, true); // Locked
  });
});
