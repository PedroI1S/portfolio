/* Mossline v3 — Organic / Nature (forest) concept
   Specimen hero (pre-rendered Cycles sequence on a canvas), the pinned cut, reveals, SOC chart, field map, mobile menu. */
import { createSequence } from './frames.js?v=46';

const V = '46';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const mobile = window.matchMedia('(max-width: 760px)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const ss = (x) => x * x * (3 - 2 * x);
const sst = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const hasIO = 'IntersectionObserver' in window;
const motion = !reduceMotion;
const root = document.documentElement;
if (motion) root.classList.add('js-motion'); // also set inline in <head> so the static cut panels never start loading

// Short tween on rAF; jumps to the end when motion is reduced or the tab is hidden.
function tween(dur, fn, done) {
  if (reduceMotion || document.hidden) { fn(1); done && done(); return; }
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    fn(easeOut(t));
    if (t < 1) requestAnimationFrame(step); else if (done) done();
  };
  requestAnimationFrame(step);
}

/* ---------- Header: solid once the page scrolls ---------- */
const header = $('.header');
const onScroll = () => header.classList.toggle('is-solid', window.scrollY > 24);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Looping SVG/CSS motion only runs while on screen ---------- */
const playing = new Set();
if (hasIO && !reduceMotion) {
  const playIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const visible = e.isIntersecting && e.intersectionRatio > 0;
      e.target.classList.toggle('is-playing', visible);
      if (visible) playing.add(e.target); else playing.delete(e.target);
    });
  }, { threshold: [0, 0.001] });
  $$('[data-play]').forEach((el) => playIO.observe(el));
}
const isPlaying = (el) => playing.has(el) && !document.hidden;

/* ---------- Anchors exported from Blender (per frame, normalised 0-1) ---------- */
const anchorsP = (name) => fetch(`seq/anchors-${name}.json?v=${V}`).then((r) => r.json()).catch(() => null);

/* ---------- Hero: the specimen ---------- */
const hero = $('.hero');
const stage = $('.hero__stage');
const heroCanvas = $('.hero__canvas');
const hudItems = $$('.hud__item');
const cut = $('.cut');
let heroSeq = null;
let heroStart = () => {};
let carryT = 0;

