/* Sowsheet — Playful / Illustrative (sketchbook) concept
   Hero entrance + hand-drawn arrows, plot cursor readout, mini bed planner,
   live seasonal bed, waitlist form, toolbar menu. */
(() => {
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = motionPreference.matches;
  const motionSyncs = [];
  motionPreference.addEventListener('change', (e) => {
    reduceMotion = e.matches;
    motionSyncs.forEach((sync) => sync());
  });
  const raf = (fn) => requestAnimationFrame(fn);
  const svgNS = 'http://www.w3.org/2000/svg';

  // One visibility gate for decorative loops. No idle timer stays scheduled off-screen.
  function watchMotion(el, onChange = () => {}) {
    let visible = false;
    const sync = () => {
      const running = visible && !document.hidden && !reduceMotion;
      if (el.classList.contains('is-running') === running) return;
      el.classList.toggle('is-running', running);
      onChange(running);
    };
    motionSyncs.push(sync);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(el);
    } else {
      const check = () => {
        const b = el.getBoundingClientRect();
        visible = b.bottom > 0 && b.top < window.innerHeight;
        sync();
      };
      window.addEventListener('scroll', check, { passive: true });
      window.addEventListener('resize', check);
      check();
    }
    document.addEventListener('visibilitychange', sync);
  }

  /* ---------- Hero ---------- */
  const hero = document.querySelector('.hero');
  const art = hero && hero.querySelector('.art');

  if (hero && art) {
    art.querySelectorAll('.pop').forEach((el, i) => el.style.setProperty('--i', i));
    hero.querySelectorAll('.hero__title .w').forEach((el, i) => el.style.setProperty('--i', i));

    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      raf(() => hero.classList.add('is-in'));
      setTimeout(() => drawArrows(!reduceMotion), reduceMotion ? 0 : 1300);
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(show);
    setTimeout(show, 1200);

    /* hand-drawn arrows from margin notes to the plan */
    const arrows = hero.querySelector('.arrows');
    const notes = [...hero.querySelectorAll('[data-note]')];
    let arrowsDrawn = false;

    function doodle(cx, cy, r) {
      // a loose ellipse that overshoots its own start, like a quick pen loop
      let d = '';
      const turns = 1.12, n = 44;
      for (let i = 0; i <= n; i++) {
        const a = -2.2 + (i / n) * Math.PI * 2 * turns;
        const k = 1 + 0.07 * Math.sin(a * 3 + 1) + i * 0.0018;
        const x = cx + Math.cos(a) * r * 1.25 * k, y = cy + Math.sin(a) * r * 0.72 * k;
        d += `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      }
      return d;
    }

    function drawArrows(animate) {
      if (!arrows || !notes.length) return;
      const box = hero.getBoundingClientRect();
      const scale = art.getScreenCTM() ? art.getScreenCTM().a : 1;
      arrows.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      arrows.textContent = '';
      const paths = [];
      notes.forEach((note) => {
        const anchor = art.querySelector(`[data-anchor="${note.dataset.note}"]`);
        if (!anchor || !note.offsetParent) return;
        const nr = note.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
        const ex = ar.left + ar.width / 2 - box.left, ey = ar.top + ar.height / 2 - box.top;
        const R = Math.max(18, 30 * scale);
        let sx, sy;
        if (ar.left < nr.left - 20) { sx = nr.left - box.left - 10; sy = nr.top - box.top + nr.height * 0.45; }
        else { sx = nr.left - box.left + nr.width * (note.dataset.note === 'herbs' ? 0.7 : 0.3); sy = nr.top - box.top - 8; }
        // stop at the edge of the doodle loop
        const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy);
        const ux = dx / len, uy = dy / len;
        const stop = R * 1.25 * Math.abs(ux) + R * 0.72 * Math.abs(uy) + 6;
        const tx = ex - ux * stop, ty = ey - uy * stop;
        const L = Math.hypot(tx - sx, ty - sy);
        const px = -uy, py = ux; // perpendicular
        const bow = (note.dataset.note === 'herbs' ? -1 : 1) * L * 0.16;
        const c1x = sx + ux * L * 0.3 + px * bow, c1y = sy + uy * L * 0.3 + py * bow;
        const c2x = tx - ux * L * 0.32 + px * bow * 0.7, c2y = ty - uy * L * 0.32 + py * bow * 0.7;
        // arrowhead along the final tangent
        const hx = tx - c2x, hy = ty - c2y, hl = Math.hypot(hx, hy) || 1;
        const ax = hx / hl, ay = hy / hl, h = 12;
        const rot = (a) => [ax * Math.cos(a) - ay * Math.sin(a), ax * Math.sin(a) + ay * Math.cos(a)];
        const [l1x, l1y] = rot(Math.PI - 0.5), [l2x, l2y] = rot(Math.PI + 0.45);
        const d = `M${sx.toFixed(1)},${sy.toFixed(1)}C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`
          + `M${(tx + l1x * h).toFixed(1)},${(ty + l1y * h).toFixed(1)}L${tx.toFixed(1)},${ty.toFixed(1)}L${(tx + l2x * h).toFixed(1)},${(ty + l2y * h).toFixed(1)}`;
        const p = document.createElementNS(svgNS, 'path');
        p.setAttribute('d', d);
        const o = document.createElementNS(svgNS, 'path');
        o.setAttribute('d', doodle(ex, ey, R));
        o.setAttribute('class', 'doodle');
        arrows.append(o, p);
        paths.push(o, p);
      });
      if (animate && !arrowsDrawn) {
        paths.forEach((p, i) => {
          const l = p.getTotalLength();
          p.style.transition = 'none';
          p.style.strokeDasharray = `${l} ${l}`;
          p.style.strokeDashoffset = l;
          p.getBoundingClientRect();
          p.style.transition = '';
          p.style.transitionDelay = `${Math.floor(i / 2) * 350 + (i % 2 ? 250 : 0)}ms`;
          raf(() => raf(() => { p.style.strokeDashoffset = 0; }));
        });
      }
      arrowsDrawn = true;
    }

    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (shown) drawArrows(false); }, 120);
    });

    /* plot coordinates under the cursor, in metres (1 unit = 50 cm) */
    const xy = hero.querySelector('.hero__xy');
    if (xy) {
      let pending = null;
      const U = 44;
      const update = () => {
        const e = pending; pending = null;
        const m = art.getScreenCTM();
        if (!m || !e) return;
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
        const a = pt.x / U, b = pt.y / (U / 2);
        const x = (a + b) / 2, y = (b - a) / 2;
        xy.textContent = (x >= 0 && x <= 10 && y >= 0 && y <= 8)
          ? `x ${(x * 0.5).toFixed(2)} m · y ${(y * 0.5).toFixed(2)} m`
          : 'off the plot';
      };
      art.addEventListener('pointermove', (e) => { if (!pending) raf(update); pending = e; });
      art.addEventListener('pointerleave', () => { pending = null; xy.textContent = 'x —.— m · y —.— m'; });
    }

    /* the cat flicks its tail now and then */
    const cat = art.querySelector('.cat');
    let catTimer = null;
    const flick = () => {
      if (cat && hero.classList.contains('is-running')) {
        cat.classList.remove('is-flick');
        void cat.getBBox();
        cat.classList.add('is-flick');
      }
    };
    cat && cat.addEventListener('pointerenter', flick);
    watchMotion(hero, (running) => {
      clearTimeout(catTimer);
      catTimer = null;
      if (running && cat) {
        const next = () => { flick(); catTimer = setTimeout(next, 7000); };
        catTimer = setTimeout(next, 7000);
      }
    });
  }
  const marquee = document.querySelector('.marquee');
  if (marquee) watchMotion(marquee);

  /* ---------- Scroll reveals ---------- */
  const revealEls = document.querySelectorAll('[data-reveal], .season');
  document.querySelectorAll('.season').forEach((s, si) => {
    s.style.setProperty('--d', `${si * 140}ms`);
    s.querySelectorAll('.pop').forEach((p, i) => p.style.setProperty('--i', i));
  });
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.1 });
    revealEls.forEach((el) => io.observe(el));
  }

  /* ---------- Planner ---------- */
  const PLANTS = {
    tomato: { name: 'tomato', plural: 'tomatoes', spread: 60, sun: 6 },
    courgette: { name: 'courgette', plural: 'courgettes', spread: 90, sun: 6 },
    beans: { name: 'beans', plural: 'beans', spread: 20, sun: 5 },
    lettuce: { name: 'lettuce', plural: 'lettuces', spread: 30, sun: 3, max: 6 },
    basil: { name: 'basil', plural: 'basil plants', spread: 25, sun: 6 },
    marigold: { name: 'marigold', plural: 'marigolds', spread: 25, sun: 4 },
    strawberry: { name: 'strawberry', plural: 'strawberries', spread: 30, sun: 5 },
    mint: { name: 'mint', plural: 'mint plants', spread: 40, sun: 3, wanders: true },
  };
  const GOOD = [
    ['basil', 'tomato', 'basil next to tomatoes. A classic pairing.'],
    ['marigold', 'tomato', 'marigolds near tomatoes keep the aphids guessing.'],
    ['beans', 'courgette', 'beans and courgettes, two of the “three sisters”. Add sweetcorn next year.'],
    // the sun comes from the south (front), so a tomato shades the square north of it
    ['lettuce', 'tomato', 'lettuce in the tomato’s shade stays sweet for longer.', (A, B) => A.r === B.r - 1],
  ];
  const SUN = [[2, 3, 3, 4, 4, 5], [3, 4, 4, 5, 6, 6], [4, 5, 5, 6, 7, 7], [4, 5, 6, 7, 8, 8]];
  const EXAMPLE = { '0,1': 'lettuce', '0,3': 'lettuce', '1,3': 'strawberry', '1,4': 'beans', '1,5': 'beans', '2,1': 'marigold', '2,4': 'tomato', '2,5': 'tomato', '3,2': 'basil', '3,3': 'basil', '3,5': 'marigold' };
  const ROWS = 4, COLS = 6;
  const cellName = (r, c) => `${'ABCD'[r]}${c + 1}`;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const plan = new Map(Object.entries(EXAMPLE));

  /* ---------- The same bed, seen through the year ---------- */
  const live = document.getElementById('season-live');
  const garden = document.getElementById('season-garden');
  const plantsEl = document.getElementById('season-plants');
  const seasonBtns = [...document.querySelectorAll('.season-control')];
  let selectedSeason = 'summer';
  const phases = {
    spring: ['01 / A small beginning', 'Spring, starting small.', 'A bed of possibilities. Little shoots mark every square you planted; there’s still plenty of room between them.'],
    summer: ['02 / The good bit', 'Summer, in full swing.', 'Your plants at their fullest. The tall ones earn their keep; the little ones fill the gaps.'],
    autumn: ['03 / One last handful', 'Autumn, slowing down.', 'The same little patch, a quieter silhouette. Pick the last few handfuls and leave room for what comes next.'],
    winter: ['04 / A well-earned rest', 'Winter, tucked in.', 'Mulch marks the planted squares; bare canes remember the tall crops. Your layout stays here, ready for another spring.'],
  };
  const project = (r, c, z = 0) => [Math.round((c - r) * 68), Math.round((c + r) * 34 - z)];
  const polygon = (points, fill, cls = '') => `<polygon class="${cls}" points="${points.map(([r, c, z]) => project(r, c, z).join(',')).join(' ')}" fill="${fill}"/>`;

  if (live && garden && plantsEl) {
    let ground = polygon([[0, 0, -20], [0, 6, -20], [4, 6, -20], [4, 0, -20]], '#DDD0B6');
    ground += polygon([[4, 0, 0], [4, 6, 0], [4, 6, -28], [4, 0, -28]], '#3B60C5');
    ground += polygon([[0, 6, 0], [4, 6, 0], [4, 6, -28], [0, 6, -28]], '#2747A6');
    ground += polygon([[0, 0, 0], [0, 6, 0], [4, 6, 0], [4, 0, 0]], '#6F8DDB');
    ground += polygon([[.09, .09, 0], [.09, 5.91, 0], [3.91, 5.91, 0], [3.91, .09, 0]], '#E5D6BC', 'season-soil');
    for (let r = 1; r < ROWS; r++) ground += `<path d="M${project(r, 0)}L${project(r, 6)}" class="season-grid"/>`;
    for (let c = 1; c < COLS; c++) ground += `<path d="M${project(0, c)}L${project(4, c)}" class="season-grid"/>`;
    for (let c = 0; c < COLS; c++) {
      const [x, y] = project(4.35, c + .5);
      ground += `<text x="${x}" y="${y + 8}" class="season-coordinate">${c + 1}</text>`;
    }
    for (let r = 0; r < ROWS; r++) {
      const [x, y] = project(r + .5, -.35);
      ground += `<text x="${x}" y="${y}" class="season-coordinate">${'ABCD'[r]}</text>`;
    }
    ground += '<path d="M-255-28l-25-45m25 45l-15-6m15 6l2-15" fill="none" stroke="#6B665F" stroke-width="1.5"/><text x="-300" y="-87" class="season-coordinate">FENCE SIDE</text>';
    document.getElementById('season-ground').innerHTML = ground;
    live.hidden = false;
    document.getElementById('season-fallback').hidden = true;
    seasonBtns.forEach((b) => b.addEventListener('click', () => {
      selectedSeason = b.dataset.season;
      live.dataset.season = selectedSeason;
      seasonBtns.forEach((s) => s.setAttribute('aria-pressed', String(s === b)));
      const [phase, name, copy] = phases[selectedSeason];
      document.getElementById('season-phase').textContent = phase;
      document.getElementById('season-name').textContent = name;
      document.getElementById('season-copy').textContent = copy;
      updateSeasonDescription();
    }));
  }

  function updateSeasonDescription() {
    if (!garden) return;
    document.getElementById('season-garden-title').textContent = `Your bed in ${selectedSeason}, ${plan.size} planted square${plan.size === 1 ? '' : 's'}`;
    document.getElementById('season-garden-desc').textContent = plan.size
      ? [...plan].map(([key, p]) => { const [r, c] = key.split(',').map(Number); return `${cap(PLANTS[p].name)} at ${cellName(r, c)}`; }).join('. ') + '. Same positions as the planner above.'
      : 'An empty 6 by 4 bed. Add a plant in the planner above to see it here.';
  }

  function renderSeasonBed() {
    if (!plantsEl) return;
    const entries = [...plan].map(([key, p]) => { const [r, c] = key.split(',').map(Number); return { key, p, r, c }; });
    entries.sort((a, b) => (a.r + a.c) - (b.r + b.c) || a.r - b.r);
    // Keyed by square: season changes keep the same nodes and animate their growth.
    [...plantsEl.children].forEach((g) => { if (!plan.has(g.dataset.key) || plan.get(g.dataset.key) !== g.dataset.plant) g.remove(); });
    entries.forEach(({ key, p, r, c }) => {
      let g = [...plantsEl.children].find((el) => el.dataset.key === key);
      if (!g) {
        g = document.createElementNS(svgNS, 'g');
        g.setAttribute('class', 'season-plant');
        g.dataset.key = key;
        g.dataset.plant = p;
        g.setAttribute('transform', `translate(${project(r + .5, c + .5).join(' ')})`);
        g.innerHTML = '<ellipse class="season-mulch" rx="25" ry="12"/>'
          + `<g class="growth growth--mature"><use href="#s-${p}" x="-65" y="-180" width="130" height="200"/></g>`
          + '<g class="growth growth--shoot"><use href="#i-seed" x="-17" y="-34" width="34" height="36"/></g>'
          + ((p === 'tomato' || p === 'beans') ? '<g class="growth growth--cane"><path d="M-15 0L0-100L15 0M-8-35H8"/></g>' : '');
      }
      plantsEl.append(g);
    });
    document.getElementById('season-plant-count').textContent = `${plan.size} planted square${plan.size === 1 ? '' : 's'}`;
    updateSeasonDescription();
  }

  const section = document.getElementById('planner');
  const bedEl = document.getElementById('bed');
  if (section && bedEl) {
    const ringsEl = document.getElementById('rings');
    const notesEl = document.getElementById('notes');
    const countEl = document.getElementById('note-count');
    const statusEl = document.getElementById('planner-status');
    const tray = section.querySelector('.tray');
    const stickers = [...tray.querySelectorAll('.sticker')];
    let tool = null;
    let focusIdx = 0;
    let lastWarnCount = 0;

    // build real buttons in place of the static example
    bedEl.textContent = '';
    const cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cell';
        b.dataset.key = `${r},${c}`;
        b.style.setProperty('--h', SUN[r][c]);
        b.tabIndex = r === 0 && c === 0 ? 0 : -1;
        b.innerHTML = `<span class="cell__sun" aria-hidden="true">${SUN[r][c]} h</span>`;
        bedEl.append(b);
        cells.push(b);
      }
    }

    function evaluate() {
      const warns = [], suns = [], goods = [], clashes = [];
      const entries = [...plan.entries()].map(([k, p]) => { const [r, c] = k.split(',').map(Number); return { k, r, c, p }; });
      entries.sort((a, b) => a.r - b.r || a.c - b.c);
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const A = entries[i], B = entries[j];
          const dist = 50 * Math.hypot(A.r - B.r, A.c - B.c);
          const need = (PLANTS[A.p].spread + PLANTS[B.p].spread) / 2;
          if (dist < need) {
            clashes.push([A, B]);
            const who = A.p === B.p ? `two ${PLANTS[A.p].plural}` : `${PLANTS[A.p].name} and ${PLANTS[B.p].name}`;
            warns.push({ cells: [A.k, B.k], html: `<b>${cellName(A.r, A.c)} and ${cellName(B.r, B.c)}:</b> ${who} want about ${Math.round(need / 5) * 5} cm between them; these are ${Math.round(dist)} cm apart.` });
          }
        }
      }
      for (const A of entries) {
        const P = PLANTS[A.p], h = SUN[A.r][A.c];
        if (h < P.sun) suns.push({ cells: [A.k], html: `<b>${cellName(A.r, A.c)}:</b> ${P.name} wants ${P.sun} h of sun or more; this square gets about ${h} h.` });
        if (P.max && h > P.max) suns.push({ cells: [A.k], html: `<b>${cellName(A.r, A.c)}:</b> ${P.name} gets ${h} h of sun here and may bolt. A shadier square keeps it sweet.` });
        if (P.wanders && entries.some((B) => B !== A && Math.max(Math.abs(A.r - B.r), Math.abs(A.c - B.c)) === 1)) {
          warns.push({ cells: [A.k], html: `<b>${cellName(A.r, A.c)}:</b> mint spreads by runners and will swamp its neighbours. Give it a pot of its own.` });
        }
      }
      for (const [a, b, text, test] of GOOD) {
        let found = null;
        for (const A of entries) {
          if (A.p !== a) continue;
          for (const B of entries) {
            if (B.p === b && Math.max(Math.abs(A.r - B.r), Math.abs(A.c - B.c)) === 1 && (!test || test(A, B))) { found = [A, B]; break; }
          }
          if (found) break;
        }
        if (found) goods.push({ html: `<b>${cellName(found[0].r, found[0].c)} and ${cellName(found[1].r, found[1].c)}:</b> ${text}` });
      }
      return { warns, suns, goods, clashes, entries };
    }

    function render(changedKey) {
      const res = evaluate();
      const sunCells = new Set(res.suns.flatMap((s) => s.cells));
      const clashCells = new Set(res.clashes.flatMap(([A, B]) => [A.k, B.k]));

      cells.forEach((b) => {
        const key = b.dataset.key;
        const [r, c] = key.split(',').map(Number);
        const p = plan.get(key);
        const cur = b.querySelector('.plant');
        if (p) {
          if (!cur || cur.dataset.plant !== p) {
            cur && cur.remove();
            const s = document.createElement('span');
            s.className = 'plant';
            s.dataset.plant = p;
            s.innerHTML = `<svg aria-hidden="true"><use href="#i-${p}"/></svg>`;
            b.append(s);
          }
        } else if (cur) cur.remove();
        b.classList.toggle('has-plant', !!p);
        b.classList.toggle('has-sun-warn', sunCells.has(key));
        b.classList.toggle('is-new', key === changedKey && !!p && !reduceMotion);
        const flags = [];
        if (clashCells.has(key)) flags.push('too close to a neighbour');
        if (sunCells.has(key)) flags.push('sun note');
        b.setAttribute('aria-label', `${cellName(r, c)}, ${p ? PLANTS[p].name : 'empty'}, about ${SUN[r][c]} hours of sun${flags.length ? `, ${flags.join(', ')}` : ''}`);
      });

      // spread rings and clash lines, in square units
      let svg = '';
      res.entries.forEach((A) => {
        svg += `<circle class="ring${clashCells.has(A.k) ? ' is-clash' : ''}" cx="${A.c + 0.5}" cy="${A.r + 0.5}" r="${PLANTS[A.p].spread / 100}"/>`;
      });
      res.clashes.forEach(([A, B]) => {
        const mx = (A.c + B.c) / 2 + 0.5, my = (A.r + B.r) / 2 + 0.5;
        svg += `<line x1="${A.c + 0.5}" y1="${A.r + 0.5}" x2="${B.c + 0.5}" y2="${B.r + 0.5}"/>`
          + `<g class="bang" transform="translate(${mx} ${my})"><circle r=".13"/><path d="M0,-.065V.015M0,.065v.001"/></g>`;
      });
      ringsEl.innerHTML = svg;

      // notes panel
      const fix = res.warns.length + res.suns.length;
      let html = '';
      res.warns.forEach((w) => { html += `<li class="pn pn--warn">${w.html}</li>`; });
      res.suns.forEach((w) => { html += `<li class="pn pn--sun">${w.html}</li>`; });
      res.goods.forEach((g) => { html += `<li class="pn pn--good">${g.html}</li>`; });
      if (!res.entries.length) html = '<li class="pn pn--ok">An empty bed. Pick a plant from the tray to start.</li>';
      else if (!fix) html = '<li class="pn pn--ok">Everything’s getting along. Nice plan.</li>' + html;
      notesEl.innerHTML = html;
      countEl.textContent = fix ? `${fix} to fix` : `${res.entries.length} plant${res.entries.length === 1 ? '' : 's'}`;
      const delta = fix - lastWarnCount;
      lastWarnCount = fix;
      renderSeasonBed();
      return { fix, delta };
    }

    const say = (msg) => { statusEl.textContent = ''; setTimeout(() => { statusEl.textContent = msg; }, 30); };
    const dirty = () => section.classList.add('is-dirty');
    const summary = ({ fix, delta }) => (delta > 0 ? ` ${delta} new note${delta > 1 ? 's' : ''} to fix.` : delta < 0 ? ` ${fix ? `${fix} left to fix.` : 'No notes left to fix.'}` : '');

    function place(key, p) {
      const [r, c] = key.split(',').map(Number);
      plan.set(key, p);
      dirty();
      say(`${cap(PLANTS[p].name)} planted in ${cellName(r, c)}.${summary(render(key))}`);
    }
    function remove(key, quiet) {
      const [r, c] = key.split(',').map(Number);
      const p = plan.get(key);
      if (!p) return;
      plan.delete(key);
      dirty();
      const res = render();
      if (!quiet) say(`${cap(PLANTS[p].name)} removed from ${cellName(r, c)}.${summary(res)}`);
    }

    function setTool(next) {
      tool = tool === next ? null : next;
      stickers.forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.plant === tool)));
    }

    tray.addEventListener('click', (e) => {
      const s = e.target.closest('.sticker');
      if (!s || suppressClick) return;
      setTool(s.dataset.plant);
      if (tool) say(tool === 'erase' ? 'Remove picked. Press a square to clear it.' : `${cap(PLANTS[tool].name)} picked. Press a square to plant it.`);
    });

    bedEl.addEventListener('click', (e) => {
      const b = e.target.closest('.cell');
      if (!b || suppressClick) return;
      focusIdx = cells.indexOf(b);
      cells.forEach((x, i) => { x.tabIndex = i === focusIdx ? 0 : -1; });
      const key = b.dataset.key;
      if (tool === 'erase') remove(key);
      else if (tool) place(key, tool);
      else {
        const [r, c] = key.split(',').map(Number);
        const p = plan.get(key);
        say(p ? `${cellName(r, c)} has ${PLANTS[p].name}. Pick a plant or Remove from the tray first, or drag it.` : 'Pick a plant from the tray first.');
        if (!p) tray.animate && !reduceMotion && tray.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 260 });
      }
    });

    // arrow keys move between squares (roving tabindex)
    bedEl.addEventListener('keydown', (e) => {
      const moves = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
      let r = Math.floor(focusIdx / COLS), c = focusIdx % COLS;
      if (moves[e.key]) {
        r = Math.min(ROWS - 1, Math.max(0, r + moves[e.key][0]));
        c = Math.min(COLS - 1, Math.max(0, c + moves[e.key][1]));
      } else if (e.key === 'Home') c = 0;
      else if (e.key === 'End') c = COLS - 1;
      else if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.closest('.cell')) { remove(e.target.closest('.cell').dataset.key); e.preventDefault(); return; }
      else return;
      e.preventDefault();
      focusIdx = r * COLS + c;
      cells.forEach((x, i) => { x.tabIndex = i === focusIdx ? 0 : -1; });
      cells[focusIdx].focus();
    });
    bedEl.addEventListener('focusin', (e) => {
      const b = e.target.closest('.cell');
      if (b) focusIdx = cells.indexOf(b);
    });

    /* drag and drop with pointer events (mouse, pen, and touch on planted squares) */
    let drag = null, suppressClick = false;
    const ghost = document.createElement('div');
    ghost.className = 'ghost';
    ghost.hidden = true;
    document.body.append(ghost);

    const cellAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const b = el && el.closest('.cell');
      return b && bedEl.contains(b) ? b : null;
    };
    const moveGhost = (x, y) => { ghost.style.transform = `translate3d(${x - 32}px, ${y - 32}px, 0) rotate(-8deg)`; };

    function onDown(e) {
      if (e.button !== 0) return;
      const s = e.target.closest('.sticker');
      const b = e.target.closest('.cell');
      let p = null, from = null;
      if (s && s.dataset.plant !== 'erase') p = s.dataset.plant;
      else if (b && plan.has(b.dataset.key)) { p = plan.get(b.dataset.key); from = b; }
      if (!p) return;
      drag = { p, from, src: s || b, x: e.clientX, y: e.clientY, id: e.pointerId, active: false, target: null };
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.active) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
        drag.active = true;
        try { drag.src.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
        ghost.innerHTML = `<svg aria-hidden="true"><use href="#i-${drag.p}"/></svg>`;
        ghost.hidden = false;
        document.documentElement.classList.add('is-dragging');
        if (drag.from) drag.from.classList.add('is-lifted');
      }
      e.preventDefault();
      moveGhost(e.clientX, e.clientY);
      const t = cellAt(e.clientX, e.clientY);
      if (t !== drag.target) {
        drag.target && drag.target.classList.remove('is-target');
        drag.target = t;
        t && t.classList.add('is-target');
      }
    }
    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      if (!d.active) return;
      ghost.hidden = true;
      document.documentElement.classList.remove('is-dragging');
      d.from && d.from.classList.remove('is-lifted');
      d.target && d.target.classList.remove('is-target');
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      if (e.type === 'pointercancel') return;
      const t = d.target;
      if (t) {
        if (d.from && t === d.from) return;
        if (d.from) {
          const [r0, c0] = d.from.dataset.key.split(',').map(Number);
          const [r1, c1] = t.dataset.key.split(',').map(Number);
          plan.delete(d.from.dataset.key);
          plan.set(t.dataset.key, d.p);
          dirty();
          say(`${cap(PLANTS[d.p].name)} moved from ${cellName(r0, c0)} to ${cellName(r1, c1)}.${summary(render(t.dataset.key))}`);
        } else place(t.dataset.key, d.p);
      } else if (d.from) {
        remove(d.from.dataset.key);
      }
    }
    section.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    /* tools */
    const sunBtn = document.getElementById('sun-toggle');
    sunBtn.addEventListener('click', () => {
      const on = sunBtn.getAttribute('aria-pressed') !== 'true';
      sunBtn.setAttribute('aria-pressed', String(on));
      section.classList.toggle('sun-on', on);
      say(on ? 'Sun and shade shown: hatching marks shade, and each square shows its hours of sun.' : 'Sun and shade hidden.');
    });
    document.getElementById('plan-reset').addEventListener('click', () => {
      plan.clear();
      Object.entries(EXAMPLE).forEach(([k, p]) => plan.set(k, p));
      section.classList.remove('is-dirty');
      const res = render();
      say(`Example bed restored: ${plan.size} plants, ${res.fix} to fix.`);
    });
    document.getElementById('plan-clear').addEventListener('click', () => {
      plan.clear();
      dirty();
      render();
      say('Bed cleared.');
    });

    lastWarnCount = render().fix;
  }

  /* ---------- Seasons ---------- */
  const seasons = [...document.querySelectorAll('.season, .season-control')];
  const hemiBtns = [...document.querySelectorAll('.hemi__btn')];
  if (seasons.length) {
    const order = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'];
    const flip = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' };
    const setHemi = (h) => {
      hemiBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hemi === h)));
      let now = order[new Date().getMonth()];
      if (h === 'south') now = flip[now];
      seasons.forEach((s) => {
        s.classList.toggle('is-now', s.dataset.season === now);
        const m = s.querySelector('.season__months, .season-control__months');
        m.textContent = h === 'south' ? m.dataset.s : m.dataset.n;
      });
    };
    hemiBtns.forEach((b) => b.addEventListener('click', () => setHemi(b.dataset.hemi)));
    setHemi('north');
  }

  /* ---------- Waitlist ---------- */
  const form = document.getElementById('waitlist-form');
  if (form) {
    const email = form.querySelector('#wl-email');
    const err = form.querySelector('#wl-email-err');
    const done = document.getElementById('waitlist-done');
    const showErr = (msg) => {
      err.textContent = msg;
      err.hidden = !msg;
      email.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };
    email.addEventListener('input', () => { if (email.getAttribute('aria-invalid') === 'true' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) showErr(''); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = email.value.trim();
      if (!v) { showErr('We need an email to tell you when it’s your turn.'); email.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { showErr('That email looks a little off. Check for a missing @ or dot?'); email.focus(); return; }
      showErr('');
      document.getElementById('wl-echo').textContent = v;
      document.getElementById('wl-number').textContent = `#${(1200 + Math.floor(Math.random() * 300)).toLocaleString('en-GB')}`;
      done.style.minHeight = `${form.offsetHeight}px`;
      form.hidden = true;
      done.hidden = false;
      done.focus();
    });
  }

  /* ---------- Anchor clearance follows the floating toolbar ---------- */
  const toolbar = document.querySelector('.toolbar');
  if (toolbar) {
    const measureNav = () => document.documentElement.style.setProperty('--nav-clearance', `${Math.ceil(toolbar.getBoundingClientRect().bottom + 12)}px`);
    measureNav();
    if ('ResizeObserver' in window) new ResizeObserver(measureNav).observe(toolbar);
    window.addEventListener('resize', measureNav);
  }

  /* ---------- Toolbar menu ---------- */
  const menuBtn = document.querySelector('.toolbar__menu');
  const menu = document.getElementById('menu');
  if (menuBtn && menu) {
    const setMenu = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.textContent = open ? 'Close' : 'Menu';
      menu.classList.toggle('is-open', open);
      if (open) menu.querySelector('a').focus();
    };
    menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
    });
    document.addEventListener('pointerdown', (e) => {
      if (menu.classList.contains('is-open') && !menu.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
    });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
  }
})();
