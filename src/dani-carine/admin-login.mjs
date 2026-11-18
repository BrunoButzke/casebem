import { ADMIN_STORAGE_KEY } from './admin-credentials.mjs';

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = String(userInput?.value || '').trim();
    const pass = String(passInput?.value || '');
    const fetchFn = windowContext.fetch || fetch;

    try {
      const res = await fetchFn('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.token) {
        showError(data.message || 'Usuário ou senha inválidos.');
        return;
      }
      windowContext.sessionStorage.setItem(ADMIN_STORAGE_KEY, data.token);
      windowContext.sessionStorage.setItem(
        `${ADMIN_STORAGE_KEY}:role`,
        data.role || 'tenant'
      );
      const dest =
        data.role === 'super'
          ? '/dani-carine/admin'
          : data.adminPath ||
            (data.weddingKey ? `/${data.weddingKey}/admin` : '/dani-carine/admin');
      windowContext.location.href = dest;
    } catch {
      showError('Não deu para entrar. Tente de novo.');
    }
  });
}
