/* 10,935 m — scroll → depth, staged intro, plunge, HUD gauge, depth scrubber, landmarks, crack, index overlay.
   Native scroll is the only input: it maps to a depth, and the depth drives the gauge, the water colour
   and (when WebGL and motion are available) the camera in scene.js. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const forcedStatic = new URLSearchParams(location.search).get('3d') === 'off';
const mobileScene = window.matchMedia('(max-width: 899px), (pointer: coarse)').matches;

/* ---------- Facts the HUD reads from ---------- */
const SURFACE = { name: 'At the surface', sci: 'Western Pacific', temp: '≈ 27–29 °C', range: '' };
const ZONES = [
  { from: 0, name: 'Sunlight zone', sci: 'Epipelagic', temp: '≈ 20–29 °C', range: '0 to 200 metres' },
  { from: 200, name: 'Twilight zone', sci: 'Mesopelagic', temp: '≈ 4–20 °C', range: '200 to 1,000 metres' },
  { from: 1000, name: 'Midnight zone', sci: 'Bathypelagic', temp: '≈ 2–4 °C', range: '1,000 to 4,000 metres' },
  { from: 4000, name: 'Abyss', sci: 'Abyssopelagic', temp: '≈ 1–3 °C', range: '4,000 to 6,000 metres' },
  { from: 6000, name: 'Hadal zone', sci: 'Hadopelagic', temp: '≈ 1–4 °C', range: '6,000 metres to the bottom' },
];
const BOTTOM = 10935;
const CRACK_AT = 9000;
// Water colour by depth. The CSS backdrop and the WebGL fog share it (the canvas fades to transparent).
const WATER = [[0, '#0a4258'], [200, '#072c42'], [600, '#05182c'], [1000, '#031020'], [2500, '#020a15'],
  [4000, '#01060d'], [6000, '#010308'], [9000, '#000104'], [BOTTOM, '#000000']].map(([d, h]) => [d, hexRgb(h)]);
// Scene units per pixel of scroll: snow, landmarks and trench walls all move past at this rate. Landmark spans
// are 4.545 px per metre (CSS), so at 10 m per unit an object drifts by at the same rate the gauge counts.
// Phones use shorter spans (2.6 px per metre) and a matching faster rate.
let UNITS_PER_PX = 0.022;

const nf = new Intl.NumberFormat('en-US');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeIn = (t) => Math.pow(clamp(t), 3);
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function waterAt(d) {
  for (let i = 1; i < WATER.length; i++) {
    if (d <= WATER[i][0]) {
      const [d0, c0] = WATER[i - 1], [d1, c1] = WATER[i];
      const t = clamp((d - d0) / (d1 - d0));
      return c0.map((c, k) => Math.round(lerp(c, c1[k], t)));
    }
  }
  return WATER[WATER.length - 1][1];
}
const zoneAt = (d) => ZONES.reduce((z, cur) => (d >= cur.from ? cur : z), ZONES[0]);
// 1 atm plus the weight of the water above (seawater ≈ 1,030 kg/m³). Approximate, and labelled as such.
function pressure(d) { const bar = 1.01325 + (1030 * 9.80665 * d) / 1e5; return { atm: bar / 1.01325, psi: bar * 14.5038 }; }
// one bar segment per tenfold loss of light in clear ocean water; sunlight is gone by about 1,000 m
function sunlight(d, above) {
  if (above) return { pct: 100, label: 'full' };
  const pct = clamp(1 - d / 1000) * 100;
  const label = d < 50 ? 'bright' : d < 200 ? 'fading' : d < 1000 ? 'faint' : 'none';
  return { pct, label };
}

/* ---------- Elements ---------- */
const scrubber = $('.scrubber');
const marker = $('.scrubber__marker');
const backdrop = $('.backdrop');
const canvas = $('.scene');
const wordEl = $('.title__word');
const reveals = $$('.card, .feature, .bignum, .landmark');
const tags = Object.fromEntries($$('.landmark').map((el) => [el.dataset.lm, $('.lm-tag', el)]));
const hud = {};
$$('[data-hud]').forEach((el) => { hud[el.dataset.hud] = el; });
const lastText = {};
const setText = (key, value) => {
  if (lastText[key] === value || !hud[key]) return;
  lastText[key] = value;
  hud[key].textContent = value;
};

