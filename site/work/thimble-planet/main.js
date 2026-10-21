/* Thimble Planet: page logic.
   Loader → gate (title behind the planet, thimble ring) → planet. Place labels projected each frame,
   a side panel per place with one playable control bound to the scene, logbook lines over the sea,
   a menu overlay, generated ambient sound, keyboard shortcuts, and the list view fallback. */
const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const reduced = root.classList.contains('reduced');
const noWebGL = root.classList.contains('no-webgl');
const small = () => window.matchMedia('(max-width: 720px)').matches;
const shortLandscape = () => window.matchMedia('(max-height: 540px) and (orientation: landscape)').matches;
const mobile = window.matchMedia('(max-width: 720px), (pointer: coarse)').matches;

const canvas = $('.scene__canvas');
const gate = $('#gate');
const loaderNum = $('.loader__num'), loaderStep = $('.loader__step'), loaderBar = $('.loader__bar i');
const panel = $('#panel'), menu = $('#menu'), announcer = $('#announce');
const menuBtn = $('[data-act="menu"]'), soundBtn = $('[data-act="sound"]');
const spots = new Map($$('.spot').map((el) => [el.dataset.place, el]));
const logEls = $$('.log');

// one source of truth for project copy: the list view articles
const places = $$('.place').map((el, i) => ({
  id: el.dataset.place,
  index: i,
  where: el.querySelector('.place__no').textContent.replace(/^\s*\d+\s*/, '').trim(),
  title: el.querySelector('.place__title').textContent.trim(),
  year: el.querySelector('.place__meta dd').textContent.trim(),
  meta: el.querySelector('.place__meta').innerHTML,
  desc: el.querySelector('.place__desc').textContent.trim(),
}));
const byId = Object.fromEntries(places.map((p) => [p.id, p]));
spots.forEach((el, id) => { const p = byId[id]; el.setAttribute('aria-label', `Visit ${p.where}: ${p.title}, ${p.year}`); });

let world = null;
let booting = null;
let entered = false;
let current = null;
let opener = null;
let menuOpen = false;
let ambience = null;

const say = (text) => { announcer.textContent = ''; setTimeout(() => { announcer.textContent = text; }, 60); };

/* ---------- Modes ---------- */
const setUrl = (url) => { try { history.replaceState(null, '', url); } catch (err) { /* sandboxed or about: documents */ } };

function setMode(mode) {
  root.classList.toggle('mode-3d', mode === '3d');
  root.classList.toggle('mode-list', mode === 'list');
  if (mode === 'list') {
    if (menuOpen) closeMenu(false);
    world && world.stop();
    ambience && ambience.set(false);
    soundBtn.setAttribute('aria-pressed', 'false');
    window.scrollTo(0, 0);
  } else if (world) {
    world.start();
  }
}

function toList() {
  root.classList.add('chose-list');
  setMode('list');
  setUrl('?list');
  $('#book-title').setAttribute('tabindex', '-1');
  $('#book-title').focus({ preventScroll: true });
}

function toPlanet() {
  if (noWebGL) return;
  setUrl(location.pathname);
  root.classList.remove('chose-list');
  if (world) {
    setMode('3d');
    if (!entered) layoutGate();
    (entered ? $('#main') : $('[data-act="enter"]')).focus({ preventScroll: true });
  } else {
    boot3d();
  }
}

if (/[?&]list\b/.test(location.search) && !reduced && !noWebGL) root.classList.add('chose-list');

/* ---------- Loader ---------- */
async function boot3d() {
  if (booting) return booting;
  setMode('3d');
  gate.dataset.state = 'loading';
  let shown = 0, target = 0, timer = 0;
  const paint = () => {
    shown += Math.max(1, (target - shown) * 0.18);
    if (shown > target) shown = target;
    loaderNum.textContent = String(Math.round(shown));
    loaderBar.style.setProperty('--p', (shown / 100).toFixed(3));
    timer = shown < 100 ? setTimeout(paint, 40) : 0;
  };
  const progress = (p, label) => {
    target = Math.max(target, Math.round(p * 100));
    if (label) loaderStep.textContent = label;
    if (!timer) paint();
  };

  booting = (async () => {
    progress(0.03, 'Fetching the toolbox');
    try {
      const fonts = document.fonts
        ? Promise.race([Promise.all([document.fonts.load('400 1em "Playfair Display"'), document.fonts.load('italic 400 1em "Playfair Display"'), document.fonts.ready]), wait(3000)])
        : Promise.resolve();
      const mod = await import('./world.js?v=30');
      progress(0.14);
      world = await mod.createWorld(canvas, { onProgress: (p, l) => progress(0.14 + p * 0.84, l), still: reduced, mobile });
      await fonts;
      progress(1, 'Ready');
    } catch (err) {
      console.warn('Thimble Planet: 3D unavailable, showing the list instead.', err);
      root.classList.add('no-webgl');
      setMode('list');
      return;
    }
    root.classList.toggle('has-post', world.postOn);
    wireWorld();
    layoutGate();
    world.start();
    while (shown < 100) await wait(50);
    await wait(150);
    gate.dataset.state = 'ready';
    loaderStep.textContent = '';
    setTimeout(() => world.rise(), reduced ? 0 : 250);   // sun-up and the title settling, in the scene
  })();
  return booting;
}

