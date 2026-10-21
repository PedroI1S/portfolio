/* hello.exe — Retro / Y2K chrome & OS concept
   Theme and sound switches, the 3D hero, telemetry, a desktop of draggable windows, copy-to-clipboard. */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n, l) => String(Math.max(0, Math.floor(n))).padStart(l, '0');
  const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  const live = document.createElement('div');
  live.className = 'sr';
  live.setAttribute('aria-live', 'polite');
  document.body.append(live);
  const announce = (msg) => { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); };

  /* ---------- Sound: tiny UI blips made live with Web Audio, off by default ---------- */
  const sound = (() => {
    let ctx = null, out = null, on = false;
    const ensure = () => {
      if (document.hidden) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        out = ctx.createGain();
        out.gain.value = 0.55;
        const comp = ctx.createDynamicsCompressor();
        out.connect(comp); comp.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    function tone(f, dur, { type = 'sine', gain = 0.15, at = 0, to = 0, attack = 0.004 } = {}) {
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur + 0.03);
    }
    function noise(dur, { gain = 0.1, freq = 1200, q = 1, at = 0 } = {}) {
      const t = ctx.currentTime + at;
      const len = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
      s.connect(f); f.connect(g); g.connect(out);
      s.start(t);
    }
    const sfx = {
      click: () => { tone(1900, 0.03, { type: 'square', gain: 0.035 }); tone(950, 0.05, { gain: 0.08 }); },
      tick: () => tone(3200, 0.02, { gain: 0.03 }),
      open: () => { tone(520, 0.12, { type: 'triangle', gain: 0.12, to: 880 }); tone(1320, 0.08, { gain: 0.04, at: 0.07 }); },
      close: () => tone(880, 0.12, { type: 'triangle', gain: 0.1, to: 420 }),
      min: () => tone(760, 0.2, { gain: 0.1, to: 260 }),
      boing: () => { tone(170, 0.5, { gain: 0.22, to: 430 }); tone(340, 0.32, { type: 'triangle', gain: 0.05, to: 860 }); },
      chime: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.55, { type: 'triangle', gain: 0.09, at: i * 0.07 })),
      copy: () => { tone(1400, 0.05, { gain: 0.08 }); tone(2100, 0.07, { gain: 0.08, at: 0.06 }); },
      grab: () => tone(420, 0.03, { gain: 0.06 }),
      drop: () => tone(300, 0.05, { gain: 0.06 }),
      crumple: () => { noise(0.14, { gain: 0.5, freq: 2200, q: 0.7 }); noise(0.2, { gain: 0.4, freq: 900, q: 0.9, at: 0.11 }); },
    };
    return {
      get on() { return on; },
      get currentContext() { return ctx; },
      set(v) { on = v; if (v) ensure(); },
      play(name) { if (on && ensure() && sfx[name]) sfx[name](); },
      context: () => (ensure() ? { ctx, out } : null),
    };
  })();

  /* ---------- Hidden tab: one shared gate for every loop on the page ---------- */
  const visWatchers = new Set();
  const onVisibility = (fn) => visWatchers.add(fn); // fn(visible)
  const syncVisibility = () => {
    root.classList.toggle('is-hidden', document.hidden);
    visWatchers.forEach((fn) => fn(!document.hidden));
  };
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
  let resumeAudio = false;
  onVisibility((visible) => {
    const a = sound.currentContext;
    if (!a) return;
    if (!visible) {
      resumeAudio = a.state === 'running';
      if (resumeAudio) a.suspend();
    } else if (resumeAudio) {
      resumeAudio = false;
      a.resume();
    }
  });
  // a 3D scene runs only while it is on screen and the tab is visible; its intersection state survives a hidden tab
  function gateScene(sc, inView = false) {
    const sync = () => (inView && !document.hidden ? sc.start() : sc.stop());
    onVisibility(sync);
    sync();
    return (v) => { inView = v; sync(); };
  }

  // apps.js (the window contents) shares the sound engine, the live region and the visibility gate
  window.helloExe = { sound, announce, reduceMotion, onVisibility };

  /* ---------- Theme: A (Aqua) / G (Graphite) ---------- */
  const themeMeta = $('meta[name="theme-color"]');
  let world = null, desk = null, loadDesk = null;
  const scenes = []; // every 3D scene on the page, re-lit when the theme changes
  let theme = root.dataset.theme === 'g' ? 'g' : 'a';
  function applyTheme(t) {
    if (t === 'g') root.dataset.theme = 'g'; else delete root.dataset.theme;
    $$('[data-theme-label]').forEach((el) => { el.textContent = t === 'g' ? 'G' : 'A'; });
    $$('[data-theme-sr]').forEach((el) => { el.textContent = t === 'g' ? 'Theme: Graphite. Switch to Aqua' : 'Theme: Aqua. Switch to Graphite'; });
    if (themeMeta) themeMeta.content = t === 'g' ? '#0B111C' : '#BFDDF0';
    scenes.forEach((sc) => sc.setTheme(t));
  }
  applyTheme(theme);
  $$('[data-toggle="theme"]').forEach((btn) => btn.addEventListener('click', () => {
    theme = theme === 'g' ? 'a' : 'g';
    store.set('hello-exe-theme', theme);
    applyTheme(theme);
    sound.play('click');
    announce(theme === 'g' ? 'Graphite theme on' : 'Aqua theme on');
  }));

  function applySound(v) {
    sound.set(v);
    $$('[data-toggle="sound"]').forEach((b) => b.setAttribute('aria-pressed', String(v)));
    $$('[data-sound-label]').forEach((el) => { el.textContent = v ? '|||' : '·'; });
  }
  $$('[data-toggle="sound"]').forEach((btn) => btn.addEventListener('click', () => {
    applySound(!sound.on);
    sound.play('chime');
  }));

  // small clicks for navigation, ticks on hover (only when sound is on)
  document.addEventListener('click', (e) => {
    if (e.target.closest('.bar__nav a, .menu a, .bar__logo, .bar__menu, .foot a, .chip')) sound.play('click');
  });
  if (finePointer) {
    $$('.bar__nav a, .toggle, .icon, .copy').forEach((el) => el.addEventListener('pointerenter', () => sound.play('tick')));
  }

  /* ---------- Mobile menu ---------- */
  const menuBtn = $('.bar__menu');
  const menu = $('#menu');
  if (menuBtn && menu) {
    const setMenu = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.querySelector('b').textContent = open ? '×' : '+';
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

  /* ---------- Registration grids: horizontal rules and crosshairs ---------- */
  const grids = $$('[data-grid]');
  function drawGrid(g) {
    g.querySelectorAll('.grid__h, .grid__x').forEach((n) => n.remove());
    const cols = parseInt(getComputedStyle(g).getPropertyValue('--cols'), 10) || 4;
    const rows = (g.dataset.rows || '').split(',').filter(Boolean).map(Number);
    const frag = document.createDocumentFragment();
    rows.forEach((y) => {
      const h = document.createElement('i');
      h.className = 'grid__h'; h.style.top = `${y}%`;
      frag.append(h);
      for (let c = 0; c <= cols; c++) {
        const x = document.createElement('b');
        x.className = 'grid__x'; x.style.left = `${(c / cols) * 100}%`; x.style.top = `${y}%`;
        frag.append(x);
      }
    });
    g.append(frag);
  }
  grids.forEach(drawGrid);
  window.matchMedia('(max-width: 900px)').addEventListener('change', () => grids.forEach(drawGrid));

  /* ---------- Hero: the chrome word and the 3D cursor ---------- */
  const hero = $('.hero');
  const canvas = $('.hero__gl');
  const hint = $('[data-hint]');
  if (hint) {
    if (reduceMotion) hint.hidden = true;
    else hint.textContent = finePointer ? 'Poke the word' : 'Tap the word';
  }
  const later = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 600));
  const hasGL = (() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  })();

  if (hero && canvas && hasGL) {
    import('./world.js?v=10')
      .then(({ createChromeWord }) => createChromeWord(canvas, { text: 'hey', reduced: reduceMotion, theme, fine: finePointer }))
      .then((w) => {
        world = w;
        scenes.push(w);
        root.classList.add('gl-ready');
        if (finePointer && !reduceMotion) hero.classList.add('is-cursor');
        const heroInView = gateScene(w, true);
        if ('IntersectionObserver' in window) {
          new IntersectionObserver(([e]) => heroInView(e.isIntersecting)).observe(hero);
        }
        let rt;
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => w.resize(), 120); });
      })
      .catch((err) => { console.warn('hello.exe: the 3D hero could not start, showing the CSS word instead.', err); })
      // the rest of the chrome loads once the hero is on screen
      .finally(() => later(() => { if (loadDesk) loadDesk(); loadContact(); }));

    const local = (e) => { const r = hero.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    hero.addEventListener('pointermove', (e) => {
      if (!world || e.pointerType === 'touch') return;
      const [x, y] = local(e);
      world.setPointer(x, y);
      world.setHoverUI(!!e.target.closest('a, button'));
    });
    hero.addEventListener('pointerleave', () => world && world.leave());
    hero.addEventListener('pointerdown', (e) => {
      if (!world || e.target.closest('a, button')) return;
      world.setPressed(true);
      const [x, y] = local(e);
      if (world.poke(x, y)) sound.play('boing');
    });
    window.addEventListener('pointerup', () => world && world.setPressed(false));
  }

  /* ---------- Telemetry: pointer readout, odometer, Porto clock, uptime ---------- */
  const xEl = $('[data-x]'), yEl = $('[data-y]'), odoEls = $$('[data-odo]');
  let px = -1, py = -1, odo = 0, telRaf = 0;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (px >= 0) odo += Math.hypot(e.clientX - px, e.clientY - py);
    px = e.clientX; py = e.clientY;
    if (telRaf) return;
    telRaf = requestAnimationFrame(() => {
      telRaf = 0;
      if (xEl) { xEl.textContent = pad(px, 4); yEl.textContent = pad(py, 4); }
      const m = (odo / 96) * 0.0254; // css px are 1/96 in
      odoEls.forEach((el) => { el.textContent = m.toFixed(2).padStart(6, '0'); });
    });
  }, { passive: true });
  if (xEl) { xEl.textContent = pad(window.innerWidth / 2, 4); yEl.textContent = pad(window.innerHeight / 2, 4); }

  const TZ = 'Europe/Lisbon';
  const hm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ });
  const hms = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: TZ });
  const tzName = (d) => (new Intl.DateTimeFormat('en-GB', { timeZone: TZ, timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName') || {}).value || 'WET';
  const statusFor = (h) => (h < 7 ? ['Asleep', 'Back at nine. Leave a message.']
    : h < 9 ? ['Coffee', 'Reading mail, slowly.']
    : h < 13 ? ['At desk', 'Replies within a day.']
    : h < 14 ? ['Lunch', 'Back at two.']
    : h < 19 ? ['At desk', 'Replies within a day.']
    : h < 23 ? ['Offline', 'Side projects, probably.']
    : ['Asleep', 'Back at nine. Leave a message.']);
  const t0 = Date.now();
  function tickClock() {
    const now = new Date();
    const hmText = hm.format(now);
    $$('[data-clock]').forEach((el) => { el.textContent = hmText; });
    $$('[data-clock-s]').forEach((el) => { el.textContent = hms.format(now); });
    $$('[data-tzname]').forEach((el) => { el.textContent = tzName(now); });
    const [label, note] = statusFor(parseInt(hmText, 10));
    $$('[data-status]').forEach((el) => { el.textContent = label; });
    $$('[data-status-note]').forEach((el) => { el.textContent = note; });
    const s = Math.floor((Date.now() - t0) / 1000);
    const up = s >= 3600 ? `${pad(s / 3600, 2)}:${pad((s % 3600) / 60, 2)}:${pad(s % 60, 2)}` : `${pad(s / 60, 2)}:${pad(s % 60, 2)}`;
    $$('[data-uptime]').forEach((el) => { el.textContent = up; });
  }
  tickClock();
  let clockTimer = document.hidden ? 0 : setInterval(tickClock, 1000);
  onVisibility((visible) => {
    if (!visible) { clearInterval(clockTimer); clockTimer = 0; }
    else if (!clockTimer) { tickClock(); clockTimer = setInterval(tickClock, 1000); }
  });

  window.addEventListener('load', () => {
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    const ms = nav && nav.loadEventStart ? nav.loadEventStart : performance.now();
    $$('[data-load]').forEach((el) => { el.textContent = ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`; });
  });

  /* ---------- Header state and the right-edge scroll readout ---------- */
  const bar = $('.bar');
  const thumb = $('.scrolly i');
  let scRaf = 0;
  function onScroll() {
    scRaf = 0;
    const y = window.scrollY, vh = window.innerHeight, doc = document.documentElement.scrollHeight;
    if (bar && hero) bar.classList.toggle('is-solid', y > hero.offsetHeight - 80);
    if (thumb) {
      const track = thumb.parentElement.clientHeight;
      const th = Math.max(28, track * (vh / doc));
      thumb.style.setProperty('--h', `${th}px`);
      thumb.style.setProperty('--y', `${(y / Math.max(1, doc - vh)) * (track - th)}px`);
    }
  }
  window.addEventListener('scroll', () => { if (!scRaf) scRaf = requestAnimationFrame(onScroll); }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Reveals ---------- */
  $$('[data-split]').forEach((word, w) => {
    const text = word.textContent.trim();
    word.textContent = '';
    word.setAttribute('aria-hidden', 'true');
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      s.style.setProperty('--i', i);
      s.style.setProperty('--w', w);
      word.append(s);
    });
  });
  const stack = $('.stack');
  if (stack) stack.setAttribute('aria-label', 'Say hello back.');

  const heroTitle = $('.hero__title');
  const revealTargets = $$('[data-reveal], .stack');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-in'));
    heroTitle && heroTitle.classList.add('is-in');
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    revealTargets.forEach((el) => io.observe(el));
    const showHero = () => requestAnimationFrame(() => heroTitle && heroTitle.classList.add('is-in'));
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(showHero);
    setTimeout(showHero, 1400);
  }

  /* ---------- Desktop: 3D icons, sprung windows, dock ---------- */
  const screen = $('.screen');
  if (screen) {
    const wins = $$('.win', screen);
    const icons = $$('.icon', screen);
    const chips = $('[data-chips]', screen);
    const lasso = $('.lasso', screen);
    const DOCK = 84; // kept clear for the dock
    const state = new Map();
    const motion = new Map();
    let zTop = 10, active = null, opened = 0;

    const area = () => ({ w: screen.clientWidth, h: screen.clientHeight - DOCK });
    const small = () => screen.clientWidth < 640;
    const iconFor = (win) => $(`[data-open="${win.id}"]`, screen);
    const iconIndex = (win) => icons.indexOf(iconFor(win));
    const titleOf = (win) => $('.win__title', win).textContent;
    // centre of an element in the desk's own coordinates (inside the bezel)
    const centreOf = (el) => {
      const s = screen.getBoundingClientRect(), r = el.getBoundingClientRect();
      return [r.left - s.left - screen.clientLeft + r.width / 2, r.top - s.top - screen.clientTop + r.height / 2];
    };

    /* springs: position, scale, a flip around x, lift, and a tilt that follows velocity */
    const SPRING = { k: 300, c: 24 }, SCALE = { k: 380, c: 22 }, FLIP = { k: 200, c: 17 };
    const spring = (v, vel, target, { k, c }, dt) => { vel += (k * (target - v) - c * vel) * dt; return [v + vel * dt, vel]; };
    const newMotion = () => ({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, s: 1, vs: 0, ts: 1, f: 0, vf: 0, tf: 0, rx: 0, ry: 0, o: 1, to: 1, lift: 0, tlift: 0, drag: false, idle: true, done: null, doneWhen: null });
    function stepMotion(m, dt) {
      if (m.drag) {
        const nx = damp(m.x, m.tx, 30, dt), ny = damp(m.y, m.ty, 30, dt);
        m.vx = damp(m.vx, (nx - m.x) / dt, 16, dt); m.vy = damp(m.vy, (ny - m.y) / dt, 16, dt);
        m.x = nx; m.y = ny;
      } else {
        [m.x, m.vx] = spring(m.x, m.vx, m.tx, SPRING, dt);
        [m.y, m.vy] = spring(m.y, m.vy, m.ty, SPRING, dt);
      }
      [m.s, m.vs] = spring(m.s, m.vs, m.ts, SCALE, dt);
      [m.f, m.vf] = spring(m.f, m.vf, m.tf, FLIP, dt);
      m.o = damp(m.o, m.to, m.to ? 14 : 10, dt);
      m.lift = damp(m.lift, m.tlift, 12, dt);
      m.rx = damp(m.rx, Math.max(-12, Math.min(12, -m.vy * 0.011)), 10, dt);
      m.ry = damp(m.ry, Math.max(-12, Math.min(12, m.vx * 0.011)), 10, dt);
    }
    const settled = (m) => !m.drag
      && Math.abs(m.x - m.tx) < 0.2 && Math.abs(m.y - m.ty) < 0.2 && Math.abs(m.vx) + Math.abs(m.vy) < 4
      && Math.abs(m.s - m.ts) < 0.001 && Math.abs(m.vs) < 0.01 && Math.abs(m.f - m.tf) < 0.05 && Math.abs(m.vf) < 0.2
      && Math.abs(m.o - m.to) < 0.005 && Math.abs(m.lift - m.tlift) < 0.005 && Math.abs(m.rx) < 0.02 && Math.abs(m.ry) < 0.02;
    function snap(m) { m.x = m.tx; m.y = m.ty; m.vx = m.vy = 0; m.s = m.ts; m.vs = 0; m.f = m.tf; m.vf = 0; m.o = m.to; m.lift = m.tlift; m.rx = m.ry = 0; }
    function paint(win, m) {
      win.style.transform = `translate3d(${m.x.toFixed(2)}px, ${m.y.toFixed(2)}px, 0) perspective(1100px) rotateX(${(m.rx + m.f).toFixed(2)}deg) rotateY(${m.ry.toFixed(2)}deg) scale(${m.s.toFixed(4)})`;
      win.style.opacity = m.o.toFixed(3);
      win.style.setProperty('--lift', m.lift.toFixed(3));
    }
    let raf = 0, lastT = 0, deskInView = !('IntersectionObserver' in window);
    function tick(now) {
      const dt = Math.min((now - lastT) / 1000, 1 / 30);
      lastT = now;
      let busy = false;
      motion.forEach((m, win) => {
        if (m.idle) return;
        for (let i = 0; i < 4; i++) stepMotion(m, dt / 4);
        if (m.done && m.doneWhen(m)) { const d = m.done; m.done = null; d(); }
        if (m.idle) return;
        if (settled(m)) { snap(m); m.idle = true; offerFocus(win); } else busy = true;
        paint(win, m);
      });
      raf = busy ? requestAnimationFrame(tick) : 0;
    }
    function kick(win) {
      const m = motion.get(win);
      if (reduceMotion) {
        snap(m); paint(win, m);
        if (m.done) { const d = m.done; m.done = null; d(); }
        offerFocus(win);
        return;
      }
      m.idle = false;
      if (!raf && deskInView && !document.hidden) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
    }
    // hidden tab: hold the springs where they are, carry on from there when the tab comes back
    const syncSprings = () => {
      if (!deskInView || document.hidden) { cancelAnimationFrame(raf); raf = 0; return; }
      if (!raf && [...motion.values()].some((m) => !m.idle)) { lastT = performance.now(); raf = requestAnimationFrame(tick); }
    };
    onVisibility(syncSprings);
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => {
      deskInView = e.isIntersecting;
      syncSprings();
    }, { rootMargin: '120px' }).observe(screen);

    // windows always come to rest fully on the desk; past the edges they rubber-band and bounce back
    function bounds(win) {
      const { w, h } = area(), ww = win.offsetWidth, wh = win.offsetHeight;
      // on phones windows are taller than the desk, so they may hang below the dock
      const y1 = small() ? h - 160 : Math.min(h - wh, h - 120);
      return { x0: 10, x1: Math.max(10, w - ww - 10), y0: 10, y1: Math.max(10, y1) };
    }
    const clampTo = (win, x, y) => { const b = bounds(win); return [Math.min(Math.max(x, b.x0), b.x1), Math.min(Math.max(y, b.y0), b.y1)]; };
    const rubber = (v, lo, hi) => (v < lo ? lo - (lo - v) * 0.3 : v > hi ? hi + (v - hi) * 0.3 : v);
    function moveTo(win, x, y, drag = false) {
      const m = motion.get(win), b = bounds(win);
      if (drag) { m.tx = rubber(x, b.x0, b.x1); m.ty = rubber(y, b.y0, b.y1); } else [m.tx, m.ty] = clampTo(win, x, y);
      kick(win);
    }
    function defaultPos(win) {
      const { w, h } = area();
      const ww = win.offsetWidth;
      if (small()) {
        const list = $('.icons', screen);
        const top = list.offsetTop + list.offsetHeight + 10;
        return [Math.max(8, (w - ww) / 2), Math.min(top + (opened % 4) * 30, h - 120)];
      }
      // keep clear of the icon columns on the right
      const x = Math.min((parseFloat(win.dataset.x) / 100) * w, w - 250 - ww);
      return [Math.max(20, x), Math.max(20, (parseFloat(win.dataset.y) / 100) * h)];
    }

    function focusWin(win, moveFocus) {
      zTop += 1;
      win.style.zIndex = zTop;
      active = win;
      wins.forEach((w) => w.classList.toggle('is-active', w === win));
      state.forEach((s, w) => s.chip.classList.toggle('is-active', w === win));
      if (moveFocus) win.focus({ preventScroll: true });
    }
    function settleActive() {
      let best = null, z = -1;
      state.forEach((s, w) => { if (s.open && !s.min && +w.style.zIndex > z) { z = +w.style.zIndex; best = w; } });
      if (best) focusWin(best, false);
      else { active = null; wins.forEach((w) => w.classList.remove('is-active')); state.forEach((s) => s.chip.classList.remove('is-active')); }
    }

    function open(win, { focus = true, silent = false, anim = true } = {}) {
      const s = state.get(win), m = motion.get(win);
      if (s.min) { restore(win); return; }
      if (s.open) { focusWin(win, focus); return; }
      m.done = null;
      win.hidden = false;
      s.open = true;
      if (!s.placed) { [s.hx, s.hy] = defaultPos(win); s.placed = true; opened++; }
      [m.tx, m.ty] = clampTo(win, s.hx, s.hy);
      m.ts = 1; m.to = 1; m.tf = 0; m.tlift = 0;
      if (anim && !reduceMotion) {
        // grow out of the icon, tipped back, and spring into place
        const [ix, iy] = centreOf(iconFor(win).querySelector('svg'));
        m.x = ix - win.offsetWidth / 2; m.y = iy - win.offsetHeight / 2; m.vx = m.vy = 0;
        m.s = 0.12; m.vs = 0; m.f = -32; m.vf = 0; m.o = 0;
        paint(win, m); kick(win);
      } else { snap(m); paint(win, m); offerFocus(win); }
      s.chip.hidden = false;
      s.chip.classList.remove('is-min');
      focusWin(win, focus);
      win.dispatchEvent(new CustomEvent('win:show', { detail: { user: !silent } }));
      if (!silent) {
        sound.play('open');
        announce(`${titleOf(win)} opened`);
        if (desk) desk.open(iconIndex(win));
      }
    }
    function close(win) {
      const s = state.get(win), m = motion.get(win);
      const hadFocus = win.contains(document.activeElement);
      s.open = false; s.min = false;
      s.hx = m.tx; s.hy = m.ty;
      s.chip.hidden = true;
      s.focusBtn.hidden = true;
      win.classList.remove('is-active');
      m.ts = 0.84; m.to = 0; m.tf = 18; m.tlift = 0; m.drag = false;
      m.doneWhen = (q) => q.o < 0.04;
      m.done = () => { win.hidden = true; m.idle = true; win.dispatchEvent(new CustomEvent('win:hide')); };
      kick(win);
      settleActive();
      if (hadFocus) iconFor(win).focus();
      sound.play('close');
      announce(`${titleOf(win)} closed`);
    }
    function minimise(win) {
      const s = state.get(win), m = motion.get(win);
      const hadFocus = win.contains(document.activeElement);
      s.min = true;
      s.hx = m.tx; s.hy = m.ty;
      s.chip.classList.add('is-min');
      s.focusBtn.hidden = true;
      win.classList.remove('is-active');
      // fly into its dock chip
      const [cx, cy] = centreOf(s.chip);
      m.tx = cx - win.offsetWidth / 2; m.ty = cy - win.offsetHeight / 2;
      m.ts = 0.05; m.to = 0; m.tf = 0; m.tlift = 0; m.drag = false;
      m.doneWhen = (q) => q.s < 0.1;
      m.done = () => { win.hidden = true; m.idle = true; win.dispatchEvent(new CustomEvent('win:hide')); };
      kick(win);
      settleActive();
      if (hadFocus) s.chip.focus();
      sound.play('min');
      announce(`${titleOf(win)} minimised to the dock`);
    }
    function restore(win) {
      const s = state.get(win), m = motion.get(win);
      s.min = false;
      m.done = null;
      s.chip.classList.remove('is-min');
      const wasHidden = win.hidden;
      win.hidden = false;
      if (wasHidden && !reduceMotion) {
        const [cx, cy] = centreOf(s.chip);
        m.x = cx - win.offsetWidth / 2; m.y = cy - win.offsetHeight / 2; m.vx = m.vy = 0;
        m.s = 0.05; m.vs = 0; m.o = 0;
      }
      [m.tx, m.ty] = clampTo(win, s.hx, s.hy);
      m.ts = 1; m.to = 1; m.tf = 0;
      paint(win, m); kick(win);
      focusWin(win, true);
      win.dispatchEvent(new CustomEvent('win:show', { detail: { user: true } }));
      sound.play('open');
    }

    /* phones: once a window has sprung into place it offers a Focus control that brings it to the middle of the desk */
    function offerFocus(win) {
      const s = state.get(win);
      if (s && s.focusBtn && s.open && !s.min) s.focusBtn.hidden = false;
    }
    function centreWin(win) {
      const m = motion.get(win);
      const { w, h } = area();
      focusWin(win, false);
      $('.win__body', win).scrollTop = 0;
      moveTo(win, (w - win.offsetWidth) / 2, (h - win.offsetHeight) / 2);
      // then bring it into the viewport: centred if it fits, title first if it doesn't
      const sr = screen.getBoundingClientRect();
      const top = window.scrollY + sr.top + screen.clientTop + m.ty;
      const barH = parseFloat(getComputedStyle(root).getPropertyValue('--bar-h')) || 52;
      const y = Math.min(top + win.offsetHeight / 2 - window.innerHeight / 2, top - barH - 8);
      window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion ? 'auto' : 'smooth' });
      sound.play('drop');
      announce(`${titleOf(win)} centred on the desk`);
    }

    wins.forEach((win) => {
      const s = { open: false, min: false, placed: false, hx: 0, hy: 0 };
      const m = newMotion();
      state.set(win, s);
      motion.set(win, m);
      win.hidden = true;
      win.tabIndex = -1;

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = titleOf(win);
      chip.hidden = true;
      chip.addEventListener('click', () => {
        if (s.min) restore(win);
        else if (active === win) minimise(win);
        else focusWin(win, true);
      });
      chips.append(chip);
      s.chip = chip;

      win.addEventListener('pointerdown', () => { if (active !== win) focusWin(win, false); });
      win.addEventListener('focusin', () => { if (active !== win && s.open && !s.min) focusWin(win, false); });
      win.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(win); } });
      $('.win__close', win).addEventListener('click', () => close(win));
      $('.win__min', win).addEventListener('click', () => minimise(win));

      // Keep the phone action readable without taking space from the app title.
      const focusBtn = document.createElement('button');
      focusBtn.type = 'button';
      focusBtn.className = 'gbtn win__focus';
      focusBtn.hidden = true;
      focusBtn.title = 'Focus window';
      focusBtn.setAttribute('aria-label', `Focus ${titleOf(win)}: centre it on the desk`);
      focusBtn.textContent = 'Focus window';
      $('.win__bar', win).after(focusBtn);
      focusBtn.addEventListener('click', () => centreWin(win));
      s.focusBtn = focusBtn;

      // drag by the title bar; let go mid-flight to throw it
      const barEl = $('.win__bar', win);
      barEl.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('.win__btns')) return;
        e.preventDefault();
        focusWin(win, false);
        const sx = e.clientX, sy = e.clientY, ox = m.x, oy = m.y;
        m.tx = m.x; m.ty = m.y;
        try { barEl.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
        m.drag = true; m.tlift = 1; m.ts = 1.025;
        win.classList.add('is-dragging');
        kick(win);
        sound.play('grab');
        const move = (ev) => moveTo(win, ox + ev.clientX - sx, oy + ev.clientY - sy, true);
        const up = () => {
          barEl.removeEventListener('pointermove', move);
          barEl.removeEventListener('pointerup', up);
          barEl.removeEventListener('pointercancel', up);
          m.drag = false; m.tlift = 0; m.ts = 1;
          // carry the release speed a little further, then settle inside the desk
          [m.tx, m.ty] = clampTo(win, m.x + m.vx * 0.16, m.y + m.vy * 0.16);
          win.classList.remove('is-dragging');
          kick(win);
          sound.play('drop');
        };
        barEl.addEventListener('pointermove', move);
        barEl.addEventListener('pointerup', up);
        barEl.addEventListener('pointercancel', up);
      });
      // double-clicking the title bar sends the window home
      barEl.addEventListener('dblclick', (e) => {
        if (e.target.closest('.win__btns')) return;
        const [x, y] = defaultPos(win);
        moveTo(win, x, y);
      });

      // keyboard move from the grip
      $('.win__grip', win).addEventListener('keydown', (e) => {
        const stepPx = e.shiftKey ? 64 : 16;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowLeft') dx = -stepPx;
        else if (e.key === 'ArrowRight') dx = stepPx;
        else if (e.key === 'ArrowUp') dy = -stepPx;
        else if (e.key === 'ArrowDown') dy = stepPx;
        else if (e.key === 'Home') { const [x, y] = defaultPos(win); moveTo(win, x, y); announce(`${titleOf(win)} back in place`); e.preventDefault(); return; }
        else return;
        e.preventDefault();
        moveTo(win, m.tx + dx, m.ty + dy);
        announce(`${titleOf(win)} at ${Math.round(m.tx)}, ${Math.round(m.ty)}`);
      });
    });

    /* icons: click selects, double-click opens; keyboard and touch open straight away */
    let lastPointer = 'mouse';
    const select = (set) => {
      icons.forEach((icon, i) => icon.classList.toggle('is-selected', set.has(i)));
      if (desk) desk.select(set);
    };
    icons.forEach((icon, i) => {
      const win = document.getElementById(icon.dataset.open);
      icon.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; if (desk) desk.press(i, true); });
      icon.addEventListener('pointerup', () => desk && desk.press(i, false));
      icon.addEventListener('pointerenter', () => desk && desk.hover(i, true));
      icon.addEventListener('pointerleave', () => { if (desk) { desk.hover(i, false); desk.press(i, false); } });
      icon.addEventListener('focus', () => desk && desk.hover(i, true));
      icon.addEventListener('blur', () => desk && desk.hover(i, false));
      icon.addEventListener('click', (e) => {
        select(new Set([i]));
        if (e.detail === 0 || lastPointer !== 'mouse') { open(win); return; }
        sound.play('tick');
      });
      icon.addEventListener('dblclick', () => open(win));
    });

    // rubber-band selection on the empty desktop
    screen.addEventListener('pointerdown', (e) => {
      if (e.target !== screen || e.pointerType !== 'mouse' || e.button !== 0) return;
      select(new Set());
      const [x0, y0] = (() => { const r = screen.getBoundingClientRect(); return [e.clientX - r.left - screen.clientLeft, e.clientY - r.top - screen.clientTop]; })();
      try { screen.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
      const iconRects = icons.map((icon) => { const [cx, cy] = centreOf(icon); return [cx - icon.offsetWidth / 2, cy - icon.offsetHeight / 2, cx + icon.offsetWidth / 2, cy + icon.offsetHeight / 2]; });
      const move = (ev) => {
        const r = screen.getBoundingClientRect();
        const x1 = ev.clientX - r.left - screen.clientLeft, y1 = ev.clientY - r.top - screen.clientTop;
        const L = Math.min(x0, x1), T = Math.min(y0, y1), Rr = Math.max(x0, x1), B = Math.max(y0, y1);
        Object.assign(lasso.style, { left: `${L}px`, top: `${T}px`, width: `${Rr - L}px`, height: `${B - T}px` });
        lasso.classList.add('is-on');
        const set = new Set();
        iconRects.forEach(([a, b, c, d], i) => { if (a < Rr && c > L && b < B && d > T) set.add(i); });
        select(set);
      };
      const up = () => {
        lasso.classList.remove('is-on');
        screen.removeEventListener('pointermove', move);
        screen.removeEventListener('pointerup', up);
        screen.removeEventListener('pointercancel', up);
      };
      screen.addEventListener('pointermove', move);
      screen.addEventListener('pointerup', up);
      screen.addEventListener('pointercancel', up);
    });

    // first boot: readme and one project already open
    wins.filter((w) => w.hasAttribute('data-open')).forEach((w) => open(w, { focus: false, silent: true, anim: false }));

    let lastW = screen.clientWidth;
    screen.classList.toggle('is-small', small());
    window.addEventListener('resize', () => {
      const w = screen.clientWidth;
      const crossed = (w < 640) !== (lastW < 640);
      lastW = w;
      screen.classList.toggle('is-small', small());
      state.forEach((s, win) => {
        if (crossed) { [s.hx, s.hy] = defaultPos(win); }
        if (s.open && !s.min) { const m = motion.get(win); moveTo(win, crossed ? s.hx : m.tx, crossed ? s.hy : m.ty); }
      });
    });

    /* the 3D icons: loaded once the hero is up, drawn behind the real buttons */
    const iconCanvas = $('.icons__gl', screen);
    const iconList = $('.icons', screen);
    const placeIconCanvas = () => {
      const pad = 30;
      Object.assign(iconCanvas.style, {
        left: `${iconList.offsetLeft - pad}px`, top: `${iconList.offsetTop - pad}px`,
        width: `${iconList.offsetWidth + pad * 2}px`, height: `${iconList.offsetHeight + pad * 2}px`,
      });
    };
    loadDesk = () => {
      if (!hasGL || !iconCanvas) return;
      placeIconCanvas();
      import('./desk3d.js?v=11')
        .then(({ createDeskIcons }) => {
          desk = createDeskIcons(iconCanvas, icons, { reduced: reduceMotion, theme });
          scenes.push(desk);
          screen.classList.add('icons-3d');
          if ('IntersectionObserver' in window) {
            const deskInView = gateScene(desk, false);
            new IntersectionObserver(([e]) => deskInView(e.isIntersecting), { rootMargin: '120px' }).observe(screen);
          } else gateScene(desk, true);
          let rt;
          window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { placeIconCanvas(); desk.resize(); }, 120); });
          screen.addEventListener('pointermove', (e) => {
            const r = iconCanvas.getBoundingClientRect();
            desk.point(e.clientX - r.left, e.clientY - r.top);
          });
        })
        .catch((err) => console.warn('hello.exe: 3D icons unavailable, keeping the flat ones.', err));
    };

    // the 3D bin follows the Recycle Bin app
    const binIndex = icons.findIndex((i) => i.dataset.open === 'w-trash');
    document.addEventListener('bin:empty', () => { iconFor($('#w-trash')).classList.add('is-empty'); if (desk) desk.empty(binIndex); });
    document.addEventListener('bin:restore', () => { iconFor($('#w-trash')).classList.remove('is-empty'); if (desk) desk.refill(binIndex); });
  }

  /* ---------- Contact: a chrome HELLO that inflates as it scrolls in ---------- */
  function loadContact() {
    const cv = $('.stack__gl'), stackEl = $('.stack'), section = $('.contact');
    if (!cv || !hasGL) return;
    import('./world.js?v=10')
      .then(({ createChromeWord }) => createChromeWord(cv, { text: 'HELLO', cursor: false, layout: 'fill', inflated: false, reduced: reduceMotion, theme, fine: finePointer }))
      .then((cw) => {
        scenes.push(cw);
        stackEl.classList.add('gl-word');
        if (reduceMotion) cw.inflate();
        if (!('IntersectionObserver' in window)) { cw.inflate(); gateScene(cw, true); }
        else {
          const cwInView = gateScene(cw, false);
          new IntersectionObserver(([e]) => cwInView(e.isIntersecting), { rootMargin: '120px' }).observe(cv);
          if (!reduceMotion) {
            const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { cw.inflate(); io.disconnect(); } }, { threshold: 0.55 });
            io.observe(cv);
          }
        }
        let rt;
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => cw.resize(), 120); });
        const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
        section.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') { const [x, y] = local(e); cw.setPointer(x, y); } });
        section.addEventListener('pointerleave', () => cw.leave());
        section.addEventListener('pointerdown', (e) => {
          if (e.target.closest('a, button')) return;
          const [x, y] = local(e);
          if (cw.poke(x, y)) sound.play('boing');
        });
      })
      .catch((err) => console.warn('hello.exe: the chrome HELLO is unavailable, keeping the CSS one.', err));
  }

  /* ---------- Copy the email ---------- */
  const toast = $('.toast');
  let toastTimer;
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 1900);
  };
  $$('[data-copy]').forEach((btn) => {
    const tag = $('.copy__tag', btn);
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.append(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
        ta.remove();
      }
      if (!ok) {
        // leave the address selected so it can be copied by hand
        const sel = window.getSelection(), range = document.createRange();
        range.selectNodeContents($('.copy__addr', btn));
        sel.removeAllRanges(); sel.addRange(range);
      }
      showToast(ok ? `Copied ${text}` : 'Selected. Press Ctrl+C or ⌘C to copy');
      if (ok) {
        sound.play('copy');
        btn.classList.add('is-copied');
        tag.textContent = '[Copied]';
        setTimeout(() => { btn.classList.remove('is-copied'); tag.textContent = '[Copy]'; }, 1900);
      }
    });
  });
})();
