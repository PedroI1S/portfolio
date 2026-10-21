/* Undersun: page logic.
   Hero arrival (horizon, wellhead rising out of the ground, the undersun, letters), the WebGL wellhead
   with its projected callout and below-ground pipes, split headings, rolling figures, the descent
   (a pinned dive down the loop and back up), generated site maps, the sites rail and the mobile menu. */
const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const reduced = root.classList.contains('reduced') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const hasIO = 'IntersectionObserver' in window;

const hero = $('.hero');
const words = $$('.hw');
const header = $('.header');

/* ---------- Letter splitting ---------- */
// Visible letters are aria-hidden; a screen-reader copy keeps the heading readable as one string.
function split(el, perLetter) {
  const text = el.textContent.replace(/[ \t\n\r]+/g, ' ').trim();
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  let i = 0;
  const walk = (node, into) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        n.textContent.split(/([ \t\n\r]+)/).forEach((part) => {
          if (!part) return;
          if (/^[ \t\n\r]+$/.test(part)) { into.appendChild(document.createTextNode(' ')); return; }
          const word = document.createElement('span');
          word.className = 'split-word';
          [...part].forEach((c) => {
            const ch = document.createElement('span');
            ch.className = 'ch';
            ch.textContent = c;
            perLetter(ch, i++);
            word.appendChild(ch);
          });
          into.appendChild(word);
        });
      } else if (n.nodeName === 'BR') {
        into.appendChild(document.createElement('br'));
      } else if (n.nodeType === 1) {
        const c = n.cloneNode(false);
        walk(n, c);
        into.appendChild(c);
      }
    });
  };
  walk(el, vis);
  el.textContent = '';
  el.append(sr, vis);
}

if (!reduced) {
  $$('[data-split]').forEach((el) => split(el, (ch, i) => ch.style.setProperty('--dl', `${Math.min(i * 16, 900)}ms`)));
  // hero words: letters rise inside each word's mask; the h1 keeps its plain text
  const title = $('.hero__title');
  title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
  let li = 0;
  words.forEach((w) => {
    const inner = $('.hw__in', w);
    const txt = inner.textContent;
    inner.textContent = '';
    inner.setAttribute('aria-hidden', 'true');
    [...txt].forEach((c) => {
      const ch = document.createElement('span');
      ch.className = 'ch';
      ch.textContent = c;
      ch.style.setProperty('--i', li++);
      inner.appendChild(ch);
    });
  });
}

/* ---------- Rolling figures ---------- */
if (!reduced) {
  $$('[data-roll]').forEach((el) => {
    const txt = el.textContent.trim();
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = txt;
    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    vis.style.display = 'inline-flex';
    let d = 0;
    [...txt].forEach((c) => {
      if (/\d/.test(c)) {
        const digit = document.createElement('span');
        digit.className = 'digit';
        const col = document.createElement('span');
        col.className = 'digit__col';
        // one full turn before landing, so every column visibly rolls
        for (let k = 0; k < 20; k++) {
          const s = document.createElement('span');
          s.textContent = k % 10;
          col.appendChild(s);
        }
        col.style.setProperty('--n', 10 + Number(c));
        col.style.setProperty('--dl', `${120 + d * 110}ms`);
        d++;
        digit.appendChild(col);
        vis.appendChild(digit);
      } else {
        const s = document.createElement('span');
        s.textContent = c;
        vis.appendChild(s);
      }
    });
    el.textContent = '';
    el.append(sr, vis);
  });
}

/* ---------- Reveals ---------- */
const revealTargets = $$('[data-reveal], [data-split]');
if (reduced || !hasIO) {
  revealTargets.forEach((el) => el.classList.add('is-in'));
  hero.classList.add('is-in');
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });
  revealTargets.forEach((el) => io.observe(el));
}

/* ---------- Header state ---------- */
const setHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
setHeader();

/* ---------- Hero: arrival and wellhead ---------- */
// Object first: the horizon draws, the wellhead rises out of the ground, the undersun glows under the
// line, then the letters and the sub-line (CSS delays from .is-in). The sequence waits for the first
// WebGL frame; if that is slow (or there is no WebGL) the poster drawing rises instead.
let world = null;
let introMode = null;
const callout = $('.hero__callout');
const fig = $('.hero__fig');
const leader = $('.hero__leader polyline');
const dot = $('.hero__leader circle');
const objBox = $('.hero__obj');
let figBox = null;

function startIntro(mode) {
  if (introMode) return;
  introMode = mode;
  if (mode === 'poster') root.classList.add('poster-on');
  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-in')));
}
if (reduced) { hero.classList.add('is-in'); introMode = 'static'; }
else if (hero.classList.contains('is-in')) introMode = 'poster';   // the page's safety net already showed the drawing

const measureFig = () => {
  if (!callout || getComputedStyle(callout).display === 'none') { figBox = null; return; }
  const h = hero.getBoundingClientRect();
  const r = fig.getBoundingClientRect();
  figBox = { x: r.left - h.left, y: r.top - h.top + r.height / 2 };
};

// the object box in hero px (offsets ignore the rise transform)
const getBox = () => {
  const stage = objBox.offsetParent;
  return { cx: stage.offsetLeft + objBox.offsetLeft, bottom: stage.offsetTop + objBox.offsetTop + objBox.offsetHeight, h: objBox.offsetHeight };
};

