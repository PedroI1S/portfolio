/* Brisure Capital — Swiss / Minimal concept
   Terrain hero with an arrival from the full stop, the pinned seven-year scene,
   range index with plates, digit rolls, office clocks, mobile menu. */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const expoOut = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
  const cubicOut = (x) => 1 - Math.pow(1 - x, 3);

  /*@terrain*/
  /* ---------- Seeded Perlin noise ---------- */
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createNoise(seed) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + t * (b - a);
    const grad = (h, x, y, z) => {
      const k = h & 15;
      const u = k < 8 ? x : y;
      const v = k < 4 ? y : (k === 12 || k === 14 ? x : z);
      return ((k & 1) === 0 ? u : -u) + ((k & 2) === 0 ? v : -v);
    };
    return (x, y, z) => {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
      const u = fade(x), v = fade(y), w = fade(z);
      const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
      const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
      return lerp(
        lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
             lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
        lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
             lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
        w);
    };
  }

  /* Height of the terrain at a point: layered noise plus Gaussian bumps
     ({x, y, amp, sigma} in canvas px). The bumps are the companies. */
  function heightAt(o, px, py) {
    const x = px * o.scale, y = py * o.scale;
    const octaves = o.octaves || 3;
    let v = 0, amp = 0.55, fr = 1;
    for (let k = 0; k < octaves; k++) { v += amp * o.noise(x * fr, y * fr, o.t + k * 7.3); amp *= 0.5; fr *= 2.03; }
    v += 0.35 * o.noise(x * 0.35 + 40, y * 0.35 + 40, o.t * 0.5);
    if (o.relief !== undefined) v *= o.relief;
    if (o.bumps) {
      // near a bump the noise is calmed, so its rings read cleanly as concentric
      let add = 0, calm = 1;
      for (const b of o.bumps) {
        if (!b.amp) continue;
        const dx = px - b.x, dy = py - b.y;
        const g = Math.exp(-(dx * dx + dy * dy) / (2 * b.sigma * b.sigma));
        add += b.amp * g;
        if (o.calm) calm *= 1 - o.calm * Math.min(1, b.amp) * Math.exp(-(dx * dx + dy * dy) / (4 * b.sigma * b.sigma));
      }
      v = v * calm + add;
    }
    return v;
  }

  /* Marching squares. Each cell is visited once and only the levels that cross it
     are traced; emit(major, x1, y1, x2, y2) receives every segment. */
  function traceContours(w, h, o, emit) {
    const cell = o.cell;
    const cols = Math.ceil(w / cell) + 1;
    const rows = Math.ceil(h / cell) + 1;
    const f = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) f[j * cols + i] = heightAt(o, i * cell, j * cell);
    }
    const lo = o.lo === undefined ? -0.62 : o.lo;
    const hi = o.hi === undefined ? 0.62 : o.hi;
    const step = (hi - lo) / (o.levels + 1);

    for (let j = 0; j < rows - 1; j++) {
      const r0 = j * cols, r1 = r0 + cols, y0 = j * cell, y1 = y0 + cell;
      for (let i = 0; i < cols - 1; i++) {
        const a = f[r0 + i], b = f[r0 + i + 1], c = f[r1 + i + 1], d = f[r1 + i];
        const mn = Math.min(a, b, c, d), mx = Math.max(a, b, c, d);
        const k0 = Math.max(1, Math.ceil((mn - lo) / step));
        const k1 = Math.min(o.levels, Math.floor((mx - lo) / step));
        if (k0 > k1) continue;
        const x0 = i * cell, x1 = x0 + cell;
        for (let k = k0; k <= k1; k++) {
          const L = lo + k * step;
          const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const m = k % o.majorEvery === 0;
          // edge crossing points: top, right, bottom, left
          const tx = x0 + cell * ((L - a) / (b - a));
          const ry = y0 + cell * ((L - b) / (c - b));
          const bx = x0 + cell * ((L - d) / (c - d));
          const ly = y0 + cell * ((L - a) / (d - a));
          switch (idx) {
            case 1: case 14: emit(m, x0, ly, bx, y1); break;
            case 2: case 13: emit(m, bx, y1, x1, ry); break;
            case 3: case 12: emit(m, x0, ly, x1, ry); break;
            case 4: case 11: emit(m, tx, y0, x1, ry); break;
            case 5: emit(m, x0, ly, tx, y0); emit(m, bx, y1, x1, ry); break;
            case 6: case 9: emit(m, tx, y0, bx, y1); break;
            case 7: case 8: emit(m, x0, ly, tx, y0); break;
            case 10: emit(m, tx, y0, x1, ry); emit(m, x0, ly, bx, y1); break;
          }
        }
      }
    }
  }
  /*/terrain*/

  // Minor and major contours go into two paths, so there are only two strokes per frame.
  function drawContours(ctx, w, h, o) {
    const minor = new Path2D(), major = new Path2D();
    traceContours(w, h, o, (m, x1, y1, x2, y2) => {
      const p = m ? major : minor;
      p.moveTo(x1, y1); p.lineTo(x2, y2);
    });
    ctx.clearRect(0, 0, w, h);
    ctx.lineJoin = 'round';
    ctx.lineWidth = o.minorWidth; ctx.strokeStyle = o.minorColor; ctx.stroke(minor);
    ctx.lineWidth = o.majorWidth; ctx.strokeStyle = o.majorColor; ctx.stroke(major);
  }

  function sizeCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  const onResize = (fn) => {
    let timer, lastW = window.innerWidth, lastH = window.innerHeight;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // phones fire resize when the URL bar slides; ignore small height-only changes
        if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 120) return;
        lastW = window.innerWidth; lastH = window.innerHeight;
        fn();
      }, 150);
    });
  };

  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const header = document.querySelector('.header');

  /* ---------- Hero: terrain born from the full stop ---------- */
  const hero = document.querySelector('.hero');
  const heroCanvas = hero && hero.querySelector('.hero__field');
  if (heroCanvas) {
    const heroTitle = hero.querySelector('.hero__title');
    const dot = hero.querySelector('.dot');
    const probe = hero.querySelector('.hero__probe');
    const noise = createNoise(2011);
    let surface = sizeCanvas(heroCanvas);
    let t = 0, maskR = 0, parallaxY = 0;
    const seed = { x: surface.w * 0.56, y: surface.h * 0.62, amp: reduceMotion ? 0.9 : 0, sigma: 160 };
    const cursor = { x: 0, y: 0, amp: 0, sigma: 120 };       // the bump that follows the pointer
    const aim = { x: 0, y: 0, amp: 0, inside: false };          // where it is heading

    const opts = () => ({
      noise, t,
      cell: surface.w < 700 ? 9 : 12,
      octaves: 2,
      scale: 0.0034,
      lo: -0.62, hi: 1.52, levels: 28, majorEvery: 4,
      bumps: [seed, cursor], calm: 0.92,
      minorColor: 'rgba(43,43,43,0.30)', majorColor: 'rgba(43,43,43,0.60)',
      minorWidth: 0.8, majorWidth: 1.2
    });
    const render = () => drawContours(surface.ctx, surface.w, surface.h, opts());

    const fullMask = () => Math.hypot(surface.w, surface.h) * 0.62;
    const setMask = (r) => { maskR = r; heroCanvas.style.setProperty('--mr', `${Math.round(r)}px`); };

    // Where the red full stop sits once the headline has landed (its line starts translated)
    const measureDot = () => {
      const span = dot.parentElement;
      span.style.transition = 'none'; span.style.transform = 'none';
      const r = dot.getBoundingClientRect(), hr = hero.getBoundingClientRect();
      span.style.transform = ''; void span.offsetWidth; span.style.transition = '';
      const fs = parseFloat(getComputedStyle(dot).fontSize);
      seed.x = r.left + r.width * 0.5 - hr.left;
      seed.y = r.bottom - hr.top - fs * 0.33;
      seed.sigma = Math.max(80, surface.w * 0.105);
      cursor.sigma = Math.max(60, surface.w * 0.09);
      heroCanvas.style.setProperty('--fx', `${Math.round(seed.x)}px`);
      heroCanvas.style.setProperty('--fy', `${Math.round(seed.y)}px`);
    };

    let raf = 0, last = 0, visible = true, introStart = -1, activeUntil = 0;
    const frame = (now) => {
      raf = 0;
      if (!visible) return;
      const intro = introStart < 0 ? 0 : clamp((now - introStart) / 1400, 0, 1);
      const settling = Math.abs(aim.amp - cursor.amp) > 0.002 || (cursor.amp > 0.002 && Math.hypot(aim.x - cursor.x, aim.y - cursor.y) > 0.5);
      const interval = intro < 1 ? 0 : (now < activeUntil || settling ? 33 : 66);
      if (now - last >= interval - 1) {
        const dt = last ? Math.min(now - last, 100) : 16;
        last = now;
        t += 0.0055 * (dt / 66);
        if (introStart >= 0) {
          const e = expoOut(intro);
          seed.amp = 0.9 * e;
          setMask(fullMask() * (0.08 + 0.92 * e));
        }
        const k = 1 - Math.pow(1 - 0.12, dt / 16.7);
        cursor.x += (aim.x - cursor.x) * k;
        cursor.y += (aim.y - parallaxY - cursor.y) * k;
        cursor.amp += (aim.amp - cursor.amp) * k;
        render();
        if (aim.inside) {
          const elev = Math.round(360 + heightAt(opts(), aim.x, aim.y - parallaxY) * 430);
          probe.textContent = `Elev. ${elev} m`;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && visible && !reduceMotion) raf = requestAnimationFrame(frame); };

    const arrive = () => {
      if (hero.classList.contains('is-arriving')) return;
      hero.classList.add('is-arriving');
      measureDot();
      if (reduceMotion) {
        setMask(fullMask());
        heroTitle.classList.add('is-in'); hero.classList.add('is-meta');
        render();
        return;
      }
      introStart = performance.now();
      setTimeout(() => heroTitle.classList.add('is-in'), 450);
      setTimeout(() => hero.classList.add('is-meta'), 1100);
      start();
    };
    setMask(0);
    fontsReady.then(arrive);
    setTimeout(arrive, 1500);   // fonts slow or blocked: arrive anyway

    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    }).observe(hero);

    onResize(() => {
      surface = sizeCanvas(heroCanvas);
      measureDot();
      if (introStart < 0 || performance.now() - introStart > 1400) setMask(fullMask());
      render();
    });

    if (!reduceMotion) {
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          parallaxY = Math.min(window.scrollY, window.innerHeight) * 0.18;
          heroCanvas.style.transform = `translate3d(0, ${parallaxY}px, 0)`;
          ticking = false;
        });
      }, { passive: true });
    }

    if (finePointer && !reduceMotion) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        aim.x = e.clientX - r.left; aim.y = e.clientY - r.top;
        if (!aim.inside) { cursor.x = aim.x; cursor.y = aim.y - parallaxY; }
        aim.inside = true; aim.amp = 0.22;
        probe.style.transform = `translate3d(${Math.round(aim.x + 14)}px, ${Math.round(aim.y + 14)}px, 0)`;
        probe.classList.add('is-on');
        activeUntil = performance.now() + 600;
        start();
      });
      hero.addEventListener('pointerleave', () => {
        aim.inside = false; aim.amp = 0;
        probe.classList.remove('is-on');
        activeUntil = performance.now() + 600;
      });
    }
  }

  /* ---------- Signature: seven years on one terrain ---------- */
  const tenor = document.querySelector('.tenor');
  const liveTenor = tenor && !reduceMotion && window.CSS && CSS.supports('position', 'sticky');
  if (liveTenor) {
    document.documentElement.classList.add('tenor-live');
    const track = tenor.querySelector('.tenor__track');
    const stage = tenor.querySelector('.tenor__stage');
    const ink = tenor.querySelector('.tenor__ink');
    const canvas = tenor.querySelector('.tenor__field');
    const point = tenor.querySelector('.tenor__point');
    const strip = tenor.querySelector('.tenor__strip');
    const captions = [...tenor.querySelectorAll('.tenor__captions p')];
    const capBox = tenor.querySelector('.tenor__captions');
    const marker = tenor.querySelector('.tenor__marker');
    const rail = tenor.querySelector('.tenor__rail ol');
    const out = {
      drawn: tenor.querySelector('[data-out="drawn"]'),
      headroom: tenor.querySelector('[data-out="headroom"]'),
      margin: tenor.querySelector('[data-out="margin"]')
    };

    // Illustrative schedule, one stop per year
    const DRAWN = [40, 40, 38, 34, 28, 20, 10, 0];
    const HEADROOM = [18, 24, 29, 35, 39, 43, 47, 52];
    const MARGIN = [6.25, 6.25, 6.25, 6.0, 6.0, 5.75, 5.75, 5.75];
    const CAPTION_AT = [0, 0.18, 0.45, 0.72, 0.995];

    const noise = createNoise(46);
    const company = { x: 0, y: 0, amp: 0.15, sigma: 200 };
    let surface, dist = 1, railW = 0, drawnP = -1, year = -1, cap = -1, shown = {};

    const layout = () => {
      surface = sizeCanvas(canvas);
      const small = surface.w < 700;
      company.x = surface.w * 0.64;
      company.y = surface.h * (small ? 0.4 : 0.44);
      company.sigma = 0.16 * Math.max(surface.w, surface.h * 0.75);
      point.style.left = `${company.x}px`;
      point.style.top = `${company.y}px`;
      dist = Math.max(1, track.offsetHeight - stage.offsetHeight);
      railW = rail.clientWidth;
      drawnP = -1;
    };

    const draw = (p) => {
      company.amp = 0.15 + 0.85 * cubicOut(p);
      drawContours(surface.ctx, surface.w, surface.h, {
        noise, t: 3.2 + 0.9 * p,
        cell: surface.w < 700 ? 14 : 10,
        octaves: 2,
        scale: 3.6 / Math.max(surface.w, surface.h),
        lo: -0.62, hi: 1.62, levels: 24, majorEvery: 4,
        bumps: [company], calm: 0.8,
        minorColor: 'rgba(255,255,255,0.22)', majorColor: 'rgba(255,255,255,0.5)',
        minorWidth: 0.8, majorWidth: 1.2
      });
      drawnP = p;
    };

    const setText = (key, el, value) => { if (shown[key] !== value) { el.textContent = value; shown[key] = value; } };

    const update = () => {
      const r = track.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = clamp((header.offsetHeight - r.top) / (dist * 0.88), 0, 1);

      // scene change: ink wipes down as the stage arrives, and back up as it leaves
      ink.classList.toggle('is-on', r.top < vh * 0.65 && r.bottom > vh * 0.92);

      if (Math.abs(p - drawnP) > 0.0015 || (p !== drawnP && (p === 0 || p === 1))) draw(p);

      const yf = p * 7, i = Math.min(6, Math.floor(yf)), f = yf - i;
      const y = Math.round(yf);
      if (y !== year) { year = y; strip.style.setProperty('--y', y); }
      setText('d', out.drawn, `€${(DRAWN[i] + (DRAWN[i + 1] - DRAWN[i]) * f).toFixed(1)}m`);
      setText('h', out.headroom, `${Math.round(HEADROOM[i] + (HEADROOM[i + 1] - HEADROOM[i]) * f)}%`);
      setText('m', out.margin, `${MARGIN[y].toFixed(2)}%`);
      marker.style.transform = `translate3d(${(p * railW).toFixed(1)}px, 0, 0)`;

      let c = 0;
      CAPTION_AT.forEach((at, k) => { if (p >= at) c = k; });
      if (c !== cap) {
        captions.forEach((el, k) => {
          el.classList.toggle('is-on', k === c);
          el.classList.toggle('was-on', k === cap);
          el.classList.toggle('is-before', k < c);
        });
        capBox.dataset.cap = c;
        cap = c;
      }
    };

    let queued = false;
    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; update(); });
    };
    layout(); draw(0); update();
    window.addEventListener('scroll', queue, { passive: true });
    onResize(() => { layout(); update(); });
    fontsReady.then(() => { railW = rail.clientWidth; update(); });
  }

  /* ---------- Closing bookend: the terrain at maturity ---------- */
  const closingCanvas = document.querySelector('.closing__field');
  if (closingCanvas) {
    let drawn = false;
    const drawClosing = () => {
      const s = sizeCanvas(closingCanvas);
      const big = Math.max(s.w, s.h);
      drawContours(s.ctx, s.w, s.h, {
        noise: createNoise(46), t: 4.1, cell: s.w < 700 ? 12 : 10, octaves: 2,
        scale: 3.6 / big, relief: 0.45, calm: 0.8,
        lo: -0.62, hi: 1.62, levels: 24, majorEvery: 4,
        bumps: [{ x: s.w * 0.64, y: s.h * 0.44, amp: 1, sigma: 0.16 * Math.max(s.w, s.h * 0.75) }],
        minorColor: 'rgba(43,43,43,0.13)', majorColor: 'rgba(43,43,43,0.3)', minorWidth: 0.8, majorWidth: 1.1
      });
      drawn = true;
    };
    new IntersectionObserver(([e], obs) => {
      if (e.isIntersecting) { drawClosing(); obs.disconnect(); }
    }, { rootMargin: '200px 0px' }).observe(closingCanvas);
    onResize(() => { if (drawn) drawClosing(); });
  }

  /* ---------- Strategies: range index, accordion and floating plate ---------- */
  const rows = [...document.querySelectorAll('.index__row')];
  if (rows.length) {
    const setOpen = (row, open) => {
      row.classList.toggle('is-open', open);
      row.querySelector('.index__head').setAttribute('aria-expanded', String(open));
      if (open) row.querySelector('img').loading = 'eager';
    };
    rows.forEach((row) => {
      row.querySelector('.index__head').addEventListener('click', () => {
        const open = !row.classList.contains('is-open');
        rows.forEach((r) => setOpen(r, r === row && open));
        if (open) plateHide();
      });
    });

    const plate = document.querySelector('.plate');
    const plateImg = plate.querySelector('img');
    const desk = window.matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)');
    const W = 320, H = 213, M = 20;
    const pos = { x: 0, y: 0 }, goal = { x: 0, y: 0 };
    let on = false, praf = 0, lastT = 0;

    const aimAt = (cx, cy) => {
      let x = cx + 28;
      if (x + W > window.innerWidth - M) x = cx - 28 - W;   // flip to the left of the cursor
      goal.x = clamp(x, M, window.innerWidth - W - M);
      goal.y = clamp(cy - H / 2, header.offsetHeight + M, window.innerHeight - H - M);
    };
    const paint = () => { plate.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0)`; };
    const follow = (now) => {
      praf = 0;
      const dt = lastT ? Math.min(now - lastT, 64) : 16; lastT = now;
      const k = reduceMotion ? 1 : 1 - Math.pow(1 - 0.18, dt / 16.7);
      pos.x += (goal.x - pos.x) * k; pos.y += (goal.y - pos.y) * k;
      paint();
      if (on && (Math.abs(goal.x - pos.x) > 0.3 || Math.abs(goal.y - pos.y) > 0.3)) praf = requestAnimationFrame(follow);
    };
    const kick = () => { if (!praf) { lastT = 0; praf = requestAnimationFrame(follow); } };
    function plateHide() { on = false; plate.classList.remove('is-on'); }

    rows.forEach((row, i) => {
      const src = `img/strategy-${i + 1}.jpg`;
      row.addEventListener('pointerenter', (e) => {
        if (!desk.matches || e.pointerType !== 'mouse' || row.classList.contains('is-open')) return;
        if (!plateImg.src.endsWith(src)) plateImg.src = src;
        aimAt(e.clientX, e.clientY);
        if (!on) { pos.x = goal.x; pos.y = goal.y; paint(); }
        on = true;
        plate.classList.add('is-on');
        kick();
      });
      row.addEventListener('pointermove', (e) => {
        if (!on) return;
        aimAt(e.clientX, e.clientY);
        kick();
      });
      row.addEventListener('pointerleave', plateHide);
    });
    window.addEventListener('scroll', () => { if (on) plateHide(); }, { passive: true });

    if (finePointer) {
      // warm the cache once the page is idle so the first hover isn't blank
      const preload = () => rows.forEach((_, i) => { new Image().src = `img/strategy-${i + 1}.jpg`; });
      ('requestIdleCallback' in window) ? requestIdleCallback(preload) : setTimeout(preload, 1500);
    }
  }

  /* ---------- Facts: digit rolls ---------- */
  if (!reduceMotion) {
    document.querySelectorAll('[data-roll]').forEach((el) => {
      const text = el.textContent.trim();
      el.textContent = '';
      let d = 0;
      for (const ch of text) {
        if (/\d/.test(ch)) {
          const roll = document.createElement('span');
          roll.className = 'roll';
          roll.style.setProperty('--d', d++);
          roll.style.setProperty('--n', 10 + Number(ch));
          const ghost = document.createElement('span');
          ghost.className = 'roll__ghost';
          ghost.textContent = ch;
          const strip = document.createElement('span');
          strip.className = 'roll__strip';
          strip.setAttribute('aria-hidden', 'true');
          for (let k = 0; k < 20; k++) {
            const s = document.createElement('span');
            s.textContent = k % 10;
            strip.append(s);
          }
          roll.append(ghost, strip);
          el.append(roll);
        } else {
          el.append(ch);
        }
      }
    });
  }

  /* ---------- Scroll reveals ---------- */
  const revealTargets = document.querySelectorAll('[data-reveal], .rule, .index__row, .closing__line');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealTargets.forEach((el) => io.observe(el));
  }

  /* ---------- Office and desk clocks ---------- */
  const clocks = document.querySelectorAll('[data-tz]');
  const tick = () => {
    const now = new Date();
    clocks.forEach((el) => {
      const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: el.dataset.tz });
      const time = el.matches('time') ? el : el.querySelector('time');
      time.textContent = fmt.format(now);
      time.setAttribute('datetime', now.toISOString());
    });
  };
  if (clocks.length) { tick(); setInterval(tick, 15000); }

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.querySelector('.header__menu');
  const menu = document.getElementById('menu');
  if (menuBtn && menu) {
    const setMenu = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.textContent = open ? 'Close' : 'Menu';
      menu.classList.toggle('is-open', open);
      document.documentElement.classList.toggle('menu-open', open);
      if (open) menu.querySelector('a').focus();
    };
    menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
  }
})();
