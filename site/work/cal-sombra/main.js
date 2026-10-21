/* Cal & Sombra — Swiss / Minimal concept
   Scroll is the time of day. One handler turns scroll into an hour, the hour into a sun, and the sun into
   every shadow on the page: the study model, the wordmark, the display statements, the readout and the dusk. */
import { HOURS, FROZEN_HOUR, sunAt, typeShadow, clockText } from './sun.js?v=15';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const lowPower = !finePointer || Math.min(screen.width, screen.height) < 700;
const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

const heroEl = $('.hero');
const stage = $('.hero__stage');
const clockEl = $('.clock');
const controls = $('.controls');

/* ---------- the sun, written to CSS ---------- */
let lastMinute = -1, lastShade = '';
function applySun(hour, dusk = 0) {
  const { el, az } = sunAt(hour);
  const s = typeShadow(el, az);
  const blur = Math.min(14, 2 + (s.len - 0.3) * 4.1);
  const key = `${s.c.toFixed(3)}|${s.d.toFixed(3)}|${blur.toFixed(1)}|${dusk.toFixed(3)}`;
  if (key !== lastShade) {
    lastShade = key;
    const st = root.style;
    st.setProperty('--sc', s.c.toFixed(3));
    st.setProperty('--sd', s.d.toFixed(3));
    st.setProperty('--sblur', blur.toFixed(1));
    st.setProperty('--shade-a', (0.05 * (1 - dusk)).toFixed(4));
    st.setProperty('--dial', `${(180 + az).toFixed(1)}deg`);
  }
  const minute = Math.round(hour * 60);
  if (minute !== lastMinute && clockEl) {
    lastMinute = minute;
    clockEl.textContent = `${clockText(hour)} · SUN ${Math.round(el)}°`;
  }
}