const groundVars = {};
function syncGround(g) {
  const set = (k, v) => {
    if (groundVars[k] !== undefined && Math.abs(groundVars[k] - v) < 0.3) return;
    groundVars[k] = v;
    hero.style.setProperty(k, `${v.toFixed(1)}px`);
  };
  set('--g-cx', g.cx); set('--g-cw', g.cw); set('--g-l1', g.l1); set('--g-l2', g.l2); set('--g-lw', g.lw);
}

function onWorldFrame(f) {
  syncGround(f.ground);
  if (!figBox || !f.risen) return;
  const { x, y } = f;
  const lx = figBox.x, ly = figBox.y;
  const dy = Math.abs(y - ly);
  const kx = Math.min(x + 26 + dy, lx - 24);
  leader.setAttribute('points', `${(x + 10).toFixed(1)},${y.toFixed(1)} ${kx.toFixed(1)},${ly.toFixed(1)} ${lx.toFixed(1)},${ly.toFixed(1)}`);
  dot.setAttribute('cx', x.toFixed(1));
  dot.setAttribute('cy', y.toFixed(1));
  if (!callout.classList.contains('is-placed') && x < lx - 60) callout.classList.add('is-placed');
}

async function bootWorld() {
  if (!root.classList.contains('has-webgl')) { if (!reduced) startIntro('poster'); return; }
  // a slow network should not leave the sky empty: after 1.2 s the drawing rises in its place
  const late = reduced ? 0 : setTimeout(() => startIntro('poster'), 1200);
  try {
    const { createWellhead } = await import('./world.js?v=5');
    measureFig();
    world = createWellhead($('.hero__canvas'), { reduced, onFrame: onWorldFrame, getBox });
    clearTimeout(late);
    if (introMode === 'poster') {
      // the drawing already rose: the live wellhead fades in over it, at rest
      world.startIntro(true);
      root.classList.add('gl-late');
    } else if (!reduced) {
      startIntro('gl');
      requestAnimationFrame(() => requestAnimationFrame(() => world.startIntro()));
    } else {
      world.startIntro(true);
    }
    root.classList.add('gl-on');
    if (hasIO) {
      new IntersectionObserver(([e]) => (e.isIntersecting ? world.start() : world.stop()), { rootMargin: '80px 0px' }).observe(hero);
    } else {
      world.start();
    }
  } catch (err) {
    clearTimeout(late);
    console.warn('Undersun: 3D view unavailable, showing the drawing instead.', err);
    root.classList.add('gl-failed');
    if (!reduced) startIntro('poster');
  }
}
bootWorld();

if (finePointer && !reduced) {
  window.addEventListener('pointermove', (e) => {
    if (!world) return;
    world.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });
}

/* ---------- Scroll-linked bits ---------- */
const speeds = [0.14, 0.07, 0];
let ticking = false;
function onScroll() {
  ticking = false;
  setHeader();
  const y = window.scrollY;
  if (!reduced) {
    const hh = hero.offsetHeight;
    if (y <= hh * 1.1) {
      words.forEach((w, i) => { if (speeds[i]) w.style.transform = `translate3d(0, ${(-y * speeds[i]).toFixed(1)}px, 0)`; });
      world && world.setScroll(clamp(y / hh, 0, 1));
    }
    hero.classList.toggle('is-off', y > hh);
  }
  dive.update(y);
}
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

let resizeTimer;
let lastW = window.innerWidth;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    measureFig();
    world && world.resize();
    updateRail();
    // phones fire resize when the toolbar shows or hides; only rebuild the descent for real changes
    if (window.innerWidth !== lastW || !dive.isBuilt()) { lastW = window.innerWidth; dive.layout(); }
    onScroll();
  }, 140);
});
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measureFig(); dive.layout(); onScroll(); });

/* ---------- How it works: the descent ---------- */
// A pinned stage (sticky, no scroll-jacking): the page scrolls, p runs 0 → 1, and a camera moves a tall
// world under it. Down the cold leg to 4,800 m, the lateral lights and the undersun grows under it,
// then back up the hot leg to the surface, where the careers section slides up over the dawn.
// The static cross-section and the steps list stay for no-JS and reduced motion.
const lerp = (a, b, t) => a + (b - a) * t;
const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
const smooth = (t) => t * t * (3 - 2 * t);
const glide = (t) => 0.5 * t + 0.5 * smooth(t);   // eased ends, a steady middle

const STRATA = [
  { from: 0, to: 150, name: 'Glacial till' },
  { from: 150, to: 900, name: 'Sandstone' },
  { from: 900, to: 1800, name: 'Mudstone' },
  { from: 1800, to: 2900, name: 'Limestone' },
  { from: 2900, to: 3600, name: 'Shale' },
  { from: 3600, to: 4800, name: 'Granite' },
];
const DEPTH = 4800;
const fmt = (n) => Math.round(n).toLocaleString('en-GB');

