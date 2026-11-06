import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const id = anchor.getAttribute('href');
    if (!id || id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView({ behavior: 'smooth' });
  });
});

function cloneMarquee() {
  const track = document.querySelector('.marquee__track');
  if (!track) return;
  track.innerHTML += track.innerHTML;
  track.querySelectorAll('span').forEach((el, i, all) => {
    if (i >= all.length / 2) el.setAttribute('aria-hidden', 'true');
  });
}

function splitWords(el) {
  const html = el.innerHTML.trim();
  const parts = html.split(/(\s+|<mark>|<\/mark>)/g).filter(Boolean);
  let inMark = false;
  const out = [];
  for (const part of parts) {
    if (part === '<mark>') {
      inMark = true;
      continue;
    }
    if (part === '</mark>') {
      inMark = false;
      continue;
    }
    if (/^\s+$/.test(part)) {
      out.push(part);
      continue;
    }
    const cls = inMark ? 'word word--hl' : 'word';
    out.push(`<span class="${cls}">${part}</span>`);
  }
  el.innerHTML = out.join('');
  return el.querySelectorAll('.word');
}

function setupCursor() {
  if (!finePointer || reducedMotion) return;
  const cursor = document.querySelector('.cursor');
  if (!cursor) return;
  document.body.classList.add('has-cursor');
  gsap.set(cursor, { opacity: 1 });

  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });

  window.addEventListener('pointermove', (e) => {
    xTo(e.clientX);
    yTo(e.clientY);
  });
}

function setupMagnetic() {
  if (!finePointer || reducedMotion) return;
  document.querySelectorAll('.magnetic').forEach((btn) => {
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.35);
      yTo((e.clientY - r.top - r.height / 2) * 0.35);
    });
    btn.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}

function setupNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  let last = 0;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle('is-solid', y > window.innerHeight * 0.7);
      if (y > 120 && y > last) nav.classList.add('is-hidden');
      else nav.classList.remove('is-hidden');
      last = y;
    },
  });
}

function setupProgress() {
  const bar = document.querySelector('.scroll-progress span');
  if (!bar) return;
  gsap.to(bar, {
    width: '100%',
    ease: 'none',
    scrollTrigger: { scrub: 0.2 },
  });
}