/* ---------- dusk: the ground turns from lime white to near black, text stays AA all the way ---------- */
const lum = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const unlum = (L) => { const v = L <= 0.0031308 ? L * 12.92 : 1.055 * Math.pow(L, 1 / 2.4) - 0.055; return Math.round(clamp(v) * 255); };
const grey = (v) => { const h = Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0'); return `#${h}${h}${h}`; };
const mix = (a, b, t) => a + (b - a) * t;
let lastDusk = -1;
function applyDusk(k) {
  if (Math.abs(k - lastDusk) < 0.002 && !(k === 0 && lastDusk !== 0) && !(k === 1 && lastDusk !== 1)) return;
  lastDusk = k;
  const t = smooth(k);
  const b = mix(255, 15, t), L = lum(b);
  const dark = L < 0.18;
  let ink, muted;
  if (!dark) {
    ink = (L + 0.05) / (lum(17) + 0.05) >= 4.6 ? 17 : 0;
    const Lmax = (L + 0.05) / 4.7 - 0.05;          // muted grey keeps 4.7:1
    muted = Math.min(107, unlum(Math.max(0, Lmax)));
  } else {
    ink = (lum(242) + 0.05) / (L + 0.05) >= 4.6 ? 242 : 255;
    const Lmin = 4.7 * (L + 0.05) - 0.05;
    muted = Math.max(154, unlum(Math.min(1, Lmin)));
  }
  const st = root.style;
  st.setProperty('--bg', grey(b));
  st.setProperty('--ink', grey(ink));
  st.setProperty('--muted', grey(muted));
  st.setProperty('--line', grey(mix(213, 51, t)));
  st.setProperty('--surface', grey(mix(244, 26, t)));
  st.setProperty('--surface-2', grey(mix(234, 38, t)));
  st.setProperty('--ctl-bg', dark ? '#ffffff' : '#000000');
  st.setProperty('--ctl-ink', dark ? '#000000' : '#ffffff');
  st.setProperty('--ctl-hover', dark ? '#d9d9d9' : '#2a2a2a');
  root.classList.toggle('on-dark', dark);
}

/* ---------- where each hour sits on the page ---------- */
let anchors = [[0, HOURS.top]], pinEnd = 0, duskFrom = Infinity, duskTo = Infinity;
function measure() {
  const vh = innerHeight, y = scrollY;
  pinEnd = reduceMotion ? 0 : Math.max(1, heroEl.offsetHeight - vh);
  const at = (id) => $(`${id} .label`).getBoundingClientRect().top + y - vh * 0.45;
  const end = Math.max(1, document.documentElement.scrollHeight - vh);
  const list = [[0, HOURS.top], [pinEnd, HOURS.pinEnd], [at('#work'), HOURS.work], [at('#practice'), HOURS.practice],
    [at('#services'), HOURS.services], [at('#people'), HOURS.people], [at('#contact'), HOURS.contact], [end, HOURS.end]];
  for (let i = 1; i < list.length; i++) list[i][0] = Math.max(list[i][0], list[i - 1][0] + 1);
  anchors = list;
  const c = at('#contact');
  duskFrom = c - vh * 0.85;
  duskTo = c - vh * 0.25;
}
function hourAt(y) {
  for (let i = 1; i < anchors.length; i++) {
    const [y1, h1] = anchors[i];
    if (y <= y1) { const [y0, h0] = anchors[i - 1]; return h0 + (h1 - h0) * clamp((y - y0) / (y1 - y0)); }
  }
  return anchors[anchors.length - 1][1];
}

/* ---------- hero: the study model (Three.js), loaded after first paint ---------- */
let hero = null;
async function loadHero() {
  if (reduceMotion) return;
  try {
    const { createHero } = await import('./hero.js?v=17');
    hero = createHero({ canvas: $('.hero__canvas'), overlay: $('.hero__dims'), lowPower, finePointer });
  } catch (err) {
    root.classList.add('no-webgl'); // offline, blocked, or no WebGL: the static plan stays
    return;
  }
  stage.classList.add('is-live');
  new IntersectionObserver(([e]) => hero.setActive(e.isIntersecting)).observe(stage);
  document.addEventListener('visibilitychange', () => hero.setActive(!document.hidden && stage.getBoundingClientRect().bottom > 0));
  update(true);
}

/* ---------- one scroll handler ---------- */
let introHour = null;            // while the sunrise plays, it owns the clock
let ticking = false, lastY = scrollY;
const bleed = $('.bleed__media');
function update(force = false) {
  ticking = false;
  const y = scrollY, vh = innerHeight;
  const p = pinEnd ? clamp(y / pinEnd) : 0;
  const hour = introHour ?? (reduceMotion ? FROZEN_HOUR : hourAt(y));
  const dusk = reduceMotion ? 0 : clamp((y - duskFrom) / (duskTo - duskFrom));
  applyDusk(dusk);
  applySun(hour, dusk);
  if (hero) hero.set(p, hour);

  // controls tuck away while reading down, and come back on the way up or inside the hero
  const dy = y - lastY;
  if (y < pinEnd + 40 || dy < -6 || root.classList.contains('is-locked')) setTucked(false);
  else if (dy > 6) setTucked(true);
  lastY = y;

  if (bleed && !reduceMotion) {
    const r = bleed.getBoundingClientRect();
    if (r.bottom > 0 && r.top < vh) bleed.style.setProperty('--bleed-s', (1.1 - 0.1 * clamp((vh - r.top) / (vh + r.height))).toFixed(4));
  }
}
const requestUpdate = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => update()); } };
addEventListener('scroll', requestUpdate, { passive: true });

let tucked = false;
function setTucked(on) {
  if (on === tucked || reduceMotion && on) return;
  tucked = on;
  controls.classList.toggle('is-tucked', on);
  if (on) setChooser(false);
}
controls.addEventListener('focusin', () => setTucked(false));

let rt;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => { measure(); if (hero) hero.resize(); update(true); }, 120);
});

