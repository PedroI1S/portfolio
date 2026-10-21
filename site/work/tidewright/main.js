/* Tidewright — Corporate Clean Premium concept
   Side index (scrollspy, retract, mobile overlay), hero telemetry, reveals, counters,
   masked expand, fleet units, missions chart, simulated tide. */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mobileMQ = window.matchMedia('(max-width: 1023px)');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- Reveals ---------- */
  document.querySelectorAll('[data-reveal-lines]').forEach((el) => {
    el.querySelectorAll('.line > span').forEach((s, i) => s.style.setProperty('--i', i));
  });
  const hero = document.querySelector('.hero');
  const revealTargets = document.querySelectorAll('[data-reveal]:not(.hero [data-reveal]), [data-reveal-lines]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-in'));
    hero.classList.add('is-in');
    hero.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    revealTargets.forEach((el) => io.observe(el));
    let shown = false;
    const showHero = () => {
      if (shown) return; shown = true;
      requestAnimationFrame(() => {
        hero.classList.add('is-in');
        hero.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
      });
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(showHero);
    setTimeout(showHero, 900);
  }

  /* ---------- Side index: scrollspy + progress ---------- */
  const links = [...document.querySelectorAll('.index__link[data-section]')];
  const sections = links.map((a) => document.getElementById(a.dataset.section));
  const nowNo = document.querySelector('[data-now-no]');
  const nowLabel = document.querySelector('[data-now-label]');
  const topProgress = document.querySelector('.topbar__progress');
  let current = -1;

  const spy = () => {
    const probe = window.innerHeight * 0.35;
    let idx = 0;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= probe) idx = i; });
    // the closing band is short: once the page bottoms out, it is the current section
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) idx = sections.length - 1;
    if (idx !== current) {
      links.forEach((a, i) => (i === idx ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      current = idx;
      if (nowNo) {
        nowNo.textContent = links[idx].querySelector('.index__no').textContent;
        nowLabel.textContent = links[idx].querySelector('.index__label').textContent;
      }
    }
    const s = sections[idx], next = sections[idx + 1];
    const start = s.getBoundingClientRect().top + window.scrollY;
    const end = next ? next.getBoundingClientRect().top + window.scrollY : document.documentElement.scrollHeight - window.innerHeight * 0.65;
    links[idx].style.setProperty('--p', clamp((window.scrollY + probe - start) / Math.max(1, end - start)).toFixed(3));
    if (topProgress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      topProgress.style.setProperty('--p', clamp(window.scrollY / Math.max(1, max)).toFixed(3));
    }
  };

  /* ---------- Retract ---------- */
  const toggle = document.querySelector('.index__toggle');
  const setClosed = (closed) => {
    root.classList.toggle('index-closed', closed);
    toggle.setAttribute('aria-expanded', String(!closed));
    toggle.setAttribute('aria-label', closed ? 'Show index' : 'Hide index');
    toggle.querySelector('.index__label').textContent = closed ? 'Show index' : 'Hide index';
    try { localStorage.setItem('tw-index', closed ? 'closed' : 'open'); } catch (e) { /* storage blocked */ }
  };
  if (toggle) {
    setClosed(root.classList.contains('index-closed'));
    toggle.addEventListener('click', () => setClosed(!root.classList.contains('index-closed')));
  }

  /* ---------- Mobile overlay ---------- */
  const menuBtn = document.querySelector('.topbar__menu');
  const index = document.getElementById('index');
  const main = document.getElementById('main');
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Index';
    root.classList.toggle('menu-open', open);
    main.inert = open;
    if (open) index.querySelector('.index__link').focus({ preventScroll: true });
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  index.addEventListener('click', (e) => { if (e.target.closest('a') && root.classList.contains('menu-open')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); }
    if (e.key === 'Tab' && root.classList.contains('menu-open')) {
      const focusable = [...document.querySelectorAll('.topbar a, .topbar button, .index a, .index button')]
        .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.querySelector('.topbar .logo').addEventListener('click', () => setMenu(false));
  mobileMQ.addEventListener('change', (m) => { if (!m.matches && root.classList.contains('menu-open')) setMenu(false); });

  /* ---------- Clocks ---------- */
  const utc = document.querySelector('[data-utc]');
  const tickUtc = () => {
    const d = new Date();
    utc.textContent = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
    utc.setAttribute('datetime', d.toISOString());
  };
  tickUtc(); setInterval(tickUtc, 20000);

  /* ---------- Hero: parallax + live telemetry ---------- */
  const plane = hero.querySelector('.hero__plane');
  const kn = hero.querySelector('[data-kn]'), hdg = hero.querySelector('[data-hdg]');
  let heroVisible = true;
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
  // CSS decorations run only in their visible section and in a visible tab.
  const decorations = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.classList.toggle('motion-visible', e.isIntersecting));
  });
  [hero, ...document.querySelectorAll('.cap')].forEach((el) => decorations.observe(el));
  const syncVisibility = () => root.classList.toggle('is-hidden', document.hidden);
  document.addEventListener('visibilitychange', syncVisibility);
  syncVisibility();
  if (!reduceMotion) {
    let speed = 4.2, heading = 72;
    setInterval(() => {
      if (!heroVisible || document.hidden) return;
      speed = clamp(speed + (Math.random() - 0.5) * 0.2, 3.8, 4.6);
      heading = clamp(heading + Math.round((Math.random() - 0.5) * 2), 70, 75);
      kn.textContent = speed.toFixed(1);
      hdg.textContent = String(heading).padStart(3, '0');
    }, 1400);
  }

  /* ---------- Masked expand ---------- */
  const expand = document.querySelector('.expand');
  let expandNear = false;
  if (expand && reduceMotion) expand.style.setProperty('--p', '1');
  if (expand && !reduceMotion) {
    new IntersectionObserver(([e]) => { expandNear = e.isIntersecting; }, { rootMargin: '20% 0px' }).observe(expand);
  }
  const updateExpand = () => {
    if (!expand || reduceMotion || !expandNear || mobileMQ.matches || document.hidden) return;
    const r = expand.getBoundingClientRect();
    const stick = expand.firstElementChild.offsetHeight;
    // 0 when the band's top is 30% into the viewport, 1 three quarters of the way through the pin
    const p = clamp((window.innerHeight * 0.3 - r.top) / (window.innerHeight * 0.3 + (r.height - stick) * 0.75));
    expand.style.setProperty('--p', easeInOut(p).toFixed(4));
  };

  /* ---------- Scroll loop (one rAF per frame) ---------- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      spy();
      updateExpand();
      if (!reduceMotion && heroVisible) plane.style.setProperty('--hy', `${Math.min(window.scrollY, window.innerHeight) * 0.14}px`);
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  spy();
  if (expand && !reduceMotion) { expandNear = expand.getBoundingClientRect().top < window.innerHeight * 1.2; updateExpand(); }

  /* ---------- Counters ---------- */
  const counters = document.querySelectorAll('[data-count]');
  const fmt = (v, dec) => v.toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        const el = e.target, to = parseFloat(el.dataset.count), dec = Number(el.dataset.decimals || 0);
        const t0 = performance.now(), dur = 900;
        const step = (now) => {
          const t = clamp((now - t0) / dur);
          el.textContent = fmt(to * easeOut(t), dec);
          if (t < 1) requestAnimationFrame(step);
        };
        el.textContent = fmt(0, dec);
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => cio.observe(c));
  }

  /* ---------- Mast callouts ---------- */
  const mast = document.querySelector('.mast');
  if (mast) {
    const setHl = (id) => mast.querySelectorAll('[data-callout]').forEach((el) => el.classList.toggle('is-hl', el.dataset.callout === id));
    mast.querySelectorAll('.mast__callouts li').forEach((li) => {
      li.addEventListener('pointerenter', () => setHl(li.dataset.callout));
      li.addEventListener('pointerleave', () => setHl(null));
    });
  }

  /* ---------- Fleet: unit order + row highlight ---------- */
  const unitBtns = document.querySelectorAll('.units__btn');
  const specDds = document.querySelectorAll('.specs dd[data-m]');
  unitBtns.forEach((btn) => btn.addEventListener('click', () => {
    const mode = btn.dataset.units;
    unitBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    specDds.forEach((dd) => {
      const [a, b] = mode === 'm' ? [dd.dataset.m, dd.dataset.i] : [dd.dataset.i, dd.dataset.m];
      dd.textContent = `${dd.dataset.pre || ''}${a} (${b})`;
    });
  }));
  if (finePointer) {
    const rows = document.querySelectorAll('.specs > div');
    rows.forEach((row) => {
      const same = () => document.querySelectorAll(`.specs > div[data-row="${row.dataset.row}"]`);
      row.addEventListener('pointerenter', () => same().forEach((r) => r.classList.add('is-hl')));
      row.addEventListener('pointerleave', () => same().forEach((r) => r.classList.remove('is-hl')));
    });
  }
  document.querySelectorAll('.btn-spec').forEach((b) => b.addEventListener('click', (e) => e.preventDefault()));

  /* ---------- Missions chart + explicit, finite survey replays ---------- */
  const chart = document.querySelector('.chart');
  if (chart) {
    const map = chart.querySelector('.chart__map');
    const coast = chart.querySelector('.chart__svg');
    const scroller = chart.querySelector('.chart__scroll');
    const layer = chart.querySelector('.chart__points');
    const card = chart.querySelector('.mcard');
    const dock = chart.querySelector('.chart__carddock');
    const rows = [...chart.querySelectorAll('.mrow')];
    const filters = chart.querySelectorAll('.filter');
    const svg = chart.querySelector('.survey__svg');
    const play = chart.querySelector('.survey__play');
    const context = chart.querySelector('.survey__coast');
    const status = chart.querySelector('.survey__status');
    const steps = [...chart.querySelectorAll('[data-phase]')];
    const fullView = [0, 0, 1200, 900];
    const duration = 7200;
    let active = -1, detail = false, running = false, visible = false;
    let elapsed = 0, lastTime = 0, raf = 0, cameraRaf = 0, phase = '';
    let route, swath, trace, vessel, findings, routeLength, approachLength, local;
    let camera = [...fullView], cameraTarget = [...fullView];
    chart.querySelector('.survey').hidden = false;
    chart.querySelector('.survey__readout').hidden = false;

    const points = rows.map((row, i) => {
      const pt = document.createElement('button');
      pt.type = 'button'; pt.className = 'pt'; pt.tabIndex = -1;
      pt.setAttribute('aria-hidden', 'true');
      pt.textContent = row.querySelector('.mrow__no').textContent;
      pt.style.left = `${row.dataset.x / 12}%`;
      pt.style.top = `${row.dataset.y / 9}%`;
      pt.addEventListener('click', () => select(i, true));
      if (finePointer) {
        pt.addEventListener('pointerenter', () => {
          // A passing pointer must never interrupt an explicitly started replay.
          if (!detail) select(i, false);
          row.classList.add('is-hover');
        });
        pt.addEventListener('pointerleave', () => row.classList.remove('is-hover'));
      }
      layer.appendChild(pt);
      return pt;
    });

    const fill = (row) => {
      const q = (s) => row.querySelector(s).textContent;
      for (const [key, selector] of Object.entries({ date: '.mrow__date', title: '.mrow__title', client: '.mrow__client', drone: '.mrow__drone', outcome: '.mrow__outcome' })) {
        card.querySelector(`[data-k="${key}"]`).textContent = q(selector);
      }
      card.querySelector('[data-k="no"]').textContent = `Mission ${q('.mrow__no')}`;
      chart.querySelector('[data-survey-label]').textContent = `Mission ${q('.mrow__no')} · survey replay`;
      svg.setAttribute('aria-label', `Survey detail: ${q('.mrow__title')}. Vessel and structure drawn to local scale.`);
    };

    const place = () => {
      if (active < 0) return;
      const docked = scroller.clientWidth < 640;
      card.classList.toggle('is-docked', docked);
      if (docked) {
        if (card.parentElement !== dock) dock.appendChild(card);
        card.style.width = '';
        return;
      }
      if (card.parentElement !== map) map.appendChild(card);
      card.style.width = `${Math.min(280, scroller.clientWidth * .36)}px`;
      if (detail) { card.style.left = 'auto'; card.style.right = '16px'; card.style.top = '16px'; return; }
      card.style.right = '';
      const row = rows[active], mw = map.clientWidth, mh = map.clientHeight;
      const x = row.dataset.x / 1200 * mw, y = row.dataset.y / 900 * mh;
      const cw = card.offsetWidth, ch = card.offsetHeight;
      let left = x + 20;
      if (left + cw > mw - 12) left = x - 20 - cw;
      card.style.left = `${Math.round(clamp(left, 12, mw - cw - 12))}px`;
      card.style.top = `${Math.round(clamp(y - ch / 2, 12, mh - ch - 12))}px`;
    };

    const frame = (smooth) => {
      if (scroller.scrollWidth <= scroller.clientWidth || detail) return;
      const x = rows[active].dataset.x / 1200 * map.clientWidth;
      scroller.scrollTo({ left: x - scroller.clientWidth / 2, behavior: reduceMotion || !smooth ? 'auto' : 'smooth' });
    };
    const setCamera = (v) => {
      camera = v;
      coast.setAttribute('viewBox', v.join(' '));
      svg.setAttribute('viewBox', v.join(' '));
    };
    const crop = () => {
      const { x, y, width } = local;
      // Leave a quiet right-hand column for the existing floating fact card.
      const w = scroller.clientWidth < 640 ? width : width * 1.65;
      const h = w * .75;
      svg.style.setProperty('--survey-text', `${Math.max(3, 10 * w / map.clientWidth).toFixed(2)}px`);
      return [x - width * .52, y - h * .5, w, h];
    };
    const cameraTo = (target, animate = true) => {
      cancelAnimationFrame(cameraRaf); cameraRaf = 0;
      cameraTarget = target;
      if (reduceMotion || !animate || document.hidden) { setCamera(target); return; }
      const from = [...camera], start = performance.now();
      const move = (now) => {
        const t = clamp((now - start) / 650), k = easeInOut(t);
        setCamera(from.map((v, i) => v + (target[i] - v) * k));
        if (t < 1) cameraRaf = requestAnimationFrame(move); else cameraRaf = 0;
      };
      cameraRaf = requestAnimationFrame(move);
    };

    // All coordinates anchor to the selected mission on the original chart.
    // In detail, one SVG unit represents one metre; the coast is context only.
    const buildSurvey = (row) => {
      const x = Number(row.dataset.x), y = Number(row.dataset.y), sector = row.dataset.sector;
      const title = row.querySelector('.mrow__title').textContent;
      let d, approach, structure, marks, width, swathWidth;
      const at = (dx, dy) => `${x + dx} ${y + dy}`;
      if (sector === 'wind') {
        approach = `M${at(-57, 30)} Q${at(-31, 35)} ${at(-24, 0)}`;
        d = `${approach} A24 24 0 1 1 ${at(24, 0)} A24 24 0 1 1 ${at(-24, 0)}`;
        structure = `<circle class="s-structure" cx="${x}" cy="${y}" r="4"/><path class="s-dimension" d="M${at(-4, -8)}h8m-8-2v4m8-4v4"/><text x="${x}" y="${y - 13}" text-anchor="middle">Monopile Ø 8 m</text>`;
        marks = `<circle cx="${x + 15}" cy="${y + 15}" r="3"/><path d="M${at(17, 17)}l10 10h12"/><text x="${x + 40}" y="${y + 34}" text-anchor="end">${title.includes('Monopile') ? 'Review scour' : 'Inspection log'}</text>`;
        width = 145; swathWidth = 8;
      } else if (sector === 'port') {
        approach = `M${at(24, 22)} Q${at(7, 24)} ${at(5, 14)}`;
        d = `${approach} L${at(5, -17)} Q${at(5, -22)} ${at(10, -22)} Q${at(15, -22)} ${at(15, -17)} L${at(15, 17)}`;
        structure = `<path class="s-structure" d="M${at(-6, -25)}h6v50h-6z"/><path class="s-dimension" d="M${at(0, -28)}h5m-5-2v4m5-4v4"/><text x="${x - 2}" y="${y - 34}" text-anchor="middle">${title.includes('Quay') ? 'Quay' : 'Breakwater'} / 5 m offset</text>`;
        marks = `<circle cx="${x - 1}" cy="${y - 8}" r="1.4"/><circle cx="${x - 1}" cy="${y + 7}" r="1.4"/><path d="M${at(-2, -8)}l-9-6h-10"/><text x="${x - 22}" y="${y - 16}" text-anchor="end">Review</text>`;
        width = 100; swathWidth = 4;
      } else if (sector === 'subsea') {
        approach = `M${at(-63, 30)} Q${at(-62, 8)} ${at(-47, 1)}`;
        d = `${approach} C${at(-18, -22)} ${at(17, 20)} ${at(53, -8)}`;
        structure = `<path class="s-structure s-cable" d="M${at(-52, 5)} C${at(-18, -18)} ${at(17, 24)} ${at(56, -4)}"/><text x="${x}" y="${y - 25}" text-anchor="middle">${row.querySelector('.mrow__title').textContent.includes('pipeline') ? 'Pipeline' : 'Cable'} corridor</text>`;
        marks = `<circle cx="${x + 12}" cy="${y + 6}" r="3"/><path d="M${at(14, 8)}l10 15h16"/><text x="${x + 41}" y="${y + 26}">Logged</text>`;
        width = 180; swathWidth = 12;
      } else {
        approach = `M${at(-47, 32)} Q${at(-42, 18)} ${at(-32, 18)}`;
        d = `${approach} H${x + 32}q6 0 6-6t-6-6H${x - 32}q-6 0-6-6t6-6H${x + 32}q6 0 6-6t-6-6H${x - 32}`;
        structure = `<rect class="s-boundary" x="${x - 39}" y="${y - 23}" width="78" height="47"/><text x="${x}" y="${y - 29}" text-anchor="middle">Habitat survey grid</text>`;
        marks = `<path d="M${at(-32, -12)}l5 5 10-12"/><text x="${x}" y="${y + 38}" text-anchor="middle">Mosaic ready</text>`;
        width = 150; swathWidth = 10;
      }
      const port = sector === 'port', gannet = row.querySelector('.mrow__drone').textContent.includes('Gannet');
      const length = port ? 1.4 : gannet ? 7.6 : 3.2, beam = port ? .7 : gannet ? 2.4 : 1.6;
      const scale = port ? 10 : 20;
      local = { x, y, width };
      svg.innerHTML = `<g class="s-local">${structure}<path class="s-route" d="${d}"/><path class="s-approach" d="${approach}"/><path class="s-swath" d="${d}" stroke-width="${swathWidth}"/><path class="s-trace" d="${d}"/><g class="s-findings">${marks}</g><g class="s-vessel"><circle class="s-locator" r="${port ? 2.6 : 4.5}"/><rect x="${-length / 2}" y="${-beam / 2}" width="${length}" height="${beam * .25}" rx="${length * .12}"/><rect x="${-length / 2}" y="${beam / 4}" width="${length}" height="${beam * .25}" rx="${length * .12}"/><path d="M${-length * .28} 0h${length * .56}"/></g><g class="s-scale" transform="translate(${x - width * .43} ${y + width * .3})"><path d="M0-1v2m0-1h${scale}m0-1v2"/><text y="5">${scale} m / local scale</text></g><text class="s-vessel-label" x="${x - width * .43}" y="${y + width * .3 - 8}">${port ? 'Tern' : gannet ? 'Gannet' : 'Fulmar'} / ${length} m</text></g>`;
      route = svg.querySelector('.s-route'); trace = svg.querySelector('.s-trace'); swath = svg.querySelector('.s-swath');
      vessel = svg.querySelector('.s-vessel'); findings = svg.querySelector('.s-findings');
      routeLength = route.getTotalLength(); approachLength = svg.querySelector('.s-approach').getTotalLength();
      for (const p of [trace, swath]) { p.style.strokeDasharray = `${routeLength} ${routeLength}`; p.style.strokeDashoffset = routeLength; }
      // An unpainted dash excludes the approach from the accumulating sonar swath.
      swath.style.strokeDasharray = `0 ${approachLength} ${routeLength - approachLength} ${routeLength}`;
    };

    const update = (ms) => {
      const p = clamp(ms / duration);
      const nextPhase = p < .22 ? 'approach' : p < .9 ? 'survey' : 'result';
      let distance = p < .22 ? approachLength * p / .22 : approachLength + (routeLength - approachLength) * clamp((p - .22) / .68);
      const point = route.getPointAtLength(distance), ahead = route.getPointAtLength(Math.min(routeLength, distance + .15));
      const behind = route.getPointAtLength(Math.max(0, distance - .15));
      vessel.setAttribute('transform', `translate(${point.x} ${point.y}) rotate(${Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180 / Math.PI})`);
      trace.style.strokeDashoffset = routeLength - distance;
      // Only the surveyed portion is filled, with no swath along the approach.
      swath.style.strokeDasharray = `0 ${approachLength} ${Math.max(0, distance - approachLength)} ${routeLength + 1}`;
      swath.style.strokeDashoffset = '0';
      findings.classList.toggle('is-in', nextPhase === 'result');
      chart.style.setProperty('--survey-p', p.toFixed(4));
      chart.dataset.surveyPhase = nextPhase;
      if (phase !== nextPhase) {
        phase = nextPhase;
        steps.forEach((s) => { if (s.dataset.phase === phase) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current'); });
        status.textContent = phase === 'approach' ? 'Approach · shore pilot supervising the planned line.' : phase === 'survey' ? 'Survey · sonar coverage builds behind the vessel.' : `Result · ${rows[active].querySelector('.mrow__outcome').textContent}`;
      }
    };
    const stop = (paused = true) => {
      cancelAnimationFrame(raf); raf = 0; running = false;
      play.textContent = elapsed >= duration ? 'Replay survey ↗' : paused && elapsed > 0 ? 'Resume survey ↗' : 'Play survey ↗';
    };
    const settleCamera = () => {
      cancelAnimationFrame(cameraRaf); cameraRaf = 0;
      setCamera(cameraTarget);
    };
    const leaveDetail = (animate = true) => {
      stop(false); elapsed = 0; phase = '';
      detail = false; chart.classList.remove('is-detail'); context.disabled = true;
      svg.setAttribute('hidden', '');
      chart.style.setProperty('--survey-p', '0');
      steps.forEach((s) => s.removeAttribute('aria-current'));
      status.textContent = 'Select Play survey to follow this mission.';
      cameraTo(fullView, animate); place(); frame(false);
    };
    const enterDetail = (animate = true) => {
      detail = true; chart.classList.add('is-detail'); context.disabled = false;
      svg.removeAttribute('hidden'); scroller.scrollLeft = 0;
      cameraTo(crop(), animate); place();
    };
    const step = (now) => {
      if (!running) return;
      elapsed = Math.min(duration, elapsed + Math.max(0, now - lastTime)); lastTime = now;
      update(elapsed);
      if (elapsed < duration) raf = requestAnimationFrame(step); else stop(false);
    };
    play.addEventListener('click', () => {
      if (running) { stop(); return; }
      if (reduceMotion) { enterDetail(false); elapsed = duration; phase = ''; update(duration); play.textContent = 'Survey complete'; return; }
      if (!detail) enterDetail();
      if (elapsed >= duration) { elapsed = 0; phase = ''; }
      running = true; play.textContent = 'Pause survey';
      lastTime = performance.now(); raf = requestAnimationFrame(step);
    });
    context.addEventListener('click', () => leaveDetail());

    function setRow(row, open) {
      row.classList.toggle('is-open', open);
      row.querySelector('.mrow__btn').setAttribute('aria-expanded', String(open));
    }
    function select(i, openRow) {
      if (i < 0) return;
      const changed = i !== active;
      if (changed) {
        stop(false); if (detail) leaveDetail(false);
        elapsed = 0; phase = ''; active = i;
        fill(rows[i]); card.hidden = false;
        points.forEach((p, k) => p.classList.toggle('is-active', k === i));
        buildSurvey(rows[i]); update(0); phase = '';
        steps.forEach((s) => s.removeAttribute('aria-current'));
        status.textContent = 'Select Play survey to follow this mission.';
        if (reduceMotion) { enterDetail(false); elapsed = duration; update(duration); play.textContent = 'Survey complete'; }
        place(); frame(openRow);
      }
      if (openRow) rows.forEach((r, k) => setRow(r, k === i));
    }
    rows.forEach((row, i) => {
      const btn = row.querySelector('.mrow__btn');
      btn.addEventListener('click', () => {
        if (row.classList.contains('is-open')) { setRow(row, false); return; }
        select(i, true);
      });
      if (finePointer) {
        btn.addEventListener('pointerenter', () => points[i].classList.add('is-hover'));
        btn.addEventListener('pointerleave', () => points[i].classList.remove('is-hover'));
      }
    });
    filters.forEach((f) => f.addEventListener('click', () => {
      const key = f.dataset.filter;
      filters.forEach((b) => b.setAttribute('aria-pressed', String(b === f)));
      rows.forEach((row, i) => {
        const on = key === 'all' || row.dataset.sector === key;
        row.hidden = !on; points[i].classList.toggle('is-off', !on);
      });
      if (active >= 0 && rows[active].hidden) {
        const wasOpen = rows[active].classList.contains('is-open');
        rows.forEach((r) => setRow(r, false));
        select(rows.findIndex((r) => !r.hidden), wasOpen);
      }
    }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && chart.contains(document.activeElement)) {
        if (detail) leaveDetail();
        rows.forEach((r) => setRow(r, false));
      }
    });
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      chart.classList.toggle('is-visible', visible && !document.hidden);
      if (!visible) { stop(); settleCamera(); }
    }).observe(scroller);
    document.addEventListener('visibilitychange', () => {
      chart.classList.toggle('is-visible', visible && !document.hidden);
      if (document.hidden) { stop(); settleCamera(); }
    });
    let chartWidth = scroller.clientWidth;
    new ResizeObserver(() => {
      place();
      if (scroller.clientWidth !== chartWidth) {
        chartWidth = scroller.clientWidth;
        if (detail) cameraTo(crop(), false);
      }
    }).observe(scroller);
    select(0, false);
  }

  /* ---------- Simulated tide (semidiurnal, M2 period) ---------- */
  const tide = document.querySelector('.tide');
  if (tide) {
    const T = 12.42 * 3600e3;                  // ms
    const epoch = Date.UTC(2026, 0, 1, 3, 10); // an invented high water
    const mean = 2.6, amp = 2.1;
    const h = (t) => mean + amp * Math.cos((2 * Math.PI * (t - epoch)) / T);
    const path = tide.querySelector('.tide__path');
    const dot = tide.querySelector('.tide__dot');
    const outH = tide.querySelector('[data-tide-h]');
    const outDir = tide.querySelector('[data-tide-dir]');
    const outNext = tide.querySelector('[data-tide-next]');
    const tf = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    const y = (v) => 58 - ((v - (mean - amp)) / (2 * amp)) * 52;
    const draw = () => {
      const now = Date.now(), span = 12 * 3600e3;
      let d = '';
      for (let i = 0; i <= 48; i++) {
        const t = now - span / 2 + (span * i) / 48;
        d += `${i ? 'L' : 'M'}${(i * 5).toFixed(1)} ${y(h(t)).toFixed(2)}`;
      }
      path.setAttribute('d', d);
      dot.setAttribute('cy', y(h(now)).toFixed(2));
      const phase = (((now - epoch) % T) + T) % T;     // 0 = high water
      const falling = phase < T / 2;
      const nextTurn = now + (falling ? T / 2 - phase : T - phase);
      outH.textContent = h(now).toFixed(1);
      outDir.textContent = falling ? 'falling' : 'rising';
      outNext.textContent = `${falling ? 'low' : 'high'} water ${tf.format(new Date(nextTurn))}`;
    };
    draw();
    setInterval(() => { if (!document.hidden) draw(); }, 60000);
  }
})();
