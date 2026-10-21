/* Side Street Quarterly — Editorial / Magazine concept
   Dawn intro, nameplate fit + letter rise, dappled canopy shade, running head, shopfront
   accordion (After Hours turns the street dark), line reveals, counters, clipping parallax,
   The Long Block (a pinned walk along the street), back-cover crop, mobile menu. */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fontsReady = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, wait(1500)])
    : Promise.resolve();

  const debounce = (fn, ms = 150) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- Nameplates: split into letters, fit to the measure ---------- */
  const nameplate = document.querySelector('.nameplate');
  const word = nameplate && nameplate.querySelector('.nameplate__word');
  if (word) {
    let n = 0;
    word.innerHTML = word.textContent.trim().split(' ').map((w) =>
      `<span class="wd">${[...w].map((c) => `<span class="ch" style="--n:${n++}">${c}</span>`).join('')}</span>`
    ).join(' ');
  }

  const backWord = document.querySelector('.back__word');
  const fitTargets = [
    { el: word, box: nameplate },
    { el: backWord, box: backWord },
  ].filter((f) => f.el);

  const fit = () => {
    fitTargets.forEach(({ el, box }) => {
      const cs = getComputedStyle(box.parentElement);
      const avail = box.parentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      // glyph widths don't scale perfectly linearly, so measure at the real size and correct twice
      for (let pass = 0; pass < 3; pass++) {
        const size = parseFloat(getComputedStyle(box).fontSize);
        const w = el.getBoundingClientRect().width;
        if (!w || Math.abs(w - avail) < 0.5) break;
        box.style.fontSize = `${Math.floor(size * (avail / w) * 100) / 100}px`;
      }
    });
    cropBack();
  };

  // The back-cover wordmark runs off the page on purpose: a quarter of the cap height is cut
  function cropBack() {
    if (!backWord) return;
    backWord.style.marginBottom = '';
    backWord.style.paddingBottom = '0';
    const fs = parseFloat(getComputedStyle(backWord).fontSize);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `800 ${fs}px Archivo, "Arial Narrow", sans-serif`;
    const cap = ctx.measureText('SIDE STREET').actualBoundingBoxAscent || fs * 0.7;
    const mark = document.createElement('span');
    mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    backWord.appendChild(mark);
    const box = backWord.getBoundingClientRect();
    const baseline = mark.getBoundingClientRect().top - box.top;
    mark.remove();
    backWord.style.marginBottom = `${(baseline - 0.25 * cap - box.height).toFixed(1)}px`;
  }

  /* ---------- Dawn, then the cover ---------- */
  const cover = document.querySelector('.cover');
  const coverHeadline = document.querySelector('.cover__headline');
  let coverStarted = false;
  const revealCoverHeadline = () => {
    if (coverStarted && coverHeadline && coverHeadline.classList.contains('is-split')) coverHeadline.classList.add('is-in');
  };
  const startCover = () => {
    if (coverStarted) return;
    coverStarted = true;
    fit();
    nameplate && nameplate.classList.add('is-in');
    cover && cover.classList.add('is-in');
    revealCoverHeadline();
  };

  const dawn = document.querySelector('.dawn');
  if (dawn && !reduceMotion) {
    const clock = dawn.querySelector('.dawn__clock');
    const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const from = 5 * 60, to = 7 * 60 + 40; // 05:00 to 07:40, the hour of bench no. 17
    const t0 = performance.now();
    const tick = (now) => {
      const k = clamp((now - t0) / 700, 0, 1);
      clock.textContent = fmt(Math.round(from + (to - from) * easeInOut(k)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    let lifted = false;
    const lift = () => {
      if (lifted) return;
      lifted = true;
      clock.textContent = fmt(to);
      dawn.classList.add('is-up');
      startCover();
      setTimeout(() => dawn.classList.add('is-done'), 650);
    };
    // lift once the clock has run and the fonts are in, never later than 1.3 s
    Promise.all([wait(720), Promise.race([fontsReady, wait(1100)])]).then(lift);
    setTimeout(lift, 1300);
    setTimeout(() => dawn.classList.add('is-done'), 2500);
  } else {
    dawn && dawn.classList.add('is-done');
    fontsReady.then(startCover);
  }
  setTimeout(startCover, 2500); // the page is never held back longer than this

  /* ---------- Canopy: dappled plane-tree shade, drawn once, swayed by CSS ---------- */
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // A plane leaf: five pointed lobes around a short stem, unit size, pointing up
  function leafPath(ctx, x, y, size, rot) {
    const lobes = [[-90, 1], [-140, 0.82], [-40, 0.82], [-188, 0.5], [8, 0.5]].sort((a, b) => a[0] - b[0]);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(size, size);
    ctx.moveTo(0, 0.28);
    lobes.forEach(([deg, r], i) => {
      const a = (deg * Math.PI) / 180;
      const prev = i ? (lobes[i - 1][0] * Math.PI) / 180 : a - 0.9;
      const mid = (a + prev) / 2;
      ctx.quadraticCurveTo(Math.cos(mid) * 0.36, Math.sin(mid) * 0.36, Math.cos(a) * r, Math.sin(a) * r);
    });
    ctx.quadraticCurveTo(Math.cos(0.5) * 0.4, Math.sin(0.5) * 0.4, 0, 0.28);
    ctx.restore();
  }

  const canopy = document.querySelector('.canopy');
  if (canopy) {
    // back layer: fewer, larger, softer leaves; front layer: smaller, crisper ones
    const layers = [
      { c: canopy.querySelector('.canopy__a'), seed: 7, count: 150, size: [56, 104], down: 5 },
      { c: canopy.querySelector('.canopy__b'), seed: 19, count: 280, size: [30, 60], down: 2.5 },
    ];
    const draw = () => {
      const w = canopy.clientWidth, h = canopy.clientHeight;
      if (!w || !h) return;
      const k = Math.min(1, Math.max(0.6, w / 1100)); // leaf scale follows the cover width
      layers.forEach((L) => {
        const rand = mulberry32(L.seed);
        const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
        // drawn small; the browser's upscale gives the soft edge of a real shadow
        const cw = Math.ceil(w / L.down), ch = Math.ceil(h / L.down), s = 1 / L.down;
        L.c.width = cw; L.c.height = ch;
        const ctx = L.c.getContext('2d');
        ctx.fillStyle = 'rgb(52, 44, 30)';
        ctx.beginPath();
        // branches reaching in from a trunk just off the top-right corner
        const branches = [[198, 1.0], [164, 1.12], [132, 0.92], [108, 0.6]].map(([deg, len]) => ({ a: (deg * Math.PI) / 180, len: len * Math.hypot(w, h) * 0.62 }));
        for (let i = 0; i < L.count; i++) {
          const b = branches[i % branches.length];
          const t = 0.12 + Math.pow(rand(), 0.8) * 0.88;
          const spread = (50 + 150 * t) * k;
          const bx = w * 1.02 + Math.cos(b.a) * b.len * t, by = -h * 0.04 + Math.sin(b.a) * b.len * t;
          const px = bx + Math.cos(b.a + Math.PI / 2) * gauss() * spread + gauss() * 16;
          const py = by + Math.sin(b.a + Math.PI / 2) * gauss() * spread + gauss() * 16;
          const size = (L.size[0] + rand() * (L.size[1] - L.size[0])) * k * (1.1 - t * 0.3);
          leafPath(ctx, px * s, py * s, size * s, b.a + Math.PI / 2 + gauss() * 1.1);
        }
        ctx.fill();
      });
    };
    draw();
    let lastW = window.innerWidth;
    window.addEventListener('resize', debounce(() => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; draw(); } }, 250));

    if (reduceMotion) canopy.classList.add('is-paused');
    else if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => canopy.classList.toggle('is-paused', !e.isIntersecting)).observe(cover);
    }
  }

  /* ---------- Running head ---------- */
  const runhead = document.getElementById('runhead');
  const coverBar = document.querySelector('.cover__bar');
  if (runhead && coverBar && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      runhead.classList.toggle('is-shown', !e.isIntersecting && e.boundingClientRect.top < 0);
    }, { rootMargin: '-52px 0px 0px 0px' }).observe(coverBar);
  } else if (runhead) {
    runhead.classList.add('is-shown');
  }

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.querySelector('.runhead__menu');
  const menu = document.getElementById('menu');
  if (menuBtn && menu) {
    const setMenu = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.textContent = open ? 'Close' : 'Menu';
      menu.classList.toggle('is-open', open);
      root.classList.toggle('menu-open', open);
      if (open) menu.querySelector('a').focus();
    };
    menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
  }

  /* ---------- Shopfronts: one open shop window at a time ---------- */
  const contents = document.querySelector('.contents');
  const depts = [...document.querySelectorAll('.dept')];
  const deptList = document.querySelector('.depts');
  const btnOf = (d) => d.querySelector('.dept__btn');
  const setOpen = (d, open) => {
    d.classList.toggle('is-open', open);
    btnOf(d).setAttribute('aria-expanded', String(open));
  };
  // After Hours turns the street dark
  const syncNight = () => contents && contents.classList.toggle('is-night', depts.some((d) => d.id === 'dept-5' && d.classList.contains('is-open')));
  depts.forEach((d) => setOpen(d, d.classList.contains('is-open')));
  depts.forEach((d, i) => {
    const btn = btnOf(d);
    btn.addEventListener('click', () => {
      const open = !d.classList.contains('is-open');
      depts.forEach((o) => setOpen(o, o === d && open));
      syncNight();
    });
    btn.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: depts.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      const j = (keys[e.key] + depts.length) % depts.length;
      btnOf(depts[j]).focus();
    });
  });

  // Cover teasers open their shop, then scroll to it
  document.querySelectorAll('[data-open]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const d = document.getElementById(`dept-${a.dataset.open}`);
      if (!d) return;
      e.preventDefault();
      deptList.classList.add('no-anim', 'is-in', 'is-settled');
      depts.forEach((o) => setOpen(o, o === d));
      syncNight();
      void deptList.offsetHeight;
      requestAnimationFrame(() => deptList.classList.remove('no-anim'));
      d.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      btnOf(d).focus({ preventScroll: true });
      try { history.replaceState(null, '', `#${d.id}`); } catch (err) { /* sandboxed frames */ }
    });
  });

  /* ---------- Line splitting for headline reveals ---------- */
  const lineEls = [...document.querySelectorAll('[data-lines]')];
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function tokens(node, open = '', close = '') {
    const out = [];
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) {
        c.textContent.split(/\s+/).filter(Boolean).forEach((w) => out.push(open + esc(w) + close));
      } else if (c.nodeType === 1) {
        const tag = c.tagName.toLowerCase();
        out.push(...tokens(c, `${open}<${tag}>`, `</${tag}>${close}`));
      }
    });
    return out;
  }
  function split(el) {
    if (!el.dataset.src) el.dataset.src = el.innerHTML;
    el.innerHTML = el.dataset.src;
    const words = tokens(el);
    el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
    const lines = [];
    let top = null;
    el.querySelectorAll('.w').forEach((s) => {
      const t = s.offsetTop;
      if (top === null || Math.abs(t - top) > 4) { lines.push([]); top = t; }
      lines[lines.length - 1].push(s.innerHTML);
    });
    el.innerHTML = lines.map((ws, n) =>
      `<span class="line"><span class="line__in" style="--n:${n}">${ws.join(' ')}</span> </span>`
    ).join('');
    el.classList.add('is-split');
  }
  const unsplit = (el) => { if (el.dataset.src) el.innerHTML = el.dataset.src; };

  if (reduceMotion) {
    lineEls.forEach((el) => el.classList.add('is-split', 'is-in'));
  } else {
    fontsReady.then(() => {
      lineEls.forEach(split);
      let lastW = window.innerWidth;
      window.addEventListener('resize', debounce(() => {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        // once revealed, hand the text back to normal wrapping
        lineEls.forEach((el) => (el.classList.contains('is-in') ? unsplit(el) : split(el)));
      }, 200));
      requestAnimationFrame(revealCoverHeadline);
    });
  }

  /* ---------- Scroll reveals ---------- */
  const revealTargets = [...document.querySelectorAll('[data-reveal]'), ...lineEls.filter((el) => !el.closest('.cover')), deptList].filter(Boolean);
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        // headlines wait until they are split, so the first frame is the hidden one
        if (el.hasAttribute('data-lines') && !el.classList.contains('is-split')) {
          fontsReady.then(() => requestAnimationFrame(() => el.classList.add('is-in')));
        } else {
          el.classList.add('is-in');
          // once the shops have landed, drop the stagger so hovers respond at once
          if (el === deptList) setTimeout(() => deptList.classList.add('is-settled'), 1400);
        }
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    revealTargets.forEach((el) => io.observe(el));
  }

  /* ---------- Counters: the big 41 and the tally, once each ---------- */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && !reduceMotion && 'IntersectionObserver' in window) {
    const run = (el) => {
      const end = Number(el.dataset.count);
      const dur = end > 20 ? 1400 : 1000;
      let start = null;
      const step = (now) => {
        if (start === null) start = now;
        const t = Math.min(1, (now - start) / dur);
        el.textContent = String(Math.round(end * easeOutExpo(t)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { run(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach((el) => cio.observe(el));
  }

  /* ---------- Clipping parallax ---------- */
  const clip = document.querySelector('[data-parallax]');
  const print = clip && clip.querySelector('.clipping__print');
  if (clip && !reduceMotion) {
    let visible = false, ticking = false;
    const update = () => {
      ticking = false;
      const r = clip.getBoundingClientRect();
      const vh = window.innerHeight;
      // -1 when the clipping enters at the bottom, +1 when it leaves at the top
      const t = clamp(((vh / 2) - (r.top + r.height / 2)) / (vh / 2 + r.height / 2), -1, 1);
      const travel = window.innerWidth < 760 ? 24 : 56;
      // the whole clipping drifts; only the print turns, so the caption stays level
      clip.style.translate = `0 ${(-t * travel).toFixed(1)}px`;
      print.style.rotate = `${(t * 2).toFixed(2)}deg`;
    };
    const onScroll = () => { if (visible && !ticking) { ticking = true; requestAnimationFrame(update); } };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) onScroll(); }).observe(clip);
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- The Long Block: the stage pins, the street walks past the fold ----------
     Native scroll only. Progress p (0..1) through the pinned length moves the strip;
     the fold's position on the street drives the odometer, the ticker and the stops. */
  const block = document.querySelector('.block');
  const svg = block && block.querySelector('.lb-svg');
  if (block && svg && !reduceMotion && 'IntersectionObserver' in window) {
    const stage = block.querySelector('.block__stage');
    const view = block.querySelector('.block__view');
    const strip = block.querySelector('.block__strip');
    const fold = block.querySelector('.block__fold');
    const VB_W = 7000, VB_H = 600;
    const S0 = Number(svg.dataset.s0), S1 = Number(svg.dataset.s1), METRES = Number(svg.dataset.metres);
    const benches = [...svg.querySelectorAll('[data-bench]')]
      .map((el) => ({ x: Number(el.dataset.x), no: el.dataset.no, gone: el.dataset.gone, now: el.dataset.now }))
      .sort((a, b) => a.x - b.x);
    const stations = [...block.querySelectorAll('.block__stations li')].map((li) => ({ li, at: Number(li.dataset.at), wide: li.hasAttribute('data-wide') }));
    const out = {};
    ['m', 'b', 's', 'g', 'tick'].forEach((k) => { out[k] = block.querySelector(`[data-odo="${k}"]`); });
    const set = (el, v) => { if (el.textContent !== v) el.textContent = v; };

    block.classList.add('is-live');
    // in the live walk the drawing no longer scrolls on its own
    view.removeAttribute('tabindex'); view.removeAttribute('role'); view.removeAttribute('aria-label');

    let geo = null, active = false, ticking = false, lastGone = -1, flashT = 0, station = -2;
    const layout = () => {
      const vw = view.clientWidth, H = view.clientHeight;
      if (!vw || !H) return;
      const s = H / VB_H;
      const half = vw / 2 / s;
      // crop the drawing so the walk starts at the north corner and ends at the south one
      const x0 = Math.max(0, S0 - half - 40), x1 = Math.min(VB_W, S1 + half + 40);
      svg.setAttribute('viewBox', `${x0.toFixed(1)} 0 ${(x1 - x0).toFixed(1)} ${VB_H}`);
      const stripPx = (x1 - x0) * s;
      svg.style.width = `${stripPx.toFixed(1)}px`;
      svg.style.height = `${H}px`;
      const travel = Math.max(0, stripPx - vw);
      // horizontal travel at about 1.1× the scroll on wide screens; phones walk a little faster
      const rate = vw < 760 ? 2 : 1.1;
      const stageH = stage.offsetHeight;
      const run = clamp(travel / rate, stageH * 1.3, stageH * 2.8);
      block.style.height = `${Math.round(stageH + run)}px`;
      geo = { vw, s, x0, travel, run, narrow: vw < 760 };
      update();
    };

    const update = () => {
      ticking = false;
      if (!geo) return;
      const p = clamp(-block.getBoundingClientRect().top / geo.run, 0, 1);
      const tx = -geo.travel * p;
      strip.style.transform = `translate3d(${tx.toFixed(1)}px, 0, 0)`;
      const foldX = geo.x0 + (geo.vw / 2 - tx) / geo.s; // the fold, in street units
      const f = clamp((foldX - S0) / (S1 - S0), 0, 1);

      let passed = 0, gone = 0, last = null;
      for (const b of benches) {
        if (b.x > foldX) break;
        passed++;
        if (b.gone) { gone++; last = b; }
      }
      set(out.m, String(Math.round(f * METRES)).padStart(3, '0'));
      set(out.b, String(passed).padStart(2, '0'));
      set(out.s, String(passed - gone).padStart(2, '0'));
      set(out.g, String(gone));
      if (gone !== lastGone) {
        set(out.tick, last ? `No. ${last.no} · gone in ${last.gone} · now ${last.now}` : '');
        if (gone > lastGone && lastGone >= 0) {
          fold.classList.add('is-flash');
          clearTimeout(flashT);
          flashT = setTimeout(() => fold.classList.remove('is-flash'), 500);
        }
        lastGone = gone;
      }

      let next = -1;
      stations.forEach((st, i) => { if (f >= st.at && !(geo.narrow && st.wide)) next = i; });
      if (next !== station) {
        stations.forEach((st, i) => st.li.classList.toggle('is-active', i === next));
        station = next;
      }
      block.classList.toggle('is-sit', f >= 0.86);
    };

    const onScroll = () => { if (active && !ticking) { ticking = true; requestAnimationFrame(update); } };
    new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active) onScroll(); }, { rootMargin: '50% 0px' }).observe(block);
    window.addEventListener('scroll', onScroll, { passive: true });
    let lastW = -1;
    const relayout = () => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; layout(); } };
    window.addEventListener('resize', debounce(relayout, 150));
    relayout();
    fontsReady.then(layout); // the head's height may change once the fonts land
  }

  /* ---------- Concept buttons ---------- */
  const note = document.querySelector('.concept-note');
  document.querySelectorAll('[data-concept]').forEach((b) => {
    b.addEventListener('click', () => {
      note.textContent = 'Side Street is a concept magazine, so there’s nothing to buy. Thank you for wanting to, though.';
    });
  });

  /* ---------- Back-issue strip: focusable only when it scrolls ---------- */
  const issueStrip = document.querySelector('.issues');
  if (issueStrip) {
    const check = () => {
      if (issueStrip.scrollWidth > issueStrip.clientWidth + 2) issueStrip.setAttribute('tabindex', '0');
      else issueStrip.removeAttribute('tabindex');
    };
    check();
    window.addEventListener('resize', debounce(check));
  }

  window.addEventListener('resize', debounce(fit, 120));

  // Late webfonts change every measurement: refit the nameplates and re-split unrevealed headlines
  if (document.fonts) {
    const refresh = debounce(() => {
      fit();
      if (!reduceMotion) lineEls.forEach((el) => { if (el.classList.contains('is-split')) (el.classList.contains('is-in') ? unsplit(el) : split(el)); });
    }, 60);
    document.fonts.ready.then(refresh);
    document.fonts.addEventListener('loadingdone', refresh);
  }
})();
