/* hello.exe — the apps inside the desktop windows.
   Each window is a small working version of the project it describes. Loops only run while their window is open. */
(() => {
  const H = window.helloExe || {};
  const sound = H.sound;
  const announce = H.announce || (() => {});
  const reduce = !!H.reduceMotion;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const winOf = (el) => el.closest('.win');
  const isOpen = (win) => !!win && !win.hidden;
  // the page's shared hidden-tab gate: fn(visible)
  const onVisibility = H.onVisibility || ((fn) => document.addEventListener('visibilitychange', () => fn(!document.hidden)));

  // Preserve timer delays and app time while a window or the tab is out of view.
  function appScheduler(win) {
    const jobs = new Set(), watchers = new Set(), pausedAnimations = new Set();
    let seen = !('IntersectionObserver' in window), active = false, elapsed = 0, since = 0;
    const now = () => elapsed + (active ? performance.now() - since : 0);
    const arm = (job) => {
      job.due = performance.now() + job.left;
      job.id = setTimeout(() => {
        job.id = 0;
        if (!active) return;
        if (!job.repeat) jobs.delete(job);
        job.fn();
        if (job.repeat && jobs.has(job)) { job.left = job.repeat; if (active) arm(job); }
      }, job.left);
    };
    const sync = () => {
      const next = seen && isOpen(win) && !document.hidden;
      if (next === active) return;
      if (!next) elapsed = now();
      active = next;
      since = performance.now();
      jobs.forEach((job) => {
        if (active) arm(job);
        else { job.left = Math.max(0, job.due - since); clearTimeout(job.id); job.id = 0; }
      });
      if (active) {
        pausedAnimations.forEach((animation) => animation.play());
        pausedAnimations.clear();
      } else {
        win.getAnimations({ subtree: true }).forEach((animation) => {
          if (animation.playState === 'running') { animation.pause(); pausedAnimations.add(animation); }
        });
      }
      watchers.forEach((fn) => fn(active));
    };
    onVisibility(sync);
    win.addEventListener('win:show', sync);
    win.addEventListener('win:hide', sync);
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { seen = e.isIntersecting; sync(); }).observe(win);
    const add = (fn, ms, repeat = 0) => {
      const job = { fn, left: ms, repeat, id: 0, due: 0 };
      jobs.add(job);
      if (active) arm(job);
      return job;
    };
    sync();
    return {
      get active() { return active; }, now,
      after: (fn, ms = 0) => add(fn, ms),
      every: (fn, ms) => add(fn, ms, ms),
      cancel(job) { if (job) { clearTimeout(job.id); jobs.delete(job); } },
      watch(fn) { watchers.add(fn); fn(active); },
    };
  }

  // Web Audio helpers: UI blips follow the SOUND switch; instruments play because you asked them to
  const audio = () => (sound && sound.context ? sound.context() : null);
  function blip(f, dur, { type = 'sine', gain = 0.08, at = 0, to = 0, force = false } = {}) {
    if (!force && !(sound && sound.on)) return;
    const a = audio();
    if (!a) return;
    const { ctx, out } = a;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /* ---------- A 5×5 tile font (Azulejo Mono, also Nimbus 98's screen font) ---------- */
  // each glyph is five rows of five tiles, top to bottom
  const F = {
    A: '.###. #...# ##### #...# #...#', B: '####. #...# ####. #...# ####.', C: '.#### #.... #.... #.... .####', D: '####. #...# #...# #...# ####.',
    E: '##### #.... ####. #.... #####', F: '##### #.... ####. #.... #....', G: '.#### #.... #..## #...# .###.', H: '#...# #...# ##### #...# #...#',
    I: '##### ..#.. ..#.. ..#.. #####', J: '..### ....# ....# #...# .###.', K: '#...# #..#. ###.. #..#. #...#', L: '#.... #.... #.... #.... #####',
    M: '#...# ##.## #.#.# #...# #...#', N: '#...# ##..# #.#.# #..## #...#', O: '.###. #...# #...# #...# .###.', P: '####. #...# ####. #.... #....',
    Q: '.###. #...# #.#.# #..#. .##.#', R: '####. #...# ####. #..#. #...#', S: '.#### #.... .###. ....# ####.', T: '##### ..#.. ..#.. ..#.. ..#..',
    U: '#...# #...# #...# #...# .###.', V: '#...# #...# #...# .#.#. ..#..', W: '#...# #...# #.#.# ##.## #...#', X: '#...# .#.#. ..#.. .#.#. #...#',
    Y: '#...# .#.#. ..#.. ..#.. ..#..', Z: '##### ...#. ..#.. .#... #####', 0: '.###. #..## #.#.# ##..# .###.', 1: '..#.. .##.. ..#.. ..#.. .###.',
    2: '.###. #...# ..##. .#... #####', 3: '####. ....# .###. ....# ####.', 4: '#..#. #..#. ##### ...#. ...#.', 5: '##### #.... ####. ....# ####.',
    6: '.###. #.... ####. #...# .###.', 7: '##### ....# ...#. ..#.. ..#..', 8: '.###. #...# .###. #...# .###.', 9: '.###. #...# .#### ....# .###.',
    '.': '..... ..... ..... ..... ..#..', ',': '..... ..... ..... ..#.. .#...', '-': '..... ..... .###. ..... .....', '!': '..#.. ..#.. ..#.. ..... ..#..',
    '?': '.###. #...# ..##. ..... ..#..', ':': '..... ..#.. ..... ..#.. .....', '+': '..... ..#.. .###. ..#.. .....', '/': '....# ...#. ..#.. .#... #....',
    '&': '.##.. #..#. .##.# #..#. .##.#', "'": '..#.. ..#.. ..... ..... .....', '°': '.#... #.#.. .#... ..... .....', ' ': '..... ..... ..... ..... .....',
  };
  Object.keys(F).forEach((k) => { F[k] = F[k].replace(/ /g, ''); });
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const glyph = (ch) => F[ch] || null;

  /* ---------- readme.txt: types itself the first time you see it ---------- */
  const md = $('[data-md]');
  if (md && !reduce) {
    $$('li', md).forEach((li, i) => li.style.setProperty('--i', i));
    const win = winOf(md);
    appScheduler(win);
    let typed = false;
    const type = () => {
      if (typed) return;
      typed = true;
      md.classList.add('is-typing');
    };
    win.addEventListener('win:show', (e) => { if (e.detail && e.detail.user) type(); });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && isOpen(win)) { type(); io.disconnect(); } }, { threshold: 0.5 });
      io.observe(md);
    }
  }

  /* ---------- linha.app: a ticket machine you can actually use ---------- */
  const kiosk = $('[data-kiosk]');
  if (kiosk) {
    const tasks = appScheduler(winOf(kiosk));
    const track = $('[data-k-track]', kiosk);
    const panels = $$('.kiosk__panel', kiosk);
    const timeEl = $('[data-k-time]', kiosk);
    const countEl = $('[data-k-count]', kiosk);
    const totalEl = $('[data-k-total]', kiosk);
    const reader = $('[data-k-reader]', kiosk);
    const msg = $('[data-k-msg]', kiosk);
    const again = $('[data-k-again]', kiosk);
    const euro = (v) => `${v.toFixed(2).replace('.', ',')} €`;
    let zone = '', price = 0, count = 1, t0 = null, timer = null, busy = false;

    const go = (n, focus = true) => {
      track.style.setProperty('--step', n);
      panels.forEach((p, i) => { p.inert = i !== n; });
      if (focus) tasks.after(() => { const b = panels[n].querySelector('button'); if (b && kiosk.contains(document.activeElement)) b.focus({ preventScroll: true }); }, reduce ? 0 : 320);
    };
    const update = () => {
      countEl.textContent = count;
      totalEl.textContent = euro(price * count);
      countEl.classList.remove('is-pop'); void countEl.offsetWidth; countEl.classList.add('is-pop');
    };
    const elapsed = () => (tasks.now() - t0) / 1000;
    const startClock = () => {
      if (t0 !== null) return;
      t0 = tasks.now();
      timer = tasks.every(() => { timeEl.textContent = `${elapsed().toFixed(1)} s`; }, 100);
    };
    go(0, false);

    $$('[data-zone]', kiosk).forEach((b) => b.addEventListener('click', () => {
      zone = b.dataset.label; price = parseFloat(b.dataset.price); count = 1;
      startClock(); update(); go(1);
      blip(880, 0.05, { type: 'square', gain: 0.04 });
    }));
    $('[data-k-minus]', kiosk).addEventListener('click', () => { count = Math.max(1, count - 1); update(); blip(660, 0.04); });
    $('[data-k-plus]', kiosk).addEventListener('click', () => { count = Math.min(9, count + 1); update(); blip(990, 0.04); });
    $('[data-k-back]', kiosk).addEventListener('click', () => go(0));
    $('[data-k-pay]', kiosk).addEventListener('click', () => {
      msg.textContent = 'Tap your card here';
      reader.classList.remove('is-reading', 'is-ok');
      go(2);
      blip(880, 0.05, { type: 'square', gain: 0.04 });
    });

    reader.addEventListener('click', () => {
      if (busy) return;
      busy = true;
      reader.classList.add('is-reading');
      msg.textContent = 'Reading…';
      tasks.after(() => {
        reader.classList.add('is-ok');
        msg.textContent = 'Approved. Boa viagem!';
        blip(1320, 0.08, { gain: 0.08 }); blip(1760, 0.12, { gain: 0.08, at: 0.09 });
        tasks.after(print, reduce ? 0 : 450);
      }, reduce ? 0 : 750);
    });

    function print() {
      tasks.cancel(timer);
      const secs = elapsed();
      timeEl.textContent = `${secs.toFixed(1)} s`;
      const now = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Lisbon' }).format(new Date());
      $('[data-t-time]', kiosk).textContent = now;
      $('[data-t-what]', kiosk).textContent = `${zone} × ${count}`;
      $('[data-t-price]', kiosk).textContent = euro(price * count);
      $('[data-t-code]', kiosk).innerHTML = Array.from({ length: 49 }, (_, i) => {
        const r = Math.floor(i / 7), c = i % 7;
        const finder = (r < 2 && c < 2) || (r < 2 && c > 4) || (r > 4 && c < 2);
        return `<i class="${finder || Math.random() > 0.5 ? 'on' : ''}"></i>`;
      }).join('');
      $('[data-t-verdict]', kiosk).textContent = secs < 20 ? `Bought in ${secs.toFixed(1)} s. Under 20.` : `Bought in ${secs.toFixed(1)} s. Take your time.`;
      kiosk.classList.add('is-printed');
      // the printer feeds in short steps
      for (let i = 0; i < 9; i++) blip(190, 0.035, { type: 'square', gain: 0.03, at: 0.2 + i * 0.09 });
      tasks.after(() => {
        again.hidden = false;
        const body = kiosk.closest('.win__body');
        if (body) body.scrollTo({ top: body.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
      }, reduce ? 0 : 1000);
      announce(`Ticket printed: ${zone}, ${count} ${count > 1 ? 'tickets' : 'ticket'}, ${euro(price * count)}. Bought in ${secs.toFixed(1)} seconds.`);
    }

    again.addEventListener('click', () => {
      kiosk.classList.remove('is-printed');
      again.hidden = true;
      busy = false; t0 = null;
      timeEl.textContent = 'Tap to start';
      go(0);
      tasks.after(() => panels[0].querySelector('button').focus({ preventScroll: true }));
    });
  }

  /* ---------- nimbus98.exe: a 16-colour dithered forecast ---------- */
  const nimbus = $('[data-nimbus]');
  if (nimbus) {
    const tasks = appScheduler(winOf(nimbus));
    const cv = $('canvas', nimbus);
    const ctx = cv.getContext('2d');
    const W = cv.width, Hh = cv.height, SCENE = 88;
    const img = ctx.createImageData(W, Hh);
    const PAL = ['#0B0F1A', '#1B2440', '#24407A', '#2F65B8', '#4F92E0', '#8CC4F2', '#CDE7F7', '#FFFFFF',
      '#A9B6C8', '#6E7B92', '#3C465C', '#FFE08A', '#FFB547', '#F07A3A', '#2D8A6E', '#A7D86E']
      .map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const th = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    // pick between palette entries along a ramp, dithered
    const ramp = (stops, t, x, y) => {
      t = clamp(t, 0, 0.9999) * (stops.length - 1);
      const i = Math.floor(t), f = t - i;
      return f > th(x, y) ? stops[i + 1] : stops[i];
    };
    const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    const vnoise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.15;

    const STATES = [
      { id: 'sun', label: 'SUNNY', say: 'sunny', temp: 22, sky: [3, 4, 5, 6], cover: 0.78, cloud: [8, 7], sun: true },
      { id: 'cloud', label: 'CLOUDY', say: 'partly cloudy', temp: 17, sky: [4, 5, 6], cover: 0.56, cloud: [9, 8, 7] },
      { id: 'rain', label: 'RAIN', say: 'rain', temp: 14, sky: [10, 9, 8], cover: 0.4, cloud: [10, 9, 8], rain: true },
      { id: 'fog', label: 'NEVOEIRO', say: 'fog', temp: 12, sky: [8, 6, 7], cover: 0.6, cloud: [8, 6, 7], fog: true },
    ];
    let si = 1, t = 0;
    const days = (() => {
      const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/Lisbon' });
      return Array.from({ length: 5 }, (_, i) => fmt.format(new Date(Date.now() + i * 864e5)).toUpperCase().slice(0, 3));
    })();
    const forecast = () => Array.from({ length: 5 }, (_, i) => STATES[(si + [0, 0, 1, 3, 2][i]) % STATES.length]);

    const px = (x, y, c) => {
      if (x < 0 || y < 0 || x >= W || y >= Hh) return;
      const o = (y * W + x) * 4, p = PAL[c];
      img.data[o] = p[0]; img.data[o + 1] = p[1]; img.data[o + 2] = p[2]; img.data[o + 3] = 255;
    };
    const text = (str, x, y, c, s = 1, shadow = -1) => {
      [...norm(str)].forEach((ch, k) => {
        const g = glyph(ch);
        if (!g) return;
        for (let i = 0; i < 25; i++) {
          if (g[i] !== '#') continue;
          const gx = x + k * 6 * s + (i % 5) * s, gy = y + Math.floor(i / 5) * s;
          for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) {
            if (shadow >= 0) px(gx + a + 1, gy + b + 1, shadow);
            px(gx + a, gy + b, c);
          }
        }
      });
    };
    const icon = (st, x, y) => {
      if (st.sun) for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const d = Math.hypot(i, j); if (d < 4.2) px(x + 5 + i, y + 4 + j, d < 2.6 ? 11 : 12); }
      const cc = st.rain ? 9 : st.fog ? 8 : 7;
      if (!st.sun) {
        [[2, 5, 3], [5, 4, 3.5], [8, 5, 2.6]].forEach(([cx, cy, r]) => { for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (Math.hypot(i, j) < r && cy + j < 8) px(x + cx + i, y + cy + j, cc); });
      }
      if (st.rain) for (let k = 0; k < 4; k++) { px(x + 2 + k * 2, y + 9, 5); px(x + 1 + k * 2, y + 10, 5); }
      if (st.fog) for (let k = 0; k < 9; k += 2) { px(x + k, y + 9, 6); px(x + k + 1, y + 11, 6); }
    };

    function draw() {
      if (document.hidden) return;
      const st = STATES[si];
      img.data.fill(0);
      // sky and clouds
      for (let y = 0; y < SCENE; y++) {
        for (let x = 0; x < W; x++) {
          let c = ramp(st.sky, y / (SCENE - 18), x, y);
          const n = fbm(x / 34 + t * 0.05, y / 16) - (y / SCENE) * 0.18;
          if (n > st.cover) c = ramp(st.cloud, clamp((n - st.cover) * 5, 0, 1), x, y);
          if (st.fog) { const band = Math.sin(y * 0.35 + t * 0.6 + Math.sin(x * 0.04) * 2) * 0.5 + 0.5; if (band > 0.55 + th(x, y) * 0.4) c = 7; }
          px(x, y, c);
        }
      }
      // sun
      if (st.sun) {
        const sx = 124, sy = 22;
        for (let j = -14; j <= 14; j++) for (let i = -14; i <= 14; i++) {
          const d = Math.hypot(i, j);
          if (d < 9) px(sx + i, sy + j, d < 6 ? 11 : 12);
          else if (d < 13 && (d - 9) / 4 < th(sx + i, sy + j) * (0.7 + 0.3 * Math.sin(Math.atan2(j, i) * 8 + t * 2))) px(sx + i, sy + j, 12);
        }
      }
      // roofs and river (a made-up riverside, not a map)
      for (let x = 0; x < W; x++) {
        const roof = 66 + Math.floor(vnoise(x / 7, 3) * 7) + (x % 23 < 3 ? -5 : 0) + (x > 40 && x < 44 ? -14 : 0);
        for (let y = roof; y < 78; y++) {
          // a few lit windows on a grid, more of them when the sky is dark
          const lit = x % 4 === 2 && y % 4 === 1 && y > roof + 2 && hash(Math.floor(x / 4), Math.floor(y / 4)) < (st.sun ? 0.12 : 0.35);
          px(x, y, lit ? 11 : 1);
        }
        for (let y = 78; y < SCENE; y++) {
          const sh = Math.sin(x * 0.5 + t * 3 + y) > 0.85;
          px(x, y, sh ? (st.sun ? 11 : 5) : ramp([2, 3], (y - 78) / 10, x, y));
        }
      }
      // rain streaks
      if (st.rain) {
        for (let k = 0; k < 70; k++) {
          const x0 = Math.floor((hash(k, 1) * W + t * 60) % W), y0 = Math.floor((hash(k, 2) * SCENE + t * 140) % SCENE);
          for (let s = 0; s < 4; s++) px((x0 - s + W) % W, (y0 + s * 2) % SCENE, 5);
        }
      }
      text('PORTO', 5, 5, 7, 1, 1);
      text(`${st.temp}°`, 5, 14, 7, 3, 1);
      text(st.label, 5, 33, 7, 1, 1);
      // five-day strip
      for (let y = SCENE; y < Hh; y++) for (let x = 0; x < W; x++) px(x, y, y === SCENE ? 4 : 1);
      forecast().forEach((f, i) => {
        const x = i * 32 + 4;
        text(days[i], x + 2, SCENE + 4, i === 0 ? 11 : 8);
        icon(f, x + 6, SCENE + 12);
        text(`${f.temp + (i % 2)}`, x + 6, SCENE + 25, 7);
      });
      ctx.putImageData(img, 0, 0);
    }

    const win = winOf(nimbus);
    let raf = 0, last = 0;
    const loop = (now) => {
      raf = 0;
      if (!tasks.active) return;
      if (now - last > 90) { t += (now - last) / 1000 || 0.09; last = now; draw(); }
      raf = requestAnimationFrame(loop);
    };
    tasks.watch((active) => {
      if (!active) { cancelAnimationFrame(raf); raf = 0; return; }
      draw();
      if (!reduce && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    });
    draw();

    const btn = $('[data-n-update]', nimbus), modem = $('[data-n-modem]', nimbus), sr = $('[data-n-sr]', nimbus);
    btn.addEventListener('click', () => {
      btn.disabled = true;
      // dial tones, a handshake, a screech (only with sound on)
      [[697, 1209], [770, 1336], [852, 1477], [941, 1336]].forEach(([a, b], i) => { blip(a, 0.09, { gain: 0.05, at: i * 0.11 }); blip(b, 0.09, { gain: 0.05, at: i * 0.11 }); });
      blip(1650, 0.35, { type: 'sawtooth', gain: 0.025, at: 0.5, to: 2400 });
      blip(980, 0.3, { type: 'square', gain: 0.02, at: 0.9, to: 1300 });
      let k = 0;
      const steps = ['Dialing', 'Dialing.', 'Connecting 14.4k', 'Connecting 14.4k.', 'Downloading ▒░░', 'Downloading ▒▒░', 'Downloading ▒▒▒'];
      const iv = tasks.every(() => {
        modem.textContent = steps[Math.min(k++, steps.length - 1)];
        if (k > steps.length) {
          tasks.cancel(iv);
          si = (si + 1) % STATES.length;
          draw();
          const now = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Lisbon' }).format(new Date());
          modem.textContent = `Updated ${now} · 16 colours`;
          sr.textContent = `Porto: ${STATES[si].say}, ${STATES[si].temp} degrees.`;
          btn.disabled = false;
        }
      }, reduce ? 30 : 230);
    });
  }

  /* ---------- azulejo.ttf: a type tester for a font made of tiles ---------- */
  const azul = $('[data-azul]');
  if (azul) {
    appScheduler(winOf(azul));
    const svg = $('[data-a-svg]', azul), input = $('[data-a-text]', azul);
    const wIn = $('[data-a-w]', azul), gIn = $('[data-a-g]', azul);
    const wOut = $('[data-a-wv]', azul), gOut = $('[data-a-gv]', azul);
    let prev = '';
    const lines = (s) => {
      if (s.length <= 6) return [s];
      const mid = Math.ceil(s.length / 2);
      let cut = s.lastIndexOf(' ', mid + 1);
      if (cut < 2 || s.length - cut > 7) cut = Math.min(6, mid);
      return [s.slice(0, cut).trimEnd(), s.slice(cut).trimStart()];
    };
    function render(pop) {
      const txt = norm(input.value).slice(0, 12);
      const w = +wIn.value, g = +gIn.value;
      wOut.textContent = w; gOut.textContent = g;
      const size = 4.4 + ((w - 100) / 800) * 5.4;           // tile edge in a 10-unit cell
      const rx = (g / 100) * (size / 2) * 0.92;
      const gloss = (g / 100) * 0.7;
      const ls = lines(txt || ' ');
      const cols = Math.max(...ls.map((l) => l.length), 1);
      const vw = cols * 60 - 10 + 20, vh = ls.length * 60 - 10 + 20;
      svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
      let k = 0, out = '<defs><linearGradient id="az-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3577D0"/><stop offset="1" stop-color="#173F84"/></linearGradient></defs>';
      ls.forEach((line, row) => {
        [...line].forEach((ch, col) => {
          const gl = glyph(ch) || F[' '];
          const ox = 10 + col * 60, oy = 10 + row * 60;
          const fresh = pop && prev[k] !== txt[k];
          out += `<g class="az-glyph${fresh ? ' is-new' : ''}" style="--d:${(k % 6) * 30}ms;transform-origin:${ox + 25}px ${oy + 25}px">`;
          for (let i = 0; i < 25; i++) {
            const x = ox + (i % 5) * 10, y = oy + Math.floor(i / 5) * 10;
            if (gl[i] === '#') {
              const o = (10 - size) / 2;
              out += `<rect class="az-on" x="${x + o}" y="${y + o}" width="${size}" height="${size}" rx="${rx}" fill="url(#az-g)"/>`;
              if (gloss > 0.02) out += `<rect x="${x + o + size * 0.16}" y="${y + o + size * 0.12}" width="${size * 0.46}" height="${size * 0.22}" rx="${size * 0.11}" fill="#fff" opacity="${gloss}"/>`;
            } else {
              out += `<rect class="az-off" x="${x + 0.5}" y="${y + 0.5}" width="9" height="9" rx="${Math.min(2, rx)}"/>`;
            }
          }
          out += '</g>';
          k++;
        });
        k++; // the line break counts as a character
      });
      svg.innerHTML = out;
      svg.setAttribute('aria-label', `${txt || 'nothing'} set in Azulejo Mono, weight ${w}, glaze ${g}`);
      prev = txt;
    }
    input.addEventListener('input', () => { render(!reduce); blip(2200 + Math.random() * 400, 0.02, { gain: 0.03 }); });
    wIn.addEventListener('input', () => render(false));
    gIn.addEventListener('input', () => render(false));
    render(false);
  }

  /* ---------- pocketfm.dmg: four knobs, four voices, one LED wall ---------- */
  const fm = $('[data-fm]');
  if (fm) {
    const wall = $('[data-fm-wall]', fm), g = wall.getContext('2d');
    const knobs = $$('.fm__knob', fm);
    const demoBtn = $('[data-fm-demo]', fm);
    const win = winOf(fm);
    const tasks = appScheduler(win);
    const COLORS = [[48, 128, 216], [240, 147, 65], [191, 208, 64], [229, 139, 196]];
    const SCALE = [50, 52, 53, 55, 57, 59, 60, 62];     // D dorian
    const OCT = [12, 7, 0, 19];
    const RATIO = [2, 3.5, 1, 1.5], INDEX = [2.4, 1.2, 3, 1.8];
    const NAMES = ['D', 'E', 'F', 'G', 'A', 'B', 'C', 'D'];
    const vals = knobs.map((k) => +k.getAttribute('aria-valuenow'));
    const ripples = [];
    let cols = 40, rows = 14, sp = 10, w = 0, h = 0, raf = 0;

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = wall.clientWidth; h = wall.clientHeight;
      if (!w || !h) return;
      wall.width = Math.round(w * dpr); wall.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      sp = Math.max(8, w / 40);
      cols = Math.floor(w / sp); rows = Math.floor(h / sp);
    }
    function paint(now) {
      g.fillStyle = '#0A1220';
      g.fillRect(0, 0, w, h);
      const ox = (w - cols * sp) / 2 + sp / 2, oy = (h - rows * sp) / 2 + sp / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let R = 0, G = 0, B = 0;
          for (const rp of ripples) {
            const age = (now - rp.t0) / 1000;
            const d = Math.hypot(c - rp.x, (r - rp.y) * 1.1);
            const ring = Math.exp(-(((d - age * 22) / 1.6) ** 2)) * Math.exp(-age * 1.6) * rp.e;
            const core = Math.exp(-((d / 2.2) ** 2)) * Math.exp(-age * 5) * rp.e;
            const k = ring + core;
            R += rp.col[0] * k; G += rp.col[1] * k; B += rp.col[2] * k;
          }
          const x = ox + c * sp, y = oy + r * sp;
          const lit = Math.min(1, (R + G + B) / 400);
          g.beginPath();
          g.arc(x, y, sp * 0.3, 0, Math.PI * 2);
          g.fillStyle = lit > 0.02 ? `rgb(${Math.min(255, 26 + R)},${Math.min(255, 37 + G)},${Math.min(255, 56 + B)})` : '#1A2538';
          g.fill();
          if (lit > 0.25) {
            g.beginPath(); g.arc(x - sp * 0.08, y - sp * 0.1, sp * 0.09, 0, Math.PI * 2);
            g.fillStyle = `rgba(255,255,255,${(lit * 0.7).toFixed(2)})`; g.fill();
          }
        }
      }
      for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i].t0 > 2600) ripples.splice(i, 1);
    }
    const loop = (now) => {
      raf = 0;
      if (!tasks.active) return;
      paint(tasks.now());
      if (ripples.length && isOpen(win)) raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf && tasks.active) raf = requestAnimationFrame(loop); };

    function note(v, step, when = 0) {
      const a = audio();
      if (!a) return;
      const { ctx, out } = a;
      const t = ctx.currentTime + 0.01 + when, dur = 0.42;
      const f = 440 * Math.pow(2, (SCALE[step] + OCT[v] - 69) / 12);
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), gn = ctx.createGain();
      car.frequency.value = f; mod.frequency.value = f * RATIO[v];
      mg.gain.setValueAtTime(f * INDEX[v], t); mg.gain.exponentialRampToValueAtTime(f * 0.15, t + dur);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.15, t + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      mod.connect(mg); mg.connect(car.frequency); car.connect(gn); gn.connect(out);
      car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
    }
    function ripple(v, step) {
      ripples.push({ x: (v + 0.5) / 4 * cols - 0.5, y: rows - 1 - (step / 7) * (rows - 3), col: COLORS[v], e: 1.4, t0: tasks.now() });
      if (reduce) { if (tasks.active) paint(tasks.now() + 250); ripples.length = 0; return; }
      kick();
    }
    function setKnob(i, v, { play = true } = {}) {
      v = clamp(v, 0, 7);
      const changed = v !== vals[i];
      vals[i] = v;
      const k = knobs[i];
      k.style.setProperty('--a', `${-135 + v * (270 / 7)}deg`);
      k.setAttribute('aria-valuenow', v);
      k.setAttribute('aria-valuetext', NAMES[v]);
      if (play && (changed || play === 'always')) { note(i, v); ripple(i, v); }
    }
    knobs.forEach((k, i) => {
      setKnob(i, vals[i], { play: false });
      k.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        k.focus({ preventScroll: true });
        try { k.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
        const sx = e.clientX, sy = e.clientY, sv = vals[i];
        let moved = false;
        k.classList.add('is-grab');
        const move = (ev) => {
          const d = Math.round(((sy - ev.clientY) + (ev.clientX - sx)) / 18);
          if (d) moved = true;
          setKnob(i, sv + d);
        };
        const up = () => {
          k.classList.remove('is-grab');
          if (!moved) setKnob(i, vals[i], { play: 'always' }); // a tap plays the current note
          k.removeEventListener('pointermove', move); k.removeEventListener('pointerup', up); k.removeEventListener('pointercancel', up);
        };
        k.addEventListener('pointermove', move); k.addEventListener('pointerup', up); k.addEventListener('pointercancel', up);
      });
      k.addEventListener('keydown', (e) => {
        const map = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 2, PageDown: -2 };
        if (e.key in map) { e.preventDefault(); setKnob(i, vals[i] + map[e.key]); }
        else if (e.key === 'Home') { e.preventDefault(); setKnob(i, 0); }
        else if (e.key === 'End') { e.preventDefault(); setKnob(i, 7); }
        else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setKnob(i, vals[i], { play: 'always' }); }
      });
      k.addEventListener('wheel', (e) => { e.preventDefault(); setKnob(i, vals[i] + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
    });

    // demo: the four voices take turns, the knobs turn themselves
    let timers = [];
    const stopDemo = () => { timers.forEach((timer) => tasks.cancel(timer)); timers = []; demoBtn.setAttribute('aria-pressed', 'false'); demoBtn.textContent = 'Play demo'; fm.classList.remove('is-demo'); };
    demoBtn.addEventListener('click', () => {
      if (demoBtn.getAttribute('aria-pressed') === 'true') { stopDemo(); return; }
      const seq = [[0, 0], [1, 4], [2, 2], [3, 6], [0, 2], [1, 4], [2, 3], [3, 7], [0, 0], [1, 4], [2, 2], [3, 5], [0, 4], [1, 6], [2, 4], [3, 7]];
      const stepMs = 60000 / 132 / 2;
      seq.forEach(([v, s], n) => timers.push(tasks.after(() => setKnob(v, s, { play: 'always' }), n * stepMs)));
      timers.push(tasks.after(stopDemo, seq.length * stepMs + 300));
      demoBtn.setAttribute('aria-pressed', 'true');
      demoBtn.textContent = 'Stop';
      fm.classList.add('is-demo');
    });

    const show = () => { if (tasks.active) { size(); paint(tasks.now()); } };
    win.addEventListener('win:show', show);
    win.addEventListener('win:hide', () => { stopDemo(); cancelAnimationFrame(raf); raf = 0; });
    tasks.watch((active) => {
      if (!active) { cancelAnimationFrame(raf); raf = 0; }
      else { show(); if (ripples.length && !reduce) kick(); }
    });
    window.addEventListener('resize', () => { if (isOpen(win)) show(); });
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (isOpen(win)) show(); }).observe(wall);
  }

  /* ---------- granite: ten thousand rows, three densities ---------- */
  const ga = $('[data-granite]');
  if (ga) {
    const tasks = appScheduler(winOf(ga));
    const scroller = $('[data-g-scroll]', ga), spacer = $('[data-g-spacer]', ga), foot = $('[data-g-foot]', ga);
    const seg = $('[data-g-seg]', ga), segBtns = $$('button', seg);
    const N = 10000;
    const PORTS = ['LEIXÕES', 'ROTTERDAM', 'HAMBURG', 'ANTWERP', 'VALÈNCIA', 'TANGER MED', 'GENOA', 'LE HAVRE', 'SINES', 'ALGECIRAS'];
    const BOX = ['20′ DV', '40′ HC', '40′ RF', '20′ OT', '45′ HC'];
    const STATUS = [['On time', 'ok'], ['On time', 'ok'], ['On time', 'ok'], ['+2 h', 'late'], ['Customs', 'hold'], ['Loaded', 'done']];
    const rand = (i, k) => { let a = (i * 2654435761 + k * 40503) >>> 0; a ^= a >>> 15; a = Math.imul(a, 2246822519) >>> 0; a ^= a >>> 13; return (a >>> 0) / 4294967296; };
    const rowData = (i) => {
      const a = Math.floor(rand(i, 1) * PORTS.length);
      let b = Math.floor(rand(i, 2) * PORTS.length); if (b === a) b = (b + 3) % PORTS.length;
      return { id: `FR-${String(20410 + i).padStart(5, '0')}`, route: `${PORTS[a]} → ${PORTS[b]}`, box: BOX[Math.floor(rand(i, 3) * BOX.length)], st: STATUS[Math.floor(rand(i, 4) * STATUS.length)] };
    };
    let rowH = 40;
    const pool = new Map();
    function makeRow(i) {
      const d = rowData(i);
      const r = document.createElement('div');
      r.className = 'ga__row';
      r.setAttribute('role', 'row');
      r.setAttribute('aria-rowindex', i + 2);
      r.innerHTML = `<span role="cell" class="mono">${d.id}</span><span role="cell">${d.route}</span><span role="cell" class="mono">${d.box}</span><span role="cell"><em class="pill pill--${d.st[1]}">${d.st[0]}</em></span>`;
      return r;
    }
    function place(r, i) { r.style.transform = `translateY(${i * rowH}px)`; r.style.height = `${rowH}px`; }
    function render() {
      const top = scroller.scrollTop, vh = scroller.clientHeight || 260;
      const i0 = Math.max(0, Math.floor(top / rowH) - 4), i1 = Math.min(N - 1, Math.ceil((top + vh) / rowH) + 4);
      pool.forEach((r, i) => { if (i < i0 || i > i1) { r.remove(); pool.delete(i); } });
      for (let i = i0; i <= i1; i++) {
        if (!pool.has(i)) { const r = makeRow(i); place(r, i); spacer.append(r); pool.set(i, r); }
      }
    }
    // frames per second while you scroll, measured, not promised
    let frames = 0, fpsT = 0, fps = 0, fpsRaf = 0, idle = 0;
    const count = (now) => {
      if (!tasks.active) { fpsRaf = 0; return; }
      frames++;
      if (!fpsT) fpsT = now;
      if (now - fpsT >= 500) { fps = Math.round((frames * 1000) / (now - fpsT)); frames = 0; fpsT = now; }
      foot.textContent = `Rendering ${pool.size} of 10,000 rows${fps ? ` · ${Math.min(fps, 120)} fps` : ''}`;
      fpsRaf = tasks.now() - idle < 600 ? requestAnimationFrame(count) : 0;
    };
    scroller.addEventListener('scroll', () => {
      render();
      idle = tasks.now();
      if (!fpsRaf && tasks.active) { frames = 0; fpsT = 0; fpsRaf = requestAnimationFrame(count); }
    }, { passive: true });
    tasks.watch((active) => {
      if (!active) { cancelAnimationFrame(fpsRaf); fpsRaf = 0; }
      else if (!fpsRaf && idle && tasks.now() - idle < 600) { frames = 0; fpsT = 0; fpsRaf = requestAnimationFrame(count); }
    });
    function setDensity(btn) {
      const next = +btn.dataset.d;
      segBtns.forEach((b, i) => { const on = b === btn; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; if (on) seg.style.setProperty('--i', i); });
      if (next === rowH) return;
      // FLIP: remember where each row sits on screen, re-lay them out, then animate only the difference
      const before = new Map();
      pool.forEach((r, i) => before.set(i, r.getBoundingClientRect().top));
      const anchor = scroller.scrollTop / rowH;
      const oldH = rowH;
      rowH = next;
      ga.style.setProperty('--row', `${rowH}px`);
      spacer.style.height = `${N * rowH}px`;
      pool.forEach((r, i) => place(r, i));
      scroller.scrollTop = anchor * rowH;
      render();
      if (!reduce && Element.prototype.animate) {
        const top0 = scroller.getBoundingClientRect().top;
        pool.forEach((r, i) => {
          const was = before.has(i) ? before.get(i) : top0 + (i - anchor) * oldH;
          const dy = was - r.getBoundingClientRect().top;
          if (Math.abs(dy) < 0.5) return;
          r.animate([{ transform: `translateY(${i * rowH + dy}px)`, height: `${oldH}px` }, { transform: `translateY(${i * rowH}px)`, height: `${rowH}px` }],
            { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' });
        });
      }
      foot.textContent = `${btn.textContent}: ${rowH} px rows · Rendering ${pool.size} of 10,000`;
      blip(1200, 0.03, { gain: 0.04 });
    }
    segBtns.forEach((b, i) => {
      b.addEventListener('click', () => setDensity(b));
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const nb = segBtns[(i + d + segBtns.length) % segBtns.length];
        nb.focus(); setDensity(nb);
      });
    });
    spacer.style.height = `${N * rowH}px`;
    ga.style.setProperty('--row', `${rowH}px`);
    segBtns.forEach((b) => { b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1; });
    seg.style.setProperty('--i', 1);
    const win = winOf(ga);
    win.addEventListener('win:show', () => { render(); foot.textContent = `Scroll it. Rendering ${pool.size} of 10,000 rows.`; });
    render();
  }

  /* ---------- Recycle Bin: crumple, throw, put back ---------- */
  const bin = $('[data-bin]');
  if (bin) {
    const tasks = appScheduler(winOf(bin));
    const list = $('[data-bin-list]', bin), items = $$('.bin__item', bin);
    const emptyBtn = $('[data-bin-empty]', bin), restoreBtn = $('[data-bin-restore]', bin);
    const can = $('.bin__can', bin), lid = $('.bin__lid', bin), countEl = $('[data-bin-count]', bin);
    const status = winOf(bin).querySelector('.win__status span:last-child');
    const statusCount = winOf(bin).querySelector('.win__status span:nth-child(2)');
    const wobble = () => lid.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-34deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(0)' }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' });

    emptyBtn.addEventListener('click', () => {
      emptyBtn.disabled = true;
      const br = bin.getBoundingClientRect(), cr = can.getBoundingClientRect();
      const finish = () => {
        items.forEach((it) => { it.hidden = true; it.classList.remove('is-gone'); });
        countEl.textContent = '0 items · bin empty. They’ll be back.';
        if (status) status.textContent = 'Emptied just now';
        if (statusCount) statusCount.textContent = '0 items';
        emptyBtn.hidden = true; emptyBtn.disabled = false;
        restoreBtn.hidden = false;
        document.dispatchEvent(new CustomEvent('bin:empty'));
        announce('Recycle Bin emptied');
      };
      if (reduce || !Element.prototype.animate) { finish(); return; }
      items.forEach((it, i) => {
        tasks.after(() => {
          const doc = $('.bin__doc', it).getBoundingClientRect();
          const ball = document.createElement('span');
          ball.className = 'bin__ball';
          ball.style.left = `${doc.left - br.left}px`; ball.style.top = `${doc.top - br.top}px`;
          bin.append(ball);
          it.classList.add('is-gone');
          const dx = cr.left + cr.width / 2 - (doc.left + doc.width / 2), dy = cr.top + 6 - (doc.top + doc.height / 2);
          const fly = ball.animate([
            { transform: 'translate(0,0) scale(1) rotate(0)', borderRadius: '3px' },
            { transform: 'translate(0,-4px) scale(.8) rotate(40deg)', borderRadius: '45%', offset: 0.18 },
            { transform: `translate(${dx * 0.55}px, ${Math.min(dy, 0) - 70}px) scale(.7) rotate(240deg)`, borderRadius: '50%', offset: 0.6 },
            { transform: `translate(${dx}px, ${dy}px) scale(.55) rotate(420deg)`, borderRadius: '50%' },
          ], { duration: 720, easing: 'cubic-bezier(.33,.1,.55,1)', fill: 'forwards' });
          blip(1800, 0.05, { type: 'triangle', gain: 0.04, to: 600 });
          fly.onfinish = () => { ball.remove(); wobble(); blip(220, 0.06, { gain: 0.06 }); if (i === items.length - 1) tasks.after(finish, 200); };
        }, i * 130);
      });
      // the lid opens first
      lid.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-34deg)' }], { duration: 200, fill: 'forwards' }).onfinish = function () { tasks.after(() => this.cancel(), items.length * 130 + 700); };
    });

    restoreBtn.addEventListener('click', () => {
      items.forEach((it, i) => {
        it.hidden = false;
        if (!reduce && it.animate) it.animate([{ transform: 'translateY(12px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: i * 70, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' });
      });
      countEl.textContent = '4 items · ideas that didn’t make it';
      if (status) status.textContent = 'Restored';
      if (statusCount) statusCount.textContent = '4 items';
      restoreBtn.hidden = true; emptyBtn.hidden = false;
      document.dispatchEvent(new CustomEvent('bin:restore'));
      announce('Four ideas put back in the Recycle Bin');
      emptyBtn.focus({ preventScroll: true });
    });
  }
})();