function setupParallax() {
  if (reducedMotion) return;
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    gsap.to(el, {
      yPercent: 14,
      ease: 'none',
      scrollTrigger: {
        trigger: el.parentElement,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
  });
}

function setupManifesto() {
  const text = document.querySelector('[data-words]');
  if (text && !reducedMotion) {
    const words = splitWords(text);
    gsap.to(words, {
      color: '#1c1917',
      stagger: 0.08,
      ease: 'none',
      scrollTrigger: {
        trigger: text,
        start: 'top 80%',
        end: 'bottom 40%',
        scrub: true,
      },
    });
  }

  setupCountdown();
}

/** Casamento: 21 nov 2026, 8h — America/Sao_Paulo (UTC−3) */
const WEDDING_AT = Date.parse('2026-11-21T08:00:00-03:00');

function setupCountdown() {
  const root = document.querySelector('.countdown');
  if (!root) return;
  const daysEl = root.querySelector('[data-unit="days"]');
  const hoursEl = root.querySelector('[data-unit="hours"]');
  const minutesEl = root.querySelector('[data-unit="minutes"]');
  const secondsEl = root.querySelector('[data-unit="seconds"]');

  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');

  const tick = () => {
    const diff = WEDDING_AT - Date.now();
    if (diff <= 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minutesEl.textContent = '00';
      secondsEl.textContent = '00';
      root.classList.add('is-done');
      return false;
    }
    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    daysEl.textContent = days > 99 ? String(days) : pad(days);
    hoursEl.textContent = pad(hours);
    minutesEl.textContent = pad(minutes);
    secondsEl.textContent = pad(seconds);
    return true;
  };

  tick();
  const id = setInterval(() => {
    if (!tick()) clearInterval(id);
  }, 1000);
}

function formatBRL(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function setupGifts() {
  const toggle = document.querySelector('.gifts__toggle');
  const panel = document.querySelector('.gifts__collapse');
  const modal = document.querySelector('#gift-modal');
  if (!toggle || !panel || !modal) return;

  const dialogImg = modal.querySelector('.gift-modal__photo img');
  const titleEl = modal.querySelector('#gift-modal-title');
  const descEl = modal.querySelector('.gift-modal__desc');
  const customBox = modal.querySelector('.gift-modal__amount--custom');
  const fixedBox = modal.querySelector('.gift-modal__amount--fixed');
  const amountInput = modal.querySelector('#gift-amount');
  const totalEl = modal.querySelector('[data-gift-total]');
  const emailEl = modal.querySelector('#gift-email');
  const messageEl = modal.querySelector('#gift-message');
  const countEl = modal.querySelector('[data-gift-count]');
  const multBtns = [...modal.querySelectorAll('.gift-modal__mult')];
  const payBtn = modal.querySelector('#gift-pay');
  const formBox = modal.querySelector('[data-gift-form]');
  const pixBox = modal.querySelector('[data-gift-pix]');
  const errorEl = modal.querySelector('[data-gift-error]');
  const pixStatus = modal.querySelector('[data-pix-status]');
  const pixQr = modal.querySelector('[data-pix-qr]');
  const pixCode = modal.querySelector('[data-pix-code]');
  const pixCopy = modal.querySelector('[data-pix-copy]');
  const pixBack = modal.querySelector('[data-pix-back]');

  let basePrice = 0;
  let multiplier = 1;
  let currentMode = 'fixed';
  let currentGiftId = '';
  let currentTitle = '';
  let pollTimer = null;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const updateCount = () => {
    countEl.textContent = String(messageEl.value.length);
  };

  const updateTotal = () => {
    totalEl.textContent = formatBRL(basePrice * multiplier);
  };

  const showError = (text) => {
    errorEl.hidden = !text;
    errorEl.textContent = text || '';
  };

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const showForm = () => {
    formBox.hidden = false;
    pixBox.hidden = true;
    pixBack.hidden = true;
    showError('');
  };

  const showPix = (payment) => {
    formBox.hidden = true;
    pixBox.hidden = false;
    pixBack.hidden = true;
    pixStatus.textContent = 'Escaneie o QR ou copie o código Pix';
    pixCode.value = payment.qrCode || '';
    if (payment.qrCodeBase64) {
      pixQr.hidden = false;
      pixQr.src = `data:image/png;base64,${payment.qrCodeBase64}`;
    } else {
      pixQr.hidden = true;
    }
  };

  const closeModal = () => {
    stopPolling();
    modal.hidden = true;
    document.body.style.overflow = '';
    showForm();
  };

  const openModal = (card) => {
    stopPolling();
    showForm();
    currentMode = card.dataset.mode || 'fixed';
    currentGiftId = card.dataset.gift || '';
    currentTitle = card.dataset.title || '';
    const desc = card.dataset.desc || '';
    const image = card.dataset.image || '';

    titleEl.textContent = currentTitle;
    descEl.textContent = desc;
    dialogImg.src = image;
    dialogImg.alt = currentTitle;
    messageEl.value = '';
    emailEl.value = '';
    updateCount();
    multiplier = 1;
    multBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.mult === '1'));

    if (currentMode === 'custom') {
      customBox.hidden = false;
      fixedBox.hidden = true;
      amountInput.value = '0.99';
    } else {
      customBox.hidden = true;
      fixedBox.hidden = false;
      basePrice = Number(card.dataset.price) || 0;
      updateTotal();
    }

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  };

  const currentAmount = () => {
    if (currentMode === 'custom') return Number(amountInput.value);
    return basePrice * multiplier;
  };

  const pollPayment = (paymentId) => {
    stopPolling();
    pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment-status?id=${encodeURIComponent(paymentId)}`);
        const data = await res.json();
        if (!res.ok) return;
        if (data.status === 'approved') {
          stopPolling();
          pixStatus.textContent = 'Pagamento confirmado. Obrigado!';
          pixBack.hidden = false;
          pixBack.textContent = 'Fechar';
        } else if (data.status === 'cancelled' || data.status === 'rejected') {
          stopPolling();
          pixStatus.textContent = 'Pagamento não concluído. Tente de novo.';
          pixBack.hidden = false;
          pixBack.textContent = 'Voltar';
        }
      } catch {
        /* ignore transient errors */
      }
    }, 3500);
  };

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    panel.classList.toggle('is-open', !expanded);
    requestAnimationFrame(() => ScrollTrigger.refresh());
  });

  document.querySelectorAll('.gift-card').forEach((card) => {
    card.addEventListener('click', () => openModal(card));
  });

  modal.querySelectorAll('[data-close-gift]').forEach((el) => {
    el.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  multBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      multiplier = Number(btn.dataset.mult) || 1;
      multBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      updateTotal();
    });
  });

  amountInput?.addEventListener('change', () => {
    const v = Number(amountInput.value);
    if (!Number.isFinite(v) || v < 0.99) amountInput.value = '0.99';
  });

  messageEl?.addEventListener('input', updateCount);

  payBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    showError('');

    const email = emailEl.value.trim();
    if (!EMAIL_RE.test(email)) {
      showError('Informe um e-mail válido para gerar o Pix.');
      return;
    }

    const amount = currentAmount();
    if (!Number.isFinite(amount) || amount < 0.99) {
      showError('Valor mínimo é R$ 0,99.');
      return;
    }

    payBtn.classList.add('is-loading');
    payBtn.textContent = 'Gerando Pix…';
    try {
      const res = await fetch('/api/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          title: currentTitle,
          email,
          message: messageEl.value.trim(),
          giftId: currentGiftId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível gerar o Pix.');
      showPix(data);
      if (data.id) pollPayment(data.id);
    } catch (err) {
      showError(err.message || 'Erro ao gerar Pix.');
    } finally {
      payBtn.classList.remove('is-loading');
      payBtn.textContent = 'Pagar com Pix';
    }
  });

  pixCopy?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pixCode.value);
      pixCopy.textContent = 'Copiado!';
      setTimeout(() => {
        pixCopy.textContent = 'Copiar código';
      }, 1800);
    } catch {
      pixCode.select();
    }
  });

  pixBack?.addEventListener('click', () => {
    if (pixStatus.textContent.includes('confirmado')) closeModal();
    else {
      stopPolling();
      showForm();
    }
  });
}

function setupDressRecolor() {
  const card = document.querySelector('.dress__card--madrinha');
  if (!card) return;
  const photo = card.querySelector('.dress__photo');
  const dots = [...card.querySelectorAll('.dress__dot')];
  if (!photo || !dots.length) return;

  // Pré-carrega as 4 fotos para troca instantânea
  dots.forEach((dot) => {
    if (!dot.dataset.image) return;
    const preload = new Image();
    preload.src = dot.dataset.image;
  });

  const applyLook = (dot) => {
    const src = dot.dataset.image;
    if (!src || photo.getAttribute('src') === src) return;
    photo.style.opacity = '0.35';
    const next = new Image();
    next.onload = () => {
      photo.src = src;
      photo.alt = `Madrinha com vestido ${dot.title.toLowerCase()}`;
      requestAnimationFrame(() => {
        photo.style.opacity = '1';
      });
    };
    next.src = src;
  };

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      dots.forEach((d) => {
        d.classList.toggle('is-active', d === dot);
        d.setAttribute('aria-pressed', d === dot ? 'true' : 'false');
      });
      applyLook(dot);
    });
  });
}

function setupHow() {
  const steps = [...document.querySelectorAll('.how__step')];
  const frames = [...document.querySelectorAll('.how__frame')];
  if (!steps.length) return;
  const n = steps.length;
  let current = 0;

  const setStep = (i) => {
    if (i === current) return;
    frames[current]?.classList.remove('is-active');
    frames[current]?.classList.add('was-active');
    steps[current]?.classList.remove('is-active');
    current = i;
    frames[current]?.classList.add('is-active');
    frames[current]?.classList.remove('was-active');
    steps[current]?.classList.add('is-active');
  };

  const mm = gsap.matchMedia();
  mm.add('(min-width: 961px)', () => {
    if (reducedMotion) return;
    ScrollTrigger.create({
      trigger: '.how',
      start: 'top top',
      end: '+=300%',
      pin: '.how__pin',
      scrub: true,
      onUpdate: (s) => setStep(Math.min(n - 1, Math.floor(s.progress * n))),
    });
  });

  mm.add('(max-width: 960px)', () => {
    if (reducedMotion) return;
    const t = setInterval(() => setStep((current + 1) % n), 2800);
    return () => clearInterval(t);
  });
}

function setupReveals() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (reducedMotion) {
    gsap.set(els, { clearProps: 'all' });
    return;
  }
  gsap.set(els, { opacity: 0, y: 50 });
  ScrollTrigger.batch(els, {
    start: 'top 88%',
    once: true,
    onEnter: (b) =>
      gsap.to(b, { opacity: 1, y: 0, duration: 1.1, stagger: 0.09, ease: 'expo.out' }),
  });
}

async function runPreloader() {
  const preloader = document.querySelector('.preloader');
  const bar = document.querySelector('.preloader__bar span');
  if (!preloader) return;

  if (reducedMotion) {
    preloader.remove();
    return;
  }

  if (lenis) lenis.stop();

  const heroImg = document.querySelector('.hero__bg img');
  const waitImg = heroImg?.complete
    ? Promise.resolve()
    : new Promise((res) => {
        heroImg?.addEventListener('load', res, { once: true });
        heroImg?.addEventListener('error', res, { once: true });
      });

  const minTime = new Promise((r) => setTimeout(r, 1300));
  const fonts = document.fonts?.ready ?? Promise.resolve();

  gsap.to(bar, { width: '100%', duration: 1.15, ease: 'power2.inOut' });
  await Promise.all([waitImg, fonts, minTime]);

  const tl = gsap.timeline({
    onComplete: () => {
      preloader.remove();
      if (lenis) lenis.start();
      ScrollTrigger.refresh();
    },
  });

  tl.to(preloader, {
    clipPath: 'inset(0 0 100% 0)',
    duration: 1.05,
    ease: 'expo.inOut',
  }).from(
    '.hero__title .line > span',
    { yPercent: 115, rotate: 4, duration: 1.3, stagger: 0.12, ease: 'expo.out' },
    0.35,
  )
    .from('.hero__eyebrow, .hero__meta, .hero__cta', { y: 28, opacity: 0, duration: 1, stagger: 0.08, ease: 'expo.out' }, 0.55)
    .from('.nav', { y: -40, opacity: 0, duration: 0.9, clearProps: 'transform,opacity' }, 0.7);
}

function setupRsvp() {
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

  function toggleGuestCountsDisabled(disabled) {
    adultsInput.disabled = disabled;
    childrenInput.disabled = disabled;
    if (disabled) {
      adultsInput.value = 0;
      childrenInput.value = 0;
    }
  }

  attendingRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      const notAttending = form.querySelector('input[name="attending"][value="no"]').checked;
      toggleGuestCountsDisabled(notAttending);
    });
  });

  observationsTextarea.addEventListener('input', () => {
    observationsCount.textContent = observationsTextarea.value.length;
  });

  async function loadExistingRsvp() {
    if (!manageToken) return;

    try {
      const response = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${manageToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        populateForm(data);
        showStatus(
          `✅ Olá, ${data.guestName}! Sua resposta já foi registrada. Você pode alterá-la abaixo.`,
          'success',
        );
        submitBtn.textContent = 'Atualizar resposta';
        isEditMode = true;
      } else if (response.status === 401) {
        // Invalid token
        localStorage.removeItem(TOKEN_KEY);
        manageToken = null;
      } else if (response.status === 503) {
        // Service unavailable
        showStatus(
          '⚠️ Serviço temporariamente indisponível. Tente novamente em alguns minutos.',
          'error'
        );
        toggleFieldsDisabled(true);
      }
    } catch (error) {
      console.error('Failed to load RSVP:', error);
      showStatus(
        '⚠️ Erro de conexão. Verifique sua internet e recarregue a página.',
        'error'
      );
    }
  }

  function populateForm(data) {
    nameInput.value = data.guestName;
    nameInput.disabled = true;

    const attendingValue = data.attending ? 'yes' : 'no';
    const attendingRadio = form.querySelector(`input[name="attending"][value="${attendingValue}"]`);
    if (attendingRadio) {
      attendingRadio.checked = true;
    }

    adultsInput.value = data.adultsCount;
    childrenInput.value = data.childrenCount;
    observationsTextarea.value = data.observations || '';
    observationsCount.textContent = observationsTextarea.value.length;

    toggleGuestCountsDisabled(!data.attending);
    consentCheckbox.checked = true;
    consentCheckbox.disabled = true;
  }

  // Edit button handler (currently unused, for future enhancement)
  editBtn.addEventListener('click', () => {
    // Future: could implement a flow to allow name change with verification
    // For MVP, just show that editing is via the form itself
    showStatus(
      'Para alterar sua resposta, modifique os campos abaixo e clique em "Atualizar resposta".',
      'info'
    );
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    hideStatus();

    const attending = form.querySelector('input[name="attending"]:checked');
    if (!attending) {
      showError('rsvp-attending', 'Por favor, selecione uma opção');
      return;
    }

    const payload = {
      guestName: nameInput.value.trim(),
      attending: attending.value === 'yes',
      adultsCount: parseInt(adultsInput.value, 10) || 0,
      childrenCount: parseInt(childrenInput.value, 10) || 0,
      observations: observationsTextarea.value.trim() || null,
      consentGiven: consentCheckbox.checked,
    };

    toggleFieldsDisabled(true);
    submitBtn.textContent = 'Enviando...';

    try {
      const method = isEditMode ? 'PUT' : 'POST';
      const headers = {
        'Content-Type': 'application/json',
      };

      if (isEditMode && manageToken) {
        headers.Authorization = `Bearer ${manageToken}`;
      } else {
        // POST: Generate client-side idempotency key
        const idempotencyKey = crypto.randomUUID();
        headers['Idempotency-Key'] = idempotencyKey;
      }

      const response = await fetch(API_URL, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        // Non-JSON response (e.g., proxy error, 503 HTML)
        if (response.status === 503) {
          showStatus('⚠️ Serviço temporariamente indisponível. Tente novamente em alguns minutos.', 'error');
          return;
        }
        showStatus('Erro inesperado. Tente novamente.', 'error');
        return;
      }

      if (response.ok) {
        if (!isEditMode && data.manageToken) {
          localStorage.setItem(TOKEN_KEY, data.manageToken);
          manageToken = data.manageToken;
        }

        const message = payload.attending
          ? `✅ Obrigado, ${payload.guestName}! Sua presença está confirmada. Aguardamos você no dia 21 de novembro!`
          : `Obrigado por avisar, ${payload.guestName}. Sentiremos sua falta!`;

        showStatus(message, 'success');
        nameInput.disabled = true;
        consentCheckbox.disabled = true;
        submitBtn.textContent = 'Atualizar resposta';
        isEditMode = true;
      } else {
        let errorMessage = data.error || 'Erro ao processar sua resposta.';

        if (data.details) {
          Object.entries(data.details).forEach(([field, msg]) => {
            const fieldMap = {
              guestName: 'rsvp-name',
              adultsCount: 'rsvp-adults',
              childrenCount: 'rsvp-children',
              observations: 'rsvp-observations',
              consentGiven: 'rsvp-consent',
            };
            if (fieldMap[field]) {
              showError(fieldMap[field], msg);
            }
          });
        }

        showStatus(errorMessage, 'error');
      }
    } catch (error) {
      console.error('RSVP submission error:', error);
      showStatus('Erro de conexão. Verifique sua internet e tente novamente.', 'error');
    } finally {
      toggleFieldsDisabled(false);
      submitBtn.textContent = isEditMode ? 'Atualizar resposta' : 'Confirmar presença';
    }
  });

  loadExistingRsvp();
}

function boot() {
  cloneMarquee();
  setupCursor();
  setupMagnetic();
  setupNav();
  setupProgress();
  setupParallax();
  setupManifesto();
  setupHow();
  setupDressRecolor();
  setupGifts();
  setupRsvp();
  setupReveals();
  ScrollTrigger.sort();
  window.addEventListener('load', () => ScrollTrigger.refresh());
  runPreloader();
}

boot();