if (motion && stage && heroCanvas) {
  hero.setAttribute('data-play', '');
  const size = mobile ? 800 : 1200;
  heroSeq = createSequence({
    base: mobile ? 'seq/hero-m/' : 'seq/hero/', count: 96, width: size, height: size,
    canvas: heroCanvas, fit: 'contain', version: V, groups: [[0, 47], [48, 95]], maxScale: 1.4,
  });
  heroSeq.resize();
  let anchors = null;
  anchorsP('hero').then((a) => { anchors = a && a.anchors; });

  const t0 = performance.now();
  let phase = 'wait';           // wait → intro → idle
  let introAt = 0, idleAt = 0;
  let ptr = 0, ptrTarget = 0;   // pointer nudge, ±6 frames
  let shown = -1;
  let visible = true;
  let raf = 0;

  if (finePointer) {
    window.addEventListener('pointermove', (e) => { ptrTarget = clamp((e.clientX / innerWidth - 0.5) * 2, -1, 1) * 6; }, { passive: true });
  }

  const placeHud = (idx) => {
    if (!anchors) return;
    const i0 = clamp(Math.floor(idx), 0, 95);
    const i1 = clamp(Math.ceil(idx), 0, 95);
    const frac = idx - Math.floor(idx);
    hudItems.forEach((el) => {
      const a0 = anchors[el.dataset.anchor] && anchors[el.dataset.anchor][i0];
      const a1 = anchors[el.dataset.anchor] && anchors[el.dataset.anchor][i1];
      if (!a0) { el.style.setProperty('--px', '-999px'); return; }
      const ax = a1 ? lerp(a0[0], a1[0], frac) : a0[0];
      const ay = a1 ? lerp(a0[1], a1[1], frac) : a0[1];
      const p = heroSeq.project(ax, ay);
      el.style.setProperty('--px', `${p.x.toFixed(1)}px`);
      el.style.setProperty('--py', `${p.y.toFixed(1)}px`);
    });
  };

  const frame = (now) => {
    raf = 0;
    let idx = -1;
    if (phase === 'wait') {
      const elapsed = now - t0;
      if (heroSeq.hasRange(0, 47) || elapsed > 4500) {
        if (heroSeq.nearest(0) < 0) {
          // nothing has arrived yet: keep the poster, then join at rest once frames land
          stage.classList.add('is-fallback');
          if (heroSeq.has(48)) { phase = 'idle'; idleAt = now; stage.classList.add('is-live', 'hud-on'); }
        } else {
          phase = 'intro'; introAt = now;
          stage.classList.add('is-live');
          stage.classList.remove('is-fallback');
        }
      }
    }
    if (phase === 'intro') {
      idx = Math.min(47, ((now - introAt) / 1000) * 30);
      if (idx >= 34) stage.classList.add('hud-on');
      if (idx >= 47 || carryT > 0.08) { phase = 'idle'; idleAt = now; stage.classList.add('hud-on'); }
    }
    if (phase === 'idle') {
      const u = (((now - idleAt) / 9000) % 1 + 1) % 1;
      const tri = u < 0.5 ? u * 2 : 2 - u * 2;   // ping-pong 48 → 95 → 48 over 9 s
      ptr += (ptrTarget - ptr) * 0.08;
      const idleIdx = clamp(48 + 47 * tri + ptr, 48, 95);
      // steer towards frame 72 (the exact rest yaw where cut frame 0 begins) as we scroll down
      idx = lerp(idleIdx, 72, sst(seg(carryT, 0, 0.85)));
    }
    if (idx >= 0) {
      if (heroSeq.draw(idx, true)) shown = idx;
      placeHud(shown);
    }
    if (visible && !document.hidden && carryT < 1) raf = requestAnimationFrame(frame);
  };
  heroStart = () => { if (!raf && visible && !document.hidden && carryT < 1) raf = requestAnimationFrame(frame); };

  heroSeq.load('high');
  heroStart();
  if (hasIO) new IntersectionObserver(([e]) => { visible = e.isIntersecting; heroStart(); }, { rootMargin: '0px 0px 100% 0px', threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', heroStart);
  window.addEventListener('resize', () => { heroSeq.resize(); placeHud(shown); });
}

/* ---------- 01 The cut: pinned, scroll-scrubbed sequence ---------- */
// Frame background: hero forest green → studio black (matches _src/convert_frames.py).
const BG0 = [15, 31, 16], BG1 = [8, 13, 11];
const cutBg = (f) => { const t = ss(seg(f, 20, 150)); return `rgb(${BG0.map((c, k) => Math.round(lerp(c, BG1[k], t))).join(' ')})`; };
const cutDepth = (f) => (f < 54 ? 0 : f < 100 ? lerp(1.2, 30.5, seg(f, 54, 100)) : 30);

let cutLoad = () => {};
if (motion && cut) {
  root.classList.add('has-cut');
  const pin = $('.cut__pin', cut);
  const canvas = $('.cut__canvas', cut);
  const steps = $$('.cut__step', cut);
  const readings = $$('.reading', cut);
  const ruler = $('.cut__ruler', cut);
  const progressEl = $('.cut__progress b', cut);
  const W = mobile ? 720 : 1600, H = mobile ? 720 : 900;
  // all 160 rendered frames are shipped; prioritize the turn frames (0..45) first so the handoff is instant
  const seq = createSequence({ base: mobile ? 'seq/cut-m/' : 'seq/cut/', count: 160, step: 1, width: W, height: H, canvas, fit: mobile ? 'contain' : 'cover', version: V, groups: [[0, 45], [46, 159]], maxScale: 1 });
  let anchors = null;
  let shown = 0, target = 0, raf = 0, near = false, loading = false;
  let carryTarget = 0, carryShown = 0, carryRaf = 0, carryLayout = null, handoff = null;
  fetch(`seq/handoff.json?v=${V}`).then((r) => r.json()).then((h) => { handoff = h; measureCarry(); syncCarry(true); }).catch(() => {});
  // mobile frames are the centre 900×900 of the 1600×900 render, scaled to 720
  const toFrame = (a) => (mobile ? [(a[0] * 1600 - 350) / 900, a[1]] : a);
  cutLoad = () => {
    if (loading) return;
    loading = true;
    seq.load('auto');
    anchorsP('cut').then((a) => { anchors = a && a.anchors; kick(); });
    seq.onLoad(() => { renderCarry(); update(); kick(); });
  };

  const measureCarry = () => {
    if (!hero || !stage) return;
    const prevTransform = stage.style.transform;
    stage.style.transform = 'none';
    const hr = hero.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    const pinRect = pin.getBoundingClientRect();
    stage.style.transform = prevTransform;

    const travel = Math.max(1, hr.height);
    const stageCx = (sr.left - hr.left) + sr.width / 2;
    const stageCy = (sr.top - hr.top) + sr.height / 2;
    const targetCx = (cr.left - pinRect.left) + cr.width / 2;
    const targetCy = (cr.top - pinRect.top) + cr.height / 2;

    const k = mobile
      ? Math.min(cr.width / W, cr.height / H)
      : Math.max(cr.width / W, cr.height / H);
    let targetScale = clamp((H * k * 1.091) / Math.max(1, sr.width), 0.5, 1.85);
    let tx = targetCx, ty = targetCy;
    // Exact fit: the same specimen points projected in hero frame 72 and cut frame 0 (seq/handoff.json).
    // Least squares for scale s and centre T so that T + s·u (hero, stage-centred px) lands on q (cut, pin px).
    if (handoff) {
      seq.resize();
      const S = sr.width;
      const u = handoff.hero.map(([x, y]) => [(x - 0.5) * S, (y - 0.5) * S]);
      const q = handoff.cut.map((c) => { const [x, y] = toFrame(c); const p = seq.project(x, y); return [p.x + cr.left - pinRect.left, p.y + cr.top - pinRect.top]; });
      const mean = (a) => a.reduce((m, v) => [m[0] + v[0] / a.length, m[1] + v[1] / a.length], [0, 0]);
      const um = mean(u), qm = mean(q);
      let num = 0, den = 0;
      u.forEach((v, i) => { const du = [v[0] - um[0], v[1] - um[1]]; num += du[0] * (q[i][0] - qm[0]) + du[1] * (q[i][1] - qm[1]); den += du[0] * du[0] + du[1] * du[1]; });
      if (den > 0) { targetScale = num / den; tx = qm[0] - targetScale * um[0]; ty = qm[1] - targetScale * um[1]; }
    }

    carryLayout = {
      travel,
      fullDx: tx - stageCx,
      fullDy: (travel + ty) - stageCy,
      targetScale,
    };
  };

  const renderCarry = () => {
    if (!hero || !stage || !carryLayout) return;
    const raw = carryShown;
    const t = clamp(raw, 0, 1);
    carryT = t;
    const e = sst(t);
    const ey = lerp(t, e, 0.25);

    const dx = carryLayout.fullDx * e;
    const dy = carryLayout.fullDy * ey;
    const scale = lerp(1, carryLayout.targetScale, e);

    stage.classList.toggle('is-carrying', t > 0.005);
    stage.style.setProperty('--carry-x', `${dx.toFixed(2)}px`);
    stage.style.setProperty('--carry-y', `${dy.toFixed(2)}px`);
    stage.style.setProperty('--carry-s', scale.toFixed(4));
    stage.style.setProperty('--hud-fade', (1 - ss(seg(t, 0.04, 0.36))).toFixed(3));

    // Clean, non-overlapping handoff right at the pin point (raw >= 0.998) so the two canvases never ghost on top of each other
    const cutReady = seq.nearest(0) >= 0;
    const handoff = cutReady && raw >= 0.998 ? 1 : 0;
    stage.style.setProperty('--stage-alpha', String(1 - handoff));
    cut.style.setProperty('--cut-alpha', String(handoff));
    if (t < 1) heroStart();
  };

  const tickCarry = () => {
    carryRaf = 0;
    const d = carryTarget - carryShown;
    carryShown = Math.abs(d) < 0.0008 ? carryTarget : carryShown + d * 0.28;
    renderCarry();
    if (!document.hidden && Math.abs(carryTarget - carryShown) >= 0.0008) {
      carryRaf = requestAnimationFrame(tickCarry);
    }
  };

  const syncCarry = (instant = false) => {
    if (!hero || !carryLayout) return;
    const hr = hero.getBoundingClientRect();
    const rawNow = clamp(-hr.top / carryLayout.travel, 0, 1.15);
    carryTarget = rawNow;
    // Once pinned in #how (rawNow >= 1), snap immediately so the hero stage never lags over the rotating cut specimen
    if (instant || rawNow >= 1) {
      carryShown = carryTarget;
      renderCarry();
    } else if (!carryRaf && !document.hidden) {
      carryRaf = requestAnimationFrame(tickCarry);
    }
  };

  const progress = () => {
    const r = cut.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1);
  };

  const pos = (name, i) => {
    const a = anchors && anchors[name] && anchors[name][i];
    if (!a) return null;
    const [x, y] = toFrame(a);
    const p = seq.project(x, y);
    return { x: p.x + canvas.offsetLeft, y: p.y + canvas.offsetTop };
  };

  const update = () => {
    const f = shown;
    const i = clamp(Math.round(f), 0, 159);
    seq.draw(f, false);  // snap to the nearest frame: crossfades soften the render
    pin.style.setProperty('--cut-bg', cutBg(f));
    pin.style.setProperty('--shade', (ss(seg(f, 12, 36)) * 0.95).toFixed(3));
    const p = f / 159;
    const active = p < 0.33 ? 0 : p < 0.66 ? 1 : 2;
    steps.forEach((s, k) => s.classList.toggle('is-active', k === active));
    readings.forEach((el, k) => {
      const lit = f >= [134, 139, 144][k] && f < 156;
      el.classList.toggle('is-lit', lit);
      const q = pos(el.dataset.band, i);
      if (q) { el.style.setProperty('--px', `${q.x.toFixed(1)}px`); el.style.setProperty('--py', `${q.y.toFixed(1)}px`); }
    });
    const top = pos('ruler_top', i), bot = pos('ruler_30', i);
    if (top && bot) {
      ruler.style.setProperty('--rx', `${top.x.toFixed(1)}px`);
      ruler.style.setProperty('--ry', `${top.y.toFixed(1)}px`);
      ruler.style.setProperty('--rh', `${Math.max(0, bot.y - top.y).toFixed(1)}px`);
    }
    ruler.style.setProperty('--ruler', (ss(seg(f, 112, 122)) * (1 - ss(seg(f, 150, 157)))).toFixed(3));
    progressEl.textContent = String(Math.round(cutDepth(f))).padStart(2, '0');
  };

  const tick = () => {
    raf = 0;
    target = progress() * 159;
    const d = target - shown;
    shown = Math.abs(d) < 0.02 ? target : shown + d * 0.22;
    update();
    if (near && !document.hidden && shown !== target) raf = requestAnimationFrame(tick);
  };
  function kick() { if (!raf && near && !document.hidden) raf = requestAnimationFrame(tick); }

  window.addEventListener('scroll', () => {
    cutLoad();
    syncCarry(false);
    kick();
  }, { passive: true });
  window.addEventListener('resize', () => { seq.resize(); measureCarry(); syncCarry(true); shown = target = progress() * 159; update(); });
  document.addEventListener('visibilitychange', () => { syncCarry(true); kick(); });
  if (hasIO) new IntersectionObserver(([e]) => { near = e.isIntersecting; kick(); }, { rootMargin: '50% 0px' }).observe(cut);
  else { near = true; }
  seq.resize();
  measureCarry();
  shown = target = progress() * 159;
  syncCarry(true);
  // start preloading the cut sequence right away so all turn frames are in memory before the user scrolls
  cutLoad();
}

/* ---------- Field map dims as the linen sheet slides over it ---------- */
const field = $('.field'), who = $('.who');
if (motion && field && who) {
  const room = () => {
    const r = who.getBoundingClientRect();
    field.style.setProperty('--room-p', clamp(1 - r.top / innerHeight, 0, 1).toFixed(3));
  };
  window.addEventListener('scroll', room, { passive: true });
  room();
}

/* ---------- Reveals ---------- */
// The hero lead sits low in the first screen, so it arrives with the headline, not on scroll.
const heroTitle = $('.hero__title');
const heroLead = $('.hero__lead');
const revealTargets = $$('[data-reveal], .cta__title').filter((el) => el !== heroLead);
const showHero = () => { heroTitle.classList.add('is-in'); heroLead.classList.add('is-in'); };
if (reduceMotion || !hasIO) {
  revealTargets.forEach((el) => el.classList.add('is-in'));
  showHero();
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  revealTargets.forEach((el) => io.observe(el));
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(showHero, 500));
  setTimeout(showHero, 1400);
}