/* ---------- Layout measurements ---------- */
let vh = window.innerHeight;
let anchors = [];
let readFrom = Infinity;   // past this line the HUD powers down so the closing text has the screen
let footerAt = Infinity;   // once the opaque footer fills the viewport, the scene stops drawing
let ticks = [];
let horizonFrac = 0.6;
let fov = 50;
const lines = {};          // doc y (centre) of each landmark

// layout position, ignoring the reveal transforms
function docTop(el) {
  let y = 0;
  for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
  return y;
}

function measure() {
  vh = window.innerHeight;
  UNITS_PER_PX = window.innerWidth < 900 ? 0.022 * 4.545 / 2.6 : 0.022;
  const portraitPhone = window.innerWidth < 900 && window.innerWidth < window.innerHeight;
  horizonFrac = portraitPhone ? 0.5 : 0.6;
  fov = window.innerWidth / vh < 0.8 ? 64 : 50;
  root.style.setProperty('--horizon', `${Math.round(horizonFrac * vh)}px`);

  anchors = [];
  $$('[data-depth], [data-span]').forEach((el) => {
    const top = docTop(el);
    if (el.dataset.span) {
      const [a, b] = el.dataset.span.split(',').map(Number);
      anchors.push({ y: top, depth: a }, { y: top + el.offsetHeight, depth: b });
    } else anchors.push({ y: top + el.offsetHeight / 2, depth: Number(el.dataset.depth) });
  });
  anchors.sort((p, q) => p.y - q.y);
  $$('.landmark').forEach((el) => { lines[el.dataset.lm] = docTop(el) + el.offsetHeight / 2; });
  readFrom = docTop($('.bottom__grid'));
  footerAt = docTop($('.footer'));
  const sr = scrubber.getBoundingClientRect();
  ticks = $$('li', scrubber).map((li) => ({ depth: Number(li.dataset.at), y: li.getBoundingClientRect().top - sr.top, link: $('a', li) }));
  layoutWord();
}

// depth at a scroll position: piecewise linear between anchors met at the viewport's centre line
function depthAt(y) {
  const line = y + vh * 0.5;
  if (!anchors.length || line <= anchors[0].y) return 0;
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1], b = anchors[i];
    if (line < b.y) return a.depth + (b.depth - a.depth) * ((line - a.y) / (b.y - a.y));
  }
  return anchors[anchors.length - 1].depth;
}
// how far past the landing (0 when "10,935 m" sits at the centre line)
const beyondAt = (y) => (anchors.length ? clamp((y + vh * 0.5 - anchors[anchors.length - 1].y) / (vh * 0.9)) : 0);

/* ---------- The word: laid out once in px so the DOM poster, the WebGL letters and the kicker agree ---------- */
let wordLayout = null;
function layoutWord() {
  const cs = getComputedStyle(wordEl);
  const size = parseFloat(cs.fontSize);
  if (!size) return;
  const font = `800 ${size}px Jost, "Futura PT", Futura, "Century Gothic", sans-serif`;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = font;
  const ls = -0.01 * size;
  const chars = ['D', 'E', 'E', 'P'];
  const adv = chars.map((c) => ctx.measureText(c).width + ls);
  const width = adv.reduce((a, b) => a + b, 0) - ls;
  const m = ctx.measureText('DEEP');
  const horizon = Math.round(horizonFrac * vh);
  const baseline = horizon - Math.max(2, size * 0.012);
  const left = (window.innerWidth - width) / 2;
  let x = left;
  const letters = chars.map((ch, i) => { const l = { ch, x, right: x + adv[i] - (i < 3 ? ls : 0) }; x += adv[i]; return l; });
  const capTop = baseline - m.actualBoundingBoxAscent;
  wordLayout = { font, size, letters, baseline, capTop, left, width };
  // the DOM word (poster, no-WebGL) sits on the same baseline; line-height is 1, so offset by the half-leading
  const fA = m.fontBoundingBoxAscent || size * 0.95, fD = m.fontBoundingBoxDescent || size * 0.3;
  root.style.setProperty('--word-top', `${(baseline - ((size - (fA + fD)) / 2 + fA)).toFixed(1)}px`);
  root.style.setProperty('--word-left', `${left.toFixed(1)}px`);
  root.style.setProperty('--cap-top', `${capTop.toFixed(1)}px`);
  if (scene) scene.setWord(wordLayout);
}