const dive = (() => {
  const how = $('#how');
  const careers = $('#careers');
  const head = $('.how__head', how);
  const steps = $$('.step', how);
  const on = !reduced && !!how && !!careers;
  let built = false, L = null;
  const el = {};

  function build() {
    const wrap = document.createElement('div');
    wrap.className = 'dive';
    wrap.innerHTML = `
      <div class="dive__stage">
        <div class="dive__world">
          <div class="dive__sky"><div class="dive__dawn"></div></div>
          <span class="dsun dsun--deep"></span>
          <span class="dsun dsun--surface"></span>
          <svg class="dive__svg" aria-hidden="true" focusable="false"></svg>
          <p class="dive__mark" aria-hidden="true">4,800<small>m</small></p>
        </div>
        <div class="dive__glow" aria-hidden="true"></div>
        <dl class="dive__hud glass" aria-hidden="true">
          <dt>Depth</dt><dd data-hud="depth">0 m</dd>
          <dt>Rock</dt><dd data-hud="rock">12 °C</dd>
          <dt>Loop</dt><dd data-hud="loop">12 °C</dd>
          <dd class="hud__phase" data-hud="phase">Surface · pad</dd>
        </dl>
      </div>
      <div class="dive__track"></div>
      <div class="dive__tail"></div>`;
    how.appendChild(wrap);
    el.wrap = wrap;
    el.stage = $('.dive__stage', wrap);
    el.world = $('.dive__world', wrap);
    el.sky = $('.dive__sky', wrap);
    el.dawn = $('.dive__dawn', wrap);
    el.svg = $('.dive__svg', wrap);
    el.mark = $('.dive__mark', wrap);
    el.sunDeep = $('.dsun--deep', wrap);
    el.sunTop = $('.dsun--surface', wrap);
    el.glow = $('.dive__glow', wrap);
    el.hud = $('.dive__hud', wrap);
    el.track = $('.dive__track', wrap);
    el.hudv = Object.fromEntries($$('[data-hud]', wrap).map((d) => [d.dataset.hud, d]));

    // the statement rides in the sky band; the steps become captions at their depth
    el.world.appendChild(head);
    const sr = document.createElement('p');
    sr.className = 'sr-only';
    sr.textContent = $('#xsec-desc').textContent;
    el.world.appendChild(sr);
    const depthLabel = ['0 m · the pad', '2,000 m', '4,800 m · the lateral', 'Back at the surface'];
    el.caps = steps.map((s, i) => {
      const cap = document.createElement('div');
      cap.className = 'cap';
      cap.innerHTML = `<p class="cap__depth">${depthLabel[i]}</p><h3 class="cap__h"><span class="cap__no">${$('.step__no', s).textContent}</span><span class="cap__title">${$('.step__title', s).textContent}</span></h3><p>${$('p', s).innerHTML}</p>`;
      el.world.appendChild(cap);
      return cap;
    });
    el.strata = STRATA.map((s) => {
      const lab = document.createElement('p');
      lab.className = 'stratum';
      lab.setAttribute('aria-hidden', 'true');
      lab.innerHTML = `${s.name}<span>${fmt(s.from)}–${fmt(s.to)} m</span>`;
      el.world.appendChild(lab);
      return lab;
    });
    root.classList.add('dive-on');
    built = true;
  }

  // geometry for the current viewport; the pipes pick up the hero's below-ground pipes on desktop
  function layout() {
    if (!on) return;
    if (!built) build();
    const W = el.stage.clientWidth, H = el.stage.clientHeight;
    const mobile = W <= 900;
    const gut = parseFloat(getComputedStyle(root).getPropertyValue('--gutter')) || 20;
    let cx, g, lw, cw;
    const hr = hero.getBoundingClientRect();
    const pr = (s) => $(s, hero).getBoundingClientRect();
    if (!mobile && hr.width) {
      const c = pr('.gpipe--casing'), a = pr('.gpipe--cold'), b = pr('.gpipe--warm');
      cx = c.left + c.width / 2 - hr.left;
      cw = c.width;
      g = (b.left - a.left) / 2;
      lw = (a.width + b.width) / 2;
    } else {
      cx = W - Math.max(gut + 34, W * 0.13); g = 13; lw = 9; cw = 20;
    }
    const dir = mobile ? -1 : 1;
    const skyH = 0.8 * H;
    const D = (mobile ? 1.3 : 1.9) * H;
    const ys = skyH;
    const yAt = (m) => ys + (m / DEPTH) * D;
    const yL = yAt(DEPTH);
    const lg = mobile ? 22 : 34;                   // lateral: upper and lower lines either side of 4,800 m
    const rc = mobile ? 16 : 26;                   // corner radius
    const yLo = yL + lg, yUp = yL - lg;
    const xc = cx - dir * g, xw = cx + dir * g;
    const xFar = dir > 0 ? W - gut - 8 : gut + 8;
    const worldH = yL + 1.15 * H;
    L = { W, H, mobile, gut, cx, g, lw, cw, dir, ys, D, yAt, yL, yLo, yUp, rc, xc, xw, xFar, worldH,
      c0: ys - (mobile ? 0.56 : 0.62) * H, cB: yL - 0.4 * H, cE: ys - (mobile ? 0.76 : 0.7) * H };
    L.cB2 = L.cB + 0.06 * H;

    el.track.style.height = '';
    el.world.style.height = `${worldH}px`;
    el.sky.style.height = `${ys}px`;
    el.world.style.background = `linear-gradient(180deg, transparent ${ys}px, #F6E6DA ${ys}px, #F5DFCF ${yAt(150)}px, #F4D7C3 ${yAt(900)}px,
      #F3CAAE ${yAt(1800)}px, #F3BA90 ${yAt(2900)}px, #F4AE79 ${yAt(3600)}px, #F5A766 ${yL}px, #F8B26D ${yL + 0.45 * H}px, #FFD29A ${worldH}px)`;

    drawWorld();

    // statement at the top of the sky band; captions at their depths
    // statement just under the header (and under the HUD strip on phones) in the opening frame
    head.style.top = `${L.c0 + parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) + (mobile ? 100 : 34)}px`;
    if (mobile) root.style.setProperty('--cap-w', `${Math.max(200, Math.min(L.xw, L.xc) - L.lw / 2 - gut - 22)}px`);
    const [c1, c2, c3, c4] = el.caps;
    c1.style.top = `${ys + (mobile ? 30 : 48)}px`;
    c2.style.top = `${yAt(2000) - 24}px`;
    c3.style.top = `${yUp - 30 - c3.offsetHeight}px`;
    c4.style.top = `${ys - (mobile ? 76 : 44) - c4.offsetHeight}px`;   // clear of the buildings on the surface
    el.strata.forEach((lab, i) => {
      const s = STRATA[i];
      lab.style.display = mobile ? 'none' : '';
      lab.style.right = `${gut}px`;
      lab.style.top = `${yAt(s.from + Math.min(260, (s.to - s.from) * 0.35))}px`;
    });
    el.mark.style.top = `${yLo + (mobile ? 0.06 : 0.07) * H}px`;
    const deepW = 1.6 * W;
    Object.assign(el.sunDeep.style, { width: `${deepW}px`, left: `${(dir > 0 ? (xc + xFar) / 2 : (xc + xFar) / 2) - deepW / 2}px`, top: `${yLo + 1}px` });
    const topW = mobile ? 0.86 * W : Math.min(0.42 * W, 640);
    Object.assign(el.sunTop.style, { width: `${topW}px`, left: `${cx - topW / 2}px`, top: `${ys + 1}px` });
    el.glow.style.setProperty('--glow-x', `${(cx / W) * 100}%`);
    measure();
    update(window.scrollY, true);
  }

  // careers rides over the last frame: the section is padded by its height and careers pulls up into it
  function measure() {
    root.style.setProperty('--careers-h', `${careers.offsetHeight}px`);
  }

  function drawWorld() {
    const { W, worldH, ys, yAt, yL, yLo, yUp, rc, xc, xw, xFar, lw, cw, cx, dir, mobile, gut } = L;
    const f = (n) => n.toFixed(1);
    const sw0 = dir > 0 ? 0 : 1, sw1 = dir > 0 ? 1 : 0;
    // the loop as three paths: down, along and back, up
    const cold = `M${f(xc)} ${f(ys)} V${f(yLo - rc)}`;
    const lat1 = `M${f(xc)} ${f(yLo - rc)} A${rc} ${rc} 0 0 ${sw0} ${f(xc + dir * rc)} ${f(yLo)} H${f(xFar - dir * (yLo - yL))} A${f(yLo - yL)} ${f(yLo - yL)} 0 0 ${sw0} ${f(xFar - dir * (yLo - yL))} ${f(yUp)}`;
    const lat2 = `M${f(xFar - dir * (yLo - yL))} ${f(yUp)} H${f(xw + dir * rc)} A${rc} ${rc} 0 0 ${sw1} ${f(xw)} ${f(yUp - rc)}`;
    const warm = `M${f(xw)} ${f(yUp - rc)} V${f(ys)}`;
    const all = [cold, lat1, lat2, warm];

    // strata boundaries, gently wavy, and a hatch per band
    let strata = '', hatch = '';
    const pats = [
      ['-35', 9, .07], ['-35', 7, .06], ['0', 10, .07], ['35', 11, .06], ['-20', 6, .06], ['55', 8, .08],
    ];
    STRATA.forEach((s, i) => {
      const y0 = yAt(s.from), y1 = i === STRATA.length - 1 ? worldH : yAt(s.to);
      hatch += `<rect x="0" y="${f(y0)}" width="${W}" height="${f(y1 - y0)}" fill="url(#dw-h${i})"/>`;
      if (i === 0) return;
      const amp = 7 + (i % 3) * 3, ph = i * 1.7;
      let d = `M0 ${f(y0)}`;
      for (let x = 0; x <= W + 40; x += 40) d += ` L${x} ${f(y0 + Math.sin(x / 210 + ph) * amp + Math.sin(x / 67 + ph * 2) * amp * 0.25)}`;
      strata += `<path d="${d}"/>`;
    });
    const defs = pats.map(([a, s, o], i) => `<pattern id="dw-h${i}" width="${s}" height="${s}" patternUnits="userSpaceOnUse" patternTransform="rotate(${a})"><path d="M0 0v${s}" stroke="#7A3A1E" stroke-opacity="${o}" stroke-width="1"/></pattern>`).join('');

    // depth ruler beside the cold leg
    const xr = xc - dir * (lw / 2 + (mobile ? 14 : 46));
    let ruler = `<path class="dw-ruler" d="M${f(xr)} ${f(ys)} V${f(yL)}"/>`;
    for (let m = 0; m <= DEPTH; m += 250) {
      const y = yAt(m), major = m % 1000 === 0 || m === DEPTH;
      ruler += `<path class="dw-ruler" d="M${f(xr)} ${f(y)} h${-dir * (major ? 10 : 5)}"/>`;
      if (major && !mobile && m > 0) ruler += `<text class="dw-ruler-t" x="${f(xr - dir * 16)}" y="${f(y + 4)}" text-anchor="${dir > 0 ? 'end' : 'start'}">${fmt(m)} m</text>`;
    }

    // surface: horizon, the plant on the pad, a factory and homes on the hot main
    const plantW = mobile ? 56 : 150, plantH = mobile ? 26 : 50;
    const px0 = cx - plantW / 2;
    let surf = `<path class="dw-line" d="M${f(px0)} ${f(ys)} V${f(ys - plantH)} H${f(px0 + plantW)} V${f(ys)}"/>`;
    surf += `<path class="dw-line" d="M${f(px0)} ${f(ys - plantH)} L${f(px0 + plantW * 0.18)} ${f(ys - plantH - plantH * 0.36)} H${f(px0 + plantW * 0.82)} L${f(px0 + plantW)} ${f(ys - plantH)}"/>`;
    surf += `<circle class="dw-line" cx="${f(cx)}" cy="${f(ys - plantH * 0.48)}" r="${mobile ? 6 : 11}"/>`;
    // the factory sits left of the plant; homes to the right on desktop, further left on phones
    const fw = mobile ? 60 : 140, fh = mobile ? 24 : 46;
    const fxa = mobile ? px0 - 18 - fw : cx - 300, teeth = 4;
    let saw = `M${f(fxa)} ${f(ys)} V${f(ys - fh)}`;
    for (let i = 0; i < teeth; i++) saw += ` L${f(fxa + (i + 1) * fw / teeth)} ${f(ys - fh - fh * 0.42)} V${f(ys - fh)}`;
    saw += ` V${f(ys)}`;
    surf += `<path class="dw-line" d="${saw}"/><path class="dw-line" d="M${f(fxa + fw * 0.12)} ${f(ys - fh)} V${f(ys - fh * 2.1)} h${f(fw * 0.1)} V${f(ys - fh)}"/>`;
    let homes = '';
    const hw = mobile ? 20 : 30, hh = mobile ? 18 : 26, hn = mobile ? 3 : 4, hgap = mobile ? 9 : 18;
    const hx0 = mobile ? fxa - 18 - hn * (hw + hgap) + hgap : cx + plantW / 2 + 90;
    for (let i = 0; i < hn; i++) {
      const x = hx0 + i * (hw + hgap);
      homes += `<path class="dw-line" d="M${f(x)} ${f(ys)} V${f(ys - hh)} L${f(x + hw / 2)} ${f(ys - hh - hw * 0.5)} L${f(x + hw)} ${f(ys - hh)} V${f(ys)}"/>`;
    }
    surf += homes;
    const hotY = ys - (mobile ? 8 : 14);
    const hot = [
      `M${f(px0)} ${f(hotY)} H${f(fxa + fw)}`,
      mobile ? `M${f(fxa)} ${f(hotY)} H${f(hx0 + hn * (hw + hgap) - hgap)}` : `M${f(px0 + plantW)} ${f(hotY)} H${f(hx0)}`,
    ];

    // heat coming off the rock along the lateral
    let heat = '';
    const n = mobile ? 4 : 7;
    for (let i = 0; i < n; i++) {
      const x = lerp(xc + dir * 80, xFar - dir * 70, i / (n - 1));
      const yb = i % 2 ? yLo + 34 : yUp - 34;
      const s = i % 2 ? -1 : 1;
      heat += `<path d="M${f(x)} ${f(yb)} q6 ${-8 * s} 0 ${-16 * s} t0 ${-16 * s}"/>`;
    }

    const ghostW = lw + 6;
    el.svg.setAttribute('width', W);
    el.svg.setAttribute('height', f(worldH));
    el.svg.setAttribute('viewBox', `0 0 ${W} ${f(worldH)}`);
    el.svg.innerHTML = `
      <defs>${defs}
        <linearGradient id="dw-col" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${f(ys)}" y2="${f(yAt(700))}"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <linearGradient id="dw-lat" gradientUnits="userSpaceOnUse" x1="${f(xc)}" x2="${f(xFar)}" y1="0" y2="0"><stop offset="0" stop-color="#3D5E86"/><stop offset=".7" stop-color="#C8643A"/></linearGradient>
      </defs>
      <g class="dw-hatch">${hatch}</g>
      <g class="dw-strata">${strata}</g>
      <path class="dw-surface-edge" d="M0 ${f(ys + 1.5)} H${W}"/>
      ${ruler}
      <path class="dw-col" stroke-width="${f(cw)}" d="M${f(cx)} ${f(ys)} V${f(yAt(700))}"/>
      ${all.map((d) => `<path class="dw-ghost" stroke-width="${f(ghostW + 2)}" d="${d}"/>`).join('')}
      ${all.map((d) => `<path class="dw-casing" stroke-width="${f(ghostW)}" d="${d}"/>`).join('')}
      <g class="dw-heat" opacity="0">${heat}</g>
      <path class="dw-glowpipe" stroke-width="${f(lw * 2.4)}" d="${warm}"/>
      <path class="dw-pipe dw-pipe--cold" pathLength="1" stroke-width="${f(lw)}" d="${cold}"/>
      <path class="dw-pipe dw-pipe--lat" pathLength="1" stroke-width="${f(lw)}" d="${lat1}"/>
      <path class="dw-pipe dw-pipe--warm" pathLength="1" stroke-width="${f(lw)}" d="${lat2}"/>
      <path class="dw-pipe dw-pipe--warm" pathLength="1" stroke-width="${f(lw)}" d="${warm}"/>
      <path class="dw-flow" d="M${f(xc)} ${f(ys)} V${f(yAt(1400))}"/>
      <path class="dw-flow dw-flow--up" d="M${f(xw)} ${f(ys)} V${f(yAt(1400))}"/>
      ${hot.map((d) => `<path class="dw-hot" pathLength="1" d="${d}"/>`).join('')}
      <path class="dw-surface" d="M0 ${f(ys)} H${W}"/>
      ${surf}`;
    el.pipes = $$('.dw-pipe', el.svg);
    el.hot = $$('.dw-hot', el.svg);
    el.heat = $('.dw-heat', el.svg);
    el.glowPipe = $('.dw-glowpipe', el.svg);
  }

  // the camera: down, a hold at the bottom, back up, a hold at the surface
  function camAt(p) {
    if (p <= 0.04) return L.c0;
    if (p <= 0.44) return lerp(L.c0, L.cB, glide((p - 0.04) / 0.4));
    if (p <= 0.58) return lerp(L.cB, L.cB2, smooth((p - 0.44) / 0.14));
    if (p <= 0.88) return lerp(L.cB2, L.cE, glide((p - 0.58) / 0.3));
    return L.cE;
  }
  const depthAt = (y) => clamp(((y - L.ys) / L.D) * DEPTH, 0, DEPTH);
  const strataAt = (m) => STRATA.find((s) => m < s.to) || STRATA[STRATA.length - 1];

  let last = {};
  const put = (node, prop, val) => {
    const key = node.dataset.k || (node.dataset.k = Math.random().toString(36).slice(2));
    if (last[key + prop] === val) return;
    last[key + prop] = val;
    if (prop === 'text') node.textContent = val;
    else node.style[prop] = val;
  };

  function update(scrollY, force = false) {
    if (!built || !L) return;
    const top = how.offsetTop;
    const dist = el.track.offsetHeight;
    const H = L.H;
    if (!force && (scrollY < top - 2 * H || scrollY > top + dist + careers.offsetHeight + 2 * H)) { el.wrap.classList.remove('is-flowing'); return; }
    const p = clamp((scrollY - top) / dist, 0, 1);
    const q = clamp((scrollY + H - careers.offsetTop) / careers.offsetHeight, 0, 1);
    const c = camAt(p);
    put(el.world, 'transform', `translate3d(0, ${(-c).toFixed(1)}px, 0)`);

    // drawing: the cold leg follows the camera down, the lateral lights, the hot leg follows it back up
    const coldF = p >= 0.44 ? 1 : clamp((c + 0.55 * H - L.ys) / (L.yLo - L.rc - L.ys), 0, 1);
    const lat1 = ramp(p, 0.45, 0.53), lat2 = ramp(p, 0.53, 0.58);
    const warmF = p < 0.58 ? 0 : clamp((L.yUp - L.rc - (c + 0.5 * H)) / (L.yUp - L.rc - L.ys), 0, 1);
    [coldF, lat1, lat2, warmF].forEach((v, i) => put(el.pipes[i], 'strokeDashoffset', (1 - v).toFixed(4)));
    const hotF = ramp(p, 0.84, 0.9);
    el.hot.forEach((h) => put(h, 'strokeDashoffset', (1 - hotF).toFixed(4)));
    put(el.heat, 'opacity', ramp(p, 0.48, 0.56).toFixed(3));
    put(el.glowPipe, 'opacity', (ramp(p, 0.58, 0.64) * 0.55).toFixed(3));

    // the undersun at the lateral, then the one under the surface that keeps rising through careers
    const grow = ramp(p, 0.45, 0.6);
    put(el.sunDeep, 'opacity', ramp(p, 0.44, 0.5).toFixed(3));
    put(el.sunDeep, 'transform', `scale(${(0.05 + 0.95 * Math.pow(grow, 1.7)).toFixed(4)})`);
    const sink = lerp(lerp(0.6, 0.22, ramp(p, 0.8, 1)), 0, smooth(ramp(q, 0, 0.75)));
    put(el.sunTop, 'opacity', ramp(p, 0.78, 0.9).toFixed(3));
    put(el.sunTop, 'transform', `translate3d(0, ${(sink * 100).toFixed(2)}%, 0)`);
    put(el.dawn, 'opacity', smooth(ramp(p, 0.8, 0.96)).toFixed(3));
    put(el.glow, 'opacity', (ramp(p, 0.55, 0.62) * (1 - ramp(p, 0.84, 0.94))).toFixed(3));

    // copy: statement first, captions by depth, the 4,800 m inscription at the bottom
    put(head, 'opacity', (1 - ramp(p, 0.05, 0.12)).toFixed(3));
    put(el.caps[0], 'opacity', (1 - ramp(p, 0.82, 0.86)).toFixed(3));
    put(el.caps[1], 'opacity', (1 - ramp(p, 0.82, 0.86)).toFixed(3));
    const c3 = ramp(p, 0.42, 0.48);
    put(el.caps[2], 'opacity', c3.toFixed(3));
    put(el.caps[2], 'transform', `translate3d(0, ${((1 - c3) * 24).toFixed(1)}px, 0)`);
    const c4 = ramp(p, 0.86, 0.92);
    put(el.caps[3], 'opacity', c4.toFixed(3));
    put(el.caps[3], 'transform', `translate3d(0, ${((1 - c4) * 24).toFixed(1)}px, 0)`);
    const mk = ramp(p, 0.43, 0.5);
    put(el.mark, 'opacity', mk.toFixed(3));
    put(el.mark, 'transform', `translate3d(0, ${((1 - mk) * 40).toFixed(1)}px, 0)`);
    const mid = c + 0.5 * H;
    el.strata.forEach((lab, i) => {
      const s = STRATA[i];
      const lit = mid >= L.yAt(s.from) && (i === STRATA.length - 1 || mid < L.yAt(s.to));
      if (lab.classList.contains('is-lit') !== lit) lab.classList.toggle('is-lit', lit);
    });

    // HUD: depth of the camera on the way down, of the hot front on the way back
    let depth, loop, phase;
    if (p < 0.04) { depth = 0; loop = 12; phase = 'Surface · pad'; }
    else if (p < 0.44) { depth = depthAt(c + 0.55 * H); loop = 12 + depth * 0.0045; phase = 'Cold leg ↓'; }
    else if (p < 0.58) { depth = DEPTH; loop = lerp(34, 150, ramp(p, 0.45, 0.58)); phase = `Lateral ${L.dir > 0 ? '→' : '←'}`; }
    else if (p < 0.88) { depth = depthAt(c + 0.5 * H); loop = 128 + 22 * (depth / DEPTH); phase = 'Hot leg ↑'; }
    else { depth = 0; loop = 128; phase = 'Surface exchanger'; }
    const rock = 12 + depth * 0.03;
    put(el.hudv.depth, 'text', `${fmt(Math.round(depth / 10) * 10)} m`);
    put(el.hudv.rock, 'text', `${Math.round(rock)} °C`);
    put(el.hudv.loop, 'text', `${Math.round(loop)} °C`);
    put(el.hudv.phase, 'text', depth > 0 && p < 0.88 ? `${phase} · ${strataAt(depth).name}` : phase);
    // the HUD steps aside for careers (and on phones for the last caption, which needs the room)
    el.hud.classList.toggle('is-hidden', q > 0.02 || (L.mobile && p > 0.9));
    el.wrap.classList.toggle('is-flowing', p > 0.9 && q < 0.98);
  }

  if (on) {
    layout();
    if ('ResizeObserver' in window) new ResizeObserver(() => { const h = careers.offsetHeight; if (h && Math.abs(h - (L ? parseFloat(root.style.getPropertyValue('--careers-h')) : 0)) > 1) { measure(); } }).observe(careers);
  }
  return { update: on ? update : () => {}, layout: on ? layout : () => {}, isBuilt: () => built };
})();
onScroll();

