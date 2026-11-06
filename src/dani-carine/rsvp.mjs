/**
 * RSVP Form Controller
 * Isolated module for frontend testing without GSAP/Lenis dependencies
 */

export function setupRsvp() {
  const form = document.getElementById('rsvp-form');
  if (!form) return;

  const nameInput = document.getElementById('rsvp-name');
  const attendingRadios = document.querySelectorAll('input[name="attending"]');
  const adultsInput = document.getElementById('rsvp-adults');
  const childrenInput = document.getElementById('rsvp-children');
  const observationsTextarea = document.getElementById('rsvp-observations');
  const observationsCount = document.getElementById('rsvp-observations-count');
  const consentCheckbox = document.getElementById('rsvp-consent');
  const submitBtn = document.getElementById('rsvp-submit');
  const editBtn = document.getElementById('rsvp-edit');
  const statusDiv = document.getElementById('rsvp-status');
  const statusMessage = document.getElementById('rsvp-status-message');
  const fieldsContainer = document.getElementById('rsvp-fields');

  const API_URL = '/api/rsvp';
  const TOKEN_KEY = 'rsvp_manage_token';

  let manageToken = localStorage.getItem(TOKEN_KEY);
  let isEditMode = false;

  function showStatus(message, type = 'info') {
    statusDiv.hidden = false;
    statusDiv.className = `rsvp__status rsvp__status--${type}`;
    statusMessage.textContent = message;
    statusDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideStatus() {
    statusDiv.hidden = true;
  }

  function showError(fieldId, message) {
    const errorEl = document.getElementById(`${fieldId}-error`);
    if (errorEl) {
      errorEl.textContent = message;
    }
  }

  function clearErrors() {
    const errors = form.querySelectorAll('.form-error');
    errors.forEach((el) => (el.textContent = ''));
  }

  function toggleFieldsDisabled(disabled) {
    const inputs = form.querySelectorAll('input, textarea, button[type="submit"]');
    inputs.forEach((input) => {
      // Never re-enable name or consent after they've been locked
      if (input === nameInput && nameInput.disabled && !disabled) {
        return; // Keep disabled
      }
      if (input === consentCheckbox && consentCheckbox.disabled && !disabled) {
        return; // Keep disabled
      }
      input.disabled = disabled;
    });
  }

  function updateCountsVisibility() {
    const attending = document.querySelector('input[name="attending"]:checked')?.value === 'true';
    const adultsGroup = adultsInput?.closest('.form__group');
    const childrenGroup = childrenInput?.closest('.form__group');

    if (adultsGroup) adultsGroup.hidden = !attending;
    if (childrenGroup) childrenGroup.hidden = !attending;

    if (!attending) {
      if (adultsInput) adultsInput.value = '0';
      if (childrenInput) childrenInput.value = '0';
    }
  }

  // Generate stable idempotency key
  function getIdempotencyKey() {
    let key = localStorage.getItem('rsvp_idempotency_key');
    if (!key) {
      key = `web-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem('rsvp_idempotency_key', key);
    }
    return key;
  }

  async function fetchRsvp() {
    if (!manageToken) return;

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${manageToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          manageToken = null;
          showError('rsvp-name', 'Token inválido. Faça uma nova confirmação.');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      populateForm(data);
      showEditButton();
    } catch (error) {
      console.error('Failed to fetch RSVP:', error);
    }
  }

  function populateForm(data) {
    if (nameInput) {
      nameInput.value = data.guestName;
      nameInput.disabled = true;
    }

    const attendingRadio = document.querySelector(`input[name="attending"][value="${data.attending}"]`);
    if (attendingRadio) {
      attendingRadio.checked = true;
    }

    if (adultsInput) adultsInput.value = data.adultsCount;
    if (childrenInput) childrenInput.value = data.childrenCount;
    if (observationsTextarea) observationsTextarea.value = data.observations || '';

    if (consentCheckbox) {
      consentCheckbox.checked = true;
      consentCheckbox.disabled = true;
    }

    updateCountsVisibility();
    updateObservationsCount();
    toggleFieldsDisabled(true);
  }

  function showEditButton() {
    if (submitBtn) submitBtn.hidden = true;
    if (editBtn) editBtn.hidden = false;
  }

  function enableEditMode() {
    isEditMode = true;
    if (submitBtn) submitBtn.hidden = false;
    if (editBtn) editBtn.hidden = true;
    toggleFieldsDisabled(false);
  }

  function updateObservationsCount() {
    if (!observationsTextarea || !observationsCount) return;
    const length = observationsTextarea.value.length;
    observationsCount.textContent = `${length}/500`;
  }

  async function submitForm(e) {
    e.preventDefault();
    clearErrors();
    hideStatus();

    const attending = document.querySelector('input[name="attending"]:checked')?.value === 'true';

    const payload = {
      guestName: nameInput?.value.trim(),
      attending,
      adultsCount: attending ? parseInt(adultsInput?.value || '0', 10) : 0,
      childrenCount: attending ? parseInt(childrenInput?.value || '0', 10) : 0,
      observations: observationsTextarea?.value.trim() || null,
      consentGiven: consentCheckbox?.checked === true,
    };

    const method = isEditMode ? 'PUT' : 'POST';
    const headers = {
      'Content-Type': 'application/json',
      'Idempotency-Key': getIdempotencyKey(),
    };

    if (method === 'PUT' && manageToken) {
      headers['Authorization'] = `Bearer ${manageToken}`;
    }

    toggleFieldsDisabled(true);
    submitBtn.textContent = isEditMode ? 'Atualizando...' : 'Enviando...';

    try {
      const response = await fetch(API_URL, { method, headers, body: JSON.stringify(payload) });

      // Handle non-JSON responses (503, 500, etc.)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Serviço temporariamente indisponível');
      }

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          showStatus('Esta confirmação já foi enviada. Verifique seu token.', 'error');
          return;
        }
        if (response.status === 413) {
          showError('rsvp-observations', 'Mensagem muito longa');
          return;
        }
        if (response.status === 429) {
          showStatus('Muitas requisições. Aguarde alguns minutos.', 'error');
          return;
        }
        throw new Error(data.error || 'Erro desconhecido');
      }

      if (method === 'POST' && data.manageToken) {
        manageToken = data.manageToken;
        localStorage.setItem(TOKEN_KEY, manageToken);
      }

      showStatus(
        isEditMode ? 'Confirmação atualizada com sucesso!' : 'Confirmação enviada com sucesso!',
        'success'
      );

      // Lock name and consent after success
      if (nameInput) nameInput.disabled = true;
      if (consentCheckbox) consentCheckbox.disabled = true;

      showEditButton();
      isEditMode = false;
    } catch (error) {
      console.error('Failed to submit RSVP:', error);
      showStatus(error.message || 'Erro ao enviar confirmação. Tente novamente.', 'error');
    } finally {
      // Restore button text, but never re-enable locked fields
      submitBtn.textContent = isEditMode ? 'Atualizar Confirmação' : 'Confirmar Presença';
      if (!isEditMode) {
        toggleFieldsDisabled(false);
      }
    }
  }

  // Event listeners
  attendingRadios.forEach((radio) => radio.addEventListener('change', updateCountsVisibility));
  if (observationsTextarea) observationsTextarea.addEventListener('input', updateObservationsCount);
  if (editBtn) editBtn.addEventListener('click', enableEditMode);
  form.addEventListener('submit', submitForm);

  // Initialize
  updateCountsVisibility();
  updateObservationsCount();
  fetchRsvp();
}
