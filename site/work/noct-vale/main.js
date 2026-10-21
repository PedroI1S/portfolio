/* Noct & Vale — Dark Luxury concept, v2
   Smoke field + zones and palettes, Enter-through-smoke, chapter counter, overlay menu,
   pinned one-scent-at-a-time sequence (rail fallback), bottle scrub-zoom with engraving,
   archive filter + smoke-dissolve preview, word-by-word quote, cursor, reveals. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1500));
  let cursorState = null; // set by the custom cursor, used by the rail and the Enter
  let scrollQueued = false;

  const DEFAULT_TINT = '#0c090d';
  const DEFAULT_PALETTE = { a: [0.85, 0.6, 0.34], b: [0.45, 0.26, 0.5], g: [1, 0.82, 0.55] };
  const parse = (s) => s.split(',').map(Number);

  /* ---------- Smoke ---------- */
  const smokeCanvas = $('.smoke');
  const smoke = smokeCanvas && window.NoctSmoke ? window.NoctSmoke.create(smokeCanvas) : null;
  root.classList.add(smoke ? 'has-smoke' : 'no-smoke');
  let menuOpen = false, entering = false, smokeLevel = 0;
  if (smoke) {
    smoke.prewarm(30);
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => smoke.resize(), 180); });
    smokeCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); smoke.stop(); root.classList.replace('has-smoke', 'no-smoke'); });
  }
  let warmRemaining = reduceMotion ? 0 : 70, warming = false;
  const warmSmoke = () => {
    if (!smoke || warming || !warmRemaining || document.hidden || menuOpen || !smoke.running) return;
    warming = true;
    idle(() => {
      warming = false;
      if (document.hidden || menuOpen || !smoke.running) return;
      const steps = Math.min(2, warmRemaining);
      smoke.prewarm(steps);
      warmRemaining -= steps;
      warmSmoke();
    });
  };
  const runSmoke = (on) => {
    if (!smoke || reduceMotion) return;
    if (on && !menuOpen) { smoke.start(); warmSmoke(); } else smoke.stop();
  };

  // Palette: the page tint and the smoke follow whichever scent is on screen
  let paletteKey = 'default';
  const setPalette = (key, tint, pal) => {
    if (key === paletteKey) return;
    paletteKey = key;
    root.style.setProperty('--tint', tint);
    $('meta[name="theme-color"]')?.setAttribute('content', tint);
    if (smoke) smoke.setPalette(pal, 1400);
  };
  const scentPalette = (li) => ({ a: parse(li.dataset.a), b: parse(li.dataset.b), g: parse(li.dataset.g) });

  // Stir with the mouse (touch screens just watch it drift)
  if (smoke && !reduceMotion && finePointer) {
    let px = null, py = null, travelled = 0;
    const hint = $('.hero__hint');
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (px !== null && smoke.running) {
        const dx = e.clientX - px, dy = e.clientY - py;
        if (dx || dy) smoke.stir(e.clientX, e.clientY, dx, dy);
        travelled += Math.abs(dx) + Math.abs(dy);
        if (hint && travelled > 700) hint.classList.add('is-done');
      }
      px = e.clientX; py = e.clientY;
    }, { passive: true });
  }

  /* ---------- Hero reveal ---------- */
  const hero = $('.hero');
  if (hero) {
    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      requestAnimationFrame(() => {
        hero.classList.add('is-in');
        if (smoke && !reduceMotion) smokeCanvas.animate([{ opacity: 0 }, { opacity: smokeLevel }], { duration: 1200, easing: 'ease-out' });
      });
      setTimeout(() => hero.classList.add('is-in'), 60);
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(show);
    setTimeout(show, 1200);
  }

  /* ---------- Header state + chapter counter ---------- */
  const header = $('.header');
  const heroTitle = $('.hero__title');
  if (header && heroTitle && 'IntersectionObserver' in window) {
    // solid as soon as the headline reaches the bar, so they never overlap
    new IntersectionObserver(([e]) => header.classList.toggle('is-solid', e.intersectionRatio < 0.99), {
      rootMargin: `-${header.offsetHeight}px 0px 0px 0px`, threshold: [0.99, 1]
    }).observe(heroTitle);
  }
  const counterNo = $('.counter__no');
  const counterName = $('.counter__name');
  const chapters = $$('[data-chapter]');
  let currentChapter = 0;
  if (counterNo && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        currentChapter = chapters.indexOf(e.target);
        counterNo.textContent = e.target.dataset.chapter;
        counterName.textContent = e.target.dataset.name;
      });
    }, { rootMargin: '-50% 0px -50% 0px' });
    chapters.forEach((c) => io.observe(c));
  }

  /* ---------- Overlay menu ---------- */
  const menu = $('#menu');
  const menuBtn = $('.menu-btn:not(.menu-btn--nojs)');
  if (menu && menuBtn) {
    const label = $('.menu-btn__label', menuBtn);
    const links = $$('.menu__nav a', menu);
    const imgs = $$('.menu__img', menu);
    const outside = [$('#main'), $('.footer'), $('.logo')];
    links.forEach((a, i) => a.parentElement.style.setProperty('--i', i));

    let front = 0, shownSrc = '', token = 0;
    const preview = (src) => {
      if (!src || src === shownSrc) return;
      shownSrc = src;
      const t = ++token;
      const back = imgs[1 - front];
      back.src = src;
      const swap = () => {
        if (t !== token) return;
        back.classList.add('is-shown');
        imgs[front].classList.remove('is-shown');
        front = 1 - front;
      };
      back.decode ? back.decode().then(swap, swap) : swap();
    };

    const isOpen = () => menu.classList.contains('is-open');
    const setMenu = (open, { restoreFocus = false } = {}) => {
      menuOpen = open;
      menuBtn.setAttribute('aria-expanded', String(open));
      label.textContent = open ? 'Close' : 'Menu';
      menu.classList.toggle('is-open', open);
      root.classList.toggle('menu-open', open);
      outside.forEach((el) => { if (el) el.inert = open; });
      runSmoke(!open && smokeLevel > 0.01);
      if (open) {
        const current = links[currentChapter] || links[0];
        links.forEach((a) => a.toggleAttribute('aria-current', a === current));
        current.setAttribute('aria-current', 'location');
        links[0].focus({ preventScroll: true });
        preview(current.dataset.preview);
      } else if (restoreFocus) {
        menuBtn.focus({ preventScroll: true });
      }
    };

    menuBtn.addEventListener('click', () => setMenu(!isOpen(), { restoreFocus: true }));
    links.forEach((a) => {
      a.addEventListener('pointerenter', () => preview(a.dataset.preview));
      a.addEventListener('focus', () => preview(a.dataset.preview));
      a.addEventListener('click', () => setMenu(false));
    });
    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') { setMenu(false, { restoreFocus: true }); return; }
      if (e.key !== 'Tab') return;
      const loop = [menuBtn, ...links];
      const i = loop.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); loop[loop.length - 1].focus(); }
      else if (!e.shiftKey && i === loop.length - 1) { e.preventDefault(); loop[0].focus(); }
    });
    const warm = () => {
      if (window.matchMedia('(min-width: 901px)').matches) links.forEach((a) => { new Image().src = a.dataset.preview; });
      menuBtn.removeEventListener('pointerenter', warm);
      menuBtn.removeEventListener('focus', warm);
    };
    menuBtn.addEventListener('pointerenter', warm);
    menuBtn.addEventListener('focus', warm);
  }

  /* ---------- 02 Scents: pinned sequence on large screens, rail elsewhere ---------- */
  const scents = $('#scents');
  const track = $('.scents__track');
  const viewport = $('.rail__viewport');
  const items = $$('.scent');
  const vials = $$('.vial');
  const pinnedMQ = window.matchMedia('(min-width: 900px)');
  let pinned = false, active = -1;

  const activate = (i) => {
    if (i === active) return;
    if (items[active]) items[active].classList.remove('is-active');
    active = i;
    items[i].classList.add('is-active');
    vials.forEach((v, k) => v.classList.toggle('is-current', k === i));
  };
  const trackRange = () => track.offsetHeight - window.innerHeight;
  const trackTop = () => track.getBoundingClientRect().top + window.scrollY;

  const updatePinned = () => {
    const range = trackRange();
    const prog = clamp(-track.getBoundingClientRect().top / Math.max(1, range));
    const p = prog * items.length;
    const i = Math.min(items.length - 1, Math.floor(p));
    const t = Math.min(1, p - i);
    activate(i);
    const li = items[i];
    li.style.setProperty('--t', t.toFixed(3));
    li.dataset.step = t < 0.06 ? 0 : t < 0.22 ? 1 : t < 0.38 ? 2 : 3;
    vials.forEach((v, k) => v.style.setProperty('--fill', k < i ? 1 : k === i ? t.toFixed(3) : 0));
  };

  const setMode = () => {
    const want = pinnedMQ.matches && !reduceMotion;
    if (want === pinned && scents.classList.contains('is-pinned') === want) return;
    pinned = want;
    scents.classList.toggle('is-pinned', pinned);
    if (pinned) {
      viewport.removeAttribute('tabindex'); viewport.removeAttribute('role'); viewport.removeAttribute('aria-label');
      viewport.scrollLeft = 0;
      active = -1;
      updatePinned();
    } else {
      viewport.setAttribute('tabindex', '0'); viewport.setAttribute('role', 'region');
      viewport.setAttribute('aria-label', 'The six scents still made. Scroll sideways to see them all.');
      items.forEach((li) => { li.classList.remove('is-active'); li.removeAttribute('data-step'); li.style.removeProperty('--t'); });
      active = -1;
    }
  };
  if (scents) {
    setMode();
    pinnedMQ.addEventListener('change', () => { setMode(); onScroll(); });
    vials.forEach((v, k) => v.addEventListener('click', () => {
      window.scrollTo({ top: trackTop() + ((k + 0.42) / items.length) * trackRange(), behavior: reduceMotion ? 'auto' : 'smooth' });
    }));
  }

  // Rail (mobile, reduced motion, no-pin): drag with momentum, buttons, progress
  const railIndex = () => {
    const m = viewport.scrollWidth - viewport.clientWidth;
    const p = m > 0 ? clamp(viewport.scrollLeft / m) : 0;
    return Math.round(p * (items.length - 1));
  };
  if (viewport) {
    const bar = $('.rail__progress span');
    const nowEl = $('.rail__now');
    const [prevBtn, nextBtn] = $$('.rail__btn');
    const maxScroll = () => viewport.scrollWidth - viewport.clientWidth;
    const step = () => (items[1] ? items[1].offsetLeft - items[0].offsetLeft : viewport.clientWidth);
    let queued = false;
    const update = () => {
      queued = false;
      if (pinned) return;
      const m = maxScroll();
      const p = m > 0 ? clamp(viewport.scrollLeft / m) : 1;
      const seen = viewport.clientWidth / viewport.scrollWidth;
      bar.style.setProperty('--p', (seen + (1 - seen) * p).toFixed(4));
      nowEl.textContent = String(railIndex() + 1).padStart(2, '0');
      prevBtn.disabled = viewport.scrollLeft <= 2;
      nextBtn.disabled = viewport.scrollLeft >= m - 2;
      onScroll();
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    viewport.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    update();

    [prevBtn, nextBtn].forEach((b) => b.addEventListener('click', () => {
      viewport.scrollBy({ left: Number(b.dataset.dir) * step(), behavior: reduceMotion ? 'auto' : 'smooth' });
    }));

    let down = false, startX = 0, startLeft = 0, lastX = 0, lastT = 0, vel = 0, glide = 0;
    const settle = () => viewport.classList.remove('is-dragging');
    viewport.addEventListener('pointerdown', (e) => {
      if (pinned || e.pointerType !== 'mouse' || e.button !== 0) return;
      e.preventDefault();
      cancelAnimationFrame(glide);
      down = true;
      startX = lastX = e.clientX;
      startLeft = viewport.scrollLeft;
      lastT = performance.now();
      vel = 0;
      try { viewport.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
      viewport.classList.add('is-dragging');
      cursorState?.('down', true);
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!down) return;
      viewport.scrollLeft = startLeft - (e.clientX - startX);
      const t = performance.now(), dt = t - lastT;
      if (dt > 0) vel = 0.75 * ((lastX - e.clientX) / dt) + 0.25 * vel;
      lastX = e.clientX; lastT = t;
    });
    const release = (e) => {
      if (!down) return;
      down = false;
      try { if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      cursorState?.('down', false);
      if (performance.now() - lastT > 80) vel = 0;
      if (reduceMotion || Math.abs(vel) < 0.05) { settle(); return; }
      let v = vel * 16;
      const glideStep = () => {
        const before = viewport.scrollLeft;
        viewport.scrollLeft += v;
        v *= 0.93;
        if (Math.abs(v) > 0.5 && viewport.scrollLeft !== before) glide = requestAnimationFrame(glideStep);
        else settle();
      };
      glide = requestAnimationFrame(glideStep);
    };
    viewport.addEventListener('pointerup', release);
    viewport.addEventListener('pointercancel', release);
  }

  /* ---------- 03 Bottle: scrub-zoom to the base, then the engraving catches the light ---------- */
  const bottle = $('#bottle');
  const bFig = $('.bottle__figure');
  const bZoom = $('.bottle__zoom');
  const bottlePinned = !!bottle && !reduceMotion;
  let bq = 0, bTarget = 0, bRaf = 0, bLast = 0, geo = null;
  if (bottlePinned) bottle.classList.add('is-pinned');
  const measureBottle = () => {
    if (!bottlePinned) return;
    const w = bFig.offsetWidth, h = bFig.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    const bx = bFig.offsetLeft + 0.497 * w, by = bFig.offsetTop + 0.686 * h;
    const want = (vw < 760 ? 0.92 : 0.6) * vw;
    geo = { bx, by, cx: vw / 2, cy: vh * (vw < 760 ? 0.5 : 0.47), S: clamp(want / (0.31 * w), 1.5, 2.6) };
  };
  const applyBottle = (q) => {
    if (!geo) measureBottle();
    const fade = smoothstep(clamp((q - 0.03) / 0.17));
    const z = easeInOut(clamp((q - 0.08) / 0.5));
    const sweep = clamp((q - 0.6) / 0.2);
    const s = bottle.style;
    s.setProperty('--fade', fade.toFixed(3));
    bZoom.style.setProperty('--zs', (1 + (geo.S - 1) * z).toFixed(4));
    bZoom.style.setProperty('--zx', `${((geo.cx - geo.bx) * z).toFixed(1)}px`);
    bZoom.style.setProperty('--zy', `${((geo.cy - geo.by) * z).toFixed(1)}px`);
    s.setProperty('--sweep', sweep.toFixed(3));
    s.setProperty('--glint', Math.sin(Math.PI * sweep).toFixed(3));
    bottle.classList.toggle('is-engraved', q > 0.78);
    bottle.classList.toggle('is-spec', q > 0.84);
  };
  const bottleTick = (now) => {
    const dt = Math.min(0.05, (now - bLast) / 1000 || 0.016);
    bLast = now;
    bq += (bTarget - bq) * (1 - Math.exp(-dt * 9));
    if (Math.abs(bTarget - bq) < 0.0005) bq = bTarget;
    applyBottle(bq);
    bRaf = bq !== bTarget ? requestAnimationFrame(bottleTick) : 0;
  };
  const updateBottle = () => {
    if (!bottlePinned) return;
    const r = bottle.getBoundingClientRect();
    if (r.bottom < -100 || r.top > window.innerHeight + 100) return;
    bTarget = clamp(-r.top / Math.max(1, r.height - window.innerHeight));
    if (!bRaf) { bLast = performance.now(); bRaf = requestAnimationFrame(bottleTick); }
  };
  if (bottlePinned) {
    window.addEventListener('resize', () => { measureBottle(); applyBottle(bq); });
    applyBottle(0);
  }

  /* ---------- 05 Quote: word by word ---------- */
  const quoteP = $('.quote__text p');
  let words = [];
  if (quoteP && !reduceMotion) {
    const text = quoteP.textContent.trim();
    quoteP.innerHTML = text.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
    quoteP.parentElement.classList.add('is-split');
    words = $$('.w', quoteP);
  }
  const updateQuote = () => {
    if (!words.length) return;
    const r = quoteP.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh) return;
    const p = clamp((vh * 0.9 - r.top) / (r.height + vh * 0.4));
    const lit = Math.round(p * words.length * 1.05);
    words.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
  };

  /* ---------- Zones: where the smoke shows, how strong, and in which palette ---------- */
  const epilogue = $('#epilogue');
  const quote = $('#words');
  const zones = [
    { el: hero, k: 1, emit: 1 },
    { el: track, k: 0.82, emit: 0.75 },
    { el: quote, k: 0.4, emit: 0.4 },
    { el: epilogue, k: 0.9, emit: 0.9 }
  ];
  const overlap = (el) => {
    if (!el) return 0;
    const r = el.getBoundingClientRect(), vh = window.innerHeight;
    return clamp((Math.min(r.bottom, vh) - Math.max(r.top, 0)) / vh);
  };
  const updateZones = () => {
    let level = 0, emit = 0;
    const f = zones.map((z) => overlap(z.el));
    zones.forEach((z, i) => { level = Math.max(level, smoothstep(clamp(f[i] * 1.6)) * z.k); emit = Math.max(emit, f[i] > 0.05 ? z.emit : 0); });
    if (entering) level = 1;
    smokeLevel = level;
    if (smoke) {
      smokeCanvas.style.opacity = level.toFixed(3);
      smoke.setEmit(emit);
      runSmoke(level > 0.01);
    }
    // palette: a scent's colours while its stage fills most of the screen
    const inScents = f[1] > 0.55;
    if (inScents) {
      const i = pinned ? Math.max(0, active) : railIndex();
      const li = items[i];
      if (li) setPalette(`scent-${i}`, li.dataset.tint, scentPalette(li));
    } else {
      setPalette('default', DEFAULT_TINT, DEFAULT_PALETTE);
    }
  };

  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      if (pinned) updatePinned();
      updateBottle();
      updateQuote();
      updateZones();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
  // the first frame shouldn't wait for a scroll, or for a starved rAF
  updateZones();

  /* ---------- Enter: through the smoke into the first scent ---------- */
  const enter = $('.enter');
  const veil = $('.veil');
  if (enter && smoke && !reduceMotion) {
    let swirlTimer = 0;
    const swirl = () => {
      const r = enter.getBoundingClientRect();
      smoke.swirl(r.left + r.width / 2, r.top + r.height / 2, r.width * 0.62, 240);
    };
    enter.addEventListener('pointerenter', () => { swirl(); clearInterval(swirlTimer); swirlTimer = setInterval(swirl, 140); });
    enter.addEventListener('pointerleave', () => clearInterval(swirlTimer));

    enter.addEventListener('click', (e) => {
      if (!smoke.running || entering) return; // plain anchor jump otherwise
      e.preventDefault();
      clearInterval(swirlTimer);
      entering = true;
      root.classList.add('is-entering');
      smoke.surge();
      updateZones();
      veil.classList.add('is-on');
      setTimeout(() => {
        const top = pinned ? trackTop() : scents.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight || 0);
        window.scrollTo({ top, behavior: 'instant' });
        try { history.replaceState(null, '', '#scents'); } catch (_) { /* srcdoc */ }
        scents.setAttribute('tabindex', '-1');
        scents.focus({ preventScroll: true });
        onScroll();
        setTimeout(() => veil.classList.remove('is-on'), 120);
        // let the surge thin out, then slip the smoke back behind the page
        setTimeout(() => {
          smokeCanvas.style.transition = 'opacity 450ms ease';
          smokeCanvas.style.opacity = '0';
          setTimeout(() => {
            root.classList.remove('is-entering');
            entering = false;
            updateZones();
            setTimeout(() => { smokeCanvas.style.transition = ''; }, 700);
          }, 460);
        }, 1500);
      }, 720);
    });
  }

  /* ---------- 04 Archive: filter ---------- */
  const index = $('.index');
  const rows = $$('.index__row');
  const filterBtns = $$('.filter__btn');
  const status = $('.filter__status');
  if (filterBtns.length) {
    const apply = (f) => {
      const show = (r) => f === 'all' || r.dataset.status === f;
      filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
      const leaving = rows.filter((r) => !r.hidden && !show(r));
      const finish = () => {
        const before = new Map(rows.filter((r) => !r.hidden).map((r) => [r, r.getBoundingClientRect().top]));
        rows.forEach((r) => { r.hidden = !show(r); r.classList.remove('is-leaving'); });
        const visible = rows.filter((r) => !r.hidden);
        if (!reduceMotion) {
          visible.forEach((r, i) => {
            if (before.has(r)) {
              const dy = before.get(r) - r.getBoundingClientRect().top;
              if (Math.abs(dy) > 1) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
            } else {
              r.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 60 + i * 30, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' });
            }
          });
        }
        status.textContent = `Showing ${visible.length} of ${rows.length} scents`;
      };
      if (leaving.length && !reduceMotion) {
        leaving.forEach((r) => r.classList.add('is-leaving'));
        setTimeout(finish, 260);
      } else finish();
    };
    filterBtns.forEach((b) => b.addEventListener('click', () => apply(b.dataset.filter)));
  }

  /* ---------- 04 Archive: a preview for every row, revealed through smoke ---------- */
  const peek = $('.peek');
  if (index && peek && finePointer) {
    const cap = $('.peek__cap', peek);
    const img = $('.peek__img', peek);
    const src = (row) => `img/peek/noct-${row.dataset.img}.jpg`;
    const gl = reduceMotion ? null : createPeekGL($('.peek__canvas', peek));
    if (!gl) peek.classList.add('no-gl');

    if ('IntersectionObserver' in window) {
      const near = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        near.disconnect();
        idle(() => rows.forEach((r) => gl ? gl.load(src(r)) : (new Image().src = src(r))));
      }, { rootMargin: '800px 0px' });
      near.observe(index);
    }

    let x = 0, y = 0, tx = 0, ty = 0, rot = 0, trot = 0, raf = 0, on = false;
    const place = () => {
      const w = peek.offsetWidth, h = peek.offsetHeight;
      const flip = tx + 40 + w > window.innerWidth - 16;
      const ox = flip ? -w - 40 : 40;
      if (reduceMotion) { x = tx; y = ty; rot = 0; }
      else { x += (tx - x) * 0.16; y += (ty - y) * 0.16; rot += (trot - rot) * 0.1; }
      const top = Math.min(Math.max(y - h / 2, 16), window.innerHeight - h - 16);
      peek.style.transform = `translate3d(${(x + ox).toFixed(1)}px, ${top.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
      raf = (on || Math.abs(tx - x) > 0.2 || Math.abs(ty - y) > 0.2) && !reduceMotion ? requestAnimationFrame(place) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(place); };

    rows.forEach((row, i) => {
      row.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        if (!on) { x = tx = e.clientX; y = ty = e.clientY; }
        on = true;
        cap.textContent = row.querySelector('.index__mat').textContent;
        trot = reduceMotion ? 0 : (i % 2 ? 3.5 : -3.5);
        peek.classList.add('is-visible');
        if (gl) gl.show(src(row)); else img.src = src(row);
        kick();
      });
    });
    index.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; kick(); }, { passive: true });
    index.addEventListener('pointerleave', () => {
      on = false;
      peek.classList.remove('is-visible');
      if (gl) gl.hide();
    });
  }

  function createPeekGL(canvas) {
    const g = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!g) return null;
    const vs = 'attribute vec2 p;varying vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}';
    const fs = `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D uA, uB;
      uniform float uMix, uShow, uTime;
      uniform vec3 uRim;
      float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
      // smoky edge: noise plus a rise from the bottom
      float field(vec2 uv, float t) {
        vec2 q = vec2(fbm(uv * 2.6 + vec2(0.0, -t * 0.25)), fbm(uv * 2.6 + vec2(3.7, t * 0.2)));
        return fbm(uv * 3.2 + q * 1.4) * 0.75 + uv.y * 0.35;
      }
      void main() {
        vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
        float f = field(vUv, uTime);          // ~0.1 at the bottom … ~1.1 at the top
        float r1 = uMix * 1.35 - 0.12;        // the incoming image rises through the old one
        float mB = 1.0 - smoothstep(r1 - 0.12, r1, f);
        float r2 = uShow * 1.35 - 0.12;       // and the whole print condenses out of smoke
        float a = 1.0 - smoothstep(r2 - 0.14, r2, f);
        vec3 col = mix(texture2D(uA, uv).rgb, texture2D(uB, uv).rgb, mB);
        float rimB = (1.0 - abs(mB * 2.0 - 1.0)) * step(0.001, uMix) * step(uMix, 0.999);
        float rimA = (1.0 - abs(a * 2.0 - 1.0)) * step(uShow, 0.999);
        col += uRim * (rimB + rimA) * 0.45;
        gl_FragColor = vec4(col * a, a);
      }`;
    const sh = (t, s) => { const o = g.createShader(t); g.shaderSource(o, s); g.compileShader(o); return g.getShaderParameter(o, g.COMPILE_STATUS) ? o : null; };
    const v = sh(g.VERTEX_SHADER, vs), f = sh(g.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const pr = g.createProgram();
    g.attachShader(pr, v); g.attachShader(pr, f); g.linkProgram(pr);
    if (!g.getProgramParameter(pr, g.LINK_STATUS)) return null;
    g.useProgram(pr);
    const b = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, b);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
    const loc = g.getAttribLocation(pr, 'p');
    g.enableVertexAttribArray(loc);
    g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    const U = (n) => g.getUniformLocation(pr, n);
    const uA = U('uA'), uB = U('uB'), uMix = U('uMix'), uShow = U('uShow'), uTime = U('uTime'), uRim = U('uRim');
    g.uniform1i(uA, 0); g.uniform1i(uB, 1);
    g.uniform3f(uRim, 0.95, 0.72, 0.42);

    const blank = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, blank);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array([12, 9, 13, 255]));
    const textures = new Map();
    const load = (url) => {
      if (textures.has(url)) return textures.get(url);
      const entry = { tex: null, ready: false };
      textures.set(url, entry);
      const im = new Image();
      im.onload = () => {
        const t = g.createTexture();
        g.bindTexture(g.TEXTURE_2D, t);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, im);
        entry.tex = t; entry.ready = true;
        kick();
      };
      im.src = url;
      return entry;
    };

    let cur = null, next = null, mix = 0, show = 0, showTarget = 0, raf = 0, last = 0, time = Math.random() * 10;
    const draw = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      time += dt;
      show += (showTarget - show) * (1 - Math.exp(-dt * (showTarget > show ? 4.5 : 6)));
      if (Math.abs(showTarget - show) < 0.002) show = showTarget;
      if (next && next.ready) {
        if (!cur || show < 0.02) { cur = next; next = null; mix = 0; }
        else {
          mix = Math.min(1, mix + dt * 2.4);
          if (mix >= 1) { cur = next; next = null; mix = 0; }
        }
      }
      g.viewport(0, 0, canvas.width, canvas.height);
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, cur && cur.ready ? cur.tex : blank);
      g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, next && next.ready ? next.tex : blank);
      g.uniform1f(uMix, next && next.ready ? mix : 0);
      g.uniform1f(uShow, show);
      g.uniform1f(uTime, time);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      // keep breathing while it's on screen; stop once it has dissolved away
      raf = show > 0 || showTarget > 0 ? requestAnimationFrame(draw) : 0;
    };
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(draw); } };
    return {
      load,
      show(url) {
        const e = load(url);
        if (cur === e) { next = null; }
        else if (next !== e) { next = e; mix = 0; }
        showTarget = 1;
        kick();
      },
      hide() { showTarget = 0; kick(); }
    };
  }

  /* ---------- Custom cursor ---------- */
  if (finePointer && !reduceMotion) {
    const cursor = $('.cursor');
    const disc = $('.cursor__disc');
    const dot = $('.cursor__dot');
    root.classList.add('has-cursor');
    cursor.classList.add('is-hidden');
    let mx = -100, my = -100, dx = -100, dy = -100, raf = 0, seen = false;
    const follow = () => {
      dx += (mx - dx) * 0.18;
      dy += (my - dy) * 0.18;
      disc.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
      raf = Math.abs(mx - dx) + Math.abs(my - dy) > 0.2 ? requestAnimationFrame(follow) : 0;
    };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      if (!seen) { seen = true; dx = mx; dy = my; }
      cursor.classList.remove('is-hidden');
      if (!raf) raf = requestAnimationFrame(follow);
    }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;
      const drag = !pinned && !!t.closest('.rail__viewport');
      const onEnter = !!t.closest('.enter');
      cursor.classList.toggle('is-drag', drag);
      cursor.classList.toggle('is-enter', onEnter);
      cursor.classList.toggle('is-peek', !!t.closest('.index__row'));
      cursor.classList.toggle('is-link', !drag && !onEnter && !!t.closest('a, button, label, [tabindex="0"]:not(.rail__viewport)'));
    });
    root.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
    cursorState = (name, on) => cursor.classList.toggle(`is-${name}`, on);
  }

  /* ---------- Scroll reveals ---------- */
  const targets = $$('[data-reveal], .archive__num, .epilogue__big, .epilogue__title');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
    targets.forEach((el) => io.observe(el));
  }
})();