/* ---------- Site maps ---------- */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f1 = (n) => n.toFixed(1);

function smoothClosed(pts) {
  // Catmull-Rom through the points, as cubic Béziers
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length], p1 = pts[i], p2 = pts[(i + 1) % pts.length], p3 = pts[(i + 2) % pts.length];
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d + 'Z';
}

function drawMap(card) {
  const W = 400, H = 300;
  const rand = mulberry32(Number(card.dataset.seed) * 7919);
  const r = (a, b) => a + rand() * (b - a);
  const kind = card.dataset.kind;
  const title = $('.site__title', card).textContent;
  const code = title.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const index = $$('.site').indexOf(card) + 1;
  let s = '';

  // terrain: two hills of wobbly contours
  for (let hIdx = 0; hIdx < 2; hIdx++) {
    const cx = r(hIdx ? 250 : 40, hIdx ? 380 : 170), cy = r(hIdx ? 30 : 160, hIdx ? 130 : 280);
    const ph = [r(0, 6.28), r(0, 6.28), r(0, 6.28)];
    for (let k = 0; k < 7; k++) {
      const base = 18 + k * 21;
      const pts = [];
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const rr = base * (1 + 0.16 * Math.sin(3 * a + ph[0]) + 0.09 * Math.sin(5 * a + ph[1]) + 0.05 * Math.sin(7 * a + ph[2] + k * 0.4));
        pts.push([cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr]);
      }
      s += `<path class="m-contour${k % 3 === 2 ? ' m-contour--major' : ''}" d="${smoothClosed(pts)}"/>`;
    }
  }

  // water: a river or, for glasshouses, a strip of coast
  if (kind === 'field') {
    const y0 = r(210, 240);
    const d = `M0 ${f1(y0)} C 90 ${f1(y0 + r(-30, 10))} 170 ${f1(y0 + r(10, 40))} 260 ${f1(y0 + r(-10, 20))} S 360 ${f1(y0 + r(20, 50))} 400 ${f1(y0 + r(0, 30))} V300 H0Z`;
    s += `<path class="m-water" d="${d}"/><path class="m-water-edge" d="${d.replace(/V300 H0Z$/, '')}"/>`;
  } else {
    const ya = r(30, 110), yb = r(190, 280);
    const d = `M-10 ${f1(ya)} C ${f1(r(90, 150))} ${f1(ya + r(20, 70))} ${f1(r(170, 230))} ${f1(yb - r(40, 90))} 410 ${f1(yb)}`;
    s += `<path d="${d}" fill="none" stroke="#8FA8D4" stroke-width="17"/><path d="${d}" fill="none" stroke="#C9D9F2" stroke-width="15"/>`;
  }

  // roads
  const ry = r(120, 180), rx = r(150, 260);
  const roads = [
    `M-10 ${f1(ry)} L ${f1(rx - 40)} ${f1(ry + r(-12, 12))} L 410 ${f1(ry + r(-30, 30))}`,
    `M ${f1(rx)} -10 L ${f1(rx + r(-20, 20))} ${f1(ry)} L ${f1(rx + r(-30, 30))} 310`,
  ];
  roads.forEach((d) => { s += `<path class="m-road-edge" d="${d}"/>`; });
  roads.forEach((d) => { s += `<path class="m-road" d="${d}"/>`; });

  // buildings clustered around the customer
  const cx = rx + (rand() < 0.5 ? -1 : 1) * r(60, 95);
  const cy = ry + (rand() < 0.5 ? -1 : 1) * r(48, 70);
  const blocks = [];
  if (kind === 'network') {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
      if (rand() < 0.15) continue;
      blocks.push([cx - 62 + j * 26 + r(-2, 2), cy - 44 + i * 22 + r(-2, 2), r(16, 20), r(12, 15), rand() < 0.8]);
    }
  } else if (kind === 'factory') {
    blocks.push([cx - 56, cy - 34, 74, 40, true], [cx + 24, cy - 34, 36, 40, true], [cx - 56, cy + 12, 52, 22, false], [cx + 2, cy + 12, 58, 22, true]);
  } else if (kind === 'field') {
    for (let i = 0; i < 6; i++) blocks.push([cx - 70, cy - 40 + i * 13, 140, 9, true]);
  } else {
    blocks.push([cx - 60, cy - 36, 120, 22, true], [cx - 60, cy - 12, 26, 48, true], [cx + 34, cy - 12, 26, 48, true], [cx - 24, cy + 18, 48, 18, false]);
  }
  blocks.forEach(([x, y, w, h, served], i) => { s += `<rect class="m-block${served ? ' m-block--served' : ''}" style="--i:${i}" x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="1.5"/>`; });

  // the pad and the heat main
  const px = clamp(cx + (cx > 200 ? -1 : 1) * r(110, 150), 40, 360);
  const py = clamp(cy + (rand() < 0.5 ? -1 : 1) * r(40, 80), 40, 250);
  const ex = cx + (px < cx ? -1 : 1) * 4;
  // the heat main draws from the pad to the customer when the card comes into view
  s += `<path class="m-net m-net--main" pathLength="1" d="M${f1(px)} ${f1(py)} H ${f1((px + ex) / 2)} V ${f1(cy)} H ${f1(ex)}"/>`;
  s += `<path class="m-net m-net--dash" d="M${f1(ex)} ${f1(cy)} H ${f1(cx + (px < cx ? 1 : -1) * 50)}"/>`;
  s += `<circle class="m-pad-ring" cx="${f1(px)}" cy="${f1(py)}" r="26"/><circle class="m-pad-ring" cx="${f1(px)}" cy="${f1(py)}" r="40"/>`;
  s += `<circle class="m-pulse" cx="${f1(px)}" cy="${f1(py)}" r="14"/>`;
  s += `<rect class="m-pad" x="${f1(px - 11)}" y="${f1(py - 11)}" width="22" height="22" rx="3"/><circle class="m-pad-core" cx="${f1(px)}" cy="${f1(py)}" r="4"/>`;
  const labelLeft = px > 300;
  s += `<text class="m-text" x="${f1(px + (labelLeft ? -18 : 18))}" y="${f1(py - 18)}" text-anchor="${labelLeft ? 'end' : 'start'}">Pad ${code}-0${index}</text>`;

  // furniture: north arrow, scale bar
  s += `<g transform="translate(372 30)"><path class="m-north" d="M0 -14 L6 6 L0 2 L-6 6Z"/><text class="m-text" x="0" y="24" text-anchor="middle">N</text></g>`;
  s += `<g transform="translate(18 280)"><path class="m-north" d="M0 0 H80 M0 -4 V4 M40 -3 V3 M80 -4 V4"/><text class="m-text" x="90" y="5">200 m</text></g>`;

  $('.site__map', card).innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" focusable="false">${s}</svg>`;
}
$$('.site').forEach(drawMap);
if (reduced || !hasIO) {
  $$('.site').forEach((c) => c.classList.add('is-drawn'));
} else {
  const mapIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-drawn'); mapIO.unobserve(e.target); } });
  }, { threshold: 0.45 });
  $$('.site').forEach((c) => mapIO.observe(c));
}

