import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

$$('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const id = anchor.getAttribute('href');
    if (!id || id === '#') return;
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView({ behavior: 'smooth' });
  });
});

$$('a[data-plan]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const plan = btn.dataset.plan;
    const radio = $(`.waitlist__plans input[value="${plan}"]`);
    if (radio) radio.checked = true;
  });
});

function cloneMarquee() {
  const track = $('.marquee__track');
  if (!track) return;
  track.innerHTML += track.innerHTML;
  $$('span', track).forEach((el, i, all) => {
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
    out.push(`<span class="word${inMark ? ' word--hl' : ''}">${part}</span>`);
  }
  el.innerHTML = out.join('');
  return $$('.word', el);
}

async function runPreloader() {
  const preloader = $('.preloader');
  const bar = $('.preloader__bar span');
  if (!preloader) return;

  if (lenis) lenis.stop();

  const heroImg = $('.hero__bg img');
  const waitImg = heroImg?.complete
    ? Promise.resolve()
    : new Promise((res) => {
        if (!heroImg) return res();
        heroImg.addEventListener('load', res, { once: true });
        heroImg.addEventListener('error', res, { once: true });
      });

  const minTime = new Promise((r) => setTimeout(r, 1300));
  const fonts = document.fonts?.ready ?? Promise.resolve();

  gsap.to(bar, { width: '100%', duration: 1.1, ease: 'power2.inOut' });
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
    duration: 0.9,
    ease: 'power4.inOut',
  })
    .from(
      '.hero__title .line > span',
      { yPercent: 115, rotate: 4, duration: 1.3, stagger: 0.12, ease: 'expo.out' },
      0.35,
    )
    .from('.hero__lead, .hero__ctas, .hero__eyebrow', { y: 30, opacity: 0, duration: 1, stagger: 0.08, ease: 'power3.out' }, 0.55)
    .from('.hero__phone', { y: 220, rotate: 12, opacity: 0, duration: 1.6, ease: 'expo.out' }, 0.5)
    .from('.nav', { y: -40, opacity: 0, duration: 0.8, clearProps: 'transform,opacity' }, 0.8);
}

function initNav() {
  const nav = $('.nav');
  if (!nav) return;
  let last = 0;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle('is-solid', y > 40);
      if (y > 120 && y > last) nav.classList.add('is-hidden');
      else nav.classList.remove('is-hidden');
      last = y;
    },
  });
}

function initProgress() {
  const bar = $('.scroll-progress span');
  if (!bar) return;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      gsap.set(bar, { width: `${self.progress * 100}%` });
    },
  });
}

function initManifesto() {
  const el = $('[data-words]');
  if (!el) return;
  const words = splitWords(el);
  if (reducedMotion) {
    gsap.set(words, { color: '#faf7f2' });
    return;
  }
  gsap.to(words, {
    color: '#faf7f2',
    stagger: 0.08,
    ease: 'none',
    scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 40%', scrub: true },
  });
}

function initCounters() {
  $$('[data-count]').forEach((el) => {
    const obj = { v: +el.dataset.from || 0 };
    const to = +el.dataset.to || 0;
    gsap.to(obj, {
      v: to,
      duration: 1.8,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate: () => {
        el.textContent = Math.round(obj.v);
      },
    });
  });
}

function initHow() {
  const steps = $$('.how__step');
  const frames = $$('.how__frame');
  if (!steps.length) return;
  let i = 0;

  const setStep = (n) => {
    if (n === i) return;
    i = n;
    steps.forEach((s, idx) => s.classList.toggle('is-active', idx === n));
    frames.forEach((f, idx) => f.classList.toggle('is-active', idx === n));
  };

  const mm = gsap.matchMedia();
  mm.add('(min-width: 961px)', () => {
    ScrollTrigger.create({
      trigger: '.how',
      start: 'top top',
      end: `+=${steps.length * 100}%`,
      pin: '.how__pin',
      scrub: true,
      onUpdate: (s) => setStep(Math.min(steps.length - 1, Math.floor(s.progress * steps.length))),
    });
  });

  mm.add('(max-width: 960px)', () => {
    const t = setInterval(() => setStep((i + 1) % steps.length), 2800);
    return () => clearInterval(t);
  });
}

function initTheme() {
  const preview = $('.theme__preview');
  const dots = $$('.theme__dot');
  if (!preview || !dots.length) return;

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      dots.forEach((d) => {
        d.classList.toggle('is-active', d === dot);
        d.setAttribute('aria-pressed', d === dot ? 'true' : 'false');
      });
      preview.dataset.theme = dot.dataset.theme;
    });
  });
}

function initFeatures() {
  const track = $('.features__track');
  const viewport = $('.features__viewport');
  if (!track || !viewport || reducedMotion) return;

  const mm = gsap.matchMedia();
  mm.add('(min-width: 961px)', () => {
    const distance = () => track.scrollWidth - innerWidth;
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: viewport,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    $$('.features__card').forEach((card) => {
      gsap.from(card, {
        scale: 0.96,
        ease: 'none',
        scrollTrigger: {
          trigger: card,
          containerAnimation: tween,
          start: 'left 100%',
          end: 'left 55%',
          scrub: true,
        },
      });
    });
  });
}

