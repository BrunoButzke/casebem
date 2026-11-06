/**
 * Messages UI (Mural de Recados)
 * Public guestbook for Dani & Carine wedding
 */

const API_URL = '/api/messages';
let currentCursor = null;

/**
 * Initialize messages system
 * @param {Window} windowContext - Window object (for testing)
 */
export function initMessages(windowContext = window) {
  const doc = windowContext.document;
  const form = doc.getElementById('messages-form');
  const submitBtn = doc.getElementById('submit-btn');
  const statusEl = doc.getElementById('messages-status');
  const messagesListEl = doc.getElementById('messages-list');
  const loadMoreBtn = doc.getElementById('load-more-btn');
  const messageTextarea = doc.getElementById('message-text');
  const messageCount = doc.getElementById('message-text-count');

  if (!form || !messagesListEl) {
    return; // Elements not found
  }

  // Character counter for message
  if (messageTextarea && messageCount) {
    messageTextarea.addEventListener('input', () => {
      messageCount.textContent = messageTextarea.value.length;
    });
  }

  // Load initial messages
  loadMessages(windowContext, messagesListEl, statusEl, loadMoreBtn, false);

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (submitBtn.disabled) return;

    const nameInput = doc.getElementById('guest-name');
    const messageInput = doc.getElementById('message-text');
    const consentCheckbox = doc.getElementById('consent-checkbox');

    const guestName = nameInput.value.trim();
    const message = messageInput.value.trim();
    const consentGiven = consentCheckbox.checked;

    // Client-side validation
    if (!guestName || guestName.length < 2) {
      showStatus(statusEl, 'Nome deve ter pelo menos 2 caracteres.', 'error');
      return;
    }

    if (!message || message.length < 3) {
      showStatus(statusEl, 'Mensagem deve ter pelo menos 3 caracteres.', 'error');
      return;
    }

    if (!consentGiven) {
      showStatus(statusEl, 'Você deve concordar em compartilhar a mensagem.', 'error');
      return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
      const response = await windowContext.fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': windowContext.crypto.randomUUID(),
        },
        body: JSON.stringify({
          guestName,
          message,
          consentGiven: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Success - add message to top of list
        prependMessage(windowContext, messagesListEl, data);
        
        // Clear form
        nameInput.value = '';
        messageInput.value = '';
        consentCheckbox.checked = false;
        if (messageCount) messageCount.textContent = '0';
        
        showStatus(statusEl, 'Mensagem enviada com sucesso! ✨', 'success');
      } else {
        // Error
        const errorMsg = data.details 
          ? Object.values(data.details).join(', ')
          : data.error;
        showStatus(statusEl, errorMsg, 'error');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      showStatus(statusEl, 'Erro ao enviar mensagem. Tente novamente.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar mensagem';
    }
  });

  // Handle load more button
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      loadMessages(windowContext, messagesListEl, statusEl, loadMoreBtn, true);
    });
  }
}

/**
 * Load messages from API
 */
async function loadMessages(windowContext, messagesListEl, statusEl, loadMoreBtn, isLoadMore) {
  if (!isLoadMore) {
    showStatus(statusEl, 'Carregando mensagens...', 'loading');
  }

  try {
    const url = currentCursor && isLoadMore
      ? `${API_URL}?limit=12&cursor=${encodeURIComponent(currentCursor)}`
      : `${API_URL}?limit=12`;
    
    const response = await windowContext.fetch(url);
    const data = await response.json();

    if (response.ok) {
      if (data.messages.length === 0 && !isLoadMore) {
        messagesListEl.innerHTML = '<p class="messages__empty">Seja o primeiro a deixar um recado!</p>';
        showStatus(statusEl, '', 'success');
      } else {
        if (isLoadMore) {
          data.messages.forEach(msg => appendMessage(windowContext, messagesListEl, msg));
        } else {
          messagesListEl.innerHTML = '';
          data.messages.forEach(msg => appendMessage(windowContext, messagesListEl, msg));
        }
        showStatus(statusEl, '', 'success');
      }

      // Update cursor and show/hide load more button
      currentCursor = data.nextCursor;
      if (loadMoreBtn) {
        loadMoreBtn.style.display = data.nextCursor ? 'block' : 'none';
      }
    } else {
      if (response.status === 503) {
        showStatus(statusEl, 'Mural temporariamente indisponível. Tente novamente mais tarde.', 'error');
      } else {
        showStatus(statusEl, data.error || 'Erro ao carregar mensagens.', 'error');
      }
    }
  } catch (error) {
    console.error('Failed to load messages:', error);
    showStatus(statusEl, 'Erro ao carregar mensagens. Verifique sua conexão.', 'error');
  }
}

/**
 * Prepend message to list (for newly created)
 */
function prependMessage(windowContext, listEl, messageData) {
  // Check for duplicates by data-message-id
  const existingIds = Array.from(listEl.querySelectorAll('[data-message-id]'))
    .map(el => el.getAttribute('data-message-id'));
  
  if (existingIds.includes(messageData.id)) {
    return; // Already exists, skip
  }
  
  const messageEl = createMessageElement(windowContext, messageData);
  if (listEl.querySelector('.messages__empty')) {
    listEl.innerHTML = '';
  }
  listEl.insertBefore(messageEl, listEl.firstChild);
}

/**
 * Append message to list (for loaded)
 */
function appendMessage(windowContext, listEl, messageData) {
  // Check for duplicates by data-message-id
  const existingIds = Array.from(listEl.querySelectorAll('[data-message-id]'))
    .map(el => el.getAttribute('data-message-id'));
  
  if (existingIds.includes(messageData.id)) {
    return; // Already exists, skip
  }
  
  const messageEl = createMessageElement(windowContext, messageData);
  listEl.appendChild(messageEl);
}

/**
 * Create message DOM element
 */
function createMessageElement(windowContext, messageData) {
  const doc = windowContext.document;
  
  const article = doc.createElement('article');
  article.className = 'message-item';
  article.setAttribute('data-message-id', messageData.id);

  const header = doc.createElement('div');
  header.className = 'message-item__header';

  const name = doc.createElement('strong');
  name.className = 'message-item__name';
  name.textContent = messageData.guestName;

  const date = doc.createElement('time');
  date.className = 'message-item__date';
  date.setAttribute('datetime', messageData.createdAt);
  date.textContent = formatDate(messageData.createdAt);

  header.appendChild(name);
  header.appendChild(date);

  const content = doc.createElement('p');
  content.className = 'message-content';
  content.textContent = messageData.message; // XSS safe: textContent, not innerHTML

  article.appendChild(header);
  article.appendChild(content);

  return article;
}

/**
 * Format date for display
 */
function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `Há ${diffMins} min`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  
  // More than a week: show date
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

/**
 * Show status message
 */
function showStatus(statusEl, message, type) {
  if (!statusEl) return;
  
  statusEl.textContent = message;
  statusEl.className = `messages__status ${type ? `messages__status--${type}` : ''}`;
  
  if (message) {
    statusEl.style.display = 'block';
  } else {
    statusEl.style.display = 'none';
  }
}