/* ---------- Gate ---------- */
// Frame the globe to the empty planet box and draw the title into the scene behind it.
function layoutGate() {
  if (!world || entered) return;
  const slot = $('.gate__planet').getBoundingClientRect();
  world.setGateFrame(slot.left + slot.width / 2, slot.top + slot.height / 2, slot.width / 2);
  if (shortLandscape()) { root.classList.remove('has-scene-title'); world.hideTitle(); return; }
  const t = drawTitle();
  if (t) { world.setTitle(t.canvas, t.rect); root.classList.add('has-scene-title'); }
}

function drawTitle() {
  const el = $('.gate__title');
  const r = el.getBoundingClientRect();
  if (!r.width) return null;
  const pad = 48;   // room for the glow
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = Math.ceil((r.width + pad * 2) * dpr);
  c.height = Math.ceil((r.height + pad * 2) * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.textAlign = 'center';
  for (const span of $$('span', el)) {
    const s = span.getBoundingClientRect(), cs = getComputedStyle(span);
    const size = parseFloat(cs.fontSize);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = ctx.measureText(span.textContent);
    const asc = m.fontBoundingBoxAscent ?? size * 0.9, desc = m.fontBoundingBoxDescent ?? size * 0.25;
    const lh = parseFloat(cs.lineHeight) || s.height;
    const baseline = pad + s.top - r.top + (lh - (asc + desc)) / 2 + asc;
    const g = ctx.createLinearGradient(0, baseline - size * 0.72, 0, baseline);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#E4D8EE');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(255, 226, 204, 0.42)';
    ctx.shadowBlur = 26 * dpr;
    ctx.fillText(span.textContent, pad + s.left - r.left + s.width / 2, baseline);
  }
  return { canvas: c, rect: { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 } };
}

function enter() {
  if (entered || gate.dataset.state !== 'ready') return;
  entered = true;
  gate.dataset.state = 'gone';
  root.classList.add('is-entered');
  setTimeout(() => root.classList.add('hud-on'), reduced ? 0 : 700);
  setTimeout(() => root.classList.add('hint-off'), 12000);
  world.enter();
  world.setInteractive(true);
  $('#main').focus({ preventScroll: true });
  say('You are orbiting Thimble Planet. Five places to visit: use the labels, the menu, or press 1 to 5.');
}

/* ---------- World wiring ---------- */
function wireWorld() {
  world.on('pick', (id) => openPlace(id, spots.get(id)));
  world.on('hover', (id) => spots.forEach((el, k) => el.classList.toggle('is-hover', k === id)));
  world.on('userMove', () => { if (current) closePanel({ fromUser: true }); });
  world.on('log', foundLog);
  world.on('quality', ({ post }) => root.classList.toggle('has-post', post));
  canvas.addEventListener('pointerdown', () => root.classList.add('hint-off'));
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    root.classList.add('no-webgl');
    setMode('list');
  });

  let frame = 0;
  const lat = $('[data-coord="lat"]'), lon = $('[data-coord="lon"]'), light = $('[data-light]');
  world.onFrame(() => {
    if (!entered) return;
    for (const [id, el] of spots) {
      const p = world.project(id);
      const a = p.behind ? 0 : clamp((p.facing - 0.04) / 0.22, 0, 1);
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      // labels near the right edge flip to the left of their dot
      if (!el._w) el._w = el.offsetWidth;
      const flip = p.x + el._w - 22 > window.innerWidth - 8;
      if (flip !== el._flip) { el._flip = flip; el.classList.toggle('is-flip', flip); }
      if (el._a === undefined || Math.abs(a - el._a) > 0.01) {
        el._a = a;
        el.style.setProperty('--a', a.toFixed(2));
        el.classList.toggle('is-away', a < 0.2);
      }
    }
    if (current === 'lighthouse') drawLogs();
    if (current === 'windmill') drawMill();
    if (++frame % 12 === 0) {
      const s = world.subPoint();
      lat.textContent = `${String(Math.round(Math.abs(s.lat))).padStart(2, '0')}° ${s.lat >= 0 ? 'N' : 'S'}`;
      lon.textContent = `${String(Math.round(Math.abs(s.lon))).padStart(3, '0')}° ${s.lon >= 0 ? 'E' : 'W'}`;
      light.textContent = world.lightName();
    }
  });
  buildLampMarks();
}

