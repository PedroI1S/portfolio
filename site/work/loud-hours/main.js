/* Loud Hours — Kinetic / Big Typography concept
   Totem cascade, canvas loops in the ( ▢ ) slot, services accordion,
   a manifesto whose weight and width follow scroll, full-screen menu, local "loud hour" clock. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const html = document.documentElement;
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = reduceMQ.matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  if (!reduce) html.classList.add('motion-ok');

  let paused = false;
  const schedulers = [];
  let finishFlight = () => {};
  const syncLoops = () => schedulers.forEach((schedule) => schedule());

  /* ---------- Hero cascade ---------- */
  const hero = $('.hero');
  const totem = $('.totem');
  const showHero = () => { totem.classList.add('is-in'); hero.classList.add('is-in'); };
  if (reduce) showHero();
  else {
    fontsReady.then(() => requestAnimationFrame(showHero));
    setTimeout(showHero, 1500);
  }

  /* ---------- ( ▢ ) slot: three generated loops ---------- */
  const INK = '#191919', PAPER = '#EEE9E2';
  const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  function drawBounce(ctx, s, t) {
    const P = .82, ph = (t % P) / P;
    const h = 4 * ph * (1 - ph);                       // 0 on the floor, 1 at the top
    const floor = s * .84;
    const edge = Math.min(ph, 1 - ph);
    const c = edge < .09 ? 1 - edge / .09 : 0;         // squash near contact
    const sx = 1 + .28 * c - .06 * h, sy = 1 - .26 * c + .1 * h;
    const bounceN = Math.floor(t / P);
    const glyph = 'LOUD'[bounceN % 4];
    // shadow
    ctx.fillStyle = 'rgba(238,233,226,.22)';
    ctx.beginPath();
    ctx.ellipse(s / 2, floor + s * .035, s * (.2 - .08 * h), s * (.025 - .01 * h), 0, 0, Math.PI * 2);
    ctx.fill();
    // glyph
    ctx.save();
    ctx.translate(s / 2, floor - h * s * .3);
    ctx.rotate(Math.sin(t * 3.1) * .09 * h);
    ctx.scale(sx, sy);
    ctx.fillStyle = PAPER;
    ctx.font = `800 ${s * .5}px "Kumbh Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(glyph, 0, 0);
    ctx.restore();
  }

  function drawWave(ctx, s, t) {
    const n = 13, gap = s * .022, w = (s * .72 - gap * (n - 1)) / n;
    const x0 = s * .14, mid = s * .47;
    ctx.fillStyle = PAPER;
    for (let i = 0; i < n; i++) {
      const env = Math.sin(Math.PI * (i + .5) / n);
      const a = Math.abs(Math.sin(t * 5.3 + i * .9) * .6 + Math.sin(t * 8.7 + i * 2.1) * .4);
      const bh = Math.max(s * .03, (.12 + .78 * a) * env * s * .62);
      ctx.fillRect(x0 + i * (w + gap), mid - bh / 2, w, bh);
    }
    // playhead
    const p = (t % 3.2) / 3.2;
    ctx.fillRect(s * .14, s * .86, s * .72 * p, s * .022);
    ctx.globalAlpha = .3;
    ctx.fillRect(s * .14 + s * .72 * p, s * .86, s * .72 * (1 - p), s * .022);
    ctx.globalAlpha = 1;
  }

  function drawTreatment(ctx, w, h, t, index) {
    const n = ((index % 3) + 3) % 3;
    const f = t % 1;
    ctx.fillStyle = PAPER; ctx.strokeStyle = PAPER; ctx.lineWidth = w * .018;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${w * .19}px "Kumbh Sans", Arial, sans-serif`;
    if (n === 0) {
      // A loaf rises, then the next treatment pushes the whole frame away.
      const cy = h * (.38 - Math.sin(f * Math.PI) * .045), r = w * .31;
      ctx.beginPath(); ctx.ellipse(w / 2, cy, r, r * (.85 + f * .15), 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const x = w * (.32 + i * .14);
        ctx.beginPath(); ctx.moveTo(x, cy - r * .3); ctx.lineTo(x + w * .07, cy + r * .05); ctx.stroke();
      }
      ctx.fillText('UP BEFORE', w / 2, h * .76); ctx.fillText('YOU.', w / 2, h * .88);
    } else if (n === 1) {
      ctx.save(); ctx.translate(w / 2, h * .36); ctx.rotate(t * Math.PI * 1.4);
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, w * (.1 + i * .08), 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillRect(-w * .025, -w * .29, w * .05, w * .14); ctx.restore();
      ctx.fillText('ON', w / 2, h * .76); ctx.fillText('REPEAT.', w / 2, h * .88);
    } else {
      ctx.font = `800 ${w * .31}px "Kumbh Sans", Arial, sans-serif`;
      const drift = Math.sin(f * Math.PI * 2) * w * .035;
      ['ONE', 'MORE', 'LOOK.'].forEach((word, i) => ctx.fillText(word, w / 2 + drift * (i % 2 ? -1 : 1), h * (.29 + i * .2)));
      ctx.fillRect(w * .12, h * .82, w * .76 * (.3 + f * .7), h * .025);
    }
  }

  function drawFeed(ctx, s, t, treatments = false) {
    const pw = s * .5, ph = s * .84, px = (s - pw) / 2, py = (s - ph) / 2;
    const lw = Math.max(1, s * (treatments ? .009 : .026)), r = s * .07;
    ctx.strokeStyle = PAPER; ctx.fillStyle = PAPER; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, r); ctx.stroke();
    // screen
    const ix = px + lw * 2, iy = py + lw * 2, iw = pw - lw * 4, ih = ph - lw * 4;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, r * .6); ctx.clip();
    const step = treatments ? 1 : .78, k = Math.floor(t / step), f = (t % step) / step;
    const off = (k + ease(clamp((f - .62) / .38))) * ih;
    for (let j = k - 1; j <= k + 2; j++) {
      const y = iy + j * ih - off;
      if (y > iy + ih || y + ih < iy) continue;
      if (treatments) {
        ctx.save(); ctx.translate(ix, y); drawTreatment(ctx, iw, ih, t, j); ctx.restore();
        continue;
      }
      const shape = ((j % 3) + 3) % 3;
      const cx = ix + iw / 2, cy = y + ih * .36, rr = iw * .26;
      ctx.beginPath();
      if (shape === 0) ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      else if (shape === 1) ctx.rect(cx - rr, cy - rr, rr * 2, rr * 2);
      else { ctx.moveTo(cx, cy - rr * 1.1); ctx.lineTo(cx + rr * 1.1, cy + rr * .9); ctx.lineTo(cx - rr * 1.1, cy + rr * .9); ctx.closePath(); }
      ctx.fill();
      ctx.fillRect(ix + iw * .14, y + ih * .7, iw * .48, ih * .055);
      ctx.globalAlpha = .45;
      ctx.fillRect(ix + iw * .14, y + ih * .8, iw * .3, ih * .055);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // a like that pops once per card
    const pop = clamp(f / .25), sc = pop < 1 ? Math.sin(pop * Math.PI) * .4 + pop : 1;
    const hx = ix + iw * .8, hy = iy + ih * .74, hs = s * .055 * sc;
    if (!treatments && hs > 0 && f < .6) {
      ctx.beginPath();
      ctx.moveTo(hx, hy + hs * .9);
      ctx.bezierCurveTo(hx - hs * 1.6, hy - hs * .1, hx - hs * .7, hy - hs * 1.3, hx, hy - hs * .4);
      ctx.bezierCurveTo(hx + hs * .7, hy - hs * 1.3, hx + hs * 1.6, hy - hs * .1, hx, hy + hs * .9);
      ctx.fillStyle = INK; ctx.lineWidth = lw * .8; ctx.stroke(); ctx.fillStyle = PAPER; ctx.fill();
    }
  }

  const LOOPS = [
    { draw: drawBounce, note: '01 · Bounce, for a type foundry' },
    { draw: drawWave,   note: '02 · Sound on, for a record label' },
    { draw: drawFeed,   note: '03 · The feed, for a bakery chain' },
  ];
  const LOOP_LEN = 3.2;

  // Each canvas owns a frozen clock. Stopping never fast-forwards or resets it.
  function canvasLoop(canvas, draw, enabled = () => true) {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    let width = 0, height = 0, dpr = 1, clock = reduce ? .25 : 0, last = 0, raf = 0, onScreen = false;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth; height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      render();
    };
    const render = () => {
      if (!width || !height) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = INK; ctx.fillRect(0, 0, width, height);
      draw(ctx, width, height, clock);
    };
    const frame = (now) => {
      raf = 0;
      const dt = last ? Math.min((now - last) / 1000, .1) : 0;
      last = now;
      clock += dt;
      render();
      schedule();
    };
    const schedule = () => {
      if (reduceMQ.matches || paused || document.hidden || html.classList.contains('menu-open') || !onScreen || !enabled()) {
        if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; return;
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };
    schedulers.push(schedule);
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; schedule(); }).observe(canvas);
    fontsReady.then(render);
    return { render, schedule };
  }

  const slotNote = $('[data-slot-note]');
  let current = -1;
  canvasLoop($('[data-slot]'), (ctx, s, _, clock) => {
    const idx = Math.floor(clock / LOOP_LEN) % LOOPS.length;
    if (idx !== current) { current = idx; if (slotNote) slotNote.textContent = LOOPS[idx].note; }
    LOOPS[idx].draw(ctx, s, clock % LOOP_LEN + idx * 11);
  });

  /* ---------- Shorts: the small phone opens into a work stage ---------- */
  const shorts = $('.svc__row--shorts');
  const workCanvas = $('[data-work-canvas]');
  const workFrame = $('[data-work-frame]');
  const workNote = $('[data-work-note]');
  const treatments = ['Up before you', 'On repeat', 'One more look'];
  let flight = null, flightAnim = null;
  const work = canvasLoop(workCanvas, (ctx, w, h, clock) => {
    const s = Math.min(w * 1.5, h * 1.05);
    ctx.save(); ctx.translate((w - s) / 2, (h - s) / 2); drawFeed(ctx, s, clock, true); ctx.restore();
    ctx.fillStyle = PAPER; ctx.font = `700 ${Math.max(9, Math.min(w * .023, 12))}px Archivo, Arial, sans-serif`;
    ctx.textAlign = 'left'; ctx.fillText('9:16', 16, 24);
    ctx.textAlign = 'right'; ctx.fillText('00:03 / LOOP', w - 16, h - 16);
    const idx = Math.floor(clock) % 3;
    workNote.textContent = `0${idx + 1} / 03 · ${treatments[idx]}`;
    workFrame.classList.add('is-drawn');
    if (flight) {
      flight.width = workCanvas.width; flight.height = workCanvas.height;
      flight.getContext('2d').drawImage(workCanvas, 0, 0);
    }
  }, () => shorts.classList.contains('is-open'));

  finishFlight = () => {
    if (flightAnim) { flightAnim.onfinish = null; flightAnim.cancel(); flightAnim = null; }
    if (flight) { flight.remove(); flight = null; }
    workFrame.classList.remove('is-flying');
  };
  const openWork = (from) => {
    finishFlight();
    if (!work || reduceMQ.matches || paused || document.hidden || from.bottom < 0 || from.top > innerHeight) return;
    const to = workFrame.getBoundingClientRect();
    if (!to.width || !to.height) return;
    flight = document.createElement('canvas'); flight.className = 'short-flight'; flight.setAttribute('aria-hidden', 'true');
    Object.assign(flight.style, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` });
    document.body.appendChild(flight);
    work.render();
    workFrame.classList.add('is-flying');
    flightAnim = flight.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` },
      { transform: 'translate(0, 0) scale(1, 1)' }
    ], { duration: 650, easing: 'cubic-bezier(.19, 1, .22, 1)', fill: 'both' });
    flightAnim.onfinish = finishFlight;
  };
  window.addEventListener('scroll', finishFlight, { passive: true });
  window.addEventListener('resize', finishFlight);

  /* ---------- One pause state for every canvas and SVG loop ---------- */
  const pauseBtns = $$('[data-pause]');
  pauseBtns.forEach((pauseBtn) => {
    if (reduce) pauseBtn.hidden = true;
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtns.forEach((btn) => {
        btn.setAttribute('aria-pressed', String(paused));
        btn.textContent = paused ? '( Play loops )' : '( Pause loops )';
      });
      html.classList.toggle('is-paused', paused);
      finishFlight(); syncLoops();
    });
  });
  const visibility = () => { html.classList.toggle('is-hidden', document.hidden); if (document.hidden) finishFlight(); syncLoops(); };
  document.addEventListener('visibilitychange', visibility);
  visibility();

  /* ---------- Services accordion ---------- */
  $$('.svc__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.svc__row');
      const open = btn.getAttribute('aria-expanded') !== 'true';
      const from = row === shorts ? $('.th--shorts').getBoundingClientRect() : null;
      btn.setAttribute('aria-expanded', String(open));
      row.classList.toggle('is-open', open);
      $('#' + btn.getAttribute('aria-controls')).inert = !open;
      if (row === shorts) { if (open) openWork(from); else finishFlight(); work && work.schedule(); }
    });
    $('#' + btn.getAttribute('aria-controls')).inert = true;
  });
  const rowObserver = new IntersectionObserver((entries) => entries.forEach((e) => e.target.closest('.svc__row').classList.toggle('is-live', e.isIntersecting)));
  $$('.svc__thumb').forEach((thumb) => rowObserver.observe(thumb));

  /* ---------- Reveals ---------- */
  const revealEls = $$('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) revealEls.forEach((el) => el.classList.add('is-in'));
  else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- Manifesto: quiet (light, wide) → loud (black, condensed) ---------- */
  const mf = $('[data-mf]');
  const mfText = $('[data-mf-text]');
  if (mf && mfText && !reduce) {
    // split into word spans, keeping the key phrase wrapper
    const split = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
            else { const w = document.createElement('span'); w.className = 'w'; w.textContent = part; frag.appendChild(w); }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) split(child);
      });
    };
    split(mfText);
    mf.dataset.split = '';
    const words = $$('.w', mfText);
    const key = $('.mf__key', mfText);
    const keyLast = key ? $$('.w', key).pop() : null;
    const num = $('[data-mf-num]');
    const hint = $('[data-mf-hint]');
    const ticksEl = $('[data-mf-ticks]');
    const TICKS = 40;
    ticksEl.innerHTML = '<i></i>'.repeat(TICKS);
    const ticks = [...ticksEl.children];
    const loud = $('.mf__loud');
    const foot = $('.foot');
    const footKey = $('.foot__key');
    const transfer = document.createElement('span');
    transfer.className = 'mf__transfer'; transfer.textContent = 'loud hour'; transfer.hidden = true;
    transfer.setAttribute('aria-hidden', 'true'); document.body.appendChild(transfer);

    // The very same words leave the final scene and land in the closing sentence.
    const handoff = (r) => {
      const h = reduceMQ.matches ? 0 : clamp((innerHeight - r.bottom) / (innerHeight * .6));
      const moving = h > 0 && h < 1;
      foot.classList.toggle('has-handoff', h > 0);
      loud.style.visibility = moving ? 'hidden' : '';
      // Opacity keeps the complete closing sentence in the accessibility tree.
      footKey.style.opacity = moving ? '0' : '';
      mf.style.setProperty('--lead-alpha', (1 - h).toFixed(3));
      mf.style.setProperty('--meter-alpha', (1 - clamp(h * 3)).toFixed(3));
      transfer.hidden = !moving;
      if (!moving) return;
      const a = loud.getBoundingClientRect(), b = footKey.getBoundingClientRect();
      const size = parseFloat(getComputedStyle(loud).fontSize);
      transfer.style.fontSize = `${size}px`;
      transfer.style.transform = `translate(${lerp(a.left, b.left, h)}px, ${lerp(a.top, b.top, h)}px) scale(${lerp(1, b.width / a.width, h)}, ${lerp(1, b.height / a.height, h)})`;
    };

    const Q = { wg: 140, wd: 125 };
    const L = { wg: 900, wd: 90 };
    const K = 7;                     // words in transition at once
    const lastT = new Float32Array(words.length).fill(-1);

    const loudWd = new Float32Array(words.length).fill(L.wd);
    const setWord = (i, t) => {
      const w = words[i];
      w.style.setProperty('--wg', lerp(Q.wg, L.wg, t).toFixed(1));
      w.style.setProperty('--wd', lerp(Q.wd, loudWd[i], t).toFixed(1));
      w.style.setProperty('--t', t.toFixed(3));
    };
    const measureAll = (t) => { words.forEach((_, i) => setWord(i, t)); return words.map((w) => w.getBoundingClientRect().width); };

    // give every word its own loud width so it takes the same room loud as quiet, then reserve its widest in-between state
    const calibrate = () => {
      words.forEach((w) => { w.style.width = ''; });
      const quiet = measureAll(0);
      const lo = new Float32Array(words.length).fill(62), hi = new Float32Array(words.length).fill(125);
      for (let k = 0; k < 10; k++) {
        for (let i = 0; i < words.length; i++) loudWd[i] = (lo[i] + hi[i]) / 2;
        measureAll(1).forEach((v, i) => { if (v > quiet[i]) hi[i] = loudWd[i]; else lo[i] = loudWd[i]; });
      }
      for (let i = 0; i < words.length; i++) loudWd[i] = (lo[i] + hi[i]) / 2;
      const max = quiet.slice();
      [.25, .5, .75, 1].forEach((t) => measureAll(t).forEach((v, i) => { if (v > max[i]) max[i] = v; }));
      words.forEach((w, i) => { w.style.width = `${Math.ceil(max[i] * 10) / 10 + .5}px`; });
      lastT.fill(-1);
      update();
    };

    const update = () => {
      const r = mf.getBoundingClientRect();
      if (reduceMQ.matches) { handoff(r); return; }
      const span = r.height - window.innerHeight;
      const p = span > 0 ? clamp(-r.top / span) : 1;
      const q = clamp((p - .03) / .75);
      const pos = q * (words.length + K);
      for (let i = 0; i < words.length; i++) {
        const t = clamp((pos - i) / K);
        if (Math.abs(t - lastT[i]) > .004 || (t !== lastT[i] && (t === 0 || t === 1))) { lastT[i] = t; setWord(i, t); }
      }
      if (key) key.classList.toggle('is-hot', lastT[words.indexOf(keyLast)] >= 1);
      const vol = Math.round(p * 100);
      num.textContent = String(vol).padStart(3, '0');
      const lit = Math.round(p * TICKS);
      ticks.forEach((el, i) => el.classList.toggle('on', i < lit));
      hint.textContent = vol >= 100 ? 'Make it yours ↓' : vol >= 85 ? 'This is the loud hour.' : 'Turn it up ↓';
      const finish = clamp((p - .8) / .2);
      const departure = clamp((innerHeight - r.bottom) / (innerHeight * .6));
      mf.style.setProperty('--copy-alpha', ((1 - .8 * finish) * (1 - departure)).toFixed(3));
      mf.style.setProperty('--climax-alpha', clamp(finish * 3).toFixed(3));
      mf.style.setProperty('--climax-scale', lerp(.72, 1, ease(finish)).toFixed(4));
      handoff(r);
    };

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { ticking = false; update(); });
    }, { passive: true });
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(calibrate, 150); });
    update();
    fontsReady.then(calibrate);
    reduceMQ.addEventListener('change', () => {
      html.classList.toggle('motion-ok', !reduceMQ.matches);
      update();
    });
  }
  reduceMQ.addEventListener('change', () => {
    finishFlight();
    pauseBtns.forEach((btn) => { btn.hidden = reduceMQ.matches; });
    syncLoops();
  });

  /* ---------- Local clock: is it a loud hour? ---------- */
  const clockEl = $('[data-clock]');
  if (clockEl) {
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const tick = () => {
      const now = new Date();
      const h = now.getHours();
      const loud = h >= 19 && h < 23;
      clockEl.textContent = `Your time ${fmt.format(now)} · ${loud ? 'a loud hour' : 'a quiet hour'}`;
    };
    tick();
    setInterval(tick, 15000);
  }

  /* ---------- Full-screen menu ---------- */
  const menu = $('#menu');
  const menuBtn = $('[data-menu-open]');
  const menuClose = $('[data-menu-close]');
  if (menu && menuBtn) {
    const dur = () => (reduceMQ.matches ? 0 : 800);
    let hideTimer;
    const openMenu = () => {
      clearTimeout(hideTimer);
      menu.classList.remove('is-closing');
      menu.hidden = false;
      void menu.offsetWidth;
      menu.classList.add('is-open');
      menuBtn.setAttribute('aria-expanded', 'true');
      html.classList.add('menu-open');
      $$('main, .top, .foot').forEach((el) => { el.inert = true; });
      finishFlight(); syncLoops();
      menuClose.focus();
    };
    const closeMenu = (restore = true) => {
      menu.classList.remove('is-open');
      menu.classList.add('is-closing');
      menuBtn.setAttribute('aria-expanded', 'false');
      html.classList.remove('menu-open');
      $$('main, .top, .foot').forEach((el) => { el.inert = false; });
      syncLoops();
      hideTimer = setTimeout(() => { menu.hidden = true; menu.classList.remove('is-closing'); }, dur());
      if (restore) menuBtn.focus();
    };
    menuBtn.addEventListener('click', openMenu);
    menuClose.addEventListener('click', () => closeMenu());
    $$('a', menu).forEach((a) => a.addEventListener('click', () => closeMenu(false)));
    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
      if (e.key !== 'Tab') return;
      const f = $$('a, button', menu);
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }
})();
