/**
 * RSVP Form Controller
 * Fluxo: buscar nome na lista oculta → (escolher se houver vários) → confirmar
 */

const MAX_COMPANIONS = 10;
const SEARCH_URL = '/api/guests/search';

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
  const matchesBlock = document.getElementById('rsvp-matches-block');
  const matchesList = document.getElementById('rsvp-matches-list');
  const inviteBox = document.getElementById('rsvp-invite');
  const inviteNameEl = document.getElementById('rsvp-invite-name');
  const confirmFields = document.getElementById('rsvp-confirm-fields');
  const changeGuestBtn = document.getElementById('rsvp-change-guest');

  const API_URL = '/api/rsvp';
  const TOKEN_KEY = 'rsvp_manage_token';

  let manageToken = localStorage.getItem(TOKEN_KEY);
  let viewMode = 'create'; // 'create' | 'view' | 'edit'
  /** @type {'search' | 'choose' | 'confirm'} */
  let phase = 'search';
  let companionSeq = 0;
  /** @type {{id: string, displayName: string} | null} */
  let selectedGuest = null;
  /** @type {Array<{id: string, displayName: string}>} */
  let lastMatches = [];

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
    if (errorEl) errorEl.textContent = message;
  }

  function clearErrors() {
    form.querySelectorAll('.form-error').forEach((el) => {
      el.textContent = '';
    });
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
    if (companionsBlock) companionsBlock.hidden = !attending || phase !== 'confirm';
    if (!attending) clearCompanions();
    syncAddCompanionBtn();
  }

  function setSelectedGuest(guest) {
    selectedGuest = guest;
    if (inviteNameEl) inviteNameEl.textContent = guest?.displayName || '';
    if (nameInput && guest) nameInput.value = guest.displayName;
  }

  function renderMatches(matches) {
    if (!matchesList) return;
    matchesList.innerHTML = '';
    matches.forEach((m, i) => {
      const id = `rsvp-match-${m.id}`;
      const label = document.createElement('label');
      label.className = 'radio-label';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'rsvp-match';
      input.value = m.id;
      input.id = id;
      if (i === 0 && matches.length === 1) input.checked = true;
      input.addEventListener('change', () => {
        if (input.checked) {
          setSelectedGuest(m);
          enterConfirmPhase();
        }
      });
      const span = document.createElement('span');
      span.textContent = m.displayName;
      label.append(input, span);
      matchesList.appendChild(label);
    });
  }

  function enterSearchPhase() {
    phase = 'search';
    selectedGuest = null;
    lastMatches = [];
    if (matchesBlock) matchesBlock.hidden = true;
    if (inviteBox) inviteBox.hidden = true;
    if (confirmFields) confirmFields.hidden = true;
    if (matchesList) matchesList.innerHTML = '';
    if (nameInput) nameInput.disabled = viewMode === 'view';
    if (submitBtn) {
      submitBtn.hidden = viewMode === 'view';
      submitBtn.textContent = 'Buscar';
    }
    clearCompanions();
    updateCompanionsVisibility();
  }

  function enterChoosePhase(matches) {
    phase = 'choose';
    lastMatches = matches;
    selectedGuest = null;
    if (matchesBlock) matchesBlock.hidden = false;
    if (inviteBox) inviteBox.hidden = true;
    if (confirmFields) confirmFields.hidden = true;
    renderMatches(matches);
    if (submitBtn) {
      submitBtn.hidden = false;
      submitBtn.textContent = 'Continuar';
    }
    showStatus('Encontramos mais de um convite. Escolha o seu.', 'info');
  }

  function enterConfirmPhase() {
    if (!selectedGuest) return;
    phase = 'confirm';
    if (matchesBlock) matchesBlock.hidden = true;
    if (inviteBox) inviteBox.hidden = false;
    if (confirmFields) confirmFields.hidden = false;
    if (nameInput) nameInput.disabled = true;
    if (submitBtn) {
      submitBtn.hidden = false;
      submitBtn.textContent = viewMode === 'edit' ? 'Atualizar confirmação' : 'Confirmar presença';
    }
    updateCompanionsVisibility();
  }

  function setViewMode(mode) {
    const allInputs = form.querySelectorAll(
      'input, textarea, button[type="submit"], button[type="button"]'
    );

    if (mode === 'create') {
      allInputs.forEach((input) => {
        input.disabled = false;
      });
      if (editBtn) editBtn.hidden = true;
      enterSearchPhase();
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
      if (inviteBox) inviteBox.hidden = false;
      if (confirmFields) confirmFields.hidden = false;
      if (matchesBlock) matchesBlock.hidden = true;
      phase = 'confirm';
    } else if (mode === 'edit') {
      allInputs.forEach((input) => {
        if (input === nameInput || input === editBtn) {
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
      if (inviteBox) inviteBox.hidden = false;
      if (confirmFields) confirmFields.hidden = false;
      if (matchesBlock) matchesBlock.hidden = true;
      phase = 'confirm';
      if (changeGuestBtn) changeGuestBtn.disabled = true;
    }
    syncAddCompanionBtn();
  }

  function setBusyState(busy) {
    form.querySelectorAll('input, textarea, button').forEach((input) => {
      input.disabled = busy;
    });
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
      enterSearchPhase();
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: { Authorization: `Bearer ${manageToken}` },
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
    setSelectedGuest({ id: 'stored', displayName: data.guestName });
    if (nameInput) nameInput.value = data.guestName;

    const attendingValue = data.attending === true || data.attending === 'true' ? 'true' : 'false';
    const attendingRadio = document.querySelector(
      `input[name="attending"][value="${attendingValue}"]`
    );
    if (attendingRadio) attendingRadio.checked = true;

    updateCompanionsVisibility();
    if (attendingValue === 'true') setCompanionsFromStored(data);
  }

  function enableEditMode() {
    viewMode = 'edit';
    setViewMode('edit');
    hideStatus();
  }

  async function runSearch() {
    clearErrors();
    hideStatus();
    const q = nameInput?.value.trim() || '';
    if (q.length < 2) {
      showError('rsvp-name', 'Digite pelo menos 2 letras do nome.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Buscando…';
    }

    try {
      const res = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showStatus(data.message || 'Não foi possível buscar o convite.', 'error');
        return;
      }

      const matches = data.matches || [];
      if (matches.length === 0) {
        enterSearchPhase();
        showStatus(
          'Não encontramos esse nome na lista. Confira a escrita ou fale com os noivos.',
          'error'
        );
        return;
      }

      if (matches.length === 1) {
        setSelectedGuest(matches[0]);
        enterConfirmPhase();
        showStatus('Convite encontrado! Confirme sua presença abaixo.', 'success');
        return;
      }

      enterChoosePhase(matches);
    } catch (err) {
      console.error(err);
      showStatus('Erro de conexão ao buscar. Tente de novo.', 'error');
    } finally {
      if (submitBtn && viewMode === 'create') {
        submitBtn.disabled = false;
        if (phase === 'search') submitBtn.textContent = 'Buscar';
        else if (phase === 'choose') submitBtn.textContent = 'Continuar';
        else submitBtn.textContent = 'Confirmar presença';
      }
    }
  }

  async function submitForm(e) {
    e.preventDefault();
    clearErrors();
    hideStatus();

    if (viewMode === 'create' && phase === 'search') {
      await runSearch();
      return;
    }

    if (viewMode === 'create' && phase === 'choose') {
      const checked = document.querySelector('input[name="rsvp-match"]:checked');
      if (!checked) {
        showError('rsvp-matches', 'Selecione o seu convite na lista.');
        return;
      }
      const guest = lastMatches.find((m) => m.id === checked.value);
      if (!guest) {
        showError('rsvp-matches', 'Seleção inválida. Busque de novo.');
        enterSearchPhase();
        return;
      }
      setSelectedGuest(guest);
      enterConfirmPhase();
      return;
    }

    if (!selectedGuest?.displayName) {
      showStatus('Busque e selecione seu convite antes de confirmar.', 'error');
      enterSearchPhase();
      return;
    }

    const attendingRadio = document.querySelector('input[name="attending"]:checked');
    if (!attendingRadio) {
      showError('rsvp-attending', 'Informe se você vai comparecer.');
      return;
    }

    const savedViewMode = viewMode;
    const attending = isAttending();
    const companions = attending ? getCompanionNames() : [];

    if (attending && companionCount() > MAX_COMPANIONS) {
      showError('rsvp-companions', `Máximo de ${MAX_COMPANIONS} acompanhantes`);
      showStatus(`Máximo de ${MAX_COMPANIONS} acompanhantes.`, 'error');
      return;
    }

    const payload = {
      guestName: selectedGuest.displayName,
      attending,
      adultsCount: companions.length,
      childrenCount: 0,
      observations: companions.length ? companions.join('\n') : null,
      consentGiven: true,
    };

    const method = savedViewMode === 'edit' ? 'PUT' : 'POST';
    const headers = { 'Content-Type': 'application/json' };

    if (method === 'POST') {
      headers['Idempotency-Key'] = getIdempotencyKey();
      if (manageToken) headers.Authorization = `Bearer ${manageToken}`;
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
        if (response.status === 403 && data?.error === 'GUEST_NOT_ON_LIST') {
          showStatus(
            data.message || 'Este nome não está na lista de convidados.',
            'error'
          );
          return;
        }
        throw new Error(data.error || data.message || 'Erro desconhecido');
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
      showStatus(
        error.message || 'Erro de conexão. Verifique sua internet e tente novamente.',
        'error'
      );
    } finally {
      if (success) {
        // view mode already applied
        return;
      }

      setBusyState(false);

      if (savedViewMode === 'edit') {
        setViewMode('edit');
        return;
      }

      // Mantém o convite selecionado após erro (409/413/etc.)
      if (selectedGuest && phase === 'confirm') {
        enterConfirmPhase();
        form
          .querySelectorAll(
            '#rsvp-confirm-fields input, #rsvp-confirm-fields button, #rsvp-submit, #rsvp-change-guest, #rsvp-add-companion'
          )
          .forEach((el) => {
            el.disabled = false;
          });
        if (nameInput) nameInput.disabled = true;
        if (submitBtn) submitBtn.textContent = 'Confirmar presença';
        return;
      }

      setViewMode(savedViewMode);
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
  if (changeGuestBtn) {
    changeGuestBtn.addEventListener('click', () => {
      if (viewMode !== 'create') return;
      hideStatus();
      if (nameInput) {
        nameInput.disabled = false;
        nameInput.focus();
        nameInput.select();
      }
      enterSearchPhase();
    });
  }
  form.addEventListener('submit', submitForm);

  enterSearchPhase();
  fetchRsvp();
}
