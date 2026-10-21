/* Silver Hour — Dark Luxury (absolute pole) concept, v3
   The page is about light: the title and every print develop as they are reached,
   the lightbox is a dark room with a spotlight, and the footer loses its light. */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const motion = !reduceMotion;
  if (motion) root.classList.add('motion');

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const pad = (n) => String(n).padStart(2, '0');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- The works, read from the walk (the single source of copy) ---------- */
  const walkFigs = [...document.querySelectorAll('.w[data-work]')]
    .sort((a, b) => a.dataset.work - b.dataset.work);
  const WORKS = walkFigs.map((fig) => {
    const img = fig.querySelector('img');
    return {
      fig, img,
      frame: fig.querySelector('.w__frame'),
      title: fig.querySelector('.w__title').textContent.trim(),
      meta: fig.querySelector('.w__meta').textContent.replace(/\s+/g, ' ').trim(),
      note: fig.querySelector('.w__note').textContent.trim(),
      alt: img.alt,
      full: fig.querySelector('.w__frame').getAttribute('href'),
      ratio: fig.dataset.ratio === 'l' ? 3 / 2 : 4 / 5
    };
  });
  const N = WORKS.length;
  const small = (i) => `img/silver-${i + 1}-sm.jpg`;

  /* Developer catches the highlights first; the shadows open only in the last half. */
  const devVars = (el, d) => {
    const shadows = smooth(0.55, 1, d);
    el.style.setProperty('--o', smooth(0, 0.3, d).toFixed(3));
    el.style.setProperty('--b', (0.5 + 0.5 * shadows).toFixed(3));
    el.style.setProperty('--c', (3.2 - 2.2 * shadows).toFixed(3));
    el.style.setProperty('--g', (0.16 * smooth(0, 0.15, d) * (1 - smooth(0.5, 0.95, d))).toFixed(3));
  };

  /* Film grain: one small noise tile, mostly dark with sparse bright specks */
  if (motion) {
    const c = document.createElement('canvas');
    c.width = c.height = 192;
    const ctx = c.getContext('2d');
    const id = ctx.createImageData(192, 192);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.pow(Math.random(), 5) * 255;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    root.style.setProperty('--grain-img', `url(${c.toDataURL()})`);
  }

  /* ---------- Title card: the title develops like a print in a tray ---------- */
  const card = document.querySelector('.card');
  const title = card.querySelector('.title');
  const counter = card.querySelector('.card__count');
  const titleCanvas = card.querySelector('.title__canvas');
  const titleCtx = titleCanvas.getContext('2d');
  let titlePixels, titleInk = [], titleNoise, titleProgress = 0, titleRaf = 0;
  const prepareTitle = () => {
    const r = title.getBoundingClientRect(), style = getComputedStyle(title);
    const pad = parseFloat(style.fontSize) * 0.35;
    // Coarse pointers use CSS pixels, regardless of the device's screen density.
    const dpr = finePointer ? Math.min(devicePixelRatio || 1, 1.5) : 1;
    titleCanvas.width = Math.ceil((r.width + pad * 2) * dpr);
    titleCanvas.height = Math.ceil((r.height + pad * 2) * dpr);
    Object.assign(titleCanvas.style, { left: `${-pad}px`, top: `${-pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    titleCtx.scale(dpr, dpr);
    titleCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    titleCtx.fontKerning = 'normal';
    titleCtx.letterSpacing = style.letterSpacing;
    titleCtx.textAlign = 'center';
    titleCtx.fillStyle = '#fff';
    const m = titleCtx.measureText(title.textContent);
    const ascent = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent;
    const descent = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent;
    titleCtx.fillText(title.textContent, r.width / 2 + pad, pad + (r.height - ascent - descent) / 2 + ascent);
    titlePixels = titleCtx.getImageData(0, 0, titleCanvas.width, titleCanvas.height);
    titleInk = [];
    titleNoise = new Float32Array(titlePixels.width * titlePixels.height);
    // A baked field of uneven patches plus fine grain. No per-frame noise or filters.
    for (let y = 0; y < titlePixels.height; y++) {
      for (let x = 0; x < titlePixels.width; x++) {
        const i = y * titlePixels.width + x;
        if (!titlePixels.data[i * 4 + 3]) continue;
        const nx = x / dpr, ny = y / dpr;
        const patches = (Math.sin(nx * 0.031 + Math.sin(ny * 0.047) * 1.8) + Math.sin(ny * 0.067 + nx * 0.011) + Math.sin(nx * 0.014 - ny * 0.023)) / 6 + 0.5;
        const grain = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        titleNoise[i] = clamp(0.08 + patches * 0.76 + (grain - Math.floor(grain) - 0.5) * 0.32);
        titleInk.push([i, titlePixels.data[i * 4 + 3]]);
      }
    }
  };
  const setTitleDevelop = (p) => {
    if (!titlePixels) prepareTitle();
    titleProgress = clamp(p);
    const threshold = titleProgress * 1.14 - 0.07;
    const tone = 0.45 + 0.55 * smooth(0.2, 0.9, titleProgress);
    for (const [i, alpha] of titleInk) {
      titlePixels.data[i * 4 + 3] = alpha * smooth(-0.045, 0.045, threshold - titleNoise[i]) * tone;
    }
    titleCtx.putImageData(titlePixels, 0, 0);
    title.classList.toggle('is-developed', p >= 1);
    titleCanvas.hidden = p >= 1;
  };
  // Also allows a frozen development frame to be inspected in a browser.
  window.setTitleDevelop = (p) => { cancelAnimationFrame(titleRaf); setTitleDevelop(p); };

  let titleStarted = false, resumeTitle;
  const developTitle = () => {
    if (titleStarted) return;
    titleStarted = true;
    card.classList.add('is-in');
    if (!motion) { title.classList.add('is-developed'); return; }
    setTitleDevelop(0);
    let elapsed = 0, previous = performance.now();
    const D = 3400;
    const step = (now) => {
      titleRaf = 0;
      if (document.hidden) return;
      // Hidden panes do not jump straight to the final stage when resumed.
      elapsed += Math.min(now - previous, 64);
      previous = now;
      const p = clamp(elapsed / D);
      setTitleDevelop(p);
      if (p < 1) titleRaf = requestAnimationFrame(step);
    };
    resumeTitle = () => { previous = performance.now(); titleRaf = requestAnimationFrame(step); };
    titleRaf = requestAnimationFrame(step);
  };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(developTitle);
  setTimeout(developTitle, 1500);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && motion && titleStarted && titleProgress < 1 && !titleRaf) resumeTitle();
  });

  // The thumbnails feed the index, so warm them now and count them in.
  if (motion) card.classList.add('is-loading');
  let loaded = 0, loaderDone = false;
  const endLoader = () => {
    if (loaderDone) return;
    loaderDone = true;
    setTimeout(() => card.classList.remove('is-loading'), 900);
  };
  WORKS.forEach((_, i) => {
    const im = new Image();
    im.onload = im.onerror = () => {
      loaded += 1;
      counter.textContent = loaded;
      if (loaded === N) endLoader();
    };
    im.src = small(i);
  });
  setTimeout(endLoader, 2500); // never hold the loader longer than this

  /* ---------- Statement: a light sweeps the words in reading order ---------- */
  const stmt = document.querySelector('.statement__text');
  let words = [];
  if (motion) {
    const text = stmt.textContent.trim();
    stmt.textContent = '';
    text.split(/(\s+)/).forEach((tok) => {
      if (!tok) return;
      if (/^\s+$/.test(tok)) { stmt.appendChild(document.createTextNode(' ')); return; }
      const s = document.createElement('span');
      s.className = 'wd';
      s.textContent = tok;
      stmt.appendChild(s);
      words.push({ el: s, o: -1, front: false });
    });
  }
  const updateStatement = (vh) => {
    if (!words.length) return;
    const r = stmt.getBoundingClientRect();
    const start = vh * 0.86, end = vh * 0.55;
    const P = clamp((start - r.top) / (r.height + start - end));
    const BAND = 5;
    const lit = P * (words.length + BAND);
    words.forEach((w, i) => {
      const v = clamp((lit - i) / BAND);
      const o = Math.round((0.14 + 0.86 * v) * 100) / 100;
      if (o !== w.o) { w.el.style.opacity = o; w.o = o; }
      const front = v > 0 && v < 1;
      if (front !== w.front) { w.el.classList.toggle('is-front', front); w.front = front; }
    });
  };

  /* ---------- The walk: each print develops as it is reached ---------- */
  const prints = WORKS.map((w, i) => ({ fig: w.fig, frame: w.frame, grain: w.frame.querySelector('.grain'), enlarges: i === 0 || i === 7, d: -1, light: -1 }));
  const updateWalk = (vh) => {
    prints.forEach((p) => {
      const r = p.frame.getBoundingClientRect();
      const d = Math.round(clamp((vh * 0.98 - r.top) / (vh * (p.enlarges ? 0.9 : 0.55))) * 500) / 500;
      const distance = Math.abs(r.top + r.height / 2 - vh / 2) / vh;
      const light = (1 - 0.45 * smooth(0.3, 0.85, distance)).toFixed(3);
      if (light !== p.light) { p.frame.style.setProperty('--light', light); p.light = light; }
      if (d === p.d) return;
      p.d = d;
      devVars(p.fig, d);
      if (p.enlarges) p.frame.style.setProperty('--in', (1 - smooth(0, 1, d)).toFixed(4));
      p.fig.classList.toggle('is-developed', d >= 1);
      if (d > 0.5) p.fig.classList.add('is-lit');
      if (d > 0 && d < 0.86) p.grain.style.backgroundPosition = `${(Math.random() * 192) | 0}px ${(Math.random() * 192) | 0}px`;
    });
  };

  /* A quiet invitation follows fine pointers over walk prints. */
  if (motion && finePointer) {
    const cursor = document.createElement('span');
    cursor.className = 'walk-cursor';
    cursor.textContent = 'Enter';
    cursor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cursor);
    WORKS.forEach(({ frame }) => {
      frame.addEventListener('pointermove', (e) => {
        cursor.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 14}px)`;
        cursor.classList.add('is-on');
      });
      frame.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
    });
    window.addEventListener('scroll', () => cursor.classList.remove('is-on'), { passive: true });
  }
  window.addEventListener('resize', () => { if (motion && titleProgress < 1) { prepareTitle(); setTitleDevelop(titleProgress); } });

  /* ---------- Footer: the page loses its light ---------- */
  const footer = document.querySelector('.footer');
  const coda = footer.querySelector('.coda');
  const codaImg = coda.querySelector('img');
  const fLine = footer.querySelector('.footer__line');
  const LAMP = { x: 0.241, y: 0.27, ratio: 1536 / 1024 };
  const placeLamp = () => {
    const W = coda.clientWidth, H = coda.clientHeight;
    if (!W || !H) return;
    const pos = getComputedStyle(codaImg).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
    const s = Math.max(W / LAMP.ratio, H);
    const dw = LAMP.ratio * s, dh = s;
    const lx = (W - dw) * (pos[0] || 0) + LAMP.x * dw;
    const ly = (H - dh) * (pos[1] || 0) + LAMP.y * dh;
    coda.style.setProperty('--lx', `${lx.toFixed(1)}px`);
    coda.style.setProperty('--ly', `${ly.toFixed(1)}px`);
    coda.style.setProperty('--lr', `${(Math.max(W, H) * 0.42).toFixed(0)}px`);
  };
  let lastF = -1;
  const updateFooter = (vh) => {
    const max = document.documentElement.scrollHeight - vh;
    const startY = coda.getBoundingClientRect().top + window.scrollY - vh * 0.2;
    const f = Math.round(clamp(max > startY ? (window.scrollY - startY) / (max - startY) : 1) * 500) / 500;
    if (f === lastF) return;
    lastF = f;
    coda.style.setProperty('--rest', (1 - 0.94 * smooth(0, 0.75, f)).toFixed(3));
    coda.style.setProperty('--co', (1 - 0.86 * smooth(0.72, 1, f)).toFixed(3));
    fLine.style.setProperty('--fl', (1 - 0.36 * smooth(0.4, 1, f)).toFixed(3));
  };

  /* One scroll loop drives the statement, the walk and the footer */
  if (motion) {
    let ticking = false;
    const frame = () => {
      ticking = false;
      const vh = window.innerHeight;
      updateStatement(vh);
      updateWalk(vh);
      updateFooter(vh);
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', () => { placeLamp(); prints.forEach((p) => { p.d = -1; }); lastF = -1; request(); });
    placeLamp();
    frame();
  }

  /* ---------- Reveals (visit section) ---------- */
  const revealTargets = document.querySelectorAll('[data-reveal]');
  if (!motion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });
    revealTargets.forEach((el) => io.observe(el));
  }

  /* ---------- Visit: one live detail, in Lisbon time ---------- */
  const live = document.querySelector('.visit__live');
  const RUN = { start: '2026-09-25', end: '2027-03-28', opens: 11 * 60, closes: 19 * 60 };
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const toStr = (dt) => dt.toISOString().slice(0, 10);
  const addDays = (s, n) => { const dt = toUTC(s); dt.setUTCDate(dt.getUTCDate() + n); return toStr(dt); };
  const lisbonNow = () => {
    const o = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).forEach((p) => { o[p.type] = p.value; });
    return { date: `${o.year}-${o.month}-${o.day}`, mins: Number(o.hour) * 60 + Number(o.minute) };
  };
  const isOpenDay = (s) => {
    if (s < RUN.start || s > RUN.end) return false;
    const md = s.slice(5);
    return toUTC(s).getUTCDay() !== 1 && md !== '12-25' && md !== '01-01';
  };
  const closingTime = (s) => {
    const dt = toUTC(s);
    const lastFriday = dt.getUTCDay() === 5 && toUTC(addDays(s, 7)).getUTCMonth() !== dt.getUTCMonth();
    return lastFriday ? 24 * 60 : RUN.closes;
  };
  const dayName = (s, today) => {
    if (s === today) return 'today';
    if (s === addDays(today, 1)) return 'tomorrow';
    const dt = toUTC(s);
    const days = (dt - toUTC(today)) / 864e5;
    return days < 7 ? WEEKDAYS[dt.getUTCDay()] : `${WEEKDAYS[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
  };
  const updateLive = () => {
    const { date, mins } = lisbonNow();
    let text, open = false;
    if (date < RUN.start) {
      text = `Opens ${dayName(RUN.start, date)} at 11:00`;
    } else if (date > RUN.end || (date === RUN.end && mins >= closingTime(date))) {
      text = 'The exhibition closed on 28 March 2027';
    } else if (isOpenDay(date) && mins >= RUN.opens && mins < closingTime(date)) {
      open = true;
      text = closingTime(date) === 24 * 60
        ? 'Open now in Lisbon · open late, until midnight'
        : 'Open now in Lisbon · closes 19:00';
    } else {
      let next = isOpenDay(date) && mins < RUN.opens ? date : addDays(date, 1);
      for (let k = 0; k < 10 && !isOpenDay(next); k++) next = addDays(next, 1);
      if (!isOpenDay(next)) text = 'Closed now · the exhibition has ended';
      else if (next === date) text = 'Opens today at 11:00, Lisbon time';
      else text = `Closed now in Lisbon · opens ${dayName(next, date)} at 11:00`;
    }
    live.textContent = text;
    live.classList.toggle('is-open', open);
    live.hidden = false;
  };
  if (live) { updateLive(); setInterval(updateLive, 60000); }

  /* ---------- All works: list / grid ---------- */
  const works = document.querySelector('.works');
  const toggles = document.querySelectorAll('.toggle__btn');
  const peek = document.querySelector('.peek');
  const peekImg = peek.querySelector('img');
  [...works.children].forEach((li, i) => li.style.setProperty('--i', i));

  let switchTimer;
  const setView = (view, animate) => {
    toggles.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    if (works.dataset.view === view) return;
    peek.classList.remove('is-on');
    clearTimeout(switchTimer);
    if (!animate || !motion) { works.dataset.view = view; return; }
    works.classList.add('is-leaving');
    switchTimer = setTimeout(() => {
      works.dataset.view = view;
      works.classList.remove('is-fresh');
      void works.offsetWidth; // restart the stagger
      works.classList.add('is-fresh', 'is-leaving');
      requestAnimationFrame(() => works.classList.remove('is-leaving'));
    }, 260);
  };
  toggles.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view, true)));
  // Without a hover preview the index hides the photographs: start touch screens on the hang.
  if (!window.matchMedia('(hover: hover)').matches) setView('grid', false);

  /* List view: a print follows the cursor */
  if (finePointer) {
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0, active = false, current = -1, swapTimer;
    let w = 0, h = 0;
    const aim = (cx, cy) => {
      let nx = cx + 40;
      if (nx + w > window.innerWidth - 16) nx = cx - w - 40;
      tx = nx;
      ty = Math.max(16, Math.min(window.innerHeight - h - 16, cy - h * 0.5));
    };
    const loop = () => {
      if (document.hidden) { active = false; raf = 0; peek.classList.remove('is-on'); return; }
      x += (tx - x) * 0.16;
      y += (ty - y) * 0.16;
      peek.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      raf = (active || Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) ? requestAnimationFrame(loop) : 0;
    };
    const measure = () => { w = peek.offsetWidth; h = w * (peek.classList.contains('is-wide') ? 2 / 3 : 5 / 4); };
    const show = (i, e) => {
      if (works.dataset.view !== 'list') return;
      const wasOn = active;
      active = true;
      if (i !== current) {
        current = i;
        const wide = works.children[i].dataset.ratio === 'l';
        clearTimeout(swapTimer);
        const swap = () => { peekImg.src = small(i); peek.classList.toggle('is-wide', wide); measure(); };
        if (wasOn) {
          peek.classList.add('is-swapping');
          swapTimer = setTimeout(() => { swap(); peek.classList.remove('is-swapping'); }, 140);
        } else swap();
      }
      aim(e.clientX, e.clientY);
      if (!wasOn) { x = tx; y = ty; } // appear in place rather than fly in
      peek.classList.add('is-on');
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const hide = () => { active = false; current = -1; peek.classList.remove('is-on'); };
    [...works.querySelectorAll('.work__link')].forEach((link, i) => {
      link.addEventListener('pointerenter', (e) => show(i, e));
      link.addEventListener('pointermove', (e) => { if (active) aim(e.clientX, e.clientY); });
    });
    works.addEventListener('pointerleave', hide);
    window.addEventListener('scroll', () => { if (active) hide(); }, { passive: true });
  }

  /* ---------- Lightbox: the dark room ---------- */
  const dlg = document.querySelector('.lightbox');
  const stage = dlg.querySelector('.lightbox__stage');
  const print = dlg.querySelector('.lightbox__print');
  const lbImg = dlg.querySelector('.lightbox__img');
  const lbNo = dlg.querySelector('.lb-no');
  const lbTitle = dlg.querySelector('.lightbox__title');
  const lbMeta = dlg.querySelector('.lightbox__meta');
  const lbNote = dlg.querySelector('.lightbox__note');
  const lbHint = dlg.querySelector('.lightbox__hint');
  const lbLight = dlg.querySelector('.lightbox__light');
  const lbClose = dlg.querySelector('.lightbox__close');
  const DIM = 0.12;

  let index = 0, want = 0, token = 0, closing = false, opener = null, openedBy = 'mouse';
  let lit = true, spotOn = false, hiddenSrc = null, hiddenFigure = null;
  let lastPointer = 'mouse';
  document.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || 'mouse'; }, true);
  if (!motion) { lbLight.hidden = true; lbHint.hidden = true; }

  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  };
  const fit = (i) => {
    const r = stage.getBoundingClientRect();
    const a = WORKS[i].ratio;
    let w = r.width, h = w / a;
    if (h > r.height) { h = r.height; w = h * a; }
    return { w, h, left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2 };
  };
  const sizePrint = (i) => {
    const f = fit(i);
    print.style.setProperty('--pw', `${f.w.toFixed(1)}px`);
    print.style.setProperty('--ph', `${f.h.toFixed(1)}px`);
    print.style.setProperty('--sr', `${(Math.max(f.w, f.h) * 0.5).toFixed(0)}px`);
    return f;
  };
  const setCaption = (i) => {
    const w = WORKS[i];
    lbNo.textContent = pad(i + 1);
    lbTitle.textContent = w.title;
    lbMeta.textContent = w.meta;
    lbNote.textContent = w.note;
  };
  const loadFull = (i) => {
    lbImg.src = WORKS[i].full;
    lbImg.alt = WORKS[i].alt;
    return (lbImg.decode ? lbImg.decode() : Promise.resolve()).catch(() => {});
  };
  const preload = (i) => { [i + 1, i - 1].forEach((j) => { new Image().src = WORKS[(j + N) % N].full; }); };
  const tween = (dur, fn, t) => new Promise((res) => {
    const t0 = performance.now();
    const f = (now) => {
      if (t !== token) { res(false); return; }
      const p = clamp((now - t0) / dur);
      fn(p);
      if (p < 1) requestAnimationFrame(f); else res(true);
    };
    requestAnimationFrame(f);
  });

  /* Light: dim with a spotlight, or the full gallery light */
  const setLit = (on, slow) => {
    lit = on;
    print.classList.toggle('is-lowering', !on && !!slow);
    print.style.setProperty('--dim', on ? '1' : String(DIM));
    lbLight.setAttribute('aria-pressed', String(on));
    lbLight.textContent = on ? 'Lower the light' : 'Raise the light';
    if (on) lbHint.classList.add('is-gone');
  };
  let mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5, spotRaf = 0, panRaf = 0;
  const setSpot = (x, y) => {
    print.style.setProperty('--mx', `${(x * 100).toFixed(2)}%`);
    print.style.setProperty('--my', `${(y * 100).toFixed(2)}%`);
  };
  const spotLoop = () => {
    mx += (tmx - mx) * 0.14;
    my += (tmy - my) * 0.14;
    setSpot(mx, my);
    spotRaf = (Math.abs(tmx - mx) > 0.001 || Math.abs(tmy - my) > 0.001) ? requestAnimationFrame(spotLoop) : 0;
  };
  stage.addEventListener('pointermove', (e) => {
    if (!spotOn || e.pointerType !== 'mouse' || panRaf) return;
    const r = print.getBoundingClientRect();
    tmx = clamp((e.clientX - r.left) / r.width, -0.2, 1.2);
    tmy = clamp((e.clientY - r.top) / r.height, -0.2, 1.2);
    if (!spotRaf) spotRaf = requestAnimationFrame(spotLoop);
  });
  const stopPan = () => { cancelAnimationFrame(panRaf); panRaf = 0; };
  // Touch and keyboard: the light wanders slowly across the print, then comes up
  const autoPan = () => {
    stopPan();
    const t0 = performance.now(), D = 3600;
    const stepPan = (now) => {
      const t = (now - t0) / D;
      if (t >= 1) { panRaf = 0; setLit(true); return; }
      mx = 0.5 + 0.3 * Math.sin(t * Math.PI * 1.6 - 1.3);
      my = 0.45 + 0.2 * Math.sin(t * Math.PI * 1.1 + 0.5);
      setSpot(mx, my);
      panRaf = requestAnimationFrame(stepPan);
    };
    panRaf = requestAnimationFrame(stepPan);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopPan(); cancelAnimationFrame(spotRaf); spotRaf = 0; }
    else if (dlg.open && spotOn && !lit && openedBy !== 'mouse') autoPan();
  });

  // Click raises the light and keeps it; press and hold shows it only while held.
  let downAt = 0, downX = 0, downY = 0, raisedByDown = false;
  print.addEventListener('pointerdown', (e) => {
    if (!motion || e.button !== 0) return;
    downAt = performance.now(); downX = e.clientX; downY = e.clientY;
    raisedByDown = false;
    if (e.pointerType === 'mouse' && !lit) { stopPan(); setLit(true); raisedByDown = true; }
  });
  print.addEventListener('pointerup', (e) => {
    if (!motion || e.button !== 0) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 12) return;
    const held = performance.now() - downAt;
    if (raisedByDown) { if (held > 450) setLit(false); return; }
    stopPan();
    if (e.pointerType !== 'mouse' || held < 450) setLit(!lit);
  });
  lbLight.addEventListener('click', () => { stopPan(); setLit(!lit); });

  /* Shared element: a copy of the print travels between the page and the dark room */
  const flyClone = (src, from, to, objectPosition) => {
    const clone = document.createElement('img');
    clone.className = 'lb-fly';
    clone.alt = '';
    clone.src = src;
    if (objectPosition) clone.style.objectPosition = objectPosition;
    const box = (r) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width ?? r.w}px`, height: `${r.height ?? r.h}px` });
    Object.assign(clone.style, box(from));
    dlg.appendChild(clone);
    const anim = clone.animate([box(from), box(to)], { duration: 860, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' });
    return anim.finished.then(() => clone, () => clone);
  };
  const restoreSrc = () => {
    if (hiddenSrc) { hiddenSrc.style.visibility = ''; hiddenSrc = null; }
    if (hiddenFigure) { hiddenFigure.classList.remove('is-in-darkroom'); hiddenFigure = null; }
  };
  const sourceImg = (trigger) => {
    if (!trigger) return null;
    if (trigger.closest('.works') && works.dataset.view === 'list') return peek.classList.contains('is-on') ? peekImg : null;
    return trigger.querySelector('img') || trigger.closest('.w')?.querySelector('.w__frame img');
  };

  const settle = (t) => {
    if (t !== token) return;
    spotOn = true;
    stage.classList.add('is-spot');
    setLit(false, true);
    lbHint.classList.remove('is-gone');
    if (openedBy !== 'mouse') autoPan();
  };

  const open = async (i, trigger, e) => {
    if (dlg.open) return;
    const t = ++token;
    index = want = i;
    opener = trigger;
    openedBy = e && e.detail === 0 ? 'keyboard' : lastPointer;
    closing = false;
    dlg.classList.remove('has-caption');
    setCaption(i);
    lbHint.classList.remove('is-gone');
    const src = motion ? sourceImg(trigger) : null;
    const from = visible(src) ? src.getBoundingClientRect() : null;
    const fromPos = src ? getComputedStyle(src).objectPosition : '';

    dlg.showModal();
    root.classList.add('lb-open');
    lbClose.focus({ preventScroll: true });
    const target = sizePrint(i);
    mx = my = tmx = tmy = 0.5;
    setSpot(0.5, 0.5);
    setLit(true);
    preload(i);

    if (!motion) {
      await loadFull(i);
      print.classList.add('is-shown');
      dlg.classList.add('is-open', 'has-caption');
      return;
    }
    requestAnimationFrame(() => dlg.classList.add('is-open')); // the house lights go down
    const ready = loadFull(i);
    if (from) {
      src.style.visibility = 'hidden';
      hiddenSrc = src;
      hiddenFigure = trigger.closest('.w');
      if (hiddenFigure) hiddenFigure.classList.add('is-in-darkroom');
      peek.classList.remove('is-on');
      const clone = await flyClone(src.currentSrc || src.src, from, target, fromPos);
      await ready;
      if (t !== token) { clone.remove(); return; }
      devVars(print, 1);
      print.classList.add('is-shown');
      dlg.classList.add('has-caption');
      requestAnimationFrame(() => clone.remove());
      await wait(380);
    } else {
      await ready;
      if (t !== token) return;
      devVars(print, 0);
      print.classList.add('is-shown');
      await tween(1700, (p) => devVars(print, p), t);
      if (t === token) dlg.classList.add('has-caption');
    }
    settle(t);
  };

  const close = async () => {
    if (!dlg.open || closing) return;
    closing = true;
    const t = ++token;
    stopPan();
    cancelAnimationFrame(spotRaf); spotRaf = 0;
    dlg.classList.remove('is-open', 'has-caption'); // the house lights come back up
    const back = motion && hiddenSrc && visible(hiddenSrc) && hiddenSrc !== peekImg ? hiddenSrc : null;
    if (back) {
      const from = print.getBoundingClientRect();
      const to = back.getBoundingClientRect();
      print.classList.remove('is-shown');
      print.style.transition = 'none';
      const clone = await flyClone(lbImg.currentSrc || lbImg.src, from, to, getComputedStyle(back).objectPosition);
      restoreSrc();
      requestAnimationFrame(() => clone.remove());
    } else {
      print.classList.remove('is-shown');
      await wait(motion ? 600 : 200);
    }
    dlg.close();
    root.classList.remove('lb-open');
    restoreSrc();
    print.style.transition = '';
    stage.classList.remove('is-spot');
    spotOn = false;
    closing = false;
    if (t === token && opener) opener.focus({ preventScroll: true });
  };

  const step = async (dir) => {
    if (!dlg.open || closing) return;
    const t = ++token;
    stopPan();
    restoreSrc();
    want = (want + dir + N) % N;
    const next = want;
    preload(next);
    if (!motion) {
      index = next;
      setCaption(next);
      sizePrint(next);
      await loadFull(next);
      return;
    }
    // the current print's light fades out
    const o0 = parseFloat(print.style.getPropertyValue('--o')) || 1;
    const faded = await tween(480, (p) => print.style.setProperty('--o', (o0 * (1 - p)).toFixed(3)), t);
    if (!faded) return;
    index = next;
    setCaption(next);
    sizePrint(next);
    devVars(print, 0);
    await loadFull(next);
    if (t !== token) return;
    // and the next one develops in, under whatever light is up
    const done = await tween(1500, (p) => devVars(print, p), t);
    if (done && !lit && openedBy !== 'mouse') autoPan();
  };

  document.querySelectorAll('[data-open]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      open(Number(el.dataset.open), el, e);
    });
  });
  dlg.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.step))));
  lbClose.addEventListener('click', close);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });
  window.addEventListener('resize', () => { if (dlg.open) sizePrint(index); });

  // Swipe between prints on touch screens
  let sx = 0, sy = 0, tracking = false;
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; tracking = true; } });
  stage.addEventListener('pointerup', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  });
  stage.addEventListener('pointercancel', () => { tracking = false; });
})();