/* ---------- 02 SOC chart ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const N = 55;                          // Mar 2022 → Sep 2026, monthly
const CORE_IDX = [6, 18, 30, 42, 54];  // September core sampling, five seasons
const monthLabel = (i) => { const t = 2 + i; return `${MONTHS[t % 12]} ${2022 + Math.floor(t / 12)}`; };
const PLOTS = {
  'north-ley':   { name: 'North Ley',   cores: [3.69, 3.71, 3.73, 3.76, 3.78], bd: 1.30, seed: 3 },
  'long-meadow': { name: 'Long Meadow', cores: [4.12, 4.12, 4.13, 4.14, 4.15], bd: 1.25, seed: 7 },
  'brook-field': { name: 'Brook Field', cores: [2.41, 2.42, 2.44, 2.46, 2.48], bd: 1.40, seed: 11 },
};
const hash = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };

function buildSeries(p) {
  const out = [];
  for (let i = 0; i < N; i++) {
    let k = CORE_IDX.findIndex((c) => c >= i);
    if (k <= 0) k = 1;
    const a = CORE_IDX[k - 1], b = CORE_IDX[k];
    const trend = p.cores[k - 1] + (p.cores[k] - p.cores[k - 1]) * ((i - a) / (b - a));
    const seasonal = 0.009 * Math.sin((2 * Math.PI * (i - 6)) / 12);
    const v = trend + seasonal + hash(i, p.seed) * 0.004;
    const hw = 0.034 + 0.05 * Math.exp(-i / 9);
    out.push({ v, lo: v - hw, hi: v + hw, hw });
  }
  return out;
}

function niceDomain(series, cores) {
  let mn = Infinity, mx = -Infinity;
  series.forEach((d) => { mn = Math.min(mn, d.lo); mx = Math.max(mx, d.hi); });
  cores.forEach((c) => { mn = Math.min(mn, c - 0.03); mx = Math.max(mx, c + 0.03); });
  const range = mx - mn;
  const step = [0.02, 0.05, 0.1, 0.2].find((s) => range / s <= 6) || 0.5;
  return [Math.floor(mn / step) * step, Math.ceil(mx / step) * step, step];
}

function smooth(pts, move = true) {
  const f = (n) => Math.round(n * 10) / 10;
  let d = `${move ? 'M' : 'L'}${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

const chartEl = $('.chart');
if (chartEl) {
  const svg = $('.chart__svg', chartEl);
  const tip = $('.chart__tip', chartEl);
  const live = $('[data-chart-live]');
  const dash = $('.dash');
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, cls) => { const n = document.createElementNS(NS, tag); if (cls) n.setAttribute('class', cls); return n; };

  const gGrid = mk('g', 'grid'), band = mk('path', 'band'), line = mk('path', 'line'), gCores = mk('g', 'cores');
  const cursor = mk('g', 'cursor'), cLine = mk('line'), cDot = mk('circle');
  cDot.setAttribute('r', 5);
  cursor.append(cLine, cDot);
  svg.append(gGrid, band, line, gCores, cursor);

  const cache = {};
  const seriesFor = (id) => (cache[id] ||= buildSeries(PLOTS[id]));
  let current = 'north-ley';
  let chartTransition = 0;
  let view = { series: seriesFor(current), cores: PLOTS[current].cores.slice(), domain: niceDomain(seriesFor(current), PLOTS[current].cores) };
  let cursorIdx = -1;
  let W = 0, H = 0;
  const pad = { l: 46, r: 14, t: 14, b: 30 };
  const x = (i) => pad.l + ((W - pad.l - pad.r) * i) / (N - 1);
  const y = (v) => { const [d0, d1] = view.domain; return pad.t + (H - pad.t - pad.b) * (1 - (v - d0) / (d1 - d0)); };

  function render() {
    W = svg.clientWidth; H = svg.clientHeight;
    if (!W || !H) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const [d0, d1, step] = view.domain;

    let grid = '';
    const first = Math.ceil(d0 / step - 1e-6);
    for (let n = first; n * step <= d1 + 1e-6; n++) {
      const v = n * step;
      const yy = Math.round(y(v)) + 0.5;
      grid += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}"/><text x="${pad.l - 10}" y="${yy + 4}" text-anchor="end">${v.toFixed(2)}</text>`;
    }
    CORE_IDX.forEach((ci, k) => {
      const xx = Math.round(x(ci)) + 0.5;
      grid += `<line class="year" x1="${xx}" x2="${xx}" y1="${pad.t}" y2="${H - pad.b}"/><text x="${xx}" y="${H - 8}" text-anchor="middle">${2022 + k}</text>`;
    });
    gGrid.innerHTML = grid;

    const up = view.series.map((d, i) => [x(i), y(d.hi)]);
    const lo = view.series.map((d, i) => [x(i), y(d.lo)]).reverse();
    band.setAttribute('d', `${smooth(up)}${smooth(lo, false)}Z`);
    line.setAttribute('d', smooth(view.series.map((d, i) => [x(i), y(d.v)])));

    let cores = '';
    view.cores.forEach((c, k) => {
      const cx = x(CORE_IDX[k]).toFixed(1), cy = y(c);
      cores += `<line x1="${cx}" x2="${cx}" y1="${y(c + 0.02).toFixed(1)}" y2="${y(c - 0.02).toFixed(1)}"/><circle cx="${cx}" cy="${cy.toFixed(1)}" r="4.5"/>`;
    });
    gCores.innerHTML = `<g class="core">${cores}</g>`;
    if (cursorIdx >= 0) placeCursor(cursorIdx, false);
  }

  function placeCursor(i, announce) {
    cursorIdx = i;
    const d = view.series[i];
    const cx = x(i), cy = y(d.v);
    cLine.setAttribute('x1', cx); cLine.setAttribute('x2', cx);
    cLine.setAttribute('y1', pad.t); cLine.setAttribute('y2', H - pad.b);
    cDot.setAttribute('cx', cx); cDot.setAttribute('cy', cy);

    const k = CORE_IDX.indexOf(i);
    tip.innerHTML =
      `<p class="tip__date">${monthLabel(i)} · ${PLOTS[current].name}</p>` +
      `<p><b>${d.v.toFixed(2)} %</b> modelled</p>` +
      `<p>95 % interval ± ${d.hw.toFixed(2)}</p>` +
      (k >= 0 ? `<p class="tip__core">Lab core ${view.cores[k].toFixed(2)} %</p>` : '');
    const tw = tip.offsetWidth || 170, th = tip.offsetHeight || 80;
    const left = clamp(cx + 16 + tw > W ? cx - 16 - tw : cx + 16, 8, Math.max(8, W - tw - 8));
    const top = clamp(cy - th - 12, 0, H - th);
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    if (announce) live.textContent = `${monthLabel(i)}: ${d.v.toFixed(2)} percent, plus or minus ${d.hw.toFixed(2)}${k >= 0 ? `. Lab core ${view.cores[k].toFixed(2)} percent` : ''}.`;
  }

  const show = () => chartEl.classList.add('is-hover');
  const hide = () => { chartEl.classList.remove('is-hover'); };
  const idxFromEvent = (e) => {
    const r = svg.getBoundingClientRect();
    return clamp(Math.round(((e.clientX - r.left - pad.l) / (W - pad.l - pad.r)) * (N - 1)), 0, N - 1);
  };
  chartEl.addEventListener('pointermove', (e) => { placeCursor(idxFromEvent(e), false); show(); });
  chartEl.addEventListener('pointerdown', (e) => { placeCursor(idxFromEvent(e), false); show(); });
  chartEl.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && document.activeElement !== chartEl) hide(); });
  chartEl.addEventListener('focus', () => { placeCursor(cursorIdx >= 0 ? cursorIdx : N - 1, true); show(); });
  chartEl.addEventListener('blur', hide);
  chartEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hide(); return; }
    const map = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1, PageDown: -12, PageUp: 12 };
    let i = cursorIdx >= 0 ? cursorIdx : N - 1;
    if (e.key in map) i = clamp(i + map[e.key], 0, N - 1);
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = N - 1;
    else return;
    e.preventDefault();
    placeCursor(i, true); show();
  });

  // Stats under the chart
  const statSoc = $('[data-stat="soc"]'), statDelta = $('[data-stat="delta"]');
  const statRate = $('[data-stat="rate"]'), statCi = $('[data-stat="ci"]');
  const statsFor = (id) => {
    const p = PLOTS[id], s = seriesFor(id);
    const delta = p.cores[4] - p.cores[0];
    // pp of SOC × bulk density × 30 cm → t C/ha over four years → t CO2e/ha/yr
    const rate = ((delta * p.bd * 30) / 4) * (44 / 12);
    return { soc: p.cores[4], delta, rate, ci: s[N - 1].hw };
  };
  let stats = statsFor(current);
  let renderedStats = stats;
  const writeStats = (s) => {
    renderedStats = s;
    statSoc.textContent = `${s.soc.toFixed(2)} %`;
    $('.data__giant span').textContent = s.soc.toFixed(2);
    $('[data-now]').textContent = s.soc.toFixed(3);
    statDelta.textContent = `+${s.delta.toFixed(2)} pp`;
    statRate.textContent = s.rate.toFixed(1);
    statCi.textContent = `± ${s.ci.toFixed(2)} pp`;
  };
  writeStats(stats);

  const segButtons = $$('.seg button');
  segButtons.forEach((btn) => btn.addEventListener('click', () => {
    const id = btn.dataset.plot;
    if (id === current) return;
    segButtons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    const from = { series: view.series.map((d) => ({ ...d })), cores: view.cores.slice(), domain: view.domain.slice() };
    const to = { series: seriesFor(id), cores: PLOTS[id].cores, domain: niceDomain(seriesFor(id), PLOTS[id].cores) };
    const s0 = renderedStats, s1 = statsFor(id);
    current = id; stats = s1;
    const transition = ++chartTransition;
    const p = PLOTS[id];
    chartEl.setAttribute('aria-label', `Soil organic carbon for ${p.name}, March 2022 to September 2026, from ${p.cores[0].toFixed(2)} to ${p.cores[4].toFixed(2)} percent. Use the left and right arrow keys to read monthly values.`);
    live.textContent = `${p.name}: ${p.cores[4].toFixed(2)} percent soil organic carbon, up ${s1.delta.toFixed(2)} points since 2022.`;
    const lerp = (a, b, t) => a + (b - a) * t;
    tween(800, (t) => {
      if (transition !== chartTransition) return;
      view = {
        series: from.series.map((d, i) => {
          const e = to.series[i];
          return { v: lerp(d.v, e.v, t), lo: lerp(d.lo, e.lo, t), hi: lerp(d.hi, e.hi, t), hw: lerp(d.hw, e.hw, t) };
        }),
        cores: from.cores.map((c, k) => lerp(c, to.cores[k], t)),
        domain: [lerp(from.domain[0], to.domain[0], t), lerp(from.domain[1], to.domain[1], t), t < 0.5 ? from.domain[2] : to.domain[2]],
      };
      writeStats({ soc: lerp(s0.soc, s1.soc, t), delta: lerp(s0.delta, s1.delta, t), rate: lerp(s0.rate, s1.rate, t), ci: lerp(s0.ci, s1.ci, t) });
      render();
    }, () => { if (transition !== chartTransition) return; view = { series: to.series, cores: to.cores.slice(), domain: to.domain }; render(); if (document.activeElement === chartEl && cursorIdx >= 0) placeCursor(cursorIdx, true); });
  }));

  render();
  if ('ResizeObserver' in window) new ResizeObserver(() => render()).observe(svg);
  else window.addEventListener('resize', render);

  const nowDot = mk('circle', 'now-dot'); nowDot.setAttribute('r', '5'); svg.append(nowDot);
  function chartProgress() {
    if (document.hidden) return;
    const rect = chartEl.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) return;
    const progress = reduceMotion ? 1 : clamp((innerHeight - rect.top) / (innerHeight * .52), 0, 1);
    const length = line.getTotalLength();
    line.style.strokeDasharray = `${length}`;
    line.style.strokeDashoffset = `${length * (1 - progress)}`;
    nowDot.setAttribute('cx', x(N-1)); nowDot.setAttribute('cy', y(view.series[N-1].v));
    nowDot.style.opacity = progress > .98 ? '1' : '0';
  }
  window.addEventListener('scroll', chartProgress, {passive:true});
  window.addEventListener('resize', chartProgress);
  new MutationObserver(chartProgress).observe(line, {attributes:true, attributeFilter:['d']});
  chartProgress();
  setInterval(() => {
    if (reduceMotion || !isPlaying($('.data'))) return;
    $('[data-now]').textContent = (stats.soc + Math.sin(Date.now()/4600)*.003).toFixed(3);
  }, 1800);

}

/* ---------- 03 Field map ---------- */
const FIELD = {
  'north-ley':    { name: 'North Ley',    practice: 'grazed ley, adaptive grazing', area: 14.2, soc: 3.78, delta: 0.09, probes: 3, offset: 7 },
  'long-meadow':  { name: 'Long Meadow',  practice: 'permanent pasture',            area: 22.6, soc: 4.15, delta: 0.03, probes: 2, offset: 19 },
  'wren-bank':    { name: 'Wren Bank',    practice: 'woodland edge, control plot',  area: 6.1,  soc: 5.02, delta: 0.01, probes: 1, offset: 31 },
  'top-slade':    { name: 'Top Slade',    practice: 'herbal ley',                   area: 9.8,  soc: 3.21, delta: 0.08, probes: 2, offset: 43 },
  'brook-field':  { name: 'Brook Field',  practice: 'arable, winter cover crops',   area: 18.4, soc: 2.48, delta: 0.07, probes: 3, offset: 52 },
  'hollow-piece': { name: 'Hollow Piece', practice: 'agroforestry, alley cropping', area: 11.5, soc: 2.96, delta: 0.11, probes: 3, offset: 58 },
};
const fieldSection = $('.field');
if (fieldSection) {
  const plots = $$('.plot', fieldSection);
  const probes = $$('.probe', fieldSection);
  probes.forEach(probe => {
    const height = FIELD[probe.dataset.plot].soc * 13;
    const ns = 'http://www.w3.org/2000/svg';
    const stem = document.createElementNS(ns, 'line'); stem.setAttribute('class','probe__pillar');
    stem.setAttribute('y1',0); stem.setAttribute('y2',-height);
    const cap = document.createElementNS(ns,'circle'); cap.setAttribute('class','probe__cap');
    cap.setAttribute('cy',-height); cap.setAttribute('r',2.5);
    probe.prepend(stem); probe.append(cap);
  });
  const buttons = $$('.field__plots button', fieldSection);
  const f = (k) => $(`[data-f="${k}"]`, fieldSection);
  const mapLive = $('[data-map-live]', fieldSection);
  let active = 'north-ley';

  const nextReading = () => {
    const now = new Date();
    const next = new Date(now);
    next.setMinutes(FIELD[active].offset, 0, 0);
    if (next <= now) next.setHours(next.getHours() + 1);
    const s = Math.round((next - now) / 1000);
    const el = f('next');
    el.textContent = `in ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    el.setAttribute('datetime', next.toISOString());
  };

  const select = (id, announce) => {
    if (!FIELD[id]) return;
    active = id;
    const d = FIELD[id];
    plots.forEach((p) => p.classList.toggle('is-active', p.dataset.plot === id));
    probes.forEach((p) => p.classList.toggle('is-active', p.dataset.plot === id));
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.plot === id)));
    f('practice').textContent = `[ ${d.practice} ]`;
    f('name').textContent = d.name;
    f('soc').textContent = `${d.soc.toFixed(2)} %`;
    f('delta').textContent = `+${d.delta.toFixed(2)} pp`;
    f('area').textContent = `${d.area.toFixed(1)} ha`;
    f('probes').textContent = `${d.probes} × 3 depths`;
    nextReading();
    if (announce) mapLive.textContent = `${d.name}, ${d.practice}: ${d.soc.toFixed(2)} percent soil organic carbon, up ${d.delta.toFixed(2)} points since 2022.`;
  };

  plots.forEach((p) => {
    p.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') select(p.dataset.plot, false); });
    p.addEventListener('click', () => select(p.dataset.plot, false));
  });
  buttons.forEach((b) => b.addEventListener('click', () => select(b.dataset.plot, true)));
  select(active, false);
  setInterval(() => { if (!document.hidden && isPlaying(fieldSection)) nextReading(); }, 1000);
}

/* ---------- Mobile menu ---------- */
const menuBtn = $('.menu-btn');
const menu = $('#menu');
if (menuBtn && menu) {
  const links = $$('a', menu);
  const background = $$('main, footer, .skip, .header > :not(.menu-btn)');
  const originalInert = new Map(background.map((el) => [el, el.inert]));
  const setMenu = (open, restoreFocus = false) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
    menu.setAttribute('aria-hidden', String(!open));
    menu.inert = !open;
    menu.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('menu-open', open);
    background.forEach((el) => { el.inert = open || originalInert.get(el); });
    if (open) links[0]?.focus();
    else if (restoreFocus) menuBtn.focus({ preventScroll: true });
  };
  setMenu(false);
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    setMenu(false);
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    // Keep native anchor scrolling, and move keyboard navigation into the chapter.
    const hadTabindex = target.hasAttribute('tabindex');
    if (!hadTabindex) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    if (!hadTabindex) target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
  });
  document.addEventListener('keydown', (e) => {
    if (!menu.classList.contains('is-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); setMenu(false, true); return; }
    if (e.key !== 'Tab') return;
    const controls = [menuBtn, ...links];
    const current = controls.indexOf(document.activeElement);
    if (current < 0 || (e.shiftKey && current === 0) || (!e.shiftKey && current === controls.length - 1)) {
      e.preventDefault();
      controls[e.shiftKey ? controls.length - 1 : 0].focus();
    }
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', (m) => {
    if (!m.matches) return;
    const focusWasInMenu = menu.contains(document.activeElement) || document.activeElement === menuBtn;
    setMenu(false);
    if (focusWasInMenu) $('.logo').focus({ preventScroll: true });
  });
}

// Stop ambient CSS animations in background tabs as well as off-screen.
const syncVisibility = () => document.documentElement.classList.toggle('is-hidden', document.hidden);
document.addEventListener('visibilitychange', syncVisibility);
syncVisibility();