/* ---------- The plunge: camera heights, waterline and pitch from the scroll position ---------- */
// lower toward the sea · waterline rises to the horizon · hold · up and out through the top (about 0.84 vh)
const P = { lower: 0.28, rise: 0.55, hold: 0.77, exit: 1.12, burst: 0.88 };
function camAt(y) {
  const s = y / vh;
  const H = horizonFrac * vh;
  let hA = lerp(1.6, 0.5, smooth(0, P.lower, s));
  hA = lerp(hA, 0.03, smooth(P.lower, P.rise, s));
  let wlY;
  if (s < P.lower) wlY = vh * 1.06;
  else if (s < P.rise) wlY = lerp(vh * 1.06, H, easeOut((s - P.lower) / (P.rise - P.lower)));
  else if (s < P.hold) wlY = H - Math.sin(((s - P.rise) / (P.hold - P.rise)) * Math.PI) * 0.015 * vh;
  else wlY = lerp(H, -0.07 * vh, easeIn((s - P.hold) / (P.exit - P.hold)) * 0.55 + smooth(P.hold, P.exit, s) * 0.45);
  const w = clamp((vh - wlY) / vh);
  const hB = lerp(-0.35, -1.6, smooth(P.hold, P.exit, s));
  const camY = s < P.exit ? hB : -1.6 - Math.min((s - P.exit) * 55, 90);
  const p0 = Math.atan((2 * horizonFrac - 1) * Math.tan((fov * Math.PI) / 360));
  let pitch = p0;
  if (s > 0.9) pitch = lerp(p0, 0.5, smooth(0.9, 1.4, s));
  if (s > 1.4) pitch = lerp(0.5, 0, smooth(1.4, 2.2, s));
  return { s, hA, hB, camY, wlY, w, pitch, horizon: H, above: s < P.hold };
}

/* ---------- Intro: the sea arrives before the type ---------- */
// sky glow 0.2 s · water 0.35 s · glitter 0.6 s · letters rise from 1.0 s (60 ms apart) · type 1.5 s ·
// frame 1.6 s · gauge zeroes 1.8–2.4 s. Scrolling, a key or a tap skips straight to the end.
const T0 = performance.now();
let readyAt = null;          // seconds after T0 when the scene drew its first frame
let introSkipped = reduceMotion;
let posterWait = false;
const introSteps = [['in-sky', 0.2, false], ['in-water', 0.6, true], ['in-letters', 1.0, true], ['in-type', 1.5, true], ['in-frame', 1.6, true], ['in-gauge', 1.8, true]];
const want3DEarly = !reduceMotion && !forcedStatic;
function introClock() {
  if (introSkipped) return 99;
  const t = (performance.now() - T0) / 1000;
  if (!want3DEarly || !root.classList.contains('is-3d') || posterWait) return t;
  if (readyAt === null) return Math.min(t, 0.6);   // hold the sea until the scene can draw it
  return t - Math.max(0, readyAt - 0.6);
}
function introTick() {
  const t = (performance.now() - T0) / 1000;
  const ts = introClock();
  let pending = false;
  for (const [cls, at, gated] of introSteps) {
    const now = gated ? ts : (introSkipped ? 99 : t);
    if (now >= at) root.classList.add(cls); else pending = true;
  }
  // if the scene is slow to arrive, show the poster sea and letters instead of a black screen
  if (!posterWait && root.classList.contains('is-3d') && readyAt === null && t > 2.2) {
    posterWait = true;
    root.classList.add('poster-wait');
  }
  if (!sceneLive && typeof staticUpdate === 'function') staticUpdate();   // keeps the zeroing gauge ticking without a scene
  if (pending || ts < 2.5) setTimeout(introTick, 40);
  else root.classList.add('intro-done');
}
function skipIntro() {
  if (introSkipped) return;
  introSkipped = true;
  introTick();
}
['wheel', 'touchmove', 'keydown', 'pointerdown'].forEach((ev) => window.addEventListener(ev, skipIntro, { passive: true, once: true }));
function introState() {
  const ts = introClock();
  return {
    water: smooth(0.35, 1.1, ts),
    glitter: smooth(0.6, 1.4, ts),
    rise: [0, 1, 2, 3].map((i) => 1 - easeOut((ts - 1.0 - i * 0.06) / 0.7)),
  };
}