/* ---------- sunrise intro: 06:00 to 07:00 in 1.8 s ---------- */
function intro() {
  if (!root.classList.contains('is-intro')) { root.classList.add('is-type'); return; }
  scrollTo(0, 0);
  const dawn = $('.dawn'), dclock = $('.dawn__clock');
  introHour = 6;
  const t0 = performance.now();
  const run = (now) => {
    const t = (now - t0) / 1000;
    const k = clamp((t - 0.4) / 1.0);
    introHour = 6 + (1 - Math.pow(1 - k, 3)) * (HOURS.top - 6);
    dclock.textContent = clockText(introHour);
    update(true);
    if (t < 1.4) requestAnimationFrame(run);
    else { introHour = null; update(true); }
  };
  requestAnimationFrame(run);
  setTimeout(() => dawn.classList.add('is-rising'), 400);
  setTimeout(() => root.classList.add('is-type'), 1050);
  setTimeout(() => { introHour = null; root.classList.remove('is-intro'); update(true); }, 1800);
}

/* ---------- count-up figures ---------- */
const fmt = new Intl.NumberFormat('en-GB');
function countUp(el) {
  const end = Number(el.dataset.count);
  if (!end || reduceMotion) return;
  const t0 = performance.now(), dur = 1700;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = fmt.format(Math.round(end * (p === 1 ? 1 : 1 - Math.pow(2, -10 * p))));
    if (p < 1) requestAnimationFrame(step);
  };
  el.textContent = '0';
  requestAnimationFrame(step);
}

/* ---------- scroll reveals ---------- */
function reveals() {
  const targets = $$('[data-reveal], [data-reveal-media]');
  // images behind a closed clip never lazy-load, so fetch them a screen ahead
  const pre = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    $$('img[loading="lazy"]', e.target).forEach((img) => { img.loading = 'eager'; });
    pre.unobserve(e.target);
  }), { rootMargin: '120% 0px' });
  $$('.card').forEach((c) => pre.observe(c));

  if (reduceMotion || !('IntersectionObserver' in window)) { targets.forEach((el) => el.classList.add('is-in')); return; }
  // a fully clipped element never intersects, so masked media are watched through their parent
  const proxy = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = proxy.get(e.target) || e.target;
      el.classList.add('is-in');
      $$('[data-count]', el).forEach(countUp);
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  targets.forEach((el) => {
    if (el.hasAttribute('data-reveal-media')) {
      const watch = el.classList.contains('bleed__media') ? el.parentElement : el.parentElement;
      proxy.set(watch, el); io.observe(watch);
    } else io.observe(el);
  });
}

/* ---------- menu and project chooser ---------- */
const menuBtn = $('.ctl--menu');
const menu = $('#menu');
const ctaBtn = $('.ctl--cta');
const chooser = $('#chooser');
const pageParts = [$('main'), $('footer')];

function setChooser(open) {
  if (!ctaBtn || !chooser) return;
  ctaBtn.setAttribute('aria-expanded', String(open));
  chooser.hidden = !open;
}
function setMenu(open) {
  const isOpen = menuBtn.getAttribute('aria-expanded') === 'true';
  if (open === isOpen) return;
  menuBtn.setAttribute('aria-expanded', String(open));
  $('.sr', menuBtn).textContent = open ? 'Close menu' : 'Menu';
  root.classList.toggle('is-locked', open);
  [...pageParts, $('.ctl--clock'), ctaBtn].forEach((el) => { if (el) el.inert = open; });
  if (open) {
    setTucked(false);
    setChooser(false);
    menu.classList.remove('is-closing');
    menu.hidden = false;
    $('a', menu).focus({ preventScroll: true });
  } else if (reduceMotion) {
    menu.hidden = true;
  } else {
    menu.classList.add('is-closing');
    menu.addEventListener('animationend', () => {
      if (menuBtn.getAttribute('aria-expanded') === 'false') menu.hidden = true;
      menu.classList.remove('is-closing');
    }, { once: true });
  }
}
$$('.menu__nav a', menu).forEach((a, i) => a.style.setProperty('--i', i));
menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
menu.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]')) setMenu(false); });

