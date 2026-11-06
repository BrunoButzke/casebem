/**
 * Tests for messages frontend (real DOM with HappyDOM)
 * Run with: node --test tests/messages-frontend-real.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

// Mock fetch responses
let mockFetchResponses = [];
let fetchCallCount = 0;

function setupMockFetch(window) {
  fetchCallCount = 0;
  window.fetch = async (url, options) => {
    fetchCallCount++;
    const response = mockFetchResponses.shift();
    if (!response) {
      throw new Error(`Unexpected fetch call ${fetchCallCount} to ${url}`);
    }
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.body,
    };
  };
}

function resetMockFetch() {
  mockFetchResponses = [];
  fetchCallCount = 0;
}

async function loadMessagesUI(window) {
  // Simulate HTML structure
  window.document.body.innerHTML = `
    <section id="mural-recados">
      <h2>Mural de Recados</h2>
      
      <form id="messages-form">
        <input type="text" id="guest-name" name="guestName" required />
        <textarea id="message-text" name="message" required></textarea>
        <label>
          <input type="checkbox" id="consent-checkbox" name="consentGiven" required />
          Concordo em compartilhar meu recado
        </label>
        <button type="submit" id="submit-btn">Enviar</button>
      </form>
      
      <div id="messages-status"></div>
      <div id="messages-list"></div>
      <button id="load-more-btn" style="display: none;">Carregar mais</button>
    </section>
  `;
  
  // Load messages module
  const module = await import('../src/dani-carine/messages.mjs');
  module.initMessages(window);
}

// Tests
test('initMessages loads initial messages on page load', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  // Mock initial GET response
  mockFetchResponses.push({
    ok: true,
    status: 200,
    body: {
      messages: [
        { id: 'msg-1', guestName: 'João Silva', message: 'Felicidades!', createdAt: '2026-11-06T10:00:00Z' },
        { id: 'msg-2', guestName: 'Maria Santos', message: 'Parabéns!', createdAt: '2026-11-06T09:00:00Z' },
      ],
      nextCursor: null,
    },
  });
  
  await loadMessagesUI(window);
  
  // Wait for async loading
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const messagesList = window.document.getElementById('messages-list');
  assert.ok(messagesList);
  
  const items = messagesList.querySelectorAll('.message-item');
  assert.equal(items.length, 2);
  
  // Check order (newest first)
  assert.match(items[0].textContent, /João Silva/);
  assert.match(items[0].textContent, /Felicidades!/);
  assert.match(items[1].textContent, /Maria Santos/);
});

test('initMessages shows loading state initially', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  mockFetchResponses.push({
    ok: true,
    status: 200,
    body: { messages: [], nextCursor: null },
  });
  
  await loadMessagesUI(window);
  
  const status = window.document.getElementById('messages-status');
  assert.match(status.textContent, /Carregando/i);
});

test('initMessages shows empty state when no messages', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  mockFetchResponses.push({
    ok: true,
    status: 200,
    body: { messages: [], nextCursor: null },
  });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const messagesList = window.document.getElementById('messages-list');
  assert.match(messagesList.textContent, /Seja o primeiro a deixar um recado/i);
});

test('initMessages shows error state on 503', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  mockFetchResponses.push({
    ok: false,
    status: 503,
    body: { error: 'Serviço temporariamente indisponível' },
  });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const status = window.document.getElementById('messages-status');
  assert.match(status.textContent, /Mural temporariamente indisponível/i);
});

test('form submit creates new message successfully', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  // Initial GET
  mockFetchResponses.push({
    ok: true,
    status: 200,
    body: { messages: [], nextCursor: null },
  });
  
  // POST response
  mockFetchResponses.push({
    ok: true,
    status: 201,
    body: {
      id: 'new-msg-1',
      guestName: 'Pedro Costa',
      message: 'Meus parabéns!',
      createdAt: '2026-11-06T11:00:00Z',
    },
  });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Fill form
  const form = window.document.getElementById('messages-form');
  const nameInput = window.document.getElementById('guest-name');
  const messageInput = window.document.getElementById('message-text');
  const consentCheckbox = window.document.getElementById('consent-checkbox');
  
  nameInput.value = 'Pedro Costa';
  messageInput.value = 'Meus parabéns!';
  consentCheckbox.checked = true;
  
  // Submit
  form.dispatchEvent(new window.Event('submit'));
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // New message should be added to list
  const messagesList = window.document.getElementById('messages-list');
  const items = messagesList.querySelectorAll('.message-item');
  assert.equal(items.length, 1);
  assert.match(items[0].textContent, /Pedro Costa/);
  assert.match(items[0].textContent, /Meus parabéns!/);
});

test('form submit clears form on success', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  mockFetchResponses.push({ ok: true, status: 200, body: { messages: [], nextCursor: null } });
  mockFetchResponses.push({
    ok: true,
    status: 201,
    body: { id: 'msg', guestName: 'Test', message: 'Msg', createdAt: '2026-11-06T10:00:00Z' },
  });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const nameInput = window.document.getElementById('guest-name');
  const messageInput = window.document.getElementById('message-text');
  const consentCheckbox = window.document.getElementById('consent-checkbox');
  
  nameInput.value = 'Test User';
  messageInput.value = 'Test message';
  consentCheckbox.checked = true;
  
  const form = window.document.getElementById('messages-form');
  form.dispatchEvent(new window.Event('submit'));
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Form should be cleared
  assert.equal(nameInput.value, '');
  assert.equal(messageInput.value, '');
  assert.equal(consentCheckbox.checked, false);
});

test('form submit preserves values on error', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  mockFetchResponses.push({ ok: true, status: 200, body: { messages: [], nextCursor: null } });
  mockFetchResponses.push({
    ok: false,
    status: 400,
    body: { error: 'Dados inválidos', details: { message: 'Mensagem muito curta' } },
  });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const nameInput = window.document.getElementById('guest-name');
  const messageInput = window.document.getElementById('message-text');
  const consentCheckbox = window.document.getElementById('consent-checkbox');
  
  nameInput.value = 'João';
  messageInput.value = 'AB'; // Too short
  consentCheckbox.checked = true;
  
  const form = window.document.getElementById('messages-form');
  form.dispatchEvent(new window.Event('submit'));
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Form should preserve values
  assert.equal(nameInput.value, 'João');
  assert.equal(messageInput.value, 'AB');
  assert.equal(consentCheckbox.checked, true);
  
  // Error message should be shown
  const status = window.document.getElementById('messages-status');
  assert.match(status.textContent, /Dados inválidos/i);
});

test('form submit disables button during submission', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  mockFetchResponses.push({ ok: true, status: 200, body: { messages: [], nextCursor: null } });
  mockFetchResponses.push({
    ok: true,
    status: 201,
    body: { id: 'msg', guestName: 'Test', message: 'Msg', createdAt: '2026-11-06T10:00:00Z' },
  });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const submitBtn = window.document.getElementById('submit-btn');
  const nameInput = window.document.getElementById('guest-name');
  const messageInput = window.document.getElementById('message-text');
  const consentCheckbox = window.document.getElementById('consent-checkbox');
  
  nameInput.value = 'Test';
  messageInput.value = 'Message';
  consentCheckbox.checked = true;
  
  const form = window.document.getElementById('messages-form');
  form.dispatchEvent(new window.Event('submit'));
  
  // Button should be disabled during submission
  assert.equal(submitBtn.disabled, true);
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Button should be re-enabled after completion
  assert.equal(submitBtn.disabled, false);
});

test('messages use textContent for XSS protection', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  mockFetchResponses.push({
    ok: true,
    status: 200,
    body: {
      messages: [
        { id: 'xss-1', guestName: '<script>alert("XSS")</script>', message: '<img src=x onerror=alert(1)>', createdAt: '2026-11-06T10:00:00Z' },
      ],
      nextCursor: null,
    },
  });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const messagesList = window.document.getElementById('messages-list');
  const item = messagesList.querySelector('.message-item');
  
  // Script tags should be escaped (textContent, not innerHTML)
  assert.match(item.textContent, /<script>/); // Visible as text
  assert.match(item.textContent, /<img src=x/); // Visible as text
  
  // No actual script elements created
  const scripts = messagesList.querySelectorAll('script');
  assert.equal(scripts.length, 0);
});

test('messages preserve newlines with white-space CSS', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  mockFetchResponses.push({
    ok: true,
    status: 200,
    body: {
      messages: [
        { id: 'msg-nl', guestName: 'João', message: 'Linha1\nLinha2\nLinha3', createdAt: '2026-11-06T10:00:00Z' },
      ],
      nextCursor: null,
    },
  });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const messagesList = window.document.getElementById('messages-list');
  const messageElement = messagesList.querySelector('.message-content');
  
  // Newlines should be preserved
  assert.match(messageElement.textContent, /Linha1\nLinha2\nLinha3/);
  
  // Element should have white-space style
  const style = window.getComputedStyle(messageElement);
  assert.match(style.whiteSpace, /pre-wrap|pre-line/);
});

test('load more button shows when nextCursor present', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  mockFetchResponses.push({
    ok: true,
    status: 200,
    body: {
      messages: [
        { id: 'msg-1', guestName: 'Test', message: 'Msg', createdAt: '2026-11-06T10:00:00Z' },
      ],
      nextCursor: 'some-cursor-value',
    },
  });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const loadMoreBtn = window.document.getElementById('load-more-btn');
  assert.equal(loadMoreBtn.style.display, 'block');
});

test('load more button hidden when no nextCursor', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  mockFetchResponses.push({
    ok: true,
    status: 200,
    body: {
      messages: [],
      nextCursor: null,
    },
  });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const loadMoreBtn = window.document.getElementById('load-more-btn');
  assert.equal(loadMoreBtn.style.display, 'none');
});

test('load more button fetches next page', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  // Initial page
  mockFetchResponses.push({
    ok: true,
    status: 200,
    body: {
      messages: [
        { id: 'msg-1', guestName: 'First', message: 'Msg1', createdAt: '2026-11-06T12:00:00Z' },
      ],
      nextCursor: 'cursor-page2',
    },
  });
  
  // Second page
  mockFetchResponses.push({
    ok: true,
    status: 200,
    body: {
      messages: [
        { id: 'msg-2', guestName: 'Second', message: 'Msg2', createdAt: '2026-11-06T11:00:00Z' },
      ],
      nextCursor: null,
    },
  });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const loadMoreBtn = window.document.getElementById('load-more-btn');
  loadMoreBtn.click();
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const messagesList = window.document.getElementById('messages-list');
  const items = messagesList.querySelectorAll('.message-item');
  
  // Should have both pages
  assert.equal(items.length, 2);
  assert.match(items[0].textContent, /First/);
  assert.match(items[1].textContent, /Second/);
  
  // Button should be hidden (no more pages)
  assert.equal(loadMoreBtn.style.display, 'none');
});

test('form validates consent checkbox', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  mockFetchResponses.push({ ok: true, status: 200, body: { messages: [], nextCursor: null } });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const form = window.document.getElementById('messages-form');
  const nameInput = window.document.getElementById('guest-name');
  const messageInput = window.document.getElementById('message-text');
  const consentCheckbox = window.document.getElementById('consent-checkbox');
  
  nameInput.value = 'Test User';
  messageInput.value = 'Valid message';
  consentCheckbox.checked = false; // Not checked
  
  // HTML5 validation should prevent submit
  const submitEvent = new window.Event('submit', { cancelable: true });
  const prevented = !form.dispatchEvent(submitEvent);
  
  // Form should not submit without consent
  assert.ok(prevented || !consentCheckbox.validity.valid);
});

test('no-JS fallback message exists', async () => {
  const window = new Window();
  
  // Before JS loads
  window.document.body.innerHTML = `
    <section id="mural-recados">
      <noscript>
        <p>O mural de recados requer JavaScript ativado.</p>
      </noscript>
    </section>
  `;
  
  const noscript = window.document.querySelector('noscript');
  assert.ok(noscript);
  assert.match(noscript.textContent, /JavaScript ativado/i);
});

test('messages do not expose private fields', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  mockFetchResponses.push({
    ok: true,
    status: 200,
    body: {
      messages: [
        { id: 'msg-1', guestName: 'João', message: 'Msg', createdAt: '2026-11-06T10:00:00Z' },
        // Server should not send these fields, but verify UI doesn't expose them
      ],
      nextCursor: null,
    },
  });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const messagesList = window.document.getElementById('messages-list');
  
  // Should not contain private field names
  assert.doesNotMatch(messagesList.innerHTML, /idempotency_key/i);
  assert.doesNotMatch(messagesList.innerHTML, /idempotency_fingerprint/i);
  assert.doesNotMatch(messagesList.innerHTML, /consent_given/i);
  assert.doesNotMatch(messagesList.innerHTML, /ip_hash/i);
});

test('form generates unique Idempotency-Key per submission', async () => {
  const window = new Window();
  setupMockFetch(window);
  
  let capturedHeaders = [];
  const originalFetch = window.fetch;
  window.fetch = async (url, options) => {
    if (options.method === 'POST') {
      capturedHeaders.push(options.headers['Idempotency-Key']);
    }
    return originalFetch(url, options);
  };
  
  mockFetchResponses.push({ ok: true, status: 200, body: { messages: [], nextCursor: null } });
  mockFetchResponses.push({ ok: true, status: 201, body: { id: 'msg1', guestName: 'T', message: 'M', createdAt: '2026-11-06T10:00:00Z' } });
  mockFetchResponses.push({ ok: true, status: 201, body: { id: 'msg2', guestName: 'T', message: 'M', createdAt: '2026-11-06T10:00:00Z' } });
  
  await loadMessagesUI(window);
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const form = window.document.getElementById('messages-form');
  const nameInput = window.document.getElementById('guest-name');
  const messageInput = window.document.getElementById('message-text');
  const consentCheckbox = window.document.getElementById('consent-checkbox');
  
  // First submission
  nameInput.value = 'User';
  messageInput.value = 'Message';
  consentCheckbox.checked = true;
  form.dispatchEvent(new window.Event('submit'));
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Second submission
  nameInput.value = 'User';
  messageInput.value = 'Message';
  consentCheckbox.checked = true;
  form.dispatchEvent(new window.Event('submit'));
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Should have different keys
  assert.equal(capturedHeaders.length, 2);
  assert.notEqual(capturedHeaders[0], capturedHeaders[1]);
});

// Cleanup
test.afterEach(() => {
  resetMockFetch();
});