/* ---------- HUD ---------- */
let liveTimer = 0;
let lastZone = '';
let userScrolled = false;
let atSurface = null;
let atBottom = null;

function renderHud(depth, above, s) {
  const surf = s < 0.95;   // the rail boots once the lens is under
  if (surf !== atSurface) { atSurface = surf; root.classList.toggle('at-surface', surf); }
  const done = window.scrollY + vh * 0.94 > readFrom;
  if (done !== atBottom) { atBottom = done; root.classList.toggle('at-bottom', done); }
  const z = above ? SURFACE : zoneAt(depth);
  setText('zone', z.name);
  setText('sci', z.sci);
  setText('temp', z.temp);
  let m = above ? 0 : Math.round(depth);
  // during the intro the gauge zeroes itself, counting down from the bottom
  const ts = introClock();
  const shown = above && ts < 2.4 ? Math.round(BOTTOM * (1 - easeOut((ts - 1.8) / 0.6))) : m;
  setText('m', nf.format(shown));
  setText('tick', `${nf.format(above ? shown : 0)} m`);
  setText('ft', nf.format(Math.round(shown * 3.28084)));
  if (m < 1) { setText('atm', '1 atm'); setText('psi', '14.7 psi'); }
  else {
    const p = pressure(m);
    setText('atm', `≈ ${nf.format(Math.round(p.atm))} atm`);
    setText('psi', `${nf.format(Math.round(p.psi / 10) * 10)} psi`);
  }
  const light = sunlight(m, above);
  setText('light-label', light.label);
  const pct = `${light.pct.toFixed(1)}%`;
  if (lastText.lightPct !== pct) { lastText.lightPct = pct; hud.light.style.setProperty('--light', pct); }

  // scrubber marker: interpolate between tick positions by depth
  let my = ticks.length ? ticks[0].y : 0;
  let active = -1;
  if (!above) {
    for (let i = 0; i < ticks.length; i++) {
      if (m >= ticks[i].depth - 1) active = i;
      const next = ticks[i + 1];
      if (next && m >= ticks[i].depth && m < next.depth) my = lerp(ticks[i].y, next.y, (m - ticks[i].depth) / (next.depth - ticks[i].depth));
      else if (!next && m >= ticks[i].depth) my = ticks[i].y;
    }
  }
  const mark = `${my.toFixed(1)}px`;
  if (lastText.mark !== mark) { lastText.mark = mark; marker.style.setProperty('--mark', mark); }
  if (lastText.active !== active) {
    lastText.active = active;
    ticks.forEach((t, i) => (i === active ? t.link.setAttribute('aria-current', 'location') : t.link.removeAttribute('aria-current')));
  }

  // announce zone changes politely, once the reader has settled
  if (z.name !== lastZone) {
    lastZone = z.name;
    clearTimeout(liveTimer);
    if (userScrolled) liveTimer = setTimeout(() => { hud.live.textContent = z.range ? `${z.name}, ${z.range}.` : 'At the surface.'; }, 900);
  }
}

function renderBackdrop(depth, cam) {
  if (!root.classList.contains('is-3d')) return;
  const under = cam.w >= 1;
  const vars = {
    '--bg': under ? `rgb(${waterAt(depth).join(',')})` : '#000',
    '--sky': under ? '0' : '1',
    '--rays': under ? (1 - smooth(20, 260, depth)).toFixed(3) : '0',
  };
  for (const k in vars) if (lastText[k] !== vars[k]) { lastText[k] = vars[k]; backdrop.style.setProperty(k, vars[k]); }
}