/* ---------- Play controls ---------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LOGS = logEls.map((el) => el.textContent.trim());
const spoken = (line) => line.replace(/ · /g, ', ');
const ctl = (name) => $(`[data-ctl="${name}"]`);
const out = (name) => $(`[data-out="${name}"]`);

// paint the lit span of a hairline scale, from an origin fraction to the thumb
function paintScale(input, origin = 0) {
  const min = Number(input.min), max = Number(input.max);
  const f = (Number(input.value) - min) / (max - min);
  const scale = input.closest('.scale');
  scale.style.setProperty('--a', Math.min(origin, f).toFixed(4));
  scale.style.setProperty('--b', Math.max(origin, f).toFixed(4));
}

function setMonthUI(m) {
  const input = ctl('month');
  input.value = m;
  input.setAttribute('aria-valuetext', `${MONTHS[m]}, ident ${m + 1} of 12`);
  out('month').textContent = MONTHS[m];
  out('ident').textContent = `Ident ${String(m + 1).padStart(2, '0')} / 12`;
  paintScale(input);
}
ctl('month').addEventListener('input', (e) => { const m = Number(e.target.value); world.setMonth(m); setMonthUI(m); });

let dayDemo = 0;
function setDayUI(d) {
  const input = ctl('day');
  input.value = d;
  input.setAttribute('aria-valuetext', `Day ${d}, ${d} forest${d > 1 ? 's' : ''}`);
  out('day').textContent = `Day ${d}`;
  out('forests').textContent = `${d} forest${d > 1 ? 's' : ''}`;
  paintScale(input);
}
ctl('day').addEventListener('input', (e) => { clearInterval(dayDemo); const d = Number(e.target.value); world.setDay(d); setDayUI(d); });
let grovePlayed = false;
function playGrove() {
  // first visit: the month replays, one forest a day
  if (grovePlayed || reduced) return;
  grovePlayed = true;
  let d = 1;
  world.setDay(1); setDayUI(1);
  dayDemo = setInterval(() => {
    d += 1;
    world.setDay(d); setDayUI(d);
    if (d >= 30) clearInterval(dayDemo);
  }, 85);
}

function setTideUI(v) {
  const input = ctl('tide');
  const m = (v / 10) * 1.2;
  const word = v <= -4 ? 'Low water' : v >= 4 ? 'High water' : 'Mid tide';
  out('tide').textContent = `${m > 0 ? '+' : m < 0 ? '−' : '±'}${Math.abs(m).toFixed(1)} m`;
  out('tideword').textContent = word;
  input.setAttribute('aria-valuetext', `${m >= 0 ? '' : 'minus '}${Math.abs(m).toFixed(1)} metres, ${word.toLowerCase()}`);
  paintScale(input, 0.5);
}
ctl('tide').addEventListener('input', (e) => { const v = Number(e.target.value); world.setTide(v / 10); setTideUI(v); });

const SEAWARD = 245;   // compass bearing the lamp faces when it looks straight out to sea
const compass = (deg) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
function setLampUI(u) {
  const input = ctl('lamp');
  const deg = Math.round((SEAWARD + u + 360) % 360);
  out('bearing').textContent = `${String(deg).padStart(3, '0')}° ${compass(deg)}`;
  input.setAttribute('aria-valuetext', `Bearing ${deg} degrees, ${world ? world.lamp.count() : 0} of 8 log entries found`);
  paintScale(input, 0.5);
}
ctl('lamp').addEventListener('input', (e) => { const u = Number(e.target.value); world.lamp.set(u); setLampUI(u); });

function buildLampMarks() {
  const marks = $('.scale__marks');
  marks.innerHTML = '';
  for (const u of world.lamp.anchors) {
    const i = document.createElement('i');
    i.style.left = `${((u + world.lamp.span) / (world.lamp.span * 2)) * 100}%`;
    marks.appendChild(i);
  }
  // pins of different lengths so neighbouring lines don't sit on one row
  logEls.forEach((el, k) => el.style.setProperty('--pin', `${22 + (k % 3) * 18}px`));
}

function foundLog(k) {
  const n = world.lamp.count();
  $$('.scale__marks i')[k]?.classList.add('is-found');
  out('found').textContent = `${n} / 8 entries`;
  out('log').innerHTML = `<b>${LOGS[k]}</b><br>${n === 8 ? 'The whole logbook, a hundred years of weather.' : `Entry ${n} of 8 from the keeper’s log.`}`;
  say(`Log entry ${n} of 8: ${spoken(LOGS[k])}.`);
  ambience && ambience.chime(k + 2, 0.5);
}

function drawLogs() {
  for (let k = 0; k < logEls.length; k++) {
    const el = logEls[k];
    const p = world.lamp.project(k);
    // the line shows while the beam is on it; a found entry leaves its pin behind
    const vis = p.behind ? 0 : 1;
    el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    el.style.setProperty('--lt', (p.lit * vis).toFixed(2));
    el.style.setProperty('--lp', ((p.found ? 0.55 + 0.45 * p.lit : p.lit) * vis).toFixed(2));
    el.classList.toggle('is-lit', p.lit > 0.5);
  }
}

// windmill: hold to grind (pointer, Space or Enter)
const hold = ctl('grind');
let grinding = false;
function grind(on) {
  if (on === grinding) return;
  grinding = on;
  world.setGrind(on);
  hold.setAttribute('aria-pressed', String(on));
  $('.hold__label', hold).textContent = on ? 'Grinding…' : 'Hold to grind';
}
hold.addEventListener('pointerdown', (e) => { e.preventDefault(); try { hold.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ } grind(true); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => hold.addEventListener(t, () => grind(false)));
hold.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); grind(true); } });
hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); grind(false); } });
hold.addEventListener('blur', () => grind(false));
hold.addEventListener('click', (e) => e.preventDefault());
function drawMill() {
  const s = world.millSpeed();
  out('rpm').textContent = `${Math.round(9 * s)} rpm`;
  out('mill').textContent = grinding ? (s > 3.6 ? 'Stones at full speed' : 'Stones spinning up') : (s > 1.2 ? 'Coasting down' : 'Stones idling');
  hold.style.setProperty('--s', ((s - 1) / 3).toFixed(3));
}

function showPlay(id) {
  $$('.play').forEach((el) => { el.hidden = el.dataset.play !== id; });
  if (id === 'cottage') setMonthUI(world.month);
  if (id === 'lighthouse') setLampUI(Number(ctl('lamp').value));
}

/* ---------- Places and the panel ---------- */
const pad2 = (n) => String(n).padStart(2, '0');

