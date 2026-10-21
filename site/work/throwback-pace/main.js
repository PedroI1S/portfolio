/* Throwback Pace Co. — Retro / Y2K sticker-book concept
   Peelable hero stickers, VHS counter that rewinds with the scroll, colourway swaps,
   a front-end bag, run filters with drawn route stickers, sign-up, countdown, menu. */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Toast ---------- */
  const toast = $('.toast');
  let toastTimer;
  const say = (msg) => {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    requestAnimationFrame(() => toast.classList.add('is-on'));
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 3200);
  };

  /* ---------- Press state for pills (keyboard too) ---------- */
  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && e.target.classList?.contains('pill')) e.target.classList.add('is-pressed');
  });
  document.addEventListener('keyup', (e) => { e.target.classList?.remove('is-pressed'); });

  /* ---------- Reveals ---------- */
  const revealTargets = $$('[data-reveal], .run, .signup');
  const heroTitle = $('.hero__title');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-in'));
    heroTitle.classList.add('is-in');
    $$('.card img').forEach((img) => { img.loading = 'eager'; });
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
        // alternate colourways sit behind a zero-area clip, which never lazy-loads on its own
        if (e.target.classList.contains('card')) $$('img', e.target).forEach((img) => { img.loading = 'eager'; });
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    revealTargets.forEach((el) => io.observe(el));
    // stagger rows that enter together
    $$('.run').forEach((row, i) => { row.style.transitionDelay = `${(i % 7) * 50}ms`; });

    // hero copy reveals with the headline, not on scroll
    let shown = false;
    const showHero = () => {
      if (shown) return; shown = true;
      requestAnimationFrame(() => {
        heroTitle.classList.add('is-in');
        $$('.hero [data-reveal]').forEach((el) => el.classList.add('is-in'));
      });
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(showHero);
    setTimeout(showHero, 1200);
  }

  // letters hop when the pointer crosses them
  if (!reduceMotion) {
    $$('.hero__title .ch').forEach((ch) => {
      ch.addEventListener('pointerenter', () => {
        if (ch.classList.contains('is-hop')) return;
        ch.classList.add('is-hop');
      });
      ch.addEventListener('animationend', () => ch.classList.remove('is-hop'));
    });
  }

  /* ---------- Hero stickers: parallax, peel and toss ---------- */
  const hero = $('.hero');
  const stickers = $$('.sticker').map((el) => ({
    el, depth: parseFloat(el.dataset.depth) || 0.2, ox: 0, oy: 0, vx: 0, vy: 0, py: 0, dragging: false
  }));
  let heroVisible = true;
  const paint = (s) => { s.el.style.transform = `translate3d(${s.ox}px, ${s.oy + s.py}px, 0)`; };

  const updateParallax = () => {
    if (reduceMotion || !heroVisible) return;
    const y = Math.min(window.scrollY, window.innerHeight * 1.2);
    stickers.forEach((s) => { s.py = -y * s.depth; paint(s); });
  };

  if (finePointer) {
    let tossRaf = 0;
    const tossing = new Set();
    const bounds = (s) => {
      // keep at least ~45% of each sticker inside the hero
      const h = hero.getBoundingClientRect();
      const w = s.el.offsetWidth, ht = s.el.offsetHeight;
      const baseX = s.el.offsetLeft, baseY = s.el.offsetTop;
      return {
        minX: -baseX - w * 0.55, maxX: h.width - baseX - w * 0.45,
        minY: -baseY - ht * 0.55 - s.py, maxY: h.height - baseY - ht * 0.45 - s.py
      };
    };
    const clamp = (s) => {
      const b = bounds(s);
      if (s.ox < b.minX) { s.ox = b.minX; s.vx *= -0.5; }
      if (s.ox > b.maxX) { s.ox = b.maxX; s.vx *= -0.5; }
      if (s.oy < b.minY) { s.oy = b.minY; s.vy *= -0.5; }
      if (s.oy > b.maxY) { s.oy = b.maxY; s.vy *= -0.5; }
    };
    const step = () => {
      tossing.forEach((s) => {
        s.ox += s.vx; s.oy += s.vy;
        s.vx *= 0.9; s.vy *= 0.9;
        clamp(s);
        s.el.style.setProperty('--tilt', `${Math.max(-18, Math.min(18, s.vx * 1.2))}deg`);
        paint(s);
        if (Math.hypot(s.vx, s.vy) < 0.2) { tossing.delete(s); s.el.style.setProperty('--tilt', '0deg'); }
      });
      tossRaf = tossing.size ? requestAnimationFrame(step) : 0;
    };

    stickers.forEach((s) => {
      let sx = 0, sy = 0, lx = 0, ly = 0, lt = 0, startX = 0, startY = 0;
      s.el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch' || e.button !== 0) return;
        e.preventDefault();
        try { s.el.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
        s.dragging = true; tossing.delete(s);
        s.el.classList.add('is-lifted');
        sx = e.clientX; sy = e.clientY; startX = s.ox; startY = s.oy;
        lx = sx; ly = sy; lt = performance.now(); s.vx = s.vy = 0;
      });
      s.el.addEventListener('pointermove', (e) => {
        if (!s.dragging) return;
        const now = performance.now(), dt = Math.max(8, now - lt);
        s.vx = (e.clientX - lx) / dt * 16; s.vy = (e.clientY - ly) / dt * 16;
        lx = e.clientX; ly = e.clientY; lt = now;
        s.ox = startX + (e.clientX - sx); s.oy = startY + (e.clientY - sy);
        clamp(s);
        s.el.style.setProperty('--tilt', `${Math.max(-14, Math.min(14, s.vx * 1.5))}deg`);
        paint(s);
      });
      const drop = () => {
        if (!s.dragging) return;
        s.dragging = false;
        s.el.classList.remove('is-lifted');
        if (performance.now() - lt > 80) { s.vx = s.vy = 0; }
        if (!reduceMotion && Math.hypot(s.vx, s.vy) > 0.6) {
          tossing.add(s);
          if (!tossRaf) tossRaf = requestAnimationFrame(step);
        } else {
          s.el.style.setProperty('--tilt', '0deg');
        }
      };
      s.el.addEventListener('pointerup', drop);
      s.el.addEventListener('pointercancel', drop);
      s.el.addEventListener('lostpointercapture', drop);
    });
  }

  /* ---------- VHS counter: plays, fast-forwards and rewinds with the scroll ---------- */
  const glyph = $('.vhs__glyph'), label = $('.vhs__label'), timeEl = $('.vhs__time');
  let tape = 4 * 60 + 21;      // the tape starts at 0:04:21, mid-warm-up
  let mode = 'play';
  const fmt = (t) => {
    t = Math.max(0, Math.floor(t));
    const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const setMode = (m) => {
    if (m === mode) return;
    mode = m;
    glyph.textContent = m === 'ff' ? '▶▶' : m === 'rew' ? '◀◀' : '▶';
    label.textContent = m === 'ff' ? 'FF' : m === 'rew' ? 'Rew' : 'Play';
    hero.classList.toggle('is-scrub', m !== 'play');
  };
  timeEl.textContent = fmt(tape);
  if (!reduceMotion) {
    setInterval(() => {
      if (mode !== 'play' || !heroVisible || document.visibilityState === 'hidden') return;
      tape += 1; timeEl.textContent = fmt(tape);
    }, 1000);
  }

  /* ---------- Track print: hero → first product row, reversible with native scroll ---------- */
  const trackSticker = $('.s-track');
  const productGrid = $('.capsule .grid');
  const heroFrame = $('.hero__frame');
  let handoff, handoffSVG, wipe, wipeAnimation;
  let wipeDirection = 0;
  if (!reduceMotion) {
    handoff = document.createElement('div');
    handoff.className = 'track-handoff';
    handoff.setAttribute('aria-hidden', 'true');
    handoff.hidden = true;
    handoffSVG = $('svg', trackSticker).cloneNode(true);
    handoffSVG.setAttribute('preserveAspectRatio', 'none');
    handoff.append(handoffSVG);
    $('main').prepend(handoff);
    wipe = document.createElement('div');
    wipe.className = 'tape-wipe';
    wipe.setAttribute('aria-hidden', 'true');
    const photo = $('img', heroFrame).cloneNode();
    photo.alt = '';
    photo.removeAttribute('fetchpriority');
    wipe.append(photo);
    heroFrame.insertBefore(wipe, $('.vhs'));
  }
  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const mix = (a, b, p) => a + (b - a) * p;
  const roundRect = (x, y, w, h, r) => `M${x+r} ${y}H${x+w-r}a${r} ${r} 0 0 1 ${r} ${r}V${y+h-r}a${r} ${r} 0 0 1 -${r} ${r}H${x+r}a${r} ${r} 0 0 1 -${r} -${r}V${y+r}a${r} ${r} 0 0 1 ${r} -${r}Z`;
  const updateHandoff = () => {
    if (!handoff || document.hidden) return;
    const hr = hero.getBoundingClientRect(), gr = productGrid.getBoundingClientRect();
    // 45vh, while the last 80% → 35% of the hero leaves the viewport.
    const p = clamp01((innerHeight * .8 - hr.bottom) / (innerHeight * .45));
    const first = $('.card', productGrid);
    const row = $$('.card', productGrid).filter(c => c.offsetTop === first.offsetTop);
    const bottom = gr.top + Math.max(...row.map(c => c.offsetHeight));
    handoff.hidden = p === 0 || bottom < -48;
    if (handoff.hidden) return;
    const pad = innerWidth <= 700 ? 18 : 30;
    const target = {x: gr.left-pad, y: gr.top-pad, w: gr.width+pad*2, h: bottom-gr.top+pad*2};
    let sr = trackSticker.getBoundingClientRect();
    if (!sr.width) {
      // The phone keeps its three hero stickers; the spare track print starts beside the exit copy.
      const foot = $('.hero__foot').getBoundingClientRect();
      sr = {x: hr.right-130, y: foot.bottom-70, width: 108, height: 63};
    }
    const e = p*p*(3-2*p);
    const w = mix(sr.width, target.w, e), h = mix(sr.height, target.h, e);
    const x = mix(sr.x, target.x, e), y = mix(sr.y, target.y, e);
    const band = mix(sr.height*38/140, pad*.8, e);
    const radius = mix(sr.height*66/140, pad*1.5, e);
    const outer = roundRect(2, 2, w-4, h-4, radius);
    const inner = roundRect(2+band, 2+band, w-4-band*2, h-4-band*2, Math.max(4, radius-band));
    const paths = $$('path', handoffSVG);
    [paths[0], paths[1], paths[3]].forEach(path => path.setAttribute('d', outer+inner));
    paths[2].setAttribute('d', roundRect(2+band/2, 2+band/2, w-4-band, h-4-band, radius-band/2));
    paths[4].setAttribute('d', `M${w/2} 2v${band}`);
    paths[5].setAttribute('d', `M${w/2} 2v${band}`);
    handoffSVG.setAttribute('viewBox', `0 0 ${w} ${h}`);
    handoff.style.width = `${w}px`;
    handoff.style.height = `${h}px`;
    handoff.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${mix(-9,0,e)}deg)`;
    handoff.style.opacity = String(clamp01(p*8));
  };
  const scrubPhoto = (direction) => {
    if (!wipe || (wipeAnimation?.playState === 'running' && wipeDirection === direction)) return;
    const r = heroFrame.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= innerHeight) return;
    wipeAnimation?.cancel();
    wipeDirection = direction;
    const bands = ['inset(8% 0 76%)', 'inset(34% 0 44%)', 'inset(68% 0 12%)', 'inset(92% 0 0)'];
    if (direction < 0) bands.reverse();
    wipeAnimation = wipe.animate(bands.map((clipPath, i) => ({
      clipPath, opacity: i === 3 ? 0 : .95,
      transform: `translateX(${direction * (i % 2 ? -16 : 22)}px)`
    })), {duration: 160, easing: 'steps(4, end)'});
  };

  /* ---------- Scroll: header, parallax, tape ---------- */
  const header = $('.header');
  let lastY = window.scrollY, ticking = false, idleTimer;
  let lastScrollTime = performance.now();
  const onScroll = () => {
    const y = window.scrollY, dy = y - lastY;
    const now = performance.now(), velocity = Math.abs(dy) / Math.max(16, now-lastScrollTime);
    lastScrollTime = now;
    lastY = y;
    // header: tucks away going down, comes back when you rewind
    header.classList.toggle('is-stuck', y > 40);
    if (!document.documentElement.classList.contains('menu-open')) {
      if (dy > 4 && y > window.innerHeight * 0.6) header.classList.add('is-hidden');
      else if (dy < -4 || y < 80) header.classList.remove('is-hidden');
    }
    if (heroVisible && Math.abs(dy) > 0) {
      setMode(dy > 0 ? 'ff' : 'rew');
      tape = Math.max(0, tape + dy * 0.9);
      timeEl.textContent = fmt(tape);
      if (velocity > .65 && !document.hidden) scrubPhoto(Math.sign(dy));
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setMode('play'), 260);
    }
    updateParallax();
    updateHandoff();
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScroll);
  }, { passive: true });
  const marquee = $('.marquee');
  if ('IntersectionObserver' in window) {
    hero.classList.add('is-offscreen');
    marquee.classList.add('is-offscreen');
    const loops = new IntersectionObserver(entries => entries.forEach(e => {
      e.target.classList.toggle('is-offscreen', !e.isIntersecting);
      if (e.target === hero) heroVisible = e.isIntersecting;
    }));
    loops.observe(hero);
    loops.observe(marquee);
    stickers.forEach(({el}) => { el.classList.add('is-offscreen'); loops.observe(el); });
  }
  const syncVisibility = () => {
    document.documentElement.classList.toggle('is-tab-hidden', document.hidden);
    if (document.hidden) { wipeAnimation?.cancel(); setMode('play'); }
    else { lastY = window.scrollY; onScroll(); }
  };
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
  window.addEventListener('resize', () => { updateParallax(); updateHandoff(); });
  document.fonts?.ready.then(updateHandoff);
  onScroll();

  /* ---------- Capsule: colourway swaps + bag ---------- */
  $$('.card').forEach((card) => {
    const imgs = $$('.card__media img', card);
    const way = $('.card__way', card);
    const btns = $$('.sw', card);
    btns.forEach((btn) => {
      // warm the alternate image when the pointer gets near
      btn.addEventListener('pointerenter', () => { imgs[btn.dataset.i].loading = 'eager'; }, { once: true });
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        if (btn.getAttribute('aria-pressed') === 'true') return;
        btns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        imgs.forEach((img, k) => {
          if (k === i) { img.loading = 'eager'; img.classList.add('is-on'); }
          else img.classList.remove('is-on');
        });
        way.textContent = btn.dataset.name;
      });
    });
  });

  let bag = 0;
  const bagBtn = $('.header__bag'), bagCount = $('.bag-count');
  $$('.add').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.card');
      bag += 1;
      bagCount.textContent = bag;
      bagBtn.classList.remove('is-bump'); void bagBtn.offsetWidth; bagBtn.classList.add('is-bump');
      header.classList.remove('is-hidden');
      say(`Added: ${$('.card__name', card).textContent}, ${$('.card__way', card).textContent}`);
    });
  });
  bagBtn.addEventListener('click', () => {
    say(bag ? `${bag} ${bag === 1 ? 'piece' : 'pieces'} in your bag. Checkout is closed: concept shop.` : 'Your bag is empty. The capsule is just below.');
  });

  /* ---------- Club runs: filters, join, route stickers ---------- */
  const runs = $$('.run');
  $$('.filter').forEach((f) => {
    f.addEventListener('click', () => {
      $$('.filter').forEach((o) => o.setAttribute('aria-pressed', String(o === f)));
      const want = f.dataset.f;
      let shown = 0;
      runs.forEach((r) => {
        const on = want === 'all' || r.dataset.d === want;
        r.hidden = !on;
        if (on) shown += 1;
      });
      if (activeRoute?.hidden) hideRoute();
      else positionRoute();
      say(`${shown} ${shown === 1 ? 'run' : 'runs'} showing`);
    });
  });
  runs.forEach((r) => {
    r.style.setProperty('--c', r.dataset.c);
    const btn = $('.run__join', r);
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      btn.innerHTML = on ? 'Going <span aria-hidden="true">✓</span>' : 'Join <span aria-hidden="true">↗</span>';
      showRoute(r);
      if (on) say(`See you in ${$('.run__place b', r).textContent}. Kit out the night before.`);
    });
  });

  // seeded routes, drawn as a smooth closed loop or an out-and-back squiggle
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const smooth = (pts, closed) => {
    const n = pts.length, P = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d + (closed ? 'Z' : '');
  };
  const routeFor = (seed, outAndBack) => {
    const rnd = mulberry32(seed * 977 + 13);
    let pts;
    if (outAndBack) {
      pts = [];
      const n = 7;
      for (let i = 0; i < n; i++) pts.push([24 + i * (172 / (n - 1)), 85 + (rnd() - 0.5) * 90]);
    } else {
      pts = [];
      const n = 9, ph = rnd() * 6.28, k = 0.18 + rnd() * 0.22;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 1 + k * Math.sin(a * 2 + ph) + (rnd() - 0.5) * 0.28;
        pts.push([110 + Math.cos(a) * 78 * r, 85 + Math.sin(a) * 52 * r]);
      }
    }
    const d = smooth(pts, !outAndBack);
    const s = pts[0], f = outAndBack ? pts[pts.length - 1] : pts[0];
    return `
      <rect x="0" y="0" width="220" height="170" fill="url(#dots)" opacity=".12"/>
      <path d="${d}" fill="none" stroke="#000" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="7 7"/>
      ${outAndBack ? `<g transform="translate(${f[0].toFixed(1)} ${f[1].toFixed(1)})"><path d="M0 0v-26" stroke="#000" stroke-width="3"/><path d="M0-26h16v10H0z" fill="#fff" stroke="#000" stroke-width="2"/><path d="M0-26h5v5H0zM10-26h5v5h-5zM5-21h5v5H5z"/></g>` : ''}
      <circle cx="${s[0].toFixed(1)}" cy="${s[1].toFixed(1)}" r="8" fill="#fff" stroke="#000" stroke-width="3"/>`;
  };

  const route = $('.route');
  const routeHome = $('.route-home');
  const routeCache = new Map();
  let activeRoute = null;
  const drawRoute = (r, target) => {
    const seed = Number(r.dataset.seed), oab = r.dataset.d === '10';
    if (!routeCache.has(seed)) routeCache.set(seed, routeFor(seed, oab));
    $('svg', target).innerHTML = routeCache.get(seed);
    target.style.setProperty('--c', r.dataset.c);
    const city = $('.run__place b', r).textContent;
    const text = `${$('.run__dist', r).textContent} · ${city} · ${oab ? 'out & back' : 'loop'}`;
    $('.route__label', target).textContent = text;
    if (target === routeHome) target.setAttribute('aria-label', `${city} concept route: ${text}`);
  };
  const positionRoute = () => {
    if (!activeRoute || activeRoute.hidden) return;
    const board = $('.runboard');
    const slot = $('.run__route-slot', activeRoute);
    // Layout coordinates stay steady while a row finishes its reveal transform.
    const top = innerWidth <= 700 ? activeRoute.offsetTop+slot.offsetTop : Math.min(activeRoute.offsetTop, board.offsetHeight-routeHome.offsetHeight);
    routeHome.style.top = `${Math.max(0, top)}px`;
    routeHome.style.left = innerWidth <= 700 ? `${activeRoute.offsetLeft+slot.offsetLeft}px` : '';
  };
  const hideRoute = () => {
    activeRoute?.classList.remove('is-route');
    runs.forEach(r => $('.run__join', r).removeAttribute('aria-details'));
    activeRoute = null;
    routeHome.hidden = true;
    route.classList.remove('is-visible');
  };
  const showRoute = (r) => {
    hideRoute();
    activeRoute = r;
    r.classList.add('is-route');
    drawRoute(r, routeHome);
    routeHome.hidden = false;
    $('.run__join', r).setAttribute('aria-details', 'run-route');
    positionRoute();
  };
  runs.forEach(r => {
    const slot = document.createElement('span');
    slot.className = 'run__route-slot';
    slot.setAttribute('aria-hidden', 'true');
    r.append(slot);
    $('.run__join', r).addEventListener('focus', () => showRoute(r));
  });
  window.addEventListener('resize', positionRoute);
  document.fonts?.ready.then(positionRoute);
  if (route && finePointer) {
    let x = 0, y = 0, raf = 0;
    const move = () => {
      // Above the row, so the cursor route cannot hide any Join control.
      const right = innerWidth-route.offsetWidth-16;
      route.style.transform = `translate3d(${Math.max(12, Math.min(x+26, right))}px, ${Math.max(8, y-route.offsetHeight-44)}px, 0)`;
      raf = 0;
    };
    runs.forEach((r) => {
      r.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'touch' || activeRoute === r) return;
        drawRoute(r, route);
        x = e.clientX; y = e.clientY; move();
        route.classList.add('is-visible');
      });
      r.addEventListener('pointerleave', () => route.classList.remove('is-visible'));
      r.addEventListener('pointermove', (e) => {
        x = e.clientX; y = e.clientY;
        if (!raf) raf = requestAnimationFrame(move);
      });
    });
  }

  /* ---------- Sign-up (front-end only) ---------- */
  const form = $('.signup');
  if (form) {
    const input = $('input', form), msg = $('.signup__msg', form), submit = $('button', form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      msg.classList.toggle('is-error', !ok);
      msg.classList.toggle('is-ok', ok);
      if (!ok) {
        input.setAttribute('aria-invalid', 'true');
        msg.textContent = v ? 'That email looks a little short of the finish line. Check it and try again.' : 'Pop your email in first.';
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      msg.textContent = 'You’re in. See you Sunday at seven. (Concept only: nothing was sent.)';
      submit.textContent = 'You’re in ✓';
      submit.disabled = true;
      input.readOnly = true;
    });
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid')) { input.removeAttribute('aria-invalid'); msg.classList.remove('is-error'); }
    });
  }

  // the pink sticker in the join section turns slowly with the scroll
  const joinSticker = $('.join__sticker');
  if (joinSticker && !reduceMotion) {
    const io2 = new IntersectionObserver(([e]) => { joinSticker.dataset.on = e.isIntersecting ? '1' : ''; });
    io2.observe(joinSticker);
    window.addEventListener('scroll', () => {
      if (joinSticker.dataset.on) joinSticker.style.setProperty('--spin', `${(window.scrollY * 0.08) % 360}deg`);
    }, { passive: true });
  }

  /* ---------- Countdown to the next Sunday, 7 a.m. ---------- */
  const cd = $('.countdown');
  const tick = () => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(7, 0, 0, 0);
    next.setDate(now.getDate() + ((7 - now.getDay()) % 7));
    if (next <= now) next.setDate(next.getDate() + 7);
    const m = Math.floor((next - now) / 60000);
    const d = Math.floor(m / 1440), h = Math.floor(m / 60) % 24, mm = m % 60;
    cd.textContent = `${d}d ${String(h).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m`;
  };
  if (cd) { tick(); setInterval(tick, 30000); }

  /* ---------- Menu ---------- */
  const menuBtn = $('.header__menu');
  const menu = $('#menu');
  const menuLabel = $('.header__menu-label');
  const outside = [$('main'), $('.footer')];
  $$('.menu__list li').forEach((li, i) => li.style.setProperty('--i', i));
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuLabel.textContent = open ? 'Close' : 'Menu';
    document.documentElement.classList.toggle('menu-open', open);
    outside.forEach((el) => { el.inert = open; });
    if (open) {
      menu.hidden = false;
      header.classList.remove('is-hidden');
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
      $('a', menu).focus({ preventScroll: true });
    } else {
      menu.classList.remove('is-open');
      menu.hidden = true;
    }
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); }
  });
})();