/* ---------- The crack: Trieste's window, "somewhere past 9,000 metres" ---------- */
// One impact with radial cracks, then four more branches that grow with depth. Cleared at the seabed.
const crackSvg = $('.crack');
const BRANCHES = [9350, 9750, 10150, 10550];
function buildCrack() {
  const W = window.innerWidth, H = window.innerHeight;
  const r = (() => { let a = 9000; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const S = Math.min(W, H * 1.6);
  const walk = (x, y, ang, len, seg) => {
    const pts = [[x, y]];
    let a = ang, d = 0;
    while (d < len) {
      const l = seg * (0.6 + r() * 0.9);
      a += (r() - 0.5) * 0.55;
      x += Math.cos(a) * l; y += Math.sin(a) * l; d += l;
      pts.push([x, y]);
    }
    return pts;
  };
  const toD = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');
  // phones: low in the frame, where the scene shows below the cards; elsewhere high on the right
  const phone = W < 600;
  const P0 = phone ? [W * 0.8, H * 0.64] : [W * 0.86, H * 0.15];
  // the main run heads left and a little down across about 60% of the width
  const main = walk(P0[0], P0[1], Math.PI * (phone ? 0.97 : 1.05), W * 0.6, S * (phone ? 0.07 : 0.04));
  const rays = [main];
  [[-0.35, 0.16], [0.42, 0.22], [1.2, 0.12], [1.75, 0.2], [2.5, 0.1], [-1.2, 0.09]].forEach(([ang, l]) => rays.push(walk(P0[0], P0[1], ang + Math.PI * (r() * 0.1), S * l, S * 0.03)));
  // concentric arcs around the impact
  const arc = (rad, a0, a1) => { const pts = []; for (let a = a0; a <= a1; a += 0.12) pts.push([P0[0] + Math.cos(a) * rad * (0.92 + r() * 0.16), P0[1] + Math.sin(a) * rad * (0.92 + r() * 0.16)]); return pts; };
  const arcs = [arc(S * 0.035, 1.9, 3.9), arc(S * 0.08, -0.4, 1.4), arc(S * 0.09, 2.6, 3.6)];
  // depth-keyed branches leave the main run at points along it
  const branches = BRANCHES.map((at, i) => {
    const from = main[Math.min(main.length - 2, 2 + Math.round((i + 0.6) * (main.length - 4) / BRANCHES.length))];
    const sub = walk(from[0], from[1], Math.PI * (i % 2 ? 0.62 : 1.38) + (r() - 0.5) * 0.4, S * (0.12 + r() * 0.1), S * 0.028);
    const twig = walk(sub[Math.floor(sub.length / 2)][0], sub[Math.floor(sub.length / 2)][1], Math.PI * (0.5 + r()), S * 0.05, S * 0.02);
    return { at, paths: [sub, twig] };
  });
  const group = (at, paths) => `<g data-at="${at}">${paths.map((p) => `<path class="crack__s" pathLength="1" d="${toD(p)}"/><path class="crack__l" pathLength="1" d="${toD(p)}"/>`).join('')}</g>`;
  crackSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  crackSvg.innerHTML = group(CRACK_AT, [...rays, ...arcs]) + branches.map((b) => group(b.at, b.paths)).join('');
  crackGroups = $$('g', crackSvg).map((g) => ({ g, at: Number(g.dataset.at) }));
  crackGroups.forEach((c) => c.g.classList.toggle('is-on', crackDepth >= c.at && !crackCleared));
}
let crackGroups = [];
let crackDepth = 0;
let crackCleared = false;
let crackHitAt = -10;
let crackArmed = true;
let crackTimers = [];
function renderCrack(depth, now) {
  crackDepth = depth;
  const landed = depth >= BOTTOM - 2;
  if (landed !== crackCleared) { crackCleared = landed; root.classList.toggle('crack-clear', landed); }
  for (const c of crackGroups) {
    const on = depth >= c.at && !landed;
    if (on !== c.g.classList.contains('is-on')) c.g.classList.toggle('is-on', on);
  }
  root.classList.toggle('is-cracked', depth >= CRACK_AT && !landed);
  // the moment of impact, once per descent past 9,000 m
  if (depth >= CRACK_AT && crackArmed && !landed) {
    crackArmed = false;
    crackHitAt = now;
    crackTimers.forEach(clearTimeout);
    root.classList.add('crack-hit', 'is-shake');
    crackTimers = [setTimeout(() => root.classList.remove('is-shake'), 220), setTimeout(() => root.classList.remove('crack-hit'), 260)];
  }
  if (depth < CRACK_AT - 150) crackArmed = true;
}

/* ---------- Landmarks: DOM labels pinned to points in the scene ---------- */
const tagState = {};
function placeTags(proj, vis) {
  const vw = window.innerWidth;
  for (const key in tags) {
    const tag = tags[key];
    const p = proj[key];
    const o = p && p.ok ? vis[key] || 0 : 0;
    const st = tagState[key] || (tagState[key] = {});
    if (o > 0.01) {
      // the note goes to the right of its point, else to the left, else centred above it, always on screen
      const box = st.box || (st.box = $('.lm-tag__text', tag));
      const w = st.w || (st.w = box.offsetWidth || 300);
      const side = p.x + 60 + w < vw - 12 ? 'r' : p.x - 60 - w > 12 ? 'l' : 'c';
      const tf = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      if (st.tf !== tf) { st.tf = tf; tag.style.transform = tf; }
      if (st.side !== side) { st.side = side; tag.classList.toggle('is-flip', side === 'l'); tag.classList.toggle('is-center', side === 'c'); }
      if (side === 'c') {
        const bx = `${(clamp(p.x - w / 2, 12, vw - w - 12) - p.x).toFixed(1)}px`;
        if (st.bx !== bx) { st.bx = bx; tag.style.setProperty('--bx', bx); }
      }
    }
    const op = o.toFixed(2);
    if (st.op !== op) { st.op = op; tag.style.opacity = op; tag.classList.toggle('is-shown', o > 0.01); }
  }
}

/* ---------- Native-scroll work: reveals (all modes), and the whole HUD when there is no scene ---------- */
let sceneLive = false;
let ticking = false;

function revealAll() {
  for (const el of reveals) {
    if (el.classList.contains('is-in')) continue;
    if (el.getBoundingClientRect().top < vh * 0.9) el.classList.add('is-in');
  }
}

function staticUpdate() {
  const y = window.scrollY;
  const cam = camAt(y);
  const above = y + vh * 0.5 < (anchors[0] ? anchors[0].y : vh);
  const depth = depthAt(y);
  renderHud(depth, above, cam.s);
  renderBackdrop(depth, cam);
}

function onScroll() {
  if (window.scrollY > 4) { userScrolled = true; skipIntro(); }
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    revealAll();
    if (!sceneLive) staticUpdate();
  });
}
window.addEventListener('scroll', onScroll, { passive: true });