/* ---------- Sites rail ---------- */
const track = $('.sites__track');
const cards = $$('.site');
const now = $('.sites__now');
const bar = $('.sites__bar i');
const [prevBtn, nextBtn] = $$('.sites__ctrl .round');
const list = $('.sites__list');
const sitesSec = $('.sites');
let navTimer;

function updateRail() {
  const max = track.scrollWidth - track.clientWidth;
  const x = track.scrollLeft;
  const step = cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : 1;
  const i = max <= 2 ? 0 : x >= max - 2 ? cards.length - 1 : Math.round(x / step);
  now.textContent = String(i + 1).padStart(2, '0');
  cards.forEach((c, k) => c.classList.toggle('is-active', k === i));
  list.classList.toggle('has-active', max > 2);
  prevBtn.disabled = x <= 2;
  nextBtn.disabled = x >= max - 2;
  const frac = max > 0 ? track.clientWidth / track.scrollWidth : 1;
  bar.style.width = `${(frac * 100).toFixed(2)}%`;
  bar.style.transform = `translateX(${max > 0 ? ((x / max) * (1 / frac - 1) * 100).toFixed(2) : 0}%)`;
}
[prevBtn, nextBtn].forEach((b) => b.addEventListener('click', () => {
  const step = cards[1].offsetLeft - cards[0].offsetLeft;
  track.scrollBy({ left: Number(b.dataset.dir) * step, behavior: reduced ? 'auto' : 'smooth' });
  // the card that lands at the front sends out a ring for a moment
  sitesSec.classList.add('is-nav');
  clearTimeout(navTimer);
  navTimer = setTimeout(() => sitesSec.classList.remove('is-nav'), 2600);
}));
let railTick = false;
track.addEventListener('scroll', () => { if (!railTick) { railTick = true; requestAnimationFrame(() => { railTick = false; updateRail(); }); } }, { passive: true });
updateRail();

/* ---------- Mobile menu ---------- */
const menuBtn = $('.header__menu');
const menu = $('#menu');
const menuLabel = $('.header__menu-label');
const setMenu = (open) => {
  menuBtn.setAttribute('aria-expanded', String(open));
  menuLabel.textContent = open ? 'Close' : 'Menu';
  menu.classList.toggle('is-open', open);
  root.classList.toggle('menu-open', open);
  if (open) $('a', menu).focus();
};
menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
});
window.matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
