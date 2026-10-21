/* Night Train to Porto · Linha Atlântica
   Ticket punch, tear and stub flight, procedural train sound (Web Audio),
   four window silhouettes and painted camera moves, range-based stamps,
   split-flap halt board, lamp toggle, first-class upgrade form. */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wideMQ = window.matchMedia('(min-width: 768px)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };

  const title = document.querySelector('.title');
  const header = document.querySelector('.header');
  const passport = document.querySelector('.passport');

  /* ---------- Title card arrival ---------- */
  const startTitle = () => title.classList.add('is-in');
  requestAnimationFrame(() => requestAnimationFrame(startTitle));
  setTimeout(startTitle, 300); // rAF can be paused in background tabs

  /* ================================================================
     Sound: all synthesised, nothing downloaded.
     run = rumble + rail joints, halt = idling engine + crickets.
     ================================================================ */
  const Sound = (() => {
    let ctx = null, master, rumbleGain, rumbleFilter, cricketGain;
    let on = false, mode = 'run', timer = null, nextClack = 0, nextChirp = 0, noiseBuf = null;

    const makeNoise = (seconds, brown) => {
      const len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
      }
      return buf;
    };

    const init = () => {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      noiseBuf = makeNoise(0.25, false);

      // rumble: looping brown noise through a low-pass, with a slow sway
      const rumble = ctx.createBufferSource();
      rumble.buffer = makeNoise(3, true); rumble.loop = true;
      rumbleFilter = ctx.createBiquadFilter(); rumbleFilter.type = 'lowpass'; rumbleFilter.frequency.value = 170;
      rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0.55;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
      const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 40;
      lfo.connect(lfoAmt).connect(rumbleFilter.frequency);
      rumble.connect(rumbleFilter).connect(rumbleGain).connect(master);
      rumble.start(); lfo.start();

      cricketGain = ctx.createGain(); cricketGain.gain.value = 0; cricketGain.connect(master);
      return true;
    };

    const clack = (t, strength) => {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 300; bp.Q.value = 1.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5 * strength, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      src.connect(bp).connect(g).connect(master);
      src.start(t); src.stop(t + 0.1);
      const thump = ctx.createOscillator(); thump.frequency.setValueAtTime(95, t); thump.frequency.exponentialRampToValueAtTime(45, t + 0.09);
      const tg = ctx.createGain(); tg.gain.setValueAtTime(0.35 * strength, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      thump.connect(tg).connect(master); thump.start(t); thump.stop(t + 0.12);
    };

    const chirp = (t) => {
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 4300 + Math.random() * 150;
        const g = ctx.createGain(); const s = t + i * 0.055;
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.05, s + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.035);
        o.connect(g).connect(cricketGain); o.start(s); o.stop(s + 0.05);
      }
    };

    // lookahead scheduler: runs only while sound is on and the tab is visible
    const tick = () => {
      const ahead = ctx.currentTime + 0.25;
      if (mode !== 'halt') {
        const period = mode === 'slow' ? 1.25 : 0.82;
        if (nextClack < ctx.currentTime) nextClack = ctx.currentTime + 0.05;
        while (nextClack < ahead) {
          clack(nextClack, 1); clack(nextClack + (mode === 'slow' ? 0.17 : 0.12), 0.8);
          nextClack += period * (0.97 + Math.random() * 0.06);
        }
      } else {
        if (nextChirp < ctx.currentTime) nextChirp = ctx.currentTime + 0.1;
        while (nextChirp < ahead) { chirp(nextChirp); nextChirp += 0.7 + Math.random() * 0.6; }
      }
    };
    const startTimer = () => { if (!timer) timer = setInterval(tick, 90); };
    const stopTimer = () => { clearInterval(timer); timer = null; };

    const applyMode = () => {
      if (!ctx) return;
      const t = ctx.currentTime;
      const rumble = { run: 0.55, slow: 0.38, halt: 0.12 }[mode];
      rumbleGain.gain.setTargetAtTime(rumble, t, 0.6);
      rumbleFilter.frequency.setTargetAtTime(mode === 'halt' ? 90 : 170, t, 0.6);
      cricketGain.gain.setTargetAtTime(mode === 'halt' ? 1 : 0, t, 0.8);
    };

    const whistle = () => {
      if (!on) return;
      const t = ctx.currentTime + 0.05;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.12);
      g.gain.setValueAtTime(0.16, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      lp.connect(g).connect(master);
      [415, 523, 622].forEach((f) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        o.frequency.setValueAtTime(f * 0.97, t); o.frequency.linearRampToValueAtTime(f, t + 0.15);
        o.connect(lp); o.start(t); o.stop(t + 1.6);
      });
    };

    const stamp = () => {
      if (!on) return;
      const t = ctx.currentTime + 0.01;
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.18);
      clack(t, 0.5);
    };

    const set = (value) => {
      if (value && !ctx && !init()) return false;
      on = value;
      if (on) {
        ctx.resume();
        master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.4);
        applyMode();
        if (!document.hidden) startTimer();
      } else if (ctx) {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        stopTimer();
        setTimeout(() => { if (!on) ctx.suspend(); }, 600);
      }
      return on;
    };

    document.addEventListener('visibilitychange', () => {
      if (!ctx || !on) return;
      if (document.hidden) { stopTimer(); ctx.suspend(); } else { ctx.resume(); startTimer(); }
    });

    return {
      set, whistle, stamp,
      get on() { return on; },
      mode(m) { if (m && m !== mode) { mode = m; applyMode(); } },
    };
  })();

  const soundBtn = document.querySelector('.sound');
  const setSound = (value) => {
    const on = Sound.set(value);
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.querySelector('.sound__label').textContent = on ? 'Sound on' : 'Sound off';
    soundBtn.setAttribute('aria-label', on ? 'Turn train sound off' : 'Turn train sound on');
  };
  soundBtn.addEventListener('click', () => setSound(!Sound.on));

  /* ---------- One object: punch → tear → flight → stamp card ---------- */
  const ticket = document.querySelector('.ticket');
  const stub = document.getElementById('journey-stub');
  const startBtn = document.querySelector('.ticket__start');
  let boarding = false, collected = false;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const animate = async (el, frames, options) => {
    const a = el.animate(frames, { fill: 'forwards', ...options });
    await a.finished;
    return a;
  };
  const collectStub = () => {
    if (collected) return;
    collected = true;
    passport.querySelector('.passport__route').remove();
    // Reparent the actual punched paper. Its route fields and punch stay with it.
    const contents = [...passport.childNodes];
    stub.append(...contents);
    passport.append(stub);
    stub.classList.remove('is-flying');
    stub.removeAttribute('style');
    passport.removeAttribute('style');
    passport.classList.add('is-shown');
    passport.inert = false;
    ticket.classList.add('is-departed', 'is-punched');
    startBtn.setAttribute('tabindex', '-1');
  };
  const boardScroll = () => new Promise((resolve) => {
    const from = window.scrollY, to = pageTop(firstStop), start = performance.now();
    const step = (now) => {
      const p = clamp((now - start) / 1400);
      window.scrollTo({ top: from + (to - from) * easeInOut(p), behavior: 'instant' });
      if (p < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
  startBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (boarding || collected) return;
    boarding = true;
    startBtn.setAttribute('aria-disabled', 'true');
    ticket.classList.add('is-punched');
    if (reduceMotion) {
      collectStub();
      window.scrollTo({ top: pageTop(firstStop), behavior: 'instant' });
    } else {
      // Keep the whole ticket in view for the 180 ms punch before tearing it.
      await wait(220);
      const from = stub.getBoundingClientRect();
      Object.assign(stub.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
      stub.classList.add('is-flying');
      document.body.append(stub);
      Sound.whistle();
      ticket.classList.add('is-departed');
      const tear = await animate(stub, [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-40px) rotate(8deg)' }], { duration: 450, easing: 'cubic-bezier(.22,.7,.3,1)' });
      // The empty destination reserves precisely the collected stub's layout.
      Object.assign(passport.style, { transition: 'none', transform: 'none', opacity: '0' });
      const to = passport.getBoundingClientRect();
      tear.cancel();
      const flight = await animate(stub, [
        { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, transform: 'translateY(-40px) rotate(8deg)' },
        { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, transform: 'translateY(0) rotate(0)' },
      ], { duration: 700, easing: 'cubic-bezier(.5,0,.15,1)' });
      flight.cancel();
      collectStub();
      await wait(120);
      await boardScroll();
    }
    boarding = false;
    const heading = firstStop.querySelector('h2');
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    requestUpdate();
  });

  /* ================================================================
     Stamp card
     ================================================================ */
  const STOPS = {
    bilbao: { name: 'Bilbao', time: '19:40' },
    santander: { name: 'Santander', time: '22:05' },
    ribadeo: { name: 'Ribadeo', time: '00:52' },
    minho: { name: 'Minho', time: '06:35' },
    porto: { name: 'Porto', time: '08:10' },
  };
  const ORDER = Object.keys(STOPS);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const savedStamps = store.get('la-stamps');
  let stamps = Array.isArray(savedStamps) ? [...new Set(savedStamps.filter((k) => STOPS[k]))] : [];

  const makeStamp = (key, seed) => {
    const s = STOPS[key];
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', 'stamp');
    svg.setAttribute('aria-hidden', 'true');
    const id = `arc-${key}-${seed}`;
    svg.style.setProperty('--r', `${((seed * 37) % 26) - 13}deg`);
    svg.innerHTML =
      `<defs><path id="${id}" d="M50 50m-33 0a33 33 0 1 1 66 0a33 33 0 1 1-66 0"/></defs>` +
      '<circle cx="50" cy="50" r="45" stroke-width="5"/><circle cx="50" cy="50" r="27" stroke-width="2"/>' +
      `<text font-size="10.5" letter-spacing="1.4"><textPath href="#${id}" startOffset="1%">${s.name} · Linha Atlântica ·</textPath></text>` +
      `<text x="50" y="57" text-anchor="middle" font-size="19">${s.time}</text>`;
    return svg;
  };

  const countEl = passport.querySelector('.passport__n');
  const dots = [...passport.querySelectorAll('.passport__dots i')];
  const live = document.getElementById('stamp-live');
  const renderPassport = (newKey) => {
    passport.querySelectorAll('.slot').forEach((slot, i) => {
      const key = slot.dataset.stop;
      if (stamps.includes(key) && !slot.querySelector('.stamp')) {
        const st = makeStamp(key, i + 3);
        if (key === newKey && !reduceMotion) st.classList.add('is-new');
        slot.appendChild(st);
        slot.setAttribute('aria-label', `${STOPS[key].name}: stamped`);
      } else if (!stamps.includes(key)) {
        slot.setAttribute('aria-label', `${STOPS[key].name}: not yet`);
      }
    });
    countEl.textContent = stamps.length;
    dots.forEach((d, i) => d.classList.toggle('is-on', i < stamps.length));
    passport.classList.toggle('is-complete', stamps.length === ORDER.length);
    renderUpgradeStatus();
  };

  const addStamp = (key) => {
    if (stamps.includes(key)) return;
    stamps.push(key);
    store.set('la-stamps', stamps);
    renderPassport(key);
    Sound.stamp();
    peek();
    live.textContent = stamps.length === ORDER.length
      ? `${STOPS[key].name} stamped. All five stamps collected: your upgrade is ready at the end of the line.`
      : `${STOPS[key].name} stamped. ${stamps.length} of 5.`;
  };

  // The torn stub unfolds briefly when a new station stamp lands.
  const passToggle = passport.querySelector('.passport__toggle');
  let pinnedOpen = false, peekTimer = null;
  const setPassOpen = (open) => {
    passport.classList.toggle('is-collapsed', !open);
    passToggle.setAttribute('aria-expanded', String(open));
  };
  setPassOpen(false);
  passToggle.addEventListener('click', () => {
    pinnedOpen = passport.classList.contains('is-collapsed');
    clearTimeout(peekTimer);
    setPassOpen(pinnedOpen);
  });
  const peek = () => {
    if (pinnedOpen || !wideMQ.matches) return;
    setPassOpen(true);
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => { if (!pinnedOpen && !passport.matches(':hover, :focus-within')) setPassOpen(false); }, 2600);
  };

  /* ================================================================
     Upgrade form
     ================================================================ */
  const upgrade = document.querySelector('.upgrade');
  const form = upgrade.querySelector('.upgrade__form');
  const status = upgrade.querySelector('.upgrade__status');
  const submit = upgrade.querySelector('.upgrade__submit');
  const errorEl = document.getElementById('up-error');
  const printed = document.getElementById('printed');

  function renderUpgradeStatus() {
    if (!status) return;
    const missing = ORDER.filter((k) => !stamps.includes(k));
    const ready = missing.length === 0;
    status.classList.toggle('is-ready', ready);
    status.innerHTML = ready
      ? '<p>All five stamps collected. Print your upgrade below.</p>'
      : `<p>You have <strong>${stamps.length}</strong> of 5 stamps. Still to visit: ${missing
          .map((k) => `<a href="#${k}">${STOPS[k].name}</a>`).join(', ')}.</p>`;
    submit.setAttribute('aria-disabled', String(!ready));
  }

  const codeFor = (text) => {
    let h = 2166136261;
    for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 8; i++) { out += A[(h >>> 0) % A.length]; h = Math.imul(h ^ (h >>> 13), 2654435761); }
    return `LA7-${out.slice(0, 4)}-${out.slice(4)}`;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.elements.name, email = form.elements.email;
    [name, email].forEach((f) => f.removeAttribute('aria-invalid'));
    const missing = ORDER.filter((k) => !stamps.includes(k));
    let msg = '';
    if (missing.length) msg = `Collect ${missing.length} more stamp${missing.length > 1 ? 's' : ''} first: ${missing.map((k) => STOPS[k].name).join(', ')}.`;
    else if (!name.value.trim()) { msg = 'Add the name for the ticket.'; name.setAttribute('aria-invalid', 'true'); name.focus(); }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { msg = 'That email address doesn’t look complete.'; email.setAttribute('aria-invalid', 'true'); email.focus(); }
    errorEl.textContent = msg;
    if (msg) return;

    printed.querySelector('.printed__name').textContent = name.value.trim();
    printed.querySelector('.printed__code').textContent = codeFor(`${name.value.trim().toLowerCase()}|${email.value.trim().toLowerCase()}`);
    const holder = printed.querySelector('.printed__stamps');
    holder.innerHTML = '';
    ORDER.forEach((k, i) => holder.appendChild(makeStamp(k, i + 11)));
    upgrade.classList.add('is-printed');
    printed.hidden = false;
    printed.classList.remove('is-new');
    void printed.offsetWidth;
    if (!reduceMotion) printed.classList.add('is-new');
    Sound.stamp();
    printed.focus({ preventScroll: true });
    printed.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  });

  const copyBtn = printed.querySelector('.printed__copy');
  copyBtn.addEventListener('click', async () => {
    const code = printed.querySelector('.printed__code').textContent;
    copyBtn.textContent = 'Copying…';
    try {
      await Promise.race([
        navigator.clipboard.writeText(code),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Clipboard unavailable')), 1200)),
      ]);
      copyBtn.textContent = 'Copied';
    } catch (e) {
      const range = document.createRange();
      range.selectNodeContents(printed.querySelector('.printed__code'));
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
      copyBtn.textContent = 'Code selected';
    }
    setTimeout(() => { copyBtn.textContent = 'Copy code'; }, 2200);
  });

  /* ================================================================
     Prologue: words light up as you read down
     ================================================================ */
  const prologueText = document.querySelector('[data-words]');
  const words = [];
  if (prologueText && !reduceMotion) {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span'); s.className = 'w'; s.textContent = part; words.push(s); frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(prologueText);
  }

  /* ================================================================
     Halt board (split-flap)
     ================================================================ */
  const FLAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:';
  const boardRows = [...document.querySelectorAll('.board__row')];
  boardRows.forEach((row) => {
    row.textContent = '';
    [...row.dataset.flap].forEach((ch) => {
      const c = document.createElement('span');
      c.className = 'flap' + (ch === ' ' ? ' is-space' : '');
      c.dataset.ch = ch;
      c.textContent = ch === ' ' ? '' : (reduceMotion ? ch : ' ');
      row.appendChild(c);
    });
  });
  let boardDone = reduceMotion;
  const runBoard = () => {
    boardDone = true;
    document.querySelectorAll('.flap:not(.is-space)').forEach((c, i) => {
      let n = 6 + ((i * 7) % 9);
      const step = () => {
        if (n-- <= 0) { c.textContent = c.dataset.ch; return; }
        c.textContent = FLAP[(Math.random() * FLAP.length) | 0];
        c.classList.remove('is-flip'); void c.offsetWidth; c.classList.add('is-flip');
        setTimeout(step, 70);
      };
      setTimeout(step, i * 25);
    });
  };

  /* ================================================================
     Lamp toggle (compartment)
     ================================================================ */
  const lampBtn = document.querySelector('.lamp');
  const compScene = document.querySelector('.stop--compartment .scene');
  lampBtn.addEventListener('click', () => {
    const off = lampBtn.getAttribute('aria-pressed') !== 'true';
    lampBtn.setAttribute('aria-pressed', String(off));
    lampBtn.querySelector('.lamp__label').textContent = off ? 'Switch the lamp on' : 'Switch off the lamp';
    compScene.classList.toggle('is-dark', off);
  });

  /* ================================================================
     Viaduct train (drawn, so it sits exactly on the painted deck)
     ================================================================ */
  const trainG = document.querySelector('.viaduct-train__body');
  if (trainG) {
    let x = 0, body = '', rim = '', wins = '';
    const car = (w, loco) => {
      const top = loco ? 10 : 8;
      body += `<path d="M${x + 1} 37 V${top + 5} Q${x + 1} ${top} ${x + (loco ? 10 : 6)} ${top} H${x + w - 5} Q${x + w} ${top} ${x + w} ${top + 5} V37 z"/>`;
      rim += `<path d="M${x + (loco ? 8 : 5)} ${top + 0.8} H${x + w - 5}"/>`;
      if (loco) {
        wins += `<rect x="${x + w - 17}" y="${top + 5}" width="9" height="6" rx="1"/>`;
        wins += `<circle cx="${x + w - 1}" cy="30" r="2.4"/>`;
      } else {
        for (let wx = x + 10; wx < x + w - 10; wx += 13) wins += `<rect x="${wx}" y="${top + 8}" width="8" height="8" rx="1.2" opacity="${(0.7 + Math.random() * 0.3).toFixed(2)}"/>`;
      }
      x += w + 3;
    };
    for (let i = 0; i < 5; i++) car(94, false);
    car(110, true);
    trainG.innerHTML =
      `<g class="vt-body" filter="url(#rough)">${body}<path d="M0 37.5 H${x}" class="vt-skirt"/></g>` +
      `<g class="vt-rim">${rim}</g>` +
      `<g class="vt-glow">${wins}</g><g class="vt-win">${wins}</g>`;
    trainG.closest('svg').setAttribute('viewBox', `0 -4 ${x} 44`);
  }

  /* ================================================================
     Count-up numbers
     ================================================================ */
  const nums = [...document.querySelectorAll('.num[data-count]')];
  const countUp = (el) => {
    const to = +el.dataset.count;
    if (reduceMotion) { el.textContent = to; return; }
    const t0 = performance.now();
    const step = () => {
      const t = clamp((performance.now() - t0) / 1400);
      el.textContent = Math.round(easeInOut(t) * to);
      if (t < 1) setTimeout(step, 30);
    };
    step();
  };

  /* ================================================================
     Scroll engine: one pass per frame for everything scroll-driven
     ================================================================ */
  const stops = [...document.querySelectorAll('.stop')];
  const scenes = [...document.querySelectorAll('.stop--scene')].map((stop) => ({
    stop,
    track: stop.querySelector('.stop__track'),
    scene: stop.querySelector('.scene'),
    planes: stop.querySelector('.scene__planes'),
    far: stop.querySelector('.plane--far'),
    near: stop.querySelector('.plane--near'),
    head: stop.querySelector('.stop__head, .card'),
    captions: [...stop.querySelectorAll('.scene__caption')],
    train: stop.querySelector('.viaduct-train'),
    word: stop.querySelector('.arrive-word'),
  }));
  const reveals = [...document.querySelectorAll('.stop__title, [data-reveal]')];
  const routeEl = header.querySelector('.route');
  const routeDots = [...header.querySelectorAll('.route__dot')];
  const firstStop = document.getElementById('bilbao');
  const lastStop = document.getElementById('porto');
  let pinned = false;
  let previousY = 0;
  let pointerX = 0, pointerY = 0;

  const setPinned = () => {
    pinned = wideMQ.matches && !reduceMotion;
    root.classList.toggle('pin', pinned);
    scenes.forEach((s) => {
      if (!pinned) {
        ['--it', '--ir', '--ib', '--il', '--rad', '--frame', '--scrim', '--head', '--card-visible', '--tx', '--word', '--wy'].forEach((p) => s.stop.style.removeProperty(p));
        s.scene.removeAttribute('style'); s.planes.style.transform = '';
        if (s.far) s.far.style.transform = '';
        if (s.near) s.near.style.transform = '';
        if (s.train) s.train.style.setProperty('--tx', '120%');
        if (s.word) s.word.style.removeProperty('--wy');
      }
    });
  };

  const pageTop = (el) => { let y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; };

  const update = () => {
    const vh = window.innerHeight, vw = window.innerWidth;
    const y = window.scrollY;

    // chrome
    const pastTitle = y > title.offsetHeight * 0.6;
    header.classList.add('is-shown');
    // Anchor navigation and manual scrolling collect the same stub instantly.
    if (pastTitle && !boarding && !collected) collectStub();
    passport.classList.toggle('is-shown', collected && (pastTitle || boarding));
    passport.inert = !passport.classList.contains('is-shown') || root.classList.contains('menu-open');
    stops.forEach((stop) => {
      const r = (stop.querySelector('.scene') || stop).getBoundingClientRect();
      stop.classList.toggle('is-active', !document.hidden && r.top < vh && r.bottom > 0);
    });

    // route progress across the five stops
    const a = pageTop(firstStop) - vh * 0.5, b = pageTop(lastStop) + lastStop.offsetHeight * 0.4 - vh * 0.5;
    const rp = clamp((y - a) / (b - a));
    routeEl.style.setProperty('--p', rp.toFixed(4));
    routeDots.forEach((d, i) => d.classList.toggle('is-past', rp >= i * 0.25 - 0.001 && y > a));

    // Intersect every stop with the travelled range, including End and drags.
    const lo = Math.min(previousY, y) + vh * .5;
    const hi = Math.max(previousY, y) + vh * .5;
    let current = null;
    stops.forEach((stop) => {
      const top = pageTop(stop), bottom = top + stop.offsetHeight;
      if (hi >= top && lo <= bottom) addStamp(stop.dataset.stop);
      if (y + vh * .5 >= top && y + vh * .5 <= bottom) current = stop;
    });
    previousY = y;
    Sound.mode(current ? current.dataset.sound : 'run');

    // prologue words
    if (words.length) {
      const r = prologueText.getBoundingClientRect();
      const t = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35));
      const n = Math.round(t * words.length);
      words.forEach((w, i) => w.classList.toggle('is-on', i < n));
    }

    // reveals and counters
    reveals.forEach((el) => {
      if (el.classList.contains('is-in')) return;
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.88 && r.bottom > 0 && !(pinned && el.closest('.stop--scene .stage'))) el.classList.add('is-in');
    });
    nums.forEach((el) => {
      if (el.dataset.done) return;
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.9) { el.dataset.done = '1'; countUp(el); }
    });
    if (!boardDone) {
      const r = boardRows[0].getBoundingClientRect();
      if (r.top < vh * 0.8) runBoard();
    }

    // pinned window scenes
    if (!pinned) return;
    scenes.forEach((s) => {
      const r = s.track.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) return;
      const p = clamp(-r.top / (r.height - vh));
      let o, ix, iy, ib, radius, fx = 0, fy = 0, nx = 0, ny = 0, fs = 1, ns = 1;
      if (s.stop.id === 'bilbao') {
        // A wide observation pane and a clear seven-vw differential pan.
        o = ease(clamp(p / .25));
        ix = vw * .16 * (1 - o); iy = vh * .34 * (1 - o); ib = iy; radius = `${2 * (1 - o)}px`;
        fx = (p - .5) * vw * .025; nx = (p - .5) * vw * .095;
      } else if (s.stop.id === 'santander') {
        // The lower sash rises, then the bed and brass lamp slide past the sea.
        o = easeInOut(clamp(p / .4));
        ix = vw * .30 * (1 - o); iy = vh * .14 * (1 - o); ib = vh * .38 * (1 - o); radius = `${6 * (1 - o)}px`;
        fx = (.5 - p) * vw * .015; nx = (p - .5) * vw * .065;
        fy = (p - .5) * vh * .025; ny = (.5 - p) * vh * .12;
      } else if (s.stop.id === 'minho') {
        // An oval dining-car window; the camera rises above the breakfast tray.
        o = .5 - Math.cos(Math.PI * clamp(p / .32)) / 2;
        ix = vw * .25 * (1 - o); iy = vh * .13 * (1 - o); ib = iy;
        radius = `${vw * .25 * (1 - o)}px / ${vh * .37 * (1 - o)}px`;
        fy = p * vh * .018; ny = -p * vh * .05;
      } else {
        // The station arch opens into a dolly beneath the iron bridge.
        o = easeInOut(clamp(p / .38));
        ix = vw * .25 * (1 - o); iy = vh * .1 * (1 - o); ib = vh * .08 * (1 - o);
        radius = `${vw * .5 * (1 - o)}px ${vw * .5 * (1 - o)}px 0 0`;
        fs = 1 + p * .04; ns = 1 + p * .12;
      }
      const st = s.stop.style;
      st.setProperty('--il', `${ix.toFixed(1)}px`); st.setProperty('--ir', `${ix.toFixed(1)}px`);
      st.setProperty('--it', `${iy.toFixed(1)}px`); st.setProperty('--ib', `${ib.toFixed(1)}px`);
      st.setProperty('--rad', radius);
      st.setProperty('--frame', clamp(1 - o * 1.5).toFixed(3));
      st.setProperty('--scrim', clamp((o - .5) * 2).toFixed(3));
      st.setProperty('--head', clamp((o - .82) / .18).toFixed(3));
      st.setProperty('--card-visible', o > .82 ? 'visible' : 'hidden');
      if (o > .86 && s.head) s.head.classList.add('is-in');
      if (s.head && s.head.querySelector('.stop__title') && o > .86) s.head.querySelector('.stop__title').classList.add('is-in');
      const sx = finePointer ? pointerX : 0, sy = finePointer ? pointerY : 0;
      s.planes.style.transform = '';
      s.far.style.transform = `translate3d(${(fx - sx * 4).toFixed(1)}px, ${(fy - sy * 3).toFixed(1)}px, 0) scale(${fs.toFixed(4)})`;
      s.near.style.transform = `translate3d(${(nx + sx * 10).toFixed(1)}px, ${(ny + sy * 5).toFixed(1)}px, 0) scale(${ns.toFixed(4)})`;

      s.captions.forEach((c) => c.classList.toggle('is-on', p > +c.dataset.at));
      if (s.train) s.train.style.setProperty('--tx', `${(-105 + clamp((p - 0.12) / 0.85) * 450).toFixed(1)}%`);
      if (s.word) {
        const w = ease(clamp((p - 0.3) / 0.35));
        st.setProperty('--word', (0.92 * w).toFixed(3));
        s.word.style.setProperty('--wy', `${(40 * (1 - w)).toFixed(1)}%`);
      }
    });
  };

  let queued = false;
  const requestUpdate = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  };
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', () => { setPinned(); requestUpdate(); });
  wideMQ.addEventListener('change', () => { setPinned(); requestUpdate(); });
  if (finePointer && !reduceMotion) {
    window.addEventListener('pointermove', (e) => {
      pointerX = e.clientX / window.innerWidth - 0.5;
      pointerY = e.clientY / window.innerHeight - 0.5;
      requestUpdate();
    }, { passive: true });
  }

  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('motion-paused', document.hidden);
    if (!document.hidden) requestUpdate();
  });

  /* ---------- Menu ---------- */
  const menuBtn = header.querySelector('.header__menu');
  const menuLabel = menuBtn.querySelector('.header__menu-label');
  const menu = document.getElementById('menu');
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuLabel.textContent = open ? 'Close' : 'Menu';
    menu.hidden = !open;
    root.classList.toggle('menu-open', open);
    document.querySelector('main').inert = open;
    document.querySelector('footer').inert = open;
    header.querySelectorAll('a').forEach((a) => { a.inert = open; });
    passport.inert = open || !passport.classList.contains('is-shown');
    if (open) { header.classList.add('is-shown'); menu.querySelector('a').focus(); } else requestUpdate();
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); }
    if (e.key === 'Tab' && !menu.hidden) {
      const focusable = [soundBtn, menuBtn, ...menu.querySelectorAll('a')];
      const i = focusable.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); focusable.at(-1).focus(); }
      else if (!e.shiftKey && i === focusable.length - 1) { e.preventDefault(); soundBtn.focus(); }
    }
  });

  /* ---------- Boot ---------- */
  setPinned();
  renderPassport(null);
  update();
  // sound stays opt-in on every visit: browsers need a gesture to start audio
})();