/* ---------- Scene (WebGL) ---------- */
let smoothY = window.scrollY;
let prevSmooth = smoothY;
let prevS = smoothY / vh;
let yaw = 0, pitchOff = 0, yawT = 0, pitchT = 0;
let scene = null;
let snowTravel = 0;
let lastFrame = performance.now();

if (finePointer) {
  window.addEventListener('pointermove', (e) => {
    yawT = (e.clientX / window.innerWidth - 0.5) * -0.07;
    pitchT = (e.clientY / vh - 0.5) * -0.04;
  }, { passive: true });
}

// rings on the water: pointer move drops small ones, a tap drops a big one
let lastRipple = { t: 0, x: -999, y: -999 };
function maybeRipple(e, tap) {
  if (!scene || !sceneLive || window.scrollY > vh * 0.25) return;
  if (e.target.closest && e.target.closest('a, button')) return;
  if (e.clientY < horizonFrac * vh + 4) return;
  const now = performance.now();
  if (!tap && (now - lastRipple.t < 90 || Math.hypot(e.clientX - lastRipple.x, e.clientY - lastRipple.y) < 26)) return;
  lastRipple = { t: now, x: e.clientX, y: e.clientY };
  scene.ripple(e.clientX, e.clientY, tap ? 1.3 : 0.55);
}
window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') maybeRipple(e, false); }, { passive: true });
window.addEventListener('pointerdown', (e) => maybeRipple(e, true), { passive: true });