ctaBtn.addEventListener('click', (e) => { e.stopPropagation(); setChooser(ctaBtn.getAttribute('aria-expanded') !== 'true'); });
chooser.addEventListener('click', (e) => { if (e.target.closest('a')) setChooser(false); });
document.addEventListener('click', (e) => { if (!chooser.hidden && !chooser.contains(e.target)) setChooser(false); });
chooser.addEventListener('focusout', (e) => {
  if (!chooser.hidden && e.relatedTarget && !chooser.contains(e.relatedTarget) && e.relatedTarget !== ctaBtn) setChooser(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
  else if (!chooser.hidden) { setChooser(false); ctaBtn.focus(); }
});

/* ---------- people: drag-to-scroll track ---------- */
function peopleTrack() {
  const track = $('.track');
  if (!track) return;
  const section = track.closest('.people');
  const items = $$('.person', track);
  const bar = $('.track__progress span', section);
  const now = $('.people__now', section);
  const [prev, next] = $$('.sq', section);
  const cursor = $('.cursor', section);
  const stepSize = () => items[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track.firstElementChild).columnGap || 0);
  const max = () => track.scrollWidth - track.clientWidth;

  const sync = () => {
    const m = max();
    const p = m > 0 ? track.scrollLeft / m : 1;
    const vis = track.clientWidth / track.scrollWidth;
    bar.style.transform = `scaleX(${vis + p * (1 - vis)})`;
    const tr = track.getBoundingClientRect();
    let first = 0, last = 0;
    items.forEach((it, i) => {
      const r = it.getBoundingClientRect();
      if (r.right <= tr.left + 8) first = i + 1;
      if (r.left < tr.right - 8) last = i;
    });
    const pad = (n) => String(n + 1).padStart(2, '0');
    now.textContent = `${pad(first)}–${pad(last)}`;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= m - 2;
  };
  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  addEventListener('resize', sync);
  sync();

  const go = (dir) => track.scrollBy({ left: dir * stepSize(), behavior: reduceMotion ? 'auto' : 'smooth' });
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  track.addEventListener('keydown', (e) => {
    if (e.target !== track) return;
    const to = (left) => track.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'Home') { e.preventDefault(); to(0); }
    else if (e.key === 'End') { e.preventDefault(); to(max()); }
  });

  // mouse drag with a little inertia (touch and pens use native scrolling)
  let down = false, moved = 0, startX = 0, startLeft = 0, lastX = 0, lastT = 0, v = 0, glide = 0;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    cancelAnimationFrame(glide);
    down = true; moved = 0;
    startX = lastX = e.clientX; startLeft = track.scrollLeft; lastT = performance.now(); v = 0;
  });
  addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 4) {
      try { track.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
      track.classList.add('is-dragging');
    }
    moved = Math.max(moved, Math.abs(dx));
    track.scrollLeft = startLeft - dx;
    const t = performance.now();
    v = (e.clientX - lastX) / Math.max(1, t - lastT);
    lastX = e.clientX; lastT = t;
  });
  const release = () => {
    if (!down) return;
    down = false;
    track.classList.remove('is-dragging');
    if (reduceMotion || Math.abs(v) < 0.05) return;
    let vel = clamp(v * 16, -48, 48), prevT = performance.now();
    const coast = (t) => {
      const dt = Math.min(48, t - prevT) / 16; prevT = t;
      track.scrollLeft -= vel * dt;
      vel *= Math.pow(0.93, dt);
      if (Math.abs(vel) > 0.3) glide = requestAnimationFrame(coast);
    };
    glide = requestAnimationFrame(coast);
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  track.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
  track.addEventListener('dragstart', (e) => e.preventDefault());

  // contextual "Drag" cursor
  if (finePointer && cursor) {
    let cr = 0, mx = 0, my = 0;
    const place = () => { cursor.style.transform = `translate3d(${mx}px, ${my}px, 0)`; cr = 0; };
    track.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY; place();
      cursor.classList.add('is-visible');
      section.classList.add('has-cursor');
    });
    track.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; if (!cr) cr = requestAnimationFrame(place); });
    track.addEventListener('pointerleave', () => { cursor.classList.remove('is-visible'); section.classList.remove('has-cursor'); });
  }
}

/* ---------- boot ---------- */
if (!reduceMotion) root.classList.add('has-dusk');
measure();
update(true);
reveals();
peopleTrack();
intro();
loadHero();
(document.fonts?.ready ?? Promise.resolve()).then(() => { measure(); update(true); });
addEventListener('load', () => { measure(); update(true); });
