/* Seedfile — page script (ES module)
   Hero plot with preflight and homing, the scroll-scrubbed plot reel, pen-drawn ledger panels and service sketches,
   the paper scene with its blue-pen figure, the header job readout, grid overlay (G), clocks, copy toast, mobile menu. */
import { buildFlowPlot, PLOTS, MICRO, portrait, record, createJob, createCursor, advance, isDone } from './plot.js?v=14';

const root = document.documentElement;
const motion = root.classList.contains('motion');   // set in <head> unless reduced motion is requested
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const phone = window.matchMedia('(max-width: 759px)');
const PEN = '#cecece';
const BLUE = '#0000ff';
const MM = 25.4 / 96;   // CSS px to millimetres

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const hex = (v) => `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
const pad = (v, l) => String(v).padStart(l, '0');
const mm = (v) => (Math.max(0, v) * MM).toFixed(1).padStart(5, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const randomSeed = () => (window.crypto && crypto.getRandomValues
  ? crypto.getRandomValues(new Uint32Array(1))[0]
  : Math.floor(Math.random() * 0x100000000));
const DPR = () => Math.min(window.devicePixelRatio || 1, phone.matches ? 1.5 : 2);

const PLOT_LABEL = {
  rings: 'Tide rings', ridges: 'Firing curves', harmonograph: 'Harmonograph', truchet: 'Weave tiles',
  stipple: 'Stipple', hatch: 'Fracture hatch', streams: 'Trip streams', circles: 'Listening grid'
};
const MODE_LABEL = { drift: 'Drift field', curl: 'Curl field', vortex: 'Vortex field', quantised: 'Quantised field' };

/* ---------- Canvas and pen helpers ---------- */
function sizeCanvas(canvas, w = canvas.clientWidth, h = canvas.clientHeight) {
  const dpr = DPR();
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h, dpr, canvas };
}
function clearSurface(s) {
  s.ctx.save();
  s.ctx.setTransform(1, 0, 0, 1, 0, 0);
  s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
  s.ctx.restore();
}
function ink(ctx, job, colour = PEN) {
  ctx.strokeStyle = colour; ctx.lineWidth = job.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
}
const inkLength = (job) => job.lens.reduce((a, b) => a + b, 0);
const strokesStarted = (cur) => cur.li + (cur.pi > 0 ? 1 : 0);

function jobFor(gen, w, h, seed, opts = {}) {
  const r = record(gen, w, h, seed);
  return createJob(r.strokes, { width: r.width, ...opts });
}
function drawFinished(canvas, kind, seed, w, h) {
  const s = sizeCanvas(canvas, w, h);
  s.ctx.fillStyle = '#000';
  s.ctx.fillRect(0, 0, s.w, s.h);
  const job = jobFor(PLOTS[kind], s.w, s.h, seed);
  ink(s.ctx, job);
  advance(s.ctx, job, createCursor(job), Infinity);
  return s;
}

// Registration marks: eight ticks just outside the paper corners
function markTicks({ x0, y0, x1, y1 }) {
  const g = 6, l = 10, out = [];
  [[x0, y0, -1, -1], [x1, y0, 1, -1], [x1, y1, 1, 1], [x0, y1, -1, 1]].forEach(([cx, cy, sx, sy]) => {
    const x = Math.round(cx) + 0.5, y = Math.round(cy) + 0.5;
    out.push([x + sx * g, y, x + sx * (g + l), y], [x, y + sy * g, x, y + sy * (g + l)]);
  });
  return out;
}
function drawTicks(ctx, ticks, from, to) {
  ctx.save();
  ctx.strokeStyle = '#858585'; ctx.lineWidth = 1; ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let i = from; i < to; i++) { const [a, b, c, d] = ticks[i]; ctx.moveTo(a, b); ctx.lineTo(c, d); }
  ctx.stroke();
  ctx.restore();
}
// Pen-up travel: 1px dashed grey moves; `alpha(i)` decides how each one fades
function drawMoves(s, moves, alpha) {
  const { ctx } = s;
  clearSurface(s);
  ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeStyle = '#858585'; ctx.lineCap = 'butt';
  moves.forEach((m, i) => {
    const a = alpha(m, i);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(m[2], m[3]); ctx.stroke();
  });
  ctx.globalAlpha = 1; ctx.setLineDash([]);
}

/* ---------- Header job readout: follows whichever plot is drawing ---------- */
const jobId = $('[data-job-id]');
const jobPct = $('[data-job-pct]');
function setJob(seed, p) {
  const id = hex(seed), pct = p == null ? 'Idle' : `${pad(Math.floor(clamp(p, 0, 1) * 100), 3)}%`;
  if (jobId.textContent !== id) jobId.textContent = id;
  if (jobPct.textContent !== pct) jobPct.textContent = pct;
}

/* ---------- Toast (neutral; blue is kept for the About pen) ---------- */
const toastEl = $('.toast');
let toastTimer;
const toast = (msg) => {
  clearTimeout(toastTimer);
  toastEl.textContent = '';
  toastEl.classList.add('is-on');
  requestAnimationFrame(() => { toastEl.textContent = msg; });
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 1800);
};

/* ---------- Chrome sizes ---------- */
const header = $('.header');
const bar = $('.footer__bar');
const setChrome = () => {
  root.style.setProperty('--header-h', `${header.offsetHeight}px`);
  const fixed = getComputedStyle(bar).position === 'fixed';
  root.style.setProperty('--foot-h', fixed ? `${bar.offsetHeight}px` : '0px');
};
setChrome();
if ('ResizeObserver' in window) {
  const ro = new ResizeObserver(setChrome);
  ro.observe(header); ro.observe(bar);
} else {
  window.addEventListener('resize', setChrome);
}

/* ---------- Hero: preflight, homing, registration marks, then the plot ---------- */
const hero = (() => {
  const well = $('[data-hero]');
  if (!well) return null;
  const canvas = $('.well__plot', well), travelCv = $('.well__travel', well), sheetEl = $('.well__sheet', well);
  const gantry = $('.well__gantry', well), penEl = $('.well__pen', well);
  const seedOut = $('[data-seed]', well), modeOut = $('[data-mode]', well), countOut = $('.well__count', well);
  const xyOut = $('[data-xy]', well), readout = $('[data-readout]', well);
  const progress = $('.well__progress', well), status = $('[data-plot-status]', well);
  const skipBtn = $('[data-skip]', well), nextBtn = $('[data-next]', well);
  const DURATION = 8000, T_PRE = 560, T_HOME = 420, T_MARK = 360, T_FEED = 240, MOVE_LIFE = 1500;

  let surf, tsurf, plot, job, cur, ticks, seed = 0, nextSeed = 0;
  let phase = 'idle', t0 = 0, elapsed = 0, last = 0, raf = 0, visible = true, announce = false, marks = 0;
  const moves = [];

  const margins = (w) => (w < 600 ? { t: 46, r: 22, b: 58, l: 22 } : { t: 60, r: 44, b: 76, l: 44 });
  const placePen = (x, y) => {
    gantry.style.transform = `translate3d(${x}px, 0, 0)`;
    penEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const setState = (s) => {
    well.classList.toggle('is-live', s === 'live');
    well.classList.toggle('is-parked', s === 'parked');
  };
  // Skip while plotting, Next seed once parked; keep keyboard focus on whichever is showing
  const controls = (plotting) => {
    const lost = document.activeElement === (plotting ? nextBtn : skipBtn);
    skipBtn.hidden = !plotting;
    nextBtn.hidden = plotting;
    if (lost) (plotting ? skipBtn : nextBtn).focus();
  };
  const setPhase = (p, now = performance.now()) => { phase = p; t0 = now; };
  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };

  function build(s) {
    seed = s >>> 0;
    surf = sizeCanvas(canvas);
    tsurf = sizeCanvas(travelCv);
    plot = buildFlowPlot(seed, surf.w, surf.h, margins(surf.w));
    job = createJob(plot.strokes, { homeX: plot.box.x0, homeY: plot.box.y0 });
    cur = createCursor(job);
    ticks = markTicks(plot.box);
    marks = 0;
    moves.length = 0;
    clearSurface(surf); clearSurface(tsurf);
    ink(surf.ctx, job);
    seedOut.textContent = hex(seed);
    modeOut.textContent = MODE_LABEL[plot.mode];
  }

  function drawMarks(k) {
    if (k > marks) { drawTicks(surf.ctx, ticks, marks, k); marks = k; ink(surf.ctx, job); }
  }

  function finish(silent = false) {
    phase = 'done';
    drawMarks(8);
    clearSurface(tsurf); moves.length = 0;
    placePen(plot.box.x0, plot.box.y0);
    setState('parked');
    well.style.setProperty('--bed', '0%');
    progress.style.transform = 'scaleX(1)';
    xyOut.textContent = `${((inkLength(job) * MM) / 1000).toFixed(1)} m of line`;
    readout.textContent = `Parked · ${job.n.toLocaleString('en-GB')} strokes`;
    controls(false);
    setJob(seed, null);
    if (announce && !silent) status.textContent = `Plot complete: ${job.n} strokes, seed ${hex(seed)}.`;
  }

  function plotUi() {
    const p = Math.min(1, cur.cost / job.total);
    placePen(cur.x, cur.y);
    xyOut.textContent = `X ${mm(cur.x - plot.box.x0)} Y ${mm(cur.y - plot.box.y0)} mm`;
    readout.textContent = `Stroke ${pad(strokesStarted(cur), 4)}/${pad(job.n, 4)} · ${pad(Math.floor(p * 100), 3)}%`;
    progress.style.transform = `scaleX(${p})`;
    setJob(seed, p);
  }

  function start(s, { intro = true } = {}) {
    build(s);
    if (!motion) {
      advance(surf.ctx, job, cur, Infinity);
      finish(true);
      return;
    }
    controls(true);
    setState('live');
    elapsed = 0;
    if (intro) {
      well.style.setProperty('--bed', '100%');
      placePen(surf.w / 2, surf.h / 2);
      setPhase('preflight');
    } else {
      setPhase('marks');
    }
    setJob(seed, 0);
    kick();
  }

  function frame(now) {
    raf = 0;
    if (!visible || phase === 'done' || phase === 'idle') return;
    const dt = last ? Math.min(250, now - last) : 0;
    last = now;
    const tp = now - t0;

    if (phase === 'preflight') {
      // a 000 → 100 counter while the bed dots scan in and the 1px line fills
      const p = clamp(tp / T_PRE, 0, 1), s = Math.floor(p * 20) / 20;
      well.style.setProperty('--bed', `${(1 - s) * 100}%`);
      progress.style.transform = `scaleX(${s})`;
      xyOut.textContent = 'Preflight · bed check';
      readout.textContent = 'Pen 1 · 0.3 mm · black';
      countOut.textContent = pad(Math.round(s * 100), 3);
      well.classList.add('is-pre');
      if (p >= 1) { well.classList.remove('is-pre'); progress.style.transform = 'scaleX(0)'; setPhase('homing', now); }
    } else if (phase === 'homing') {
      // the gantry travels from wherever it was left to the home corner, in ten steps
      const p = clamp(tp / T_HOME, 0, 1), s = Math.floor(p * 10) / 10;
      const sx = surf.w / 2, sy = surf.h / 2;
      const x = sx + (plot.box.x0 - sx) * s, y = sy + (plot.box.y0 - sy) * s;
      placePen(x, y);
      xyOut.textContent = `Homing X ${mm(x - plot.box.x0)} Y ${mm(y - plot.box.y0)}`;
      readout.textContent = `Stroke 0000/${pad(job.n, 4)} · 000%`;
      if (p >= 1) setPhase('marks', now);
    } else if (phase === 'marks') {
      const p = clamp(tp / T_MARK, 0, 1), k = Math.min(8, Math.floor(p * 8) + 1);
      drawMarks(k);
      placePen(ticks[k - 1][2], ticks[k - 1][3]);
      xyOut.textContent = `Registration ${k}/8`;
      if (p >= 1) { elapsed = 0; setPhase('plot', now); }
    } else if (phase === 'plot') {
      elapsed += dt;
      advance(surf.ctx, job, cur, job.total * Math.min(1, elapsed / DURATION), (i, fx, fy, tx, ty) => {
        if (Math.hypot(tx - fx, ty - fy) > 4) moves.push([fx, fy, tx, ty, now]);
      });
      while (moves.length && now - moves[0][4] > MOVE_LIFE) moves.shift();
      drawMoves(tsurf, moves, (m) => {
        const age = now - m[4];
        return Math.min(1, age / 120) * (1 - Math.max(0, (age - 900) / 600));
      });
      if (isDone(job, cur)) { finish(); return; }
      plotUi();
    } else if (phase === 'feed') {
      // the finished sheet feeds up 40px in 8px steps, then a blank one takes its place
      const p = clamp(tp / T_FEED, 0, 1);
      sheetEl.style.transform = `translate3d(0, ${-Math.round(p * 5) * 8}px, 0)`;
      if (p >= 1) { sheetEl.style.transform = ''; start(nextSeed, { intro: false }); return; }
    }
    kick();
  }

  skipBtn.addEventListener('click', () => {
    if (!job || phase === 'done') return;
    if (phase === 'feed') { sheetEl.style.transform = ''; build(nextSeed); }
    well.classList.remove('is-pre');
    advance(surf.ctx, job, cur, Infinity);
    finish();
  });
  nextBtn.addEventListener('click', () => {
    nextSeed = randomSeed();
    announce = true;
    if (!motion) { start(nextSeed); status.textContent = `Plotted seed ${hex(seed)}.`; return; }
    status.textContent = `Plotting seed ${hex(nextSeed)}.`;
    controls(true);
    setState('');
    setPhase('feed');
    kick();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) return;
      last = 0;
      if (phase === 'done') setJob(seed, null);
      kick();
    }).observe(well);
  }

  // Rebuild at the new size with the same seed, keeping progress
  if ('ResizeObserver' in window) {
    let rw = 0, rh = 0, rt;
    new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!rw) { rw = width; rh = height; return; }
      if (Math.abs(width - rw) < 1 && Math.abs(height - rh) < 60) return;
      rw = width; rh = height;
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (!job) return;
        if (phase === 'done' || !motion) {
          build(seed); advance(surf.ctx, job, cur, Infinity); finish(true);
        } else if (phase === 'plot') {
          const f = cur.cost / job.total;
          build(seed); drawMarks(8);
          advance(surf.ctx, job, cur, job.total * f);
          elapsed = f * DURATION;
          plotUi();
        } else {
          start(seed, { intro: false });
        }
      }, 200);
    }).observe(well);
  }

  const param = new URLSearchParams(window.location.search).get('seed');
  const initial = param && /^(0x)?[0-9a-f]{1,8}$/i.test(param) ? parseInt(param.replace(/^0x/i, ''), 16) : randomSeed();
  setTimeout(() => start(initial), 0);
  return { well };
})();

/* ---------- Plot reel: scroll scrubs the pen through the eight project plots ---------- */
const reel = (() => {
  const sec = $('.reel');
  if (!sec) return null;
  const items = $$('.reel__sheets li', sec).map((li) => ({
    li, kind: li.dataset.plot, seed: Number(li.dataset.seed), name: li.dataset.name, meta: li.dataset.meta
  }));

  if (!motion) {
    // reduced motion: the 4 × 2 grid of finished plots
    const draw = (it) => { const c = $('canvas', it.li); drawFinished(c, it.kind, it.seed); };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        draw(items.find((it) => it.li === e.target));
      }), { rootMargin: '300px 0px' });
      items.forEach((it) => io.observe(it.li));
    } else items.forEach(draw);
    return null;
  }

  const track = $('.reel__track', sec), well = $('.reel__well', sec), sheetEl = $('.well__sheet', well);
  const canvas = $('.reel__plot', well), travelCv = $('.well__travel', well);
  const gantry = $('.well__gantry', well), penEl = $('.well__pen', well);
  const figOut = $('[data-reel-fig]', well), kindOut = $('[data-reel-kind]', well);
  const nameOut = $('[data-reel-name]', well), metaOut = $('[data-reel-meta]', well);
  const xyOut = $('[data-reel-xy]', well), readout = $('[data-reel-readout]', well);
  const progress = $('.well__progress', well), ticks = $$('.reel__ticks li', well);
  const DRAW_FROM = 0.06, DRAW_TO = 0.84, FEED_FROM = 0.93;

  let surf, tsurf, sheet, jobs = [], k = -1, cur = null, active = false, lastKey = '';
  const moves = [];
  const onDown = (i, fx, fy, tx, ty) => {
    if (Math.hypot(tx - fx, ty - fy) < 4) return;
    moves.push([fx, fy, tx, ty]);
    if (moves.length > 6) moves.shift();
  };

  function layout() {
    surf = sizeCanvas(canvas);
    tsurf = sizeCanvas(travelCv);
    const W = surf.w, H = surf.h;
    const m = W < 600 ? { t: 46, r: 22, b: 58, l: 22 } : { t: 60, r: 44, b: 76, l: 44 };
    const aw = W - m.l - m.r, ah = H - m.t - m.b, ar = aw >= ah ? 1.5 : 0.8;
    let w = aw, h = aw / ar;
    if (h > ah) { h = ah; w = ah * ar; }
    sheet = { x: Math.round(m.l + (aw - w) / 2), y: Math.round(m.t + (ah - h) / 2), w: Math.round(w), h: Math.round(h) };
    jobs = [];
    k = -1;
    lastKey = '';
  }
  const job = (i) => jobs[i] || (jobs[i] = jobFor(PLOTS[items[i].kind], sheet.w, sheet.h, items[i].seed));

  function load(i) {
    k = i;
    const j = job(i);
    cur = createCursor(j);
    moves.length = 0;
    clearSurface(surf);
    surf.ctx.setTransform(surf.dpr, 0, 0, surf.dpr, sheet.x * surf.dpr, sheet.y * surf.dpr);
    tsurf.ctx.setTransform(tsurf.dpr, 0, 0, tsurf.dpr, sheet.x * tsurf.dpr, sheet.y * tsurf.dpr);
    drawTicks(surf.ctx, markTicks({ x0: 0, y0: 0, x1: sheet.w, y1: sheet.h }), 0, 8);
    ink(surf.ctx, j);
    const it = items[i];
    figOut.textContent = `Fig. ${pad(i + 1, 2)}`;
    kindOut.textContent = PLOT_LABEL[it.kind];
    nameOut.textContent = it.name;
    metaOut.textContent = it.meta;
  }

  function update() {
    if (!active) return;
    if (!surf) layout();
    const r = track.getBoundingClientRect();
    const travel = Math.max(1, track.offsetHeight - window.innerHeight);
    const p = Math.round(clamp(-r.top / travel, 0, 1) * 240) / 240;   // quantised: the scrub ticks
    const f = p * 8, i = Math.min(7, Math.floor(f)), q = Math.min(1, f - i);
    const d = clamp((q - DRAW_FROM) / (DRAW_TO - DRAW_FROM), 0, 1);
    const feed = i < 7 && q > FEED_FROM ? Math.round(((q - FEED_FROM) / (1 - FEED_FROM)) * 5) * 8 : 0;
    const key = `${i}:${d}:${feed}`;
    if (key === lastKey) return;
    lastKey = key;

    if (i !== k) load(i);
    const j = jobs[i], target = d * j.total;
    if (target < cur.cost - 0.01) load(i);          // scrolling back un-plots: redraw up to the new point
    if (target > cur.cost) advance(surf.ctx, j, cur, target, onDown);

    const live = d > 0 && d < 1;
    drawMoves(tsurf, live ? moves : [], (m, n) => 0.3 + (0.7 * (n + 1)) / moves.length);
    sheetEl.style.transform = feed ? `translate3d(0, ${-feed}px, 0)` : '';
    well.classList.toggle('is-live', live);
    well.classList.toggle('is-parked', d >= 1 && !feed);
    const px = d >= 1 ? 0 : cur.x, py = d >= 1 ? 0 : cur.y;
    gantry.style.transform = `translate3d(${sheet.x + px}px, 0, 0)`;
    penEl.style.transform = `translate3d(${sheet.x + px}px, ${sheet.y + py - feed}px, 0)`;

    if (d === 0) {
      xyOut.textContent = `Sheet ${pad(i + 1, 2)} of 08 loaded`;
      readout.textContent = `Stroke 0000/${pad(j.n, 4)} · 000%`;
    } else if (d < 1) {
      xyOut.textContent = `X ${mm(cur.x)} Y ${mm(cur.y)} mm`;
      readout.textContent = `Stroke ${pad(strokesStarted(cur), 4)}/${pad(j.n, 4)} · ${pad(Math.floor(d * 100), 3)}%`;
    } else {
      xyOut.textContent = items[i].kind === 'stipple' ? `${j.n.toLocaleString('en-GB')} dots` : `${((inkLength(j) * MM) / 1000).toFixed(1)} m of line`;
      readout.textContent = feed ? 'Feeding next sheet' : `Plotted · ${j.n.toLocaleString('en-GB')} strokes`;
    }
    progress.style.transform = `scaleX(${d})`;
    ticks.forEach((t, n) => t.style.setProperty('--f', n < i ? 1 : n === i ? d : 0));
    setJob(items[i].seed, d >= 1 ? null : d);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      active = e.isIntersecting;
      if (active) update();
    }).observe(track);
  } else active = true;
  if ('ResizeObserver' in window) {
    let rt;
    new ResizeObserver(() => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (surf) { layout(); update(); } }, 150);
    }).observe(well);
  }
  return { update };
})();

/* ---------- Work ledger: open rows plot their drawing; hover shows a snapshot by the cursor ---------- */
const rows = $$('.row');
rows.forEach((row) => {
  const details = $('details', row), fig = $('.row__fig', row), canvas = $('.row__plot', row), penEl = $('.row__pen', row);
  const seed = Number(row.dataset.seed), kind = row.dataset.plot;
  let raf = 0;
  const plotPanel = (instant) => {
    cancelAnimationFrame(raf);
    const s = sizeCanvas(canvas);
    s.ctx.fillStyle = '#000';
    s.ctx.fillRect(0, 0, s.w, s.h);
    const j = jobFor(PLOTS[kind], s.w, s.h, seed), c = createCursor(j);
    ink(s.ctx, j);
    if (instant || !motion) { advance(s.ctx, j, c, Infinity); return; }
    fig.classList.add('is-live');
    const t0 = performance.now(), D = 2600;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / D);
      advance(s.ctx, j, c, j.total * p);
      penEl.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
      setJob(seed, p < 1 ? p : null);
      if (p < 1 && details.open) raf = requestAnimationFrame(step);
      else { raf = 0; fig.classList.remove('is-live'); }
    };
    raf = requestAnimationFrame(step);
  };
  details.addEventListener('toggle', () => {
    if (!details.open) { cancelAnimationFrame(raf); raf = 0; fig.classList.remove('is-live'); return; }
    // exclusive accordion for browsers without <details name>
    rows.forEach((other) => {
      const d = $('details', other);
      if (d !== details && d.open) d.open = false;
    });
    plotPanel(false);
  });
  row.redraw = () => { if (details.open) plotPanel(true); };
});
let panelTimer;
window.addEventListener('resize', () => {
  clearTimeout(panelTimer);
  panelTimer = setTimeout(() => rows.forEach((row) => row.redraw()), 200);
});

const thumb = $('.thumb');
if (thumb && finePointer && rows.length) {
  const TW = 256, TH = 168;
  const tc = $('canvas', thumb), cap = $('.thumb__cap', thumb);
  const dpr = DPR();
  tc.width = TW * dpr; tc.height = TH * dpr;
  const tctx = tc.getContext('2d');
  const cache = new Map();
  const snapshot = (row) => {
    if (!cache.has(row)) cache.set(row, drawFinished(document.createElement('canvas'), row.dataset.plot, Number(row.dataset.seed), TW, TH).canvas);
    return cache.get(row);
  };
  let mx = 0, my = 0, raf = 0;
  // follow the cursor in 8px steps, flipping away from the viewport edges
  const place = () => {
    raf = 0;
    let x = mx + 24, y = my + 24;
    if (x + TW + 8 > window.innerWidth) x = mx - TW - 24;
    if (y + TH + 40 > window.innerHeight) y = my - TH - 56;
    thumb.style.transform = `translate3d(${Math.round(x / 8) * 8}px, ${Math.round(y / 8) * 8}px, 0)`;
  };
  rows.forEach((row, i) => {
    const sum = $('summary', row), details = $('details', row);
    sum.addEventListener('pointerenter', (e) => {
      if (details.open) return;
      tctx.drawImage(snapshot(row), 0, 0);
      cap.textContent = `Fig. ${pad(i + 1, 2)} · ${PLOT_LABEL[row.dataset.plot]} · seed ${row.dataset.seed}`;
      mx = e.clientX; my = e.clientY;
      place();
      thumb.classList.add('is-on');
    });
    sum.addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (!raf) raf = requestAnimationFrame(place);
    });
    sum.addEventListener('pointerleave', () => thumb.classList.remove('is-on'));
    sum.addEventListener('click', () => thumb.classList.remove('is-on'));
  });
  const warm = () => rows.forEach(snapshot);
  ('requestIdleCallback' in window) ? requestIdleCallback(warm, { timeout: 3000 }) : setTimeout(warm, 1500);
}

/* ---------- Services: each row's sketch re-seeds on hover, focus and click ---------- */
$$('.svc').forEach((row, i) => {
  const btn = $('.svc__plot', row);
  if (!btn || !MICRO[i]) return;
  const canvas = $('canvas', btn), seedOut = $('.svc__seed', btn);
  const s = sizeCanvas(canvas, 120, 28);
  let seed = 0x5eed + i * 977, raf = 0;
  const draw = (animate) => {
    cancelAnimationFrame(raf);
    s.ctx.fillStyle = '#000';
    s.ctx.fillRect(0, 0, 120, 28);
    const j = jobFor(MICRO[i], 120, 28, seed), c = createCursor(j);
    ink(s.ctx, j);
    seedOut.textContent = `0x${hex(seed).slice(-4)}`;
    if (!animate || !motion) { advance(s.ctx, j, c, Infinity); return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 420);
      advance(s.ctx, j, c, j.total * (Math.ceil(p * 6) / 6));   // six pen steps
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  draw(false);
  const reseed = () => { seed = randomSeed(); draw(true); };
  if (finePointer) row.addEventListener('pointerenter', reseed);
  btn.addEventListener('focus', () => { if (btn.matches(':focus-visible')) reseed(); });
  btn.addEventListener('click', reseed);
});

/* ---------- Paper scene: stepped wipe in, header inverts over it, one blue-pen figure ---------- */
const paper = $('#paper');
if (paper) {
  if (!motion || !('IntersectionObserver' in window)) paper.classList.add('is-in');
  else {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { paper.classList.add('is-in'); io.disconnect(); onScroll(); }
    }, { rootMargin: '0px 0px -30% 0px' });
    io.observe(paper);
  }
}
const paperHeader = () => {
  if (!paper) return;
  const r = paper.getBoundingClientRect(), line = header.offsetHeight / 2;
  root.classList.toggle('on-paper', paper.classList.contains('is-in') && r.top <= line && r.bottom > line);
};

const aboutFig = $('.about__fig');
if (aboutFig) {
  const canvas = $('canvas', aboutFig), penEl = $('.about__pen', aboutFig);
  const SEED = 0x7e3;
  let plotted = false;
  const plotFig = (instant) => {
    const s = sizeCanvas(canvas);
    const j = jobFor(portrait, s.w, s.h, SEED, { homeX: 0, homeY: 0 }), c = createCursor(j);
    j.width = Math.max(1.25, s.w / 400);
    ink(s.ctx, j, BLUE);
    if (instant || !motion) { advance(s.ctx, j, c, Infinity); return; }
    aboutFig.classList.add('is-live');
    const t0 = performance.now(), D = 3600;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / D);
      advance(s.ctx, j, c, j.total * p);
      penEl.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
      setJob(SEED, p < 1 ? p : null);
      if (p < 1) requestAnimationFrame(step);
      else aboutFig.classList.remove('is-live');
    };
    requestAnimationFrame(step);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      plotted = true;
      plotFig(false);
    }, { threshold: 0.45 });
    io.observe(aboutFig);
  } else { plotted = true; plotFig(true); }
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (plotted) plotFig(true); }, 200); });
}

// The archive counter ticks up in sixteen steps when About comes in
const counter = $('[data-count]');
let countStarted = false;
const startCount = () => {
  if (!counter || countStarted) return;
  countStarted = true;
  const target = Number(counter.dataset.count);
  if (!motion) return;
  let i = 0;
  const tick = () => {
    i++;
    counter.textContent = Math.round((target * i) / 16).toLocaleString('en-GB');
    if (i < 16) setTimeout(tick, 60);
  };
  counter.textContent = '0';
  setTimeout(tick, 120);
};

/* ---------- Section reveals (typed titles, stepped row wipes) ---------- */
$$('.reveal-rows').forEach((group) => {
  [...group.children].forEach((child, i) => child.style.setProperty('--r', Math.min(i, 10)));
});
const sections = $$('.section');
const revealed = (s) => { s.classList.add('is-in'); if (s.id === 'about') startCount(); };
if (!motion || !('IntersectionObserver' in window)) {
  sections.forEach(revealed);
} else {
  if (counter) counter.textContent = '0';
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { revealed(e.target); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px' });
  sections.forEach((s) => io.observe(s));
}

/* ---------- Grey titles drift right in 8px steps as they pass (STYLE.md quantised parallax) ---------- */
const megas = $$('.mega');
const slack = new Map();
const measureSlack = () => megas.forEach((m) => {
  slack.set(m, Math.max(0, Math.floor((m.parentElement.clientWidth - m.offsetWidth) / 8) * 8));
});
measureSlack();
const drift = () => {
  if (!motion) return;
  const vh = window.innerHeight;
  megas.forEach((m) => {
    const r = m.getBoundingClientRect();
    if (r.bottom < -40 || r.top > vh + 40) return;
    const p = clamp((vh - r.top) / (vh + r.height), 0, 1);
    m.style.setProperty('--drift', `${Math.min(slack.get(m) || 0, Math.round((p * 48) / 8) * 8)}px`);
  });
};

/* ---------- One scroll pass: reel scrub, title drift, header theme ---------- */
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    if (reel) reel.update();
    drift();
    paperHeader();
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { measureSlack(); onScroll(); });
onScroll();

/* ---------- Footer bar: frames the stage on arrival, returns once the colophon is clear ---------- */
const colophon = $('.footer__colophon');
if ('IntersectionObserver' in window && hero && colophon) {
  const seen = new Map([[hero.well, true], [colophon, false]]);
  const update = (entries) => {
    entries.forEach((e) => seen.set(e.target, e.target === hero.well ? e.intersectionRatio > 0.9 : e.intersectionRatio > 0.99));
    root.classList.toggle('bar-away', ![...seen.values()].some(Boolean));
  };
  new IntersectionObserver(update, { threshold: [0, 0.9, 1] }).observe(hero.well);
  new IntersectionObserver(update, { threshold: 1, rootMargin: `0px 0px -${bar.offsetHeight + 8}px 0px` }).observe(colophon);
}

/* ---------- Current section in the nav ---------- */
const navLinks = $$('.header__nav a');
if (navLinks.length && 'IntersectionObserver' in window) {
  const byId = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
  const navIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => a.removeAttribute('aria-current'));
      const a = byId.get(e.target.id);
      if (a) a.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('.stage, .reel, .section').forEach((s) => navIO.observe(s));
}

/* ---------- Grid overlay: G key, or the buttons ---------- */
const gridBtns = $$('[data-grid-toggle]');
const gridTag = $('.gridlay__tag');
const shortcutBtns = $$('[data-shortcut]');
let shortcut = true;
const updateTag = () => {
  const cs = getComputedStyle(root);
  const gap = parseInt(cs.getPropertyValue('--gap'), 10);
  const margin = parseInt(cs.getPropertyValue('--pad'), 10);
  gridTag.textContent = `12 col · gap ${gap} · margin ${margin}${shortcut ? ' · G to hide' : ''}`;
};
const setGrid = (on) => {
  root.classList.toggle('show-grid', on);
  gridBtns.forEach((b) => b.setAttribute('aria-pressed', String(on)));
  if (on) updateTag();
  toast(on ? 'Grid on' : 'Grid off');
};
gridBtns.forEach((b) => b.addEventListener('click', () => setGrid(!root.classList.contains('show-grid'))));
shortcutBtns.forEach((b) => b.addEventListener('click', () => {
  shortcut = b.dataset.shortcut === 'on';
  shortcutBtns.forEach((x) => x.setAttribute('aria-pressed', String((x.dataset.shortcut === 'on') === shortcut)));
  if (root.classList.contains('show-grid')) updateTag();
  toast(shortcut ? 'G key on' : 'G key off');
}));
window.addEventListener('resize', () => { if (root.classList.contains('show-grid')) updateTag(); });
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  const t = e.target;
  if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  if (shortcut && (e.key === 'g' || e.key === 'G')) setGrid(!root.classList.contains('show-grid'));
  else if (e.key === 'Escape' && root.classList.contains('show-grid') && !root.classList.contains('menu-open')) setGrid(false);
});

/* ---------- Clocks: Porto in the header, both studios in Contact ---------- */
const clocks = $$('[data-tz]');
const formats = new Map();
const partsIn = (tz, now) => {
  let f = formats.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    formats.set(tz, f);
  }
  const o = {};
  f.formatToParts(now).forEach((p) => { o[p.type] = p.value; });
  return o;
};
const tick = () => {
  const now = new Date();
  clocks.forEach((el) => {
    const p = partsIn(el.dataset.tz, now);
    const hm = `${p.hour}:${p.minute}`;
    const t = $('time', el);
    if (t.textContent !== hm) { t.textContent = hm; t.dateTime = hm; }
    const open = $('[data-open]', el);
    if (open) {
      const mins = Number(p.hour) * 60 + Number(p.minute);
      const weekday = p.weekday !== 'Sat' && p.weekday !== 'Sun';
      open.textContent = weekday && mins >= 570 && mins < 1110 ? 'Open' : 'Closed';
    }
  });
  setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
};
if (clocks.length) tick();

/* ---------- Email: click copies, a toast confirms ---------- */
const mail = $('[data-copy]');
const hint = $('#mail-hint');
if (mail) {
  const idle = '[ Click to copy ]';
  hint.textContent = idle;
  let hintTimer;
  const legacyCopy = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove();
    return ok;
  };
  mail.addEventListener('click', async (e) => {
    e.preventDefault();
    const text = mail.dataset.copy;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (err) { ok = legacyCopy(text); }
    if (!ok) { window.location.href = mail.href; return; }
    toast(`Copied: ${text}`);
    hint.textContent = '[ Copied ]';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { hint.textContent = idle; }, 2400);
  });
}

/* ---------- Mobile menu ---------- */
const menuBtn = $('.header__menu');
const menu = $('#menu');
if (menuBtn && menu) {
  const label = $('span', menuBtn);
  const outside = $$('main, .footer');
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    label.textContent = open ? '[ Close ]' : '[ Menu ]';
    menuBtn.setAttribute('aria-label', open ? 'Close' : 'Menu');
    menu.classList.toggle('is-open', open);
    root.classList.toggle('menu-open', open);
    outside.forEach((el) => { el.inert = open; });
    if (open) $('a', menu).focus();
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
  });
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
}

/* ---------- Stepped grain texture; paused with the tab ---------- */
const grain = document.createElement('canvas');
grain.width = grain.height = 128;
const gctx = grain.getContext('2d');
const img = gctx.createImageData(128, 128);
for (let i = 0; i < img.data.length; i += 4) {
  const v = (Math.random() * 255) | 0;
  img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  img.data[i + 3] = 255;
}
gctx.putImageData(img, 0, 0);
root.style.setProperty('--grain', `url(${grain.toDataURL()})`);
document.addEventListener('visibilitychange', () => root.classList.toggle('is-hidden', document.hidden));