function fillPanel(p) {
  $('.panel__no', panel).textContent = pad2(p.index + 1);
  $('.panel__of', panel).textContent = `/ ${pad2(places.length)}`;
  $('.panel__place', panel).textContent = p.where;
  $('#panel-title').textContent = p.title;
  $('.panel__meta', panel).innerHTML = p.meta;
  $('.panel__desc', panel).textContent = p.desc;
  setAbout(false);
  showPlay(p.id);
}

function setAbout(open) {
  $('.panel__more').setAttribute('aria-expanded', String(open));
  $('.panel__about').classList.toggle('is-open', open);
  placeInset();
}

function placeInset() {
  if (!world) return;
  if (!current || panel.hidden) { world.setInset(0, 0); return; }
  // layout offsets, not getBoundingClientRect: the panel may still be mid-slide
  if (small()) world.setInset(0, Math.min(panel.offsetHeight, window.innerHeight * 0.62) / 2);
  else world.setInset((window.innerWidth - panel.offsetLeft) / 2, 0);
}

let panelTimer = 0;
function openPlace(id, from) {
  const p = byId[id];
  if (!p || !world || !entered) return;
  if (menuOpen) closeMenu(false);
  if (from) opener = from;
  const switching = current && current !== id;
  if (current === id && panel.classList.contains('is-open')) { $('#panel-title').focus({ preventScroll: true }); return; }
  if (current === 'windmill') grind(false);
  current = id;
  root.classList.add('has-place');
  root.classList.toggle('at-lighthouse', id === 'lighthouse');
  spots.forEach((el, k) => el.classList.toggle('is-active', k === id));
  const duration = world.focus(id);
  if (id === 'lighthouse') { const u = world.lamp.take(); ctl('lamp').value = u; }
  ambience && ambience.chime(p.index);
  say(`Travelling to ${p.where}: ${p.title}, ${p.year}. It is ${LIGHT_WORDS[id]} here.`);

  clearTimeout(panelTimer);
  if (switching) panel.classList.remove('is-open');
  const delay = reduced ? 0 : Math.max(switching ? 450 : 0, duration * 1000 * 0.55);
  panelTimer = setTimeout(() => {
    if (current !== id) return;
    fillPanel(p);
    panel.hidden = false;
    placeInset();
    requestAnimationFrame(() => panel.classList.add('is-open'));
    setTimeout(() => panel.classList.add('is-open'), 30);   // rAF can stall when the tab is in the background
    $('#panel-title').focus({ preventScroll: true });
    if (id === 'grove') setTimeout(playGrove, 400);
  }, delay);
}
const LIGHT_WORDS = { cottage: 'dusk', windmill: 'a low gold afternoon', dock: 'the blue hour', lighthouse: 'night', grove: 'a misty dawn' };

