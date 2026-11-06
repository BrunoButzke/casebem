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
  let viewMode = 'create'; // 'create' | 'view' | 'edit'

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

  function setViewMode(mode) {
    // mode: 'create' | 'view' | 'edit'
    const allInputs = form.querySelectorAll('input, textarea, button[type="submit"]');
    
    if (mode === 'create') {
      // Fresh form: all enabled
      allInputs.forEach((input) => (input.disabled = false));
      if (submitBtn) {
        submitBtn.hidden = false;
        submitBtn.textContent = 'Confirmar Presença';
      }
      if (editBtn) editBtn.hidden = true;
    } else if (mode === 'view') {
      // Response saved: all disabled, show edit button
      allInputs.forEach((input) => (input.disabled = true));
      if (submitBtn) submitBtn.hidden = true;
      if (editBtn) editBtn.hidden = false;
    } else if (mode === 'edit') {
      // Edit mode: unlock editable fields, keep name/consent locked
      allInputs.forEach((input) => {
        if (input === nameInput || input === consentCheckbox) {
          input.disabled = true; // Name/consent always locked after first save
        } else {
          input.disabled = false;
        }
      });
      if (submitBtn) {
        submitBtn.hidden = false;
        submitBtn.textContent = 'Atualizar Confirmação';
      }
      if (editBtn) editBtn.hidden = true;
    }
  }

  function setBusyState(busy) {
    const allInputs = form.querySelectorAll('input, textarea, button');
    allInputs.forEach((input) => (input.disabled = busy));
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

  // Generate or get idempotency key (rotates on field change or after success)
  function getIdempotencyKey() {
    let key = localStorage.getItem('rsvp_idempotency_key');
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem('rsvp_idempotency_key', key);
    }
    return key;
  }

  function rotateIdempotencyKey() {
    const key = crypto.randomUUID();
    localStorage.setItem('rsvp_idempotency_key', key);
    return key;
  }

  function clearIdempotencyKey() {
    localStorage.removeItem('rsvp_idempotency_key');
  }

  async function fetchRsvp() {
    if (!manageToken) {
      viewMode = 'create';
      return;
    }

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
          rotateIdempotencyKey(); // New key for fresh attempt
          showError('rsvp-name', 'Token inválido. Faça uma nova confirmação.');
          viewMode = 'create';
          setViewMode('create');
          return;
        }
        // Other errors (503, 500): silent, keep token for retry
        console.warn(`GET failed: ${response.status}`);
        return;
      }

      const data = await response.json();
      populateForm(data);
      viewMode = 'view';
      setViewMode('view');
    } catch (error) {
      console.error('Failed to fetch RSVP:', error);
      // Network errors: keep token, silent
    }
  }

  function populateForm(data) {
    if (nameInput) nameInput.value = data.guestName;

    const attendingRadio = document.querySelector(`input[name="attending"][value="${data.attending}"]`);
    if (attendingRadio) attendingRadio.checked = true;

    if (adultsInput) adultsInput.value = data.adultsCount;
    if (childrenInput) childrenInput.value = data.childrenCount;
    if (observationsTextarea) observationsTextarea.value = data.observations || '';
    if (consentCheckbox) consentCheckbox.checked = true;

    updateCountsVisibility();
    updateObservationsCount();
  }

  function enableEditMode() {
    viewMode = 'edit';
    setViewMode('edit');
    hideStatus();
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

    const savedViewMode = viewMode; // Capture before async
    const attending = document.querySelector('input[name="attending"]:checked')?.value === 'true';

    const payload = {
      guestName: nameInput?.value.trim(),
      attending,
      adultsCount: attending ? parseInt(adultsInput?.value || '0', 10) : 0,
      childrenCount: attending ? parseInt(childrenInput?.value || '0', 10) : 0,
      observations: observationsTextarea?.value.trim() || null,
      consentGiven: consentCheckbox?.checked === true,
    };

    const method = savedViewMode === 'edit' ? 'PUT' : 'POST';
    const headers = {
      'Content-Type': 'application/json',
    };

    // POST: send idempotency key + bearer if token exists (for network retry)
    // PUT: send bearer (idempotency optional, not required by spec)
    if (method === 'POST') {
      headers['Idempotency-Key'] = getIdempotencyKey();
      if (manageToken) {
        headers['Authorization'] = `Bearer ${manageToken}`;
      }
    } else if (method === 'PUT' && manageToken) {
      headers['Authorization'] = `Bearer ${manageToken}`;
    }

    setBusyState(true);
    if (submitBtn) submitBtn.textContent = savedViewMode === 'edit' ? 'Atualizando...' : 'Enviando...';

    let success = false;

    try {
      const response = await fetch(API_URL, { method, headers, body: JSON.stringify(payload) });

      // Handle non-JSON responses (503, 500, etc.)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Serviço temporariamente indisponível');
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Resposta inválida do servidor');
      }

      if (!response.ok) {
        if (response.status === 409) {
          showStatus(
            'Se você já confirmou, recupere o site no mesmo dispositivo ou fale com os noivos. Não reenvie outra confirmação com o mesmo nome.',
            'error'
          );
          return;
        }
        if (response.status === 413) {
          showError('rsvp-observations', 'Mensagem muito longa');
          showStatus('Campo observações muito longo. Reduza o texto.', 'error');
          return;
        }
        if (response.status === 429) {
          showStatus('Muitas requisições. Aguarde alguns minutos.', 'error');
          return;
        }
        if (response.status === 401) {
          // Token invalid - reset to create mode
          localStorage.removeItem(TOKEN_KEY);
          manageToken = null;
          rotateIdempotencyKey();
          showStatus('Token inválido. Faça uma nova confirmação.', 'error');
          viewMode = 'create';
          setViewMode('create');
          return;
        }
        throw new Error(data.error || 'Erro desconhecido');
      }

      // Success!
      success = true;
      if (method === 'POST' && data.manageToken) {
        manageToken = data.manageToken;
        localStorage.setItem(TOKEN_KEY, manageToken);
        clearIdempotencyKey(); // Clear after successful create
      }

      showStatus(
        savedViewMode === 'edit' ? 'Confirmação atualizada com sucesso!' : 'Confirmação enviada com sucesso!',
        'success'
      );

      viewMode = 'view';
      setViewMode('view');
    } catch (error) {
      console.error('Failed to submit RSVP:', error);
      showStatus(error.message || 'Erro de conexão. Verifique sua internet e tente novamente.', 'error');
    } finally {
      // Restore button text
      if (submitBtn) submitBtn.textContent = savedViewMode === 'edit' ? 'Atualizar Confirmação' : 'Confirmar Presença';
      
      if (success) {
        // Success: viewMode already set to 'view'
        // setViewMode('view') already disabled all inputs, don't call setBusyState(false)
      } else if (viewMode !== savedViewMode) {
        // Error with explicit mode change (e.g. 401 -> 'create')
        // New mode already set, just clear busy state
        setBusyState(false);
      } else {
        // Error without mode change: restore previous mode
        setViewMode(savedViewMode);
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