// called by the scene once per frame; returns everything it needs
function frameState(dt) {
  if (window.scrollY >= footerAt) { smoothY = prevSmooth = window.scrollY; return null; }
  const now = performance.now();
  lastFrame = now;
  smoothY = damp(smoothY, window.scrollY, 5, dt);
  if (Math.abs(smoothY - window.scrollY) < 0.05) smoothY = window.scrollY;
  const vel = dt > 0 ? (smoothY - prevSmooth) / dt : 0;
  prevSmooth = smoothY;

  const cam = camAt(smoothY);
  const depth = cam.above ? 0 : depthAt(smoothY);
  const beyond = beyondAt(smoothY);
  const landing = smooth(BOTTOM - 900, BOTTOM, depth);
  const stopY = anchors.length ? anchors[anchors.length - 1].y - vh * 0.5 : Infinity;
  const line = smoothY + vh * 0.5;

  // bubbles and an exposure dip as the lens goes under (only on the way down)
  const burst = prevS < P.burst && cam.s >= P.burst && cam.s < P.exit + 0.3;
  if (burst) { root.classList.remove('is-dip'); void root.offsetWidth; root.classList.add('is-dip'); }
  prevS = cam.s;

  yaw = damp(yaw, yawT, 3, dt);
  pitchOff = damp(pitchOff, pitchT, 3, dt);

  renderHud(depth, cam.above, window.scrollY / vh);
  renderBackdrop(depth, cam);
  renderCrack(depth, now);
  const out = smooth(0.03, 0.3, cam.s).toFixed(3);
  if (lastText.heroOut !== out) { lastText.heroOut = out; root.style.setProperty('--hero-out', out); }

  // the crack: the lamp dips by 60% for 300 ms and the snow stalls for a moment
  const sinceHit = (now - crackHitAt) / 1000;
  const lampDip = sinceHit < 0.3 ? 0.4 : 1;
  const travel = Math.min(smoothY, stopY) * UNITS_PER_PX;
  if (sinceHit > 0.45) snowTravel = Math.abs(snowTravel - travel) < 0.01 ? travel : damp(snowTravel, travel, sinceHit < 1.2 ? 6 : 30, dt);

  // things you pass: positions from the scroll line, so they drift by at the same rate as the snow
  const rel = (key) => (lines[key] !== undefined ? (line - lines[key]) * UNITS_PER_PX : 999);
  const dslY = rel('dsl'), shipY = rel('titanic');
  const obj = {
    dsl: dslY, dslOn: 1 - smooth(16, 28, Math.abs(dslY)),
    ship: shipY, shipOn: 1 - smooth(15, 24, Math.abs(shipY)), shipX: -2.5 + clamp(shipY / 14, -1, 1) * -3,
    wallHalf: lerp(24, 6.5, smooth(4500, 10500, depth)),
    wallOn: smooth(4500, 6000, depth) * (1 - smooth(10500, 10900, depth)),
  };
  const lamp = smooth(250, 1300, depth) * lampDip;
  scene.labelVis = {
    dsl: obj.dslOn * (1 - smooth(9, 15, Math.abs(dslY))),
    titanic: obj.shipOn * (1 - smooth(10, 15, Math.abs(shipY))),
    walls: smooth(6100, 6500, depth) * (1 - smooth(8600, 9000, depth)),
  };

  const under = smooth(0.0, -3.0, cam.camY);
  return {
    fov,
    hA: cam.hA, hB: cam.hB, camY: cam.camY, w: cam.w, wlY: cam.wlY, horizon: cam.horizon,
    pitch: cam.pitch + pitchOff * under - 0.3 * smooth(0, 1, beyond),
    yaw,
    intro: introState(),
    water: waterAt(depth),
    ambient: Math.pow(1 - smooth(0, 950, depth), 1.4),
    lamp,
    bio: smooth(150, 800, depth) * (1 - 0.55 * smooth(3000, 8000, depth)) * (1 - 0.6 * landing),
    snow: lerp(1, 0.6, smooth(0, 4000, depth)) * (1 - 0.35 * landing),
    fog: lerp(0.07, 0.042, smooth(0, 1500, depth)),
    travel: snowTravel,
    stretch: smoothY < stopY && sinceHit > 0.45 ? clamp(Math.abs(vel) / 2600, 0, 1.4) : 0,
    drift: sinceHit < 0.45 ? 0 : lerp(0.32, -0.05, landing),
    floor: landing,
    burst,
    obj,
  };
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (_) { return false; }
}

const can3D = !reduceMotion && hasWebGL();
const want3D = can3D && !forcedStatic;

function fallBack() {
  sceneLive = false;
  if (scene) { scene.dispose(); scene = null; }
  root.classList.remove('is-3d', 'is-live', 'is-cracked', 'crack-hit', 'is-shake', 'poster-wait');
  placeTags({}, {});
  staticUpdate();
}

