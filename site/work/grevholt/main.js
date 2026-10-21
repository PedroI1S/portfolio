/* Grevholt Group · interactions
   Patterns follow work/brisure-capital: html.js gate, IO reveals, reduced motion, mobile menu. */
(() => {
  'use strict';

  const root = document.documentElement;
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = mqReduce.matches;
  mqReduce.addEventListener?.('change', (e) => { reduceMotion = e.matches; });
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  /* ---------- Header: solid after the hero, hides on scroll down ---------- */
  const header = document.querySelector('.header');
  const hero = document.querySelector('.hero');
  const heroCopy = hero && hero.querySelector('.hero__content');
  const livesEl = document.querySelector('.lives');
  let lastY = window.scrollY;
  let headerTick = false;
  const updateHeader = () => {
    const y = window.scrollY;
    const barH = header.querySelector('.header__bar').offsetHeight;
    const threshold = (hero ? hero.offsetHeight : 600) - barH - 8;
    // go solid as soon as the hero copy reaches the bar, so white nav never sits on white headline
    const copyTop = heroCopy ? heroCopy.getBoundingClientRect().top : Infinity;
    const solid = y > threshold || copyTop < barH + 24;
    header.classList.toggle('is-solid', solid);
    const focusInside = header.contains(document.activeElement) && document.activeElement !== document.body;
    // the pinned signature stage gets the whole screen
    let onStage = false;
    if (livesEl && livesEl.classList.contains('is-pinned')) {
      const r = livesEl.getBoundingClientRect();
      onStage = r.top <= 1 && r.bottom >= window.innerHeight - 1;
    }
    const megaOpen = header.classList.contains('is-mega');
    if (onStage && !focusInside && !megaOpen) header.classList.add('is-hidden');
    else if (solid && y > lastY + 4 && !focusInside && !root.classList.contains('menu-open')) header.classList.add('is-hidden');
    else if (y < lastY - 4 || !solid) header.classList.remove('is-hidden');
    if (Math.abs(y - megaOpenedAt) > 120) setMega(false);
    lastY = y;
    headerTick = false;
  };
  const queueHeader = () => { if (!headerTick) { headerTick = true; requestAnimationFrame(updateHeader); } };
  window.addEventListener('scroll', queueHeader, { passive: true });
  window.addEventListener('resize', queueHeader);
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));

  /* ---------- Mega-menu ---------- */
  const trigger = document.querySelector('.nav__trigger');
  const mega = document.getElementById('mega');
  let megaOpenedAt = -1e6;
  function setMega(open) {
    if (!trigger || !mega) return;
    if (open === (trigger.getAttribute('aria-expanded') === 'true')) return;
    trigger.setAttribute('aria-expanded', String(open));
    mega.classList.toggle('is-open', open);
    header.classList.toggle('is-mega', open);
    megaOpenedAt = open ? window.scrollY : -1e6;
  }
  if (trigger && mega) {
    trigger.addEventListener('click', () => setMega(trigger.getAttribute('aria-expanded') !== 'true'));
    mega.addEventListener('click', (e) => { if (e.target.closest('a')) setMega(false); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.mega') && !e.target.closest('.nav__trigger')) setMega(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') { setMega(false); trigger.focus(); }
    });
    // close when focus leaves the trigger + panel
    header.addEventListener('focusout', (e) => {
      if (e.relatedTarget && !mega.contains(e.relatedTarget) && e.relatedTarget !== trigger) setMega(false);
    });
  }

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.querySelector('.header__menu');
  const menu = document.getElementById('menu');
  if (menuBtn && menu) {
    const label = menuBtn.querySelector('.header__menu-label');
    const outside = [document.querySelector('.skip'), header.querySelector('.logo'), document.getElementById('main'), document.querySelector('.footer')].filter(Boolean);
    const setMenu = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      label.textContent = open ? 'Close' : 'Menu';
      menu.classList.toggle('is-open', open);
      header.classList.toggle('is-menu', open);
      root.classList.toggle('menu-open', open);
      // the rest of the page is out of reach while the full-screen menu is open
      outside.forEach((el) => { el.inert = open; });
      if (open) { header.classList.remove('is-hidden'); menu.querySelector('a').focus(); }
    };
    menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (!menu.classList.contains('is-open')) return;
      if (e.key === 'Escape') { setMenu(false); menuBtn.focus(); return; }
      if (e.key !== 'Tab') return;
      // wrap focus between the Close button and the last menu link
      const loop = [menuBtn, ...menu.querySelectorAll('a')];
      const first = loop[0], last = loop[loop.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!loop.includes(document.activeElement)) { e.preventDefault(); first.focus(); }
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
  }

  /* ---------- Hero: intro + pause Ken Burns off-screen or hidden ---------- */
  if (hero) {
    const heroTitle = hero.querySelector('.hero__title');
    const showHero = () => requestAnimationFrame(() => { hero.classList.add('is-in'); heroTitle.classList.add('is-in'); });
    if (reduceMotion) showHero();
    else {
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(showHero);
      setTimeout(showHero, 1200);
    }
    // Ken Burns runs only while the hero is on screen and the tab is visible
    let heroOnScreen = true;
    const syncHero = () => hero.classList.toggle('is-paused', !heroOnScreen || document.hidden);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { heroOnScreen = e.isIntersecting; syncHero(); }).observe(hero);
    }
    document.addEventListener('visibilitychange', syncHero);
  }

  /* ---------- Counters ---------- */
  const fmt = (v, dec) => v.toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const runCounter = (el) => {
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.dec || '0', 10);
    if (reduceMotion) { el.textContent = fmt(target, dec); return; }
    const t0 = performance.now();
    const dur = 800;
    const step = (now) => {
      const t = clamp((now - t0) / dur, 0, 1);
      el.textContent = fmt(target * easeOut(t), dec);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ---------- Scroll reveals ---------- */
  const revealTargets = [...document.querySelectorAll('[data-reveal], [data-split]')].filter((el) => !el.closest('.hero'));
  const onReveal = (el) => {
    el.classList.add('is-in');
    el.querySelectorAll('[data-count]').forEach(runCounter);
  };
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { onReveal(e.target); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
    revealTargets.forEach((el) => io.observe(el));
  }

  /* ---------- Brands: one panel at a time ---------- */
  const tiles = [...document.querySelectorAll('.brand')];
  const panels = document.querySelector('.brand-panels');
  if (tiles.length && panels) {
    const closeAll = () => {
      tiles.forEach((t) => t.setAttribute('aria-expanded', 'false'));
      panels.querySelectorAll('.brand-detail').forEach((d) => d.classList.remove('is-open'));
      panels.classList.remove('is-open');
    };
    tiles.forEach((tile) => {
      tile.addEventListener('click', () => {
        const wasOpen = tile.getAttribute('aria-expanded') === 'true';
        const panelWasOpen = panels.classList.contains('is-open');
        closeAll();
        if (wasOpen) return;
        const detail = document.getElementById(tile.getAttribute('aria-controls'));
        tile.setAttribute('aria-expanded', 'true');
        detail.classList.add('is-open');
        panels.classList.add('is-open');
        // bring the panel into view if it opens below the fold
        setTimeout(() => {
          const r = detail.getBoundingClientRect();
          if (r.bottom > window.innerHeight) {
            const top = window.scrollY + r.top - Math.max(80, window.innerHeight - r.height - 24);
            window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
          }
        }, panelWasOpen || reduceMotion ? 0 : 320);
      });
    });
    panels.querySelectorAll('.brand-detail__close').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.closest('.brand-detail').id;
        closeAll();
        document.querySelector(`.brand[aria-controls="${id}"]`)?.focus({ preventScroll: true });
      });
    });
  }

  /* ---------- Signature: One pair, three lives ----------
     Desktop with motion: one damped scroll-progress pass drives the SVG boot through
     material → build → repair. Otherwise the three static panels in the HTML stay as they are. */
  if (livesEl) {
    const mqPin = window.matchMedia('(min-width: 901px) and (min-height: 620px)');
    const svg = livesEl.querySelector('.boot');
    const items = [...livesEl.querySelectorAll('.life')];
    const segs = [...livesEl.querySelectorAll('.lives__seg')];
    const tags = [...livesEl.querySelectorAll('[data-leader-label]')];
    const leaders = [...svg.querySelectorAll('.boot__leader')];
    const repairEl = livesEl.querySelector('[data-repair]');
    const part = {};
    svg.querySelectorAll('[data-part]').forEach((el) => { part[el.dataset.part] = el; });
    const movers = [...svg.querySelectorAll('[data-x]')].map((el) => {
      const [dx, dy, r, cx, cy, i] = el.dataset.x.split(' ').map(Number);
      return { el, dx, dy, r, cx, cy, i };
    });
    const worn = part.soleA.querySelector('.boot__worn');
    const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const easeIn = (t) => t * t * t;
    const BEATS = [[0, 0.33], [0.33, 0.73], [0.73, 1]];
    let pinned = false, inView = false, target = 0, cur = 0, raf = 0, lastT = 0;

    const set = (el, k, v) => el.setAttribute(k, typeof v === 'number' ? v.toFixed(3) : v);
    const paint = (p) => {
      // beat 1 (0–.3): cut pieces drift apart over the fabric photo
      const sep = lerp(0.4, 1, easeOut(clamp(p / 0.28, 0, 1)));
      movers.forEach((m) => {
        // beat 2 (.32–.58): pieces assemble bottom-up, one after another
        const asm = easeInOut(clamp((p - (0.32 + m.i * 0.016)) / 0.13, 0, 1));
        const e = sep * (1 - asm);
        let ty = m.dy * e;
        if (m.el === part.soleA) ty += 100 * easeIn(clamp((p - 0.82) / 0.07, 0, 1)); // beat 3: worn sole drops ~8vh
        set(m.el, 'transform', `translate(${(m.dx * e).toFixed(2)} ${ty.toFixed(2)}) rotate(${(m.r * e).toFixed(3)} ${m.cx} ${m.cy})`);
      });
      set(part.spool, 'opacity', 1 - smooth(0.3, 0.4, p));
      set(part.shadow, 'opacity', smooth(0.44, 0.6, p));
      set(part.stitches, 'opacity', smooth(0.54, 0.6, p));
      set(part.eyelets, 'opacity', smooth(0.55, 0.6, p));
      set(part.laces, 'opacity', smooth(0.57, 0.62, p));
      // nine years of work, then the old sole goes and a new one slides home on the same welt
      const wear = smooth(0.74, 0.82, p);
      set(part.wear, 'opacity', wear);
      set(worn, 'opacity', wear);
      set(part.soleA, 'opacity', 1 - smooth(0.84, 0.92, p));
      const fit = easeOut(clamp((p - 0.86) / 0.1, 0, 1));
      set(part.soleB, 'opacity', smooth(0.86, 0.9, p));
      set(part.soleB, 'transform', `translate(${(240 * (1 - fit)).toFixed(2)} 0)`);
      leaders.forEach((g, k) => {
        const draw = smooth(0.58 + k * 0.015, 0.64 + k * 0.015, p);
        const vis = 1 - smooth(0.71, 0.75, p);
        g.firstElementChild.style.strokeDashoffset = (1 - draw).toFixed(3);
        g.lastElementChild.style.opacity = draw > 0.02 ? 1 : 0;
        g.style.opacity = vis.toFixed(3);
        tags[k].style.opacity = (smooth(0.6 + k * 0.015, 0.65 + k * 0.015, p) * vis).toFixed(3);
      });
      // photos, copy and rail follow the beats; text never travels with the object
      const x1 = smooth(0.3, 0.36, p), x2 = smooth(0.7, 0.76, p);
      const w = [1 - x1, x1 * (1 - x2), x2];
      let current = 0;
      items.forEach((li, k) => {
        const [a, b] = BEATS[k];
        li.style.setProperty('--o', w[k].toFixed(3));
        // copy fades out completely before the next beat's copy fades in
        li.style.setProperty('--co', Math.max(0, w[k] * 2 - 1).toFixed(3));
        li.style.setProperty('--s', (1.06 - 0.06 * clamp((p - a) / (b - a), 0, 1)).toFixed(4));
        li.style.setProperty('--y', `${((1 - w[k]) * (p < a ? 16 : -16)).toFixed(1)}px`);
        if (w[k] > w[current]) current = k;
      });
      items.forEach((li, k) => li.classList.toggle('is-current', k === current));
      segs.forEach((seg, k) => {
        const [a, b] = BEATS[k];
        seg.style.setProperty('--f', clamp((p - a) / (b - a), 0, 1).toFixed(3));
        seg.classList.toggle('is-on', k === current);
      });
      repairEl.textContent = fmt(60000 + 1000 * easeOut(clamp((p - 0.84) / 0.13, 0, 1)), 0);
    };

    const tick = (t) => {
      raf = 0;
      const dt = Math.min(64, t - (lastT || t));
      lastT = t;
      cur += (target - cur) * (1 - Math.exp(-dt / 90));
      if (Math.abs(target - cur) < 0.0004) cur = target;
      paint(cur);
      if (cur !== target) raf = requestAnimationFrame(tick);
      else lastT = 0;
    };
    const measure = () => {
      const r = livesEl.getBoundingClientRect();
      target = clamp(-r.top / Math.max(1, r.height - window.innerHeight), 0, 1);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const setMode = () => {
      const want = mqPin.matches && !reduceMotion;
      if (want === pinned) return;
      pinned = want;
      livesEl.classList.toggle('is-pinned', pinned);
      if (pinned) {
        const r = livesEl.getBoundingClientRect();
        cur = target = clamp(-r.top / Math.max(1, r.height - window.innerHeight), 0, 1);
        paint(cur);
      } else {
        cancelAnimationFrame(raf); raf = 0;
        repairEl.textContent = '61,000';
      }
    };
    setMode();
    mqPin.addEventListener?.('change', setMode);
    mqReduce.addEventListener?.('change', setMode);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView && pinned) measure(); }, { rootMargin: '10% 0px' }).observe(livesEl);
    } else inView = true;
    window.addEventListener('scroll', () => { if (pinned && inView) measure(); }, { passive: true });
    window.addEventListener('resize', () => { if (pinned) measure(); });
  }

  /* ---------- Investors: illustrative series + chart ---------- */
  const CLOSE = 48.62;
  const mulberry = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Brownian bridge from `start` to CLOSE, so every range ends on the same price
  const series = (n, start, vol, seed) => {
    const rnd = mulberry(seed);
    const w = [0];
    for (let i = 1; i < n; i++) w.push(w[i - 1] + (rnd() - 0.5) * 2);
    const end = w[n - 1];
    return w.map((v, i) => {
      const t = i / (n - 1);
      return +(lerp(start, CLOSE, t) + (v - end * t) * vol).toFixed(2);
    });
  };
  const pad = (n) => String(n).padStart(2, '0');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const lastClose = new Date(2026, 9, 9); // Fri 9 Oct 2026
  const tradingDays = (count) => {
    const out = []; const d = new Date(lastClose);
    while (out.length < count) {
      if (d.getDay() !== 0 && d.getDay() !== 6) out.unshift(new Date(d));
      d.setDate(d.getDate() - 1);
    }
    return out;
  };
  const dayLabel = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  const ranges = {
    '1D': (() => {
      const n = 103; // 09:00 to 17:30, every 5 min
      const v = series(n, 47.88, 0.085, 7);
      return { values: v, labels: v.map((_, i) => { const m = 540 + i * 5; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }), suffix: 'today' };
    })(),
    '1M': (() => {
      const days = tradingDays(22);
      return { values: series(days.length, 45.90, 0.42, 21), labels: days.map(dayLabel), suffix: 'past month' };
    })(),
    '1Y': (() => {
      const weeks = []; const d = new Date(lastClose);
      for (let i = 0; i < 52; i++) { weeks.unshift(new Date(d)); d.setDate(d.getDate() - 7); }
      return { values: series(52, 41.20, 1.05, 4), labels: weeks.map((w) => `w/c ${dayLabel(w)}`), suffix: 'past year' };
    })()
  };

  // derive the cells from the same data so nothing contradicts the chart
  const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const d1 = ranges['1D'].values; const y1 = ranges['1Y'].values;
  setText('q-hi', Math.max(...d1).toFixed(2));
  setText('q-lo', Math.min(...d1).toFixed(2));
  setText('q-whi', Math.max(...y1, ...d1).toFixed(2));
  setText('q-wlo', Math.min(...y1, ...d1).toFixed(2));

  const fig = document.querySelector('.chart__fig');
  if (fig) {
    const W = 600, H = 220, PADY = 14;
    const svg = fig.querySelector('svg');
    const line = svg.querySelector('.chart__line');
    const area = svg.querySelector('.chart__area');
    const grid = svg.querySelector('.chart__grid');
    const cross = svg.querySelector('.chart__cross');
    const wipe = svg.querySelector('.chart__wipe');
    const dot = fig.querySelector('.chart__dot');
    const readEl = document.getElementById('chart-read');
    const liveEl = document.getElementById('chart-live');
    const hiEl = fig.querySelector('.chart__axis--hi');
    const loEl = fig.querySelector('.chart__axis--lo');
    const chgEl = document.getElementById('q-chg');
    const tabs = [...document.querySelectorAll('.chart__tabs [role="tab"]')];
    let cur = '1D', pts = [], idx = -1, drawn = false;

    for (let i = 0; i < 4; i++) {
      const y = PADY + (i * (H - PADY * 2)) / 3;
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', 0); l.setAttribute('x2', W); l.setAttribute('y1', y); l.setAttribute('y2', y);
      grid.appendChild(l);
    }

    const wipeIn = () => {
      if (reduceMotion) { wipe.setAttribute('width', W); return; }
      const t0 = performance.now();
      const step = (now) => {
        const t = clamp((now - t0) / 1100, 0, 1);
        wipe.setAttribute('width', (W * easeOut(t)).toFixed(1));
        if (t < 1) requestAnimationFrame(step);
      };
      wipe.setAttribute('width', 0);
      requestAnimationFrame(step);
    };

    const draw = (key, animate) => {
      cur = key;
      const { values, suffix } = ranges[key];
      const min = Math.min(...values), max = Math.max(...values);
      const span = max - min || 1;
      pts = values.map((v, i) => [ (i / (values.length - 1)) * W, PADY + (1 - (v - min) / span) * (H - PADY * 2) ]);
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
      line.setAttribute('d', d);
      area.setAttribute('d', `${d}L${W},${H}L0,${H}Z`);
      hiEl.textContent = max.toFixed(2); hiEl.style.top = `${(PADY / H) * 100}%`;
      loEl.textContent = min.toFixed(2); loEl.style.top = `${((H - PADY) / H) * 100}%`;
      const first = values[0];
      const diff = CLOSE - first;
      const pct = (diff / first) * 100;
      chgEl.innerHTML = `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(2)} (${Math.abs(pct).toFixed(2)}%) <span>${suffix}</span>`;
      readEl.textContent = `Close ${CLOSE.toFixed(2)} EUR · ${suffix}`;
      hideRead();
      if (animate) wipeIn();
    };

    const showRead = (i, announce) => {
      idx = clamp(i, 0, pts.length - 1);
      const [x, y] = pts[idx];
      const v = ranges[cur].values[idx];
      cross.setAttribute('x1', x); cross.setAttribute('x2', x);
      dot.style.left = `${(x / W) * 100}%`;
      dot.style.top = `${(y / H) * 100}%`;
      fig.classList.add('is-reading');
      const txt = `${ranges[cur].labels[idx]} · ${v.toFixed(2)} EUR`;
      readEl.textContent = txt;
      if (announce) liveEl.textContent = txt;
    };
    function hideRead() {
      fig.classList.remove('is-reading');
      idx = -1;
      readEl.textContent = `Close ${CLOSE.toFixed(2)} EUR · ${ranges[cur].suffix}`;
    }

    fig.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const t = clamp((e.clientX - r.left) / r.width, 0, 1);
      showRead(Math.round(t * (pts.length - 1)), false);
    });
    fig.addEventListener('pointerleave', hideRead);
    fig.addEventListener('keydown', (e) => {
      const n = pts.length;
      const big = Math.max(1, Math.round(n / 10));
      let i = idx < 0 ? n - 1 : idx;
      if (e.key === 'ArrowLeft') i -= e.shiftKey ? big : 1;
      else if (e.key === 'ArrowRight') i += e.shiftKey ? big : 1;
      else if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = n - 1;
      else if (e.key === 'Escape') { hideRead(); return; }
      else return;
      e.preventDefault();
      showRead(i, true);
    });
    fig.addEventListener('blur', hideRead);

    const selectTab = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tab.focus();
      draw(tab.dataset.range, true);
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => { if (tab.getAttribute('aria-selected') !== 'true') selectTab(tab, false); });
      tab.addEventListener('keydown', (e) => {
        let j = i;
        if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        else return;
        e.preventDefault();
        selectTab(tabs[j], true);
      });
    });

    draw('1D', false);
    // draw the line in the first time the chart is seen
    if (!reduceMotion && 'IntersectionObserver' in window) {
      wipe.setAttribute('width', 0);
      const cio = new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !drawn) { drawn = true; wipeIn(); cio.disconnect(); }
      }, { threshold: 0.4 });
      cio.observe(fig);
    }
  }

  /* ---------- News carousel ---------- */
  const track = document.getElementById('news-track');
  if (track) {
    const prev = document.querySelector('.news__controls [data-dir="-1"]');
    const next = document.querySelector('.news__controls [data-dir="1"]');
    const posEl = document.getElementById('news-pos');
    const cards = [...track.children];
    document.getElementById('news-total').textContent = pad(cards.length);
    const step = () => {
      const a = cards[0].getBoundingClientRect(), b = cards[1].getBoundingClientRect();
      return b.left - a.left;
    };
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
      const i = next.disabled ? cards.length - 1 : Math.round(track.scrollLeft / step());
      posEl.textContent = pad(i + 1);
    };
    [prev, next].forEach((btn) => btn.addEventListener('click', () => {
      track.scrollBy({ left: Number(btn.dataset.dir) * step(), behavior: reduceMotion ? 'auto' : 'smooth' });
    }));
    track.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      track.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * step(), behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    let st = 0;
    track.addEventListener('scroll', () => { cancelAnimationFrame(st); st = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------- Concept-only actions ---------- */
  const toast = document.querySelector('.toast');
  let toastTimer = 0;
  document.querySelectorAll('[data-concept]').forEach((el) => {
    el.addEventListener('click', () => {
      toast.textContent = el.dataset.concept;
      toast.classList.add('is-on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('is-on'), 3600);
    });
  });

  /* ---------- Head-office clock ---------- */
  const clock = document.getElementById('hq-clock');
  if (clock) {
    const tf = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin', timeZoneName: 'short' });
    const tick = () => {
      const now = new Date();
      clock.textContent = tf.format(now);
      clock.setAttribute('datetime', now.toISOString());
    };
    tick();
    setInterval(() => { if (!document.hidden) tick(); }, 15000);
  }

  updateHeader();
})();