function closePanel({ fromUser = false } = {}) {
  if (!current) return;
  const hadFocus = panel.contains(document.activeElement);
  if (current === 'windmill') grind(false);
  clearInterval(dayDemo);
  current = null;
  clearTimeout(panelTimer);
  root.classList.remove('has-place', 'at-lighthouse');
  spots.forEach((el) => el.classList.remove('is-active'));
  panel.classList.remove('is-open');
  setTimeout(() => { if (!current) panel.hidden = true; }, 600);
  world.setInset(0, 0);
  if (!fromUser) world.unfocus();
  if (hadFocus) {
    const back = opener && opener.isConnected && !opener.closest('[hidden]') ? opener : $('#main');
    back.focus({ preventScroll: true });
  }
  say('Back in orbit, at dusk.');
}

function nextPlace() {
  const i = current ? byId[current].index : -1;
  openPlace(places[(i + 1) % places.length].id, null);
}

/* ---------- Menu ---------- */
function setInert(on) {
  for (const el of [$('#hud'), $('#main')]) el.inert = on;
}

function openMenu(focusAbout = false) {
  if (menuOpen || !entered) return;
  if (current === 'windmill') grind(false);
  menuOpen = true;
  menu.hidden = false;
  setTimeout(() => menu.classList.add('is-open'), 20);
  menuBtn.setAttribute('aria-expanded', 'true');
  setInert(true);
  world.setInteractive(false);
  setTimeout(() => { if (menuOpen) world.stop(); }, 420);
  (focusAbout ? $('#about') : $('.menu__places button')).focus({ preventScroll: true });
}

function closeMenu(restore = true) {
  if (!menuOpen) return;
  menuOpen = false;
  menu.classList.remove('is-open');
  menuBtn.setAttribute('aria-expanded', 'false');
  setInert(false);
  if (root.classList.contains('mode-3d')) { world.start(); world.setInteractive(true); }
  setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 400);
  if (restore) menuBtn.focus({ preventScroll: true });
}