if (want3D) {
  root.classList.add('is-3d');
  const pre = document.createElement('link');
  pre.rel = 'modulepreload';
  pre.href = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
  pre.crossOrigin = 'anonymous';
  document.head.appendChild(pre);
  import('./scene.js?v=29')
    .then(({ mountScene }) => {
      scene = mountScene(canvas, {
        mobile: mobileScene,
        onFrame: frameState,
        onLabels: (proj) => placeTags(proj, scene ? scene.labelVis || {} : {}),
        onReady() {
          sceneLive = true;
          if (readyAt === null) readyAt = (performance.now() - T0) / 1000;
          if (posterWait) { introSkipped = true; root.classList.remove('poster-wait'); }
          root.classList.add('is-live');
        },
        onFail: fallBack,
      });
      if (!scene) return;
      smoothY = prevSmooth = window.scrollY;
      prevS = smoothY / vh;
      snowTravel = Math.min(smoothY, Infinity) * UNITS_PER_PX;
      if (wordLayout) scene.setWord(wordLayout);
      if (document.fonts) document.fonts.ready.then(() => { layoutWord(); });
      scene.start();
    })
    .catch(fallBack);

  // pause the loop in background tabs; the page doesn't gate on document.hidden otherwise
  document.addEventListener('visibilitychange', () => {
    if (!scene) return;
    if (document.visibilityState === 'hidden') scene.stop(); else scene.start();
  });
}

/* ---------- 3D on/off: the header pill shows the current state ---------- */
if (can3D) {
  $$('[data-mode]').forEach((a) => {
    a.hidden = false;
    a.href = forcedStatic ? location.pathname : '?3d=off';
    if (a.classList.contains('mode-link')) {
      a.classList.toggle('is-on', !forcedStatic);
      $('.mode__text', a).textContent = forcedStatic ? '3D off' : '3D on';
      a.setAttribute('aria-label', forcedStatic ? '3D off: turn it on' : '3D on: turn it off');
    } else a.textContent = forcedStatic ? a.dataset.on : a.dataset.off;
  });
}

/* ---------- Chapter links: land the card on the centre line so the gauge reads its threshold ---------- */
const indexBtn = $('.index-btn');
const index = $('#index');
const closeBtn = $('.index__close', index);

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href').slice(1);
  const section = id && document.getElementById(id);
  if (!section) return;
  const target = id === 'bottom' ? $('.bottom__num') : section.classList.contains('chapter') ? $('.card, .feature', section) : null;
  if (index.classList.contains('is-open')) setIndex(false, false);
  if (!target) return;
  e.preventDefault();
  const top = docTop(target) + target.offsetHeight / 2 - vh / 2;
  window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
  try { history.replaceState(null, '', `#${id}`); } catch (_) { /* srcdoc */ }
  target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
});

/* ---------- Index overlay ---------- */
const outside = [$('main'), $('footer'), scrubber, $('.gauge'), $('.top')];
function setIndex(open, restoreFocus = true) {
  indexBtn.setAttribute('aria-expanded', String(open));
  index.classList.toggle('is-open', open);
  root.classList.toggle('index-open', open);
  outside.forEach((el) => { el.inert = open; });
  if (open) closeBtn.focus();
  else if (restoreFocus) indexBtn.focus();
}
indexBtn.addEventListener('click', () => setIndex(true));
closeBtn.addEventListener('click', () => setIndex(false));
document.addEventListener('keydown', (e) => {
  if (!index.classList.contains('is-open')) return;
  if (e.key === 'Escape') { setIndex(false); return; }
  if (e.key === 'Tab') {
    const f = $$('a:not([hidden]), button', index);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* ---------- Boot ---------- */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    measure();
    for (const k in tagState) tagState[k].w = 0;
    if (scene) scene.resize();
    buildCrack();
    revealAll();
    if (!sceneLive) staticUpdate();
  }, 120);
});
if ('ResizeObserver' in window) {
  let roTimer;
  new ResizeObserver(() => { clearTimeout(roTimer); roTimer = setTimeout(() => { measure(); if (!sceneLive) staticUpdate(); }, 120); }).observe($('main'));
}

measure();
buildCrack();
staticUpdate();
revealAll();
if (reduceMotion || window.scrollY > 4) skipIntro();
introTick();
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { measure(); staticUpdate(); });