function initParallax() {
  if (reducedMotion) return;
  $$('[data-parallax]').forEach((el) => {
    gsap.to(el, {
      yPercent: 18,
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

function initReveals() {
  const els = $$('.reveal, .plan:not(.reveal)');
  if (!els.length) return;
  gsap.set(els, { opacity: 0, y: 50 });
  ScrollTrigger.batch(els, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, stagger: 0.09, ease: 'expo.out' }),
  });
}

function initCursor() {
  const cursor = $('.cursor');
  if (!cursor || !finePointer || reducedMotion) return;
  gsap.set(cursor, { opacity: 1, xPercent: -50, yPercent: -50 });
  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });

  window.addEventListener('mousemove', (e) => {
    xTo(e.clientX);
    yTo(e.clientY);
  });

}

function initMagnetic() {
  if (!finePointer || reducedMotion) return;
  $$('.magnetic').forEach((btn) => {
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.45, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.45, ease: 'elastic.out(1, 0.4)' });
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.35);
      yTo((e.clientY - r.top - r.height / 2) * 0.35);
    });
    btn.addEventListener('mouseleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}

function initPhoneTilt() {
  const phone = $('.hero__phone');
  if (!phone || !finePointer || reducedMotion) return;
  gsap.set(phone, { transformPerspective: 900 });
  const rx = gsap.quickTo(phone, 'rotationX', { duration: 0.8, ease: 'power3' });
  const ry = gsap.quickTo(phone, 'rotationY', { duration: 0.8, ease: 'power3' });
  phone.addEventListener('mousemove', (e) => {
    const r = phone.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rx(py * -12);
    ry(px * 14);
  });
  phone.addEventListener('mouseleave', () => {
    rx(0);
    ry(0);
  });
}

function confetti(originEl) {
  const rect = originEl.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const colors = ['#2f4a40', '#d4846a', '#faf7f2', '#1c1917'];
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.style.background = colors[i % colors.length];
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.borderRadius = i % 3 === 0 ? '50%' : '2px';
    document.body.appendChild(piece);
    const angle = Math.random() * Math.PI * 2;
    const velocity = 180 + Math.random() * 320;
    gsap
      .timeline({ onComplete: () => piece.remove() })
      .to(piece, {
        x: Math.cos(angle) * velocity,
        y: Math.sin(angle) * velocity - 160,
        rotation: Math.random() * 720 - 360,
        duration: 0.9,
        ease: 'power3.out',
      })
      .to(piece, { y: '+=320', opacity: 0, duration: 1.1, ease: 'power1.in' });
  }
}

function initWaitlist() {
  const root = $('.waitlist');
  if (!root) return;
  const form = $('.waitlist__form', root);
  const success = $('.waitlist__success', root);
  const msg = $('.waitlist__msg', root);
  const button = form.querySelector('button[type="submit"]');
  const payBtn = $('[data-pay-plan]', success);
  const payMsg = $('[data-pay-msg]', success);
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  let savedEmail = '';
  let savedPlan = 'plus';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const consent = form.consent.checked;
    const plan = form.querySelector('input[name="plan"]:checked')?.value || 'plus';
    const emailField = form.email.closest('.waitlist__field');
    const nameField = form.name.closest('.waitlist__field');

    emailField.classList.remove('is-error');
    nameField.classList.remove('is-error');
    msg.textContent = '';

    if (!name) {
      nameField.classList.add('is-error');
      msg.textContent = 'Conta pra gente como te chamamos.';
      return;
    }
    if (!EMAIL_RE.test(email)) {
      emailField.classList.add('is-error');
      msg.textContent = 'Digite um e-mail válido.';
      return;
    }
    if (!consent) {
      msg.textContent = 'Marque o consentimento para receber o aviso.';
      return;
    }

    savedEmail = email;
    savedPlan = plan;
    button.disabled = true;
    button.textContent = 'Enviando…';
    await new Promise((r) => setTimeout(r, 700));

    $('[data-success-email]', success).textContent = email;
    confetti(button);
    gsap.to(form, {
      opacity: 0,
      y: -20,
      duration: 0.4,
      onComplete: () => {
        form.hidden = true;
        success.hidden = false;
        gsap.from(success, { opacity: 0, y: 30, duration: 0.6, ease: 'power3.out' });
      },
    });
  });

  payBtn?.addEventListener('click', async () => {
    if (!savedEmail) {
      payMsg.textContent = 'Volte e preencha o formulário antes de pagar.';
      return;
    }
    payBtn.disabled = true;
    payMsg.textContent = 'Abrindo Mercado Pago…';
    try {
      const res = await fetch('/api/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: savedPlan, email: savedEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
      const url = data.initPoint || data.sandboxInitPoint;
      if (!url) throw new Error('Link de pagamento indisponível.');
      location.href = url;
    } catch (err) {
      payMsg.textContent = err.message || 'Erro ao abrir o checkout.';
      payBtn.disabled = false;
    }
  });
}

async function boot() {
  cloneMarquee();
  initNav();
  initProgress();
  initManifesto();
  initCounters();
  initHow();
  initTheme();
  initFeatures();
  initParallax();
  initReveals();
  initCursor();
  initMagnetic();
  initPhoneTilt();
  initWaitlist();

  if (reducedMotion) {
    $('.preloader')?.remove();
  } else {
    await runPreloader();
  }

  ScrollTrigger.sort();
  addEventListener('load', () => ScrollTrigger.refresh());
}

boot();