/* ---------- Sound: wind, water and a soft drone, all generated ---------- */
class Ambience {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = this.ctx = new AC();
    this.on = false;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = b * 3.5; }
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;

    const lfoGain = (freq, depth, param) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = freq; g.gain.value = depth;
      o.connect(g).connect(param); o.start();
    };
    const wind = ctx.createBiquadFilter(); wind.type = 'lowpass'; wind.frequency.value = 520;
    const windGain = ctx.createGain(); windGain.gain.value = 0.32;
    lfoGain(0.06, 0.18, windGain.gain);
    lfoGain(0.045, 180, wind.frequency);
    const surf = ctx.createBiquadFilter(); surf.type = 'bandpass'; surf.frequency.value = 820; surf.Q.value = 0.7;
    const surfGain = ctx.createGain(); surfGain.gain.value = 0.1;
    lfoGain(0.11, 0.09, surfGain.gain);
    noise.connect(wind).connect(windGain).connect(this.master);
    noise.connect(surf).connect(surfGain).connect(this.master);
    noise.start();

    [110, 164.81, 246.94].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.detune.value = (i - 1) * 5;
      g.gain.value = 0.016;
      o.connect(g).connect(this.master); o.start();
    });
  }
  set(on) {
    this.on = on;
    const t = this.ctx.currentTime;
    if (on && this.ctx.state !== 'running') this.ctx.resume();
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 0.55 : 0, t, on ? 0.6 : 0.25);
    if (!on) setTimeout(() => { if (!this.on) this.ctx.suspend(); }, 1500);
  }
  chime(i, level = 1) {
    if (!this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const f = [523.25, 587.33, 659.25, 783.99, 880, 987.77, 1046.5, 1174.66, 1318.51, 1567.98][i % 10];
    [[f, 0.07], [f * 2.01, 0.025], [f * 1.5, 0.02]].forEach(([freq, amp]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * level, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 2.3);
    });
  }
}

function toggleSound() {
  const on = soundBtn.getAttribute('aria-pressed') !== 'true';
  try {
    if (!ambience) ambience = new Ambience();
    ambience.set(on);
    soundBtn.setAttribute('aria-pressed', String(on));
    say(on ? 'Sound on.' : 'Sound off.');
  } catch (err) {
    console.warn('Thimble Planet: audio unavailable.', err);
  }
}

/* ---------- Controls ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act], .spot, .menu__places button, .panel__more');
  if (!el) return;
  if (el.matches('.spot')) { openPlace(el.dataset.place, el); return; }
  if (el.matches('.menu__places button')) { closeMenu(false); openPlace(el.dataset.place, spots.get(el.dataset.place)); return; }
  if (el.matches('.panel__more')) { setAbout(el.getAttribute('aria-expanded') !== 'true'); return; }
  switch (el.dataset.act) {
    case 'enter': enter(); break;
    case 'list': e.preventDefault(); toList(); break;
    case 'planet': toPlanet(); break;
    case 'menu': menuOpen ? closeMenu() : openMenu(); break;
    case 'menu-close': closeMenu(); break;
    case 'about': openMenu(true); break;
    case 'sound': toggleSound(); break;
    case 'reset': if (current) closePanel({ fromUser: true }); world.reset(); say('View reset.'); break;
    case 'next': nextPlace(); break;
    case 'close': closePanel(); break;
  }
});

// a label on the far side gets keyboard focus: turn the planet so it faces the camera
spots.forEach((el, id) => el.addEventListener('focus', () => { if (world && !current && el._a < 0.5) world.face(id); }));

const OWN_KEYS = /^(Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown| |Enter|\+|=|-|_)$/;
document.addEventListener('keydown', (e) => {
  if (!root.classList.contains('mode-3d') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (!entered) {
    if (k === 'Enter' && gate.dataset.state === 'ready' && !e.target.closest('a, button')) { e.preventDefault(); enter(); }
    return;
  }
  if (menuOpen) {
    if (k === 'Escape' || k === 'm' || k === 'M') { e.preventDefault(); closeMenu(); }
    return;
  }
  // sliders and the grind button keep their own keys
  if (e.target.closest('.scale__input, .hold') && OWN_KEYS.test(k)) return;
  if (k === 'Escape') { if (current) { e.preventDefault(); closePanel(); } return; }
  if (k === 'm' || k === 'M') { e.preventDefault(); openMenu(); return; }
  if (/^[1-5]$/.test(k)) { e.preventDefault(); openPlace(places[Number(k) - 1].id, null); return; }
  if (k === 'r' || k === 'R') { if (current) closePanel({ fromUser: true }); world.reset(); return; }
  const step = 0.2;
  const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (arrows[k]) { e.preventDefault(); root.classList.add('hint-off'); world.orbitBy(...arrows[k]); return; }
  if (k === '+' || k === '=') { e.preventDefault(); world.zoomBy(0.88); return; }
  if (k === '-' || k === '_') { e.preventDefault(); world.zoomBy(1.14); }
});

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    spots.forEach((el) => { el._w = 0; });
    if (world && !entered) layoutGate();
    else placeInset();
  }, 120);
});

/* ---------- Start ---------- */
setDayUI(30); setTideUI(0);
if (root.classList.contains('mode-3d')) boot3d();
