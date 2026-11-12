/**
 * RSVP Form Controller
 * Isolated module for frontend testing without GSAP/Lenis dependencies
 */

const MAX_COMPANIONS = 10;

export function setupRsvp() {
  const form = document.getElementById('rsvp-form');
  if (!form) return;

  const nameInput = document.getElementById('rsvp-name');
  const attendingRadios = document.querySelectorAll('input[name="attending"]');
  const companionsBlock = document.getElementById('rsvp-companions-block');
  const companionsList = document.getElementById('rsvp-companions-list');
  const addCompanionBtn = document.getElementById('rsvp-add-companion');
  const companionsError = document.getElementById('rsvp-companions-error');
  const submitBtn = document.getElementById('rsvp-submit');
  const editBtn = document.getElementById('rsvp-edit');
  const statusDiv = document.getElementById('rsvp-status');
  const statusMessage = document.getElementById('rsvp-status-message');

  const API_URL = '/api/rsvp';
  const TOKEN_KEY = 'rsvp_manage_token';

  let manageToken = localStorage.getItem(TOKEN_KEY);
  let viewMode = 'create'; // 'create' | 'view' | 'edit'
  let companionSeq = 0;

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

  function isAttending() {
    return document.querySelector('input[name="attending"]:checked')?.value === 'true';
  }

  function getCompanionNames() {
    if (!companionsList) return [];
    return Array.from(companionsList.querySelectorAll('input[data-companion-name]'))
      .map((input) => input.value.trim())
      .filter(Boolean);
  }

  function companionCount() {
    return companionsList ? companionsList.querySelectorAll('.rsvp__companion-row').length : 0;
  }

  function syncAddCompanionBtn() {
    if (!addCompanionBtn) return;
    addCompanionBtn.disabled = companionCount() >= MAX_COMPANIONS || viewMode === 'view';
  }

  function addCompanionRow(name = '') {
    if (!companionsList) return;
    if (companionCount() >= MAX_COMPANIONS) return;

    companionSeq += 1;
    const id = `rsvp-companion-${companionSeq}`;
    const row = document.createElement('div');
    row.className = 'rsvp__companion-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.maxLength = 100;
    input.placeholder = 'Nome do acompanhante';
    input.autocomplete = 'name';
    input.setAttribute('data-companion-name', '1');
    input.value = name;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'rsvp__companion-remove';
    removeBtn.textContent = 'Remover';
    removeBtn.addEventListener('click', () => {
      row.remove();
      syncAddCompanionBtn();
    });

    row.append(input, removeBtn);
    companionsList.appendChild(row);
    syncAddCompanionBtn();
    return input;
  }

  function clearCompanions() {
    if (companionsList) companionsList.innerHTML = '';
    syncAddCompanionBtn();
  }

  function setCompanionsFromStored(data) {
    clearCompanions();
    const fromObs = String(data.observations || '')
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const names =
      fromObs.length > 0
        ? fromObs
        : Array.from({ length: Number(data.adultsCount) || 0 }, () => '');
    names.slice(0, MAX_COMPANIONS).forEach((n) => addCompanionRow(n));
  }

  function updateCompanionsVisibility() {
    const attending = isAttending();
    if (companionsBlock) companionsBlock.hidden = !attending;
    if (!attending) clearCompanions();
    syncAddCompanionBtn();
  }

  function setViewMode(mode) {
    const allInputs = form.querySelectorAll('input, textarea, button[type="submit"], button[type="button"]');

    if (mode === 'create') {
      allInputs.forEach((input) => (input.disabled = false));
      if (submitBtn) {
        submitBtn.hidden = false;
        submitBtn.textContent = 'Confirmar presença';
      }
      if (editBtn) editBtn.hidden = true;
    } else if (mode === 'view') {
      allInputs.forEach((input) => {
        if (input === editBtn) return;
        input.disabled = true;
      });
      if (editBtn) {
        editBtn.hidden = false;
        editBtn.disabled = false;
      }
      if (submitBtn) submitBtn.hidden = true;
    } else if (mode === 'edit') {
      allInputs.forEach((input) => {
        if (input === nameInput) {
          input.disabled = true;
        } else if (input === editBtn) {
          input.disabled = true;
        } else {
          input.disabled = false;
        }
      });
      if (submitBtn) {
        submitBtn.hidden = false;
        submitBtn.textContent = 'Atualizar confirmação';
      }
      if (editBtn) editBtn.hidden = true;
    }
    syncAddCompanionBtn();
  }

  function setBusyState(busy) {
    const allInputs = form.querySelectorAll('input, textarea, button');
    allInputs.forEach((input) => (input.disabled = busy));
  }

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
          Authorization: `Bearer ${manageToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          manageToken = null;
          rotateIdempotencyKey();
          showError('rsvp-name', 'Token inválido. Faça uma nova confirmação.');
          viewMode = 'create';
          setViewMode('create');
          return;
        }
        console.warn(`GET failed: ${response.status}`);
        return;
      }

      const data = await response.json();
      populateForm(data);
      viewMode = 'view';
      setViewMode('view');
    } catch (error) {
      console.error('Failed to fetch RSVP:', error);
    }
  }

  function populateForm(data) {
    if (nameInput) nameInput.value = data.guestName;

    const attendingValue = data.attending === true || data.attending === 'true' ? 'true' : 'false';
    const attendingRadio = document.querySelector(`input[name="attending"][value="${attendingValue}"]`);
    if (attendingRadio) attendingRadio.checked = true;

    updateCompanionsVisibility();
    if (attendingValue === 'true') setCompanionsFromStored(data);
  }

  function enableEditMode() {
    viewMode = 'edit';
    setViewMode('edit');
    hideStatus();
  }

  async function submitForm(e) {
    e.preventDefault();
    clearErrors();
    hideStatus();

    const savedViewMode = viewMode;
    const attending = isAttending();
    const companions = attending ? getCompanionNames() : [];

    if (attending && companionCount() > MAX_COMPANIONS) {
      showError('rsvp-companions', `Máximo de ${MAX_COMPANIONS} acompanhantes`);
      showStatus(`Máximo de ${MAX_COMPANIONS} acompanhantes.`, 'error');
      return;
    }

    // API legado: adultsCount + observations (nomes) + consent implícito ao enviar
    const payload = {
      guestName: nameInput?.value.trim(),
      attending,
      adultsCount: companions.length,
      childrenCount: 0,
      observations: companions.length ? companions.join('\n') : null,
      consentGiven: true,
    };

    const method = savedViewMode === 'edit' ? 'PUT' : 'POST';
    const headers = {
      'Content-Type': 'application/json',
    };

    if (method === 'POST') {
      headers['Idempotency-Key'] = getIdempotencyKey();
      if (manageToken) {
        headers.Authorization = `Bearer ${manageToken}`;
      }
    } else if (method === 'PUT' && manageToken) {
      headers.Authorization = `Bearer ${manageToken}`;
    }

    setBusyState(true);
    if (submitBtn) submitBtn.textContent = savedViewMode === 'edit' ? 'Atualizando...' : 'Enviando...';

    let success = false;

    try {
      const response = await fetch(API_URL, { method, headers, body: JSON.stringify(payload) });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Serviço temporariamente indisponível');
      }

      let data;
      try {
        data = await response.json();
      } catch {
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
          showStatus('Lista de acompanhantes muito longa. Remova alguns nomes.', 'error');
          return;
        }
        if (response.status === 429) {
          showStatus('Muitas requisições. Aguarde alguns minutos.', 'error');
          return;
        }
        if (response.status === 401) {
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

      success = true;
      if (method === 'POST' && data.manageToken) {
        manageToken = data.manageToken;
        localStorage.setItem(TOKEN_KEY, manageToken);
        clearIdempotencyKey();
      }

      showStatus(
        savedViewMode === 'edit'
          ? 'Confirmação atualizada com sucesso!'
          : 'Confirmação enviada com sucesso!',
        'success'
      );

      viewMode = 'view';
      setViewMode('view');
    } catch (error) {
      console.error('Failed to submit RSVP:', error);
      showStatus(error.message || 'Erro de conexão. Verifique sua internet e tente novamente.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.textContent =
          savedViewMode === 'edit' ? 'Atualizar confirmação' : 'Confirmar presença';
      }

      if (success) {
        // view mode already applied
      } else if (viewMode !== savedViewMode) {
        setBusyState(false);
      } else {
        setViewMode(savedViewMode);
      }
    }
  }

  attendingRadios.forEach((radio) => radio.addEventListener('change', updateCompanionsVisibility));
  if (addCompanionBtn) {
    addCompanionBtn.addEventListener('click', () => {
      const input = addCompanionRow('');
      input?.focus();
    });
  }
  if (editBtn) editBtn.addEventListener('click', enableEditMode);
  form.addEventListener('submit', submitForm);

  updateCompanionsVisibility();
  fetchRsvp();
}
