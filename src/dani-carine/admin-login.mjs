import {
  TEMP_ADMIN_USER,
  TEMP_ADMIN_PASS,
  TEMP_ADMIN_TOKEN,
  ADMIN_STORAGE_KEY,
} from './admin-credentials.mjs';

/**
 * Modal de login na página principal → painel admin.
 */
export function setupAdminLogin(windowContext = window) {
  const doc = windowContext.document;
  const openBtn = doc.getElementById('admin-login-open');
  const modal = doc.getElementById('admin-login-modal');
  const form = doc.getElementById('admin-login-form');
  const errorEl = doc.getElementById('admin-login-error');
  const userInput = doc.getElementById('admin-user');
  const passInput = doc.getElementById('admin-pass');

  if (!openBtn || !modal || !form) return;

  const showError = (msg) => {
    if (!errorEl) return;
    errorEl.hidden = !msg;
    errorEl.textContent = msg || '';
  };

  const open = () => {
    modal.hidden = false;
    doc.body.style.overflow = 'hidden';
    showError('');
    userInput?.focus();
  };

  const close = () => {
    modal.hidden = true;
    doc.body.style.overflow = '';
    showError('');
    form.reset();
  };

  openBtn.addEventListener('click', open);
  modal.querySelectorAll('[data-admin-login-close]').forEach((el) => {
    el.addEventListener('click', close);
  });

  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = String(userInput?.value || '').trim();
    const pass = String(passInput?.value || '');

    if (user !== TEMP_ADMIN_USER || pass !== TEMP_ADMIN_PASS) {
      showError('Usuário ou senha inválidos.');
      return;
    }

    windowContext.sessionStorage.setItem(ADMIN_STORAGE_KEY, TEMP_ADMIN_TOKEN);
    windowContext.location.href = '/dani-carine/admin.html';
  });
}
