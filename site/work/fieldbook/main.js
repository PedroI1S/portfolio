/* Fieldbook Type — the survey sheet is a working variable-font instrument. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = motion.matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Bare chrome, with a real small-screen index and hard theme cuts. */
  const head = $('.head');
  const menu = $('.head__menu');
  const closeMenu = () => { head.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); menu.textContent = '[ Index + ]'; };
  menu.addEventListener('click', () => {
    const open = head.classList.toggle('is-open');
    menu.setAttribute('aria-expanded', String(open));
    menu.textContent = open ? '[ Close − ]' : '[ Index + ]';
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); menu.focus(); } });
  $$('.index-nav a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('click', e => { if (!head.contains(e.target)) closeMenu(); });
  const themeButtons = $$('[data-theme-set]');
  const syncTheme = () => {
    themeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeSet === root.dataset.theme)));
    $('meta[name="theme-color"]').content = root.dataset.theme === 'dark' ? '#0f0f0f' : '#ffffff';
  };
  themeButtons.forEach(b => b.addEventListener('click', () => {
    root.dataset.theme = b.dataset.themeSet;
    try { localStorage.setItem('fieldbook-theme', root.dataset.theme); } catch (_) {}
    syncTheme();
  }));
  syncTheme();
  const reveal = $$('.mega, .band');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }));
    reveal.forEach(el => io.observe(el));
    const navIO = new IntersectionObserver(entries => entries.forEach(e => {
      const a = $(`.index-nav a[href="#${e.target.id}"]`);
      if (!a) return;
      if (e.isIntersecting) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    }), { rootMargin: '-10% 0px -65% 0px' });
    $$('main > section[id]').forEach(el => navIO.observe(el));
  } else reveal.forEach(el => el.classList.add('is-in'));

  /* Measure Archivo at the four design-space corners once. Interpolate its
     advance without layout reads, and damp the live axes in the same frame so
     width, fitted size and metric lines always travel together. */
  const field = $('.plot__field');
  const word = $('.plot__title text');
  const metrics = $$('.metric');
  const crosshair = $('.crosshair');
  const traverse = $('.plot__traverse');
  const polyline = $('polyline', traverse);
  const stationsGroup = $('g', traverse);
  const plotW = $('#plot-weight'), plotD = $('#plot-width');
  const weightOut = $('#plot-weight-out'), widthOut = $('#plot-width-out');
  const pause = $('.plot__pause');
  let fieldWidth = 0, fieldHeight = 0, fieldRect;
  let corners = [4.65, 5.15, 5.7, 6.25];
  let ratios = { ascender: .77, cap: .71, x: .53, descender: .20 };
  let plotWeight = 400, plotWidth = 100;
  let targetWeight = 400, targetWidth = 100, lastFrame = 0;
  let pointer = { x: .5, y: .45 }, manualUntil = 0, paused = false;
  let plotVisible = false, plotArrived = false, raf = 0, idleTimer = 0, dirty = true;
  let lastCut = '', stationNumber = 0;
  let stationPosition = { x: .5, y: .45 };
  const stations = [];
  let introStart = performance.now();
  let introDone = reduce;
  const svgNS = 'http://www.w3.org/2000/svg';
  function measureFont() {
    const probe = document.createElement('span');
    probe.textContent = 'FIELDBOOK';
    Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', fontFamily: 'Archivo, Arial, sans-serif', fontSize: '1000px', letterSpacing: '-.045em', lineHeight: '1' });
    document.body.append(probe);
    corners = [[100,62],[900,62],[100,125],[900,125]].map(([w,d]) => {
      probe.style.fontVariationSettings = `'wght' ${w}, 'wdth' ${d}`;
      return probe.getBoundingClientRect().width / 1000;
    });
    probe.remove();
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = '400 1000px Archivo, Arial, sans-serif';
    const mH = ctx.measureText('H'), mx = ctx.measureText('x'), mh = ctx.measureText('h'), mp = ctx.measureText('p');
    ratios = { ascender: mh.actualBoundingBoxAscent / 1000, cap: mH.actualBoundingBoxAscent / 1000, x: mx.actualBoundingBoxAscent / 1000, descender: mp.actualBoundingBoxDescent / 1000 };
    dirty = true; kick();
  }
  function measureField() {
    fieldRect = field.getBoundingClientRect(); fieldWidth = fieldRect.width; fieldHeight = fieldRect.height;
    dirty = true; kick();
  }
  function applyCut(w, d, force = false) {
    const key = `${w.toFixed(2)}/${d.toFixed(3)}`;
    plotWeight = w; plotWidth = d;
    if (key === lastCut && !force) return;
    lastCut = key;
    const u = (w - 100) / 800, v = (d - 62) / 63;
    const advance = (corners[0] * (1-u) + corners[1] * u) * (1-v)
      + (corners[2] * (1-u) + corners[3] * u) * v;
    const size = Math.min((fieldWidth - 2) * .985 / advance, (fieldHeight - 330) / (ratios.ascender + ratios.descender));
    const baseline = fieldHeight * (fieldWidth < 761 ? .46 : .59);
    word.style.fontSize = `${size}px`;
    word.style.letterSpacing = `${-.045*size}px`;
    word.style.fontVariationSettings = `'wght' ${w}, 'wdth' ${d}`;
    word.setAttribute('y', baseline);
    metrics.forEach(line => {
      const name = line.dataset.metric;
      const amount = name === 'baseline' ? 0 : size * ratios[name];
      const y = name === 'descender' ? baseline + amount : baseline - amount;
      line.style.setProperty('--line-y', `${y}px`);
      $('b', line).textContent = Math.round(amount);
    });
    weightOut.value = Math.round(w); widthOut.value = d.toFixed(1);
    // Preserve a focused range's position while its specimen eases toward it.
    if (document.activeElement !== plotW) plotW.value = Math.round(targetWeight);
    if (document.activeElement !== plotD) plotD.value = targetWidth;
    plotD.setAttribute('aria-valuetext', `${targetWidth.toFixed(1)} width units`);
    if (!reduce && introDone && Math.hypot(pointer.x-stationPosition.x,pointer.y-stationPosition.y) > .075) {
      stationPosition = { ...pointer }; addStation();
    }
  }
  function addStation() {
    const point = { x: pointer.x, y: pointer.y, n: (stationNumber = stationNumber % 99 + 1) };
    stations.push(point);
    if (stations.length > 12) { stations.shift(); stationsGroup.firstElementChild?.remove(); }
    const g = document.createElementNS(svgNS, 'g');
    const circle = document.createElementNS(svgNS, 'circle'); circle.setAttribute('r', '3');
    const label = document.createElementNS(svgNS, 'text'); label.textContent = String(point.n).padStart(2, '0');
    g.append(circle, label); stationsGroup.append(g);
    renderStations();
  }
  function renderStations() {
    polyline.setAttribute('points', stations.map(p => `${(p.x*fieldWidth).toFixed(1)},${(p.y*fieldHeight).toFixed(1)}`).join(' '));
    [...stationsGroup.children].forEach((g,i) => {
      const x = stations[i].x*fieldWidth, y = stations[i].y*fieldHeight;
      g.firstElementChild.setAttribute('cx', x); g.firstElementChild.setAttribute('cy', y);
      g.lastElementChild.setAttribute('x', x+6); g.lastElementChild.setAttribute('y', y-7);
    });
  }
  // Keep the intro's deliberate ease-in-out, with continuous variable axes.
  const easeIO = x => {
    const sx = t => 3*.785*(1-t)*(1-t)*t + 3*.15*(1-t)*t*t + t*t*t;
    let lo=0, hi=1, t=x;
    for(let i=0;i<16;i++) { if(sx(t)<x) lo=t; else hi=t; t=(lo+hi)/2; }
    return 3*.135*(1-t)*(1-t)*t + 3*.86*(1-t)*t*t + t*t*t;
  };
  function render(now) {
    raf = 0;
    if (!plotVisible || document.hidden) return;
    const dt = lastFrame ? Math.min(now-lastFrame,64) : 1000/60;
    lastFrame = now;
    const auto = !reduce && !paused && now >= manualUntil;
    let w = plotWeight, d = plotWidth;
    if (!introDone) {
      const t = clamp((now - introStart) / 1200, 0, 1);
      w = t < .55 ? 100 + 800 * easeIO(t/.55) : 900 - 500 * easeIO((t-.55)/.45);
      d = 100;
      if (t === 1) { introDone = true; w = 400; targetWeight = 400; targetWidth = 100; }
    } else {
      if (auto) {
        const t = (now-introStart-1200)/1000;
        const follow = 1-Math.exp(-dt/180);
        pointer.x += (.5+.44*Math.sin(t*.29)-pointer.x)*follow;
        pointer.y += (.46+.27*Math.sin(t*.41+.5)-pointer.y)*follow;
        targetWidth = 62+63*pointer.x;
        targetWeight = 100+800*pointer.y;
      }
      const follow = reduce ? 1 : 1-Math.exp(-dt/100);
      w += (targetWeight-w)*follow;
      d += (targetWidth-d)*follow;
      if (Math.abs(targetWeight-w) < .02) w=targetWeight;
      if (Math.abs(targetWidth-d) < .002) d=targetWidth;
    }
    applyCut(w,d,dirty);
    crosshair.style.setProperty('--pointer-x', `${(pointer.x*100).toFixed(2)}%`);
    crosshair.style.setProperty('--pointer-y', `${(pointer.y*100).toFixed(2)}%`);
    $('span',crosshair).textContent = String(stationNumber%99+1).padStart(2,'0');
    if (dirty) { renderStations(); dirty = false; }
    const settling = Math.abs(targetWeight-w) > .02 || Math.abs(targetWidth-d) > .002;
    if (auto || !introDone || settling) raf = requestAnimationFrame(render);
  }
  function kick() { if (!raf && plotVisible && !document.hidden) raf = requestAnimationFrame(render); }
  function manual(w,d) {
    introDone = true; manualUntil = performance.now()+3000;
    targetWeight=w; targetWidth=d; kick();
    clearTimeout(idleTimer);
    if (!reduce && !paused) idleTimer = setTimeout(kick, 3020);
  }
  field.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const rect = field.getBoundingClientRect();
    pointer = { x: clamp((e.clientX-rect.left)/fieldWidth,0,1), y: clamp((e.clientY-rect.top)/fieldHeight,0,1) };
    // Only writes happen in rAF, even when input events arrive faster than a frame.
    manualUntil = performance.now()+3000; introDone = true;
    targetWeight = 100+800*pointer.y;
    targetWidth = 62+63*pointer.x;
    clearTimeout(idleTimer); if (!reduce && !paused) idleTimer=setTimeout(kick,3020);
    kick();
  });
  [plotW,plotD].forEach(el => el.addEventListener('input', () => {
    const w = +plotW.value, d = +plotD.value;
    pointer = { x:(d-62)/63, y:(w-100)/800 }; manual(w,d);
  }));
  pause.addEventListener('click', () => {
    paused = !paused; introDone = true;
    pause.setAttribute('aria-pressed',String(paused));
    pause.textContent = paused ? '[ Resume plot ]' : '[ Pause plot ]';
    kick();
  });
  function suspendPlot() {
    cancelAnimationFrame(raf); raf=0; lastFrame=0; clearTimeout(idleTimer);
  }
  if ('ResizeObserver' in window) new ResizeObserver(measureField).observe(field);
  else addEventListener('resize',measureField);
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => {
    plotVisible=e.isIntersecting;
    if (plotVisible) {
      if (!plotArrived) {
        plotArrived=true; introStart=performance.now();
        field.closest('.plot').classList.add('is-in');
      }
      kick();
    } else suspendPlot();
  }).observe(field);
  else { plotVisible=true; field.closest('.plot').classList.add('is-in'); }

  document.addEventListener('visibilitychange', () => { if (document.hidden) suspendPlot(); else kick(); });
  measureField(); measureFont();
  // Loading only Archivo improves the measurement; it never gates the heading or intro.
  if (document.fonts) {
    document.fonts.load('400 1000px Archivo', 'FIELDBOOK').then(measureFont).catch(() => {});
    document.fonts.addEventListener('loadingdone',measureFont);
  }
  motion.addEventListener('change', e => {
    reduce=e.matches; introDone=true; suspendPlot();
    if (reduce) { targetWeight=plotWeight=400; targetWidth=plotWidth=100; dirty=true; }
    kick();
  });

  /* P3: the ink room carries the last measured Plot weight. */
  const tester=$('#tester'), tList=$('.tester__list'), tInput=$('#tt-text'), tSize=$('#tt-size'), tW=$('#tt-wght');
  const tLines=$$('.tline'), defaultText=tInput.value;
  const defaultSize=()=>Math.min(260,Math.round(innerWidth*.18));
  let testerTouched=false, testerEntered=false;
  tSize.value=defaultSize();
  function updateTester() {
    const empty=!tInput.value.trim(), text=empty?defaultText:tInput.value, size=+tSize.value, w=+tW.value;
    $('#tt-size-out').value=size; $('#tt-wght-out').value=w;
    tSize.setAttribute('aria-valuetext',`${size} pixels`);
    tList.style.setProperty('--tt-size',`${size}px`);
    tLines.forEach(l=>{
      const mn=+l.dataset.wmin,mx=+l.dataset.wmax,ww=clamp(w,mn,mx),t=$('.tline__text',l);
      t.textContent=text;t.style.fontWeight=ww;t.style.color=empty?'var(--fg-2)':'';
      $('.tline__w',l).textContent=mn===mx?`${mn} only`:`wght ${ww}`;
    });
  }
  [tInput,tSize,tW].forEach(el=>el.addEventListener('input',()=>{testerTouched=true;updateTester();}));
  function inheritPlot() { if(!testerTouched){tW.value=Math.round(plotWeight);updateTester();} }
  if('IntersectionObserver' in window)new IntersectionObserver(([e])=>{
    if(e.isIntersecting&&!testerEntered){inheritPlot();testerEntered=true;}
  }).observe(tester);
  $('.tester__reset').addEventListener('click',()=>{
    tInput.value=defaultText;tSize.value=defaultSize();tW.value=400;testerTouched=true;
    tLines.forEach((l,i)=>{l.classList.remove('is-picked');l.classList.toggle('is-featured',i===0);});updateTester();$('#tt-status').textContent='Tester reset.';
  });
  updateTester();
  addEventListener('resize',()=>{if(!testerTouched){tSize.value=defaultSize();updateTester();}});
  function pickFamily(fam) {
    const line=tLines.find(l=>l.dataset.family===fam);if(!line)return;
    inheritPlot();testerEntered=true;
    tLines.forEach(l=>{l.classList.toggle('is-picked',l===line);l.classList.toggle('is-featured',l===line);});
    line.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});
    if(finePointer||document.activeElement?.matches('.card__btn,.ledger__act a'))tInput.focus({preventScroll:true});
    $('#tt-status').textContent=`${$('.tline__name',line).textContent} is highlighted in the tester. Type to try it.`;
  }
  $$('.ledger__act a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();pickFamily(a.dataset.family);}));
  $$('.ledger tbody tr').forEach(tr=>tr.addEventListener('click',e=>{if(!e.target.closest('a')&&!String(getSelection()))pickFamily(tr.dataset.family);}));


  (() => {
  const lerp = (a,b,t) => a+(b-a)*t;
  const nearestAngle = (target,ref) => target+360*Math.round((ref-target)/360);
  function mulberry32(a) { return () => { a|=0; a=(a+0x6d2b79f5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
  /* ---------- 01 Specimen cloud (CSS 3D) ---------- */
  const specimens = $('#specimens');
  const stage = $('.stage');
  const figLabel = $('.stage__fig');
  const cloud = $('.cloud', stage);
  const cards = $$('.card', cloud);
  const links = cards.map((c) => $('.card__btn', c));
  links.forEach((a,i) => a.tabIndex = i ? -1 : 0);
  const N = cards.length;
  const R = 600;                 // ring radius; the cloud is pushed back so the front card sits on the screen plane
  const PERSPECTIVE = 1800;
  const CW = 150, CH = 200, GAP = 16;

  // Scatter: a jittered 6 x 2 x 2 lattice, shuffled, so cards spread without clumping
  const rng = mulberry32(2019);
  const cells = [];
  for (let l = 0; l < 2; l++) for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) cells.push({ c, r, l });
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const SCATTER = cells.map(({ c, r, l }) => ({
    x: (c - 2.5) * 215 + (l ? 70 : -70) + (rng() - 0.5) * 60,
    y: (r - 0.5) * 250 + (rng() - 0.5) * 70,
    z: (l - 0.5) * 520 + (rng() - 0.5) * 120,
    ry: (rng() * 2 - 1) * 28,
    rx: (rng() * 2 - 1) * 14,
    rz: (rng() * 2 - 1) * 7,
  }));

  const rad = Math.PI / 180;
  const FORMATIONS = {
    ring: (i) => { const a = (i / N) * 360; return { x: R * Math.sin(a * rad), y: 0, z: R * Math.cos(a * rad), ry: a, rx: 0, rz: 0 }; },
    // 8 columns = 8 families, 3 rows = 3 cuts each
    grid: (i) => { const cols = stageW <= 760 ? 3 : 8; return { x: ((i % cols) - (cols-1)/2) * (CW+GAP), y: (Math.floor(i/cols) - (Math.ceil(N/cols)-1)/2) * (CH+GAP), z: R, ry: 0, rx: 0, rz: 0 }; },
    // one and a half turns, rising 20px a card
    spiral: (i) => { const a = i * 22.5, r = 420; return { x: r * Math.sin(a * rad), y: (i - (N - 1) / 2) * 20, z: r * Math.cos(a * rad), ry: a, rx: 0, rz: 0 }; },
    scatter: (i) => ({ ...SCATTER[i] }),
  };
  // per-formation camera: tilt (deg), push-back (px) and idle spin (deg/s)
  // w: the formation's on-screen width at scale 1, used to fit it to narrower stages
  const VIEW = {
    ring: { tilt: -15, dz: -R, spin: 5, w: 1060 },
    grid: { tilt: 0, dz: -R, spin: 0, w: 1340 },
    spiral: { tilt: -8, dz: -460, spin: 7, w: 1000 },
    scatter: { tilt: -3, dz: -360, spin: 2.5, w: 1340 },
  };
  const DUR = 1200, STAGGER = 18;

  let is3d = false, visible = true, raf = 0, last = 0;
  let formation = 'ring';
  let cur = cards.map((_, i) => FORMATIONS.ring(i));
  let theta = 0, tilt = VIEW.ring.tilt, dz = VIEW.ring.dz, scale = 1;
  let spin = 0, vel = 0, aim = null, morph = null;
  let paused = false, dragging = false, hoverHold = false, focusHold = false;
  const back = new Array(N).fill(false);
  const alpha = new Array(N).fill(1);

  const rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };
  const rotX = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };

  function render() {
    const th = theta * rad, tl = tilt * rad;
    stage.style.setProperty('--gallery-scale', scale.toFixed(3));
    cloud.style.transform = `translateZ(${(dz * scale).toFixed(1)}px) rotateX(${tilt.toFixed(2)}deg) rotateY(${theta.toFixed(2)}deg) scale3d(${scale.toFixed(3)}, ${scale.toFixed(3)}, ${scale.toFixed(3)})`;
    for (let i = 0; i < N; i++) {
      const p = cur[i];
      cards[i].style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, ${p.z.toFixed(1)}px) rotateY(${p.ry.toFixed(2)}deg) rotateX(${p.rx.toFixed(2)}deg) rotateZ(${p.rz.toFixed(2)}deg)`;
      // where the card ends up, and which way it faces, to pick its face and fade it with depth
      let pos = rotX(rotY([p.x * scale, p.y * scale, p.z * scale], th), tl);
      pos = [pos[0], pos[1], pos[2] + dz * scale];
      const n = rotX(rotY(rotY(rotX([0, 0, 1], p.rx * rad), p.ry * rad), th), tl);
      const facing = n[0] * -pos[0] + n[1] * -pos[1] + n[2] * (PERSPECTIVE - pos[2]) > 0;
      if (back[i] === facing) { back[i] = !facing; cards[i].classList.toggle('is-back', !facing); }
      const o = clamp(1 + pos[2] / (1500 * Math.max(scale, 0.6)), 0.28, 1);
      if (Math.abs(o - alpha[i]) > 0.01) { alpha[i] = o; cards[i].style.opacity = o >= 0.999 ? '' : o.toFixed(2); }
    }
  }

  function frame(now) {
    raf = 0;
    if (!is3d || !visible || document.hidden) return;
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    const view = VIEW[formation];
    const hold = paused || reduce || hoverHold || focusHold || dragging;
    const want = hold ? 0 : view.spin;
    spin += (want - spin) * Math.min(1, dt * 2.5);
    if (want === 0 && Math.abs(spin) < 0.01) spin = 0;

    if (!dragging) {
      theta += (spin + vel) * dt;
      vel *= Math.pow(0.04, dt);
      if (Math.abs(vel) < 0.05) vel = 0;
    }
    if (aim !== null && !dragging) {
      theta += (aim - theta) * (reduce ? 1 : Math.min(1, dt * 6));
      if (Math.abs(aim - theta) < 0.05) { theta = aim; aim = null; }
    }
    let settling = false;
    if (formation === 'grid' && !dragging && !morph && aim === null) {
      const home = nearestAngle(0, theta);
      vel = 0;
      if (Math.abs(home - theta) > 0.05) { theta += (home - theta) * Math.min(1, dt * 5); settling = true; } else theta = home;
    }
    if (morph) {
      const el = now - morph.t0;
      let doneAll = true;
      for (let i = 0; i < N; i++) {
        const t = clamp((el - i * STAGGER) / DUR, 0, 1);
        if (t < 1) doneAll = false;
        const e = easeIO(t), a = morph.from[i], b = morph.to[i];
        cur[i] = { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), z: lerp(a.z, b.z, e), ry: lerp(a.ry, b.ry, e), rx: lerp(a.rx, b.rx, e), rz: lerp(a.rz, b.rz, e) };
      }
      const g = easeIO(clamp(el / (DUR + N * STAGGER), 0, 1));
      tilt = lerp(morph.tilt0, morph.tilt1, g);
      dz = lerp(morph.dz0, morph.dz1, g);
      scale = lerp(morph.s0, morph.s1, g);
      if (morph.theta1 !== null) theta = lerp(morph.theta0, morph.theta1, g);
      if (doneAll) morph = null;
    }
    render();
    const moving = morph || dragging || settling || spin !== 0 || want !== 0 || vel !== 0 || aim !== null;
    if (moving && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (raf || !is3d || !visible || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const fBtns = $$('.formations button');
  function setFormation(name, instant) {
    const phoneGrid = name === 'grid' && stage.clientWidth <= 760;
    stage.classList.toggle('is-phone-grid', phoneGrid);
    stage.style.height = phoneGrid ? `${Math.ceil(stage.clientWidth / 3 * (CH/CW) * 8 + 140)}px` : '';
    measure();
    const to = cards.map((_, i) => {
      const p = FORMATIONS[name](i);
      p.ry = nearestAngle(p.ry, cur[i].ry);   // turn the short way round
      return p;
    });
    const theta1 = name === 'grid' ? nearestAngle(0, theta) : null;
    formation = name;
    stage.dataset.formation = name;
    if (figLabel) figLabel.textContent = name[0].toUpperCase() + name.slice(1);
    fBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.formation === name)));
    aim = null;
    if (instant || reduce) {
      cur = to;
      tilt = VIEW[name].tilt;
      dz = VIEW[name].dz;
      scale = fitScale(name);
      if (theta1 !== null) theta = theta1;
      morph = null;
      if (is3d) render();
    } else {
      morph = { from: cur.map((p) => ({ ...p })), to, t0: performance.now(), tilt0: tilt, tilt1: VIEW[name].tilt, dz0: dz, dz1: VIEW[name].dz, s0: scale, s1: fitScale(name), theta0: theta, theta1 };
    }
    kick();
  }
  fBtns.forEach((b) => b.addEventListener('click', () => { if (b.dataset.formation !== formation) setFormation(b.dataset.formation); }));

  const pauseBtn = $('.stage__pause');
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    kick();
  });
  const syncPauseVisibility = () => { pauseBtn.hidden = reduce; };
  syncPauseVisibility();

  let stageW = 1400, stageH = 800;
  function measure() {
    stageW = stage.clientWidth;
    stageH = stage.clientHeight;
  }
  // fit a formation around the cloud origin (42% down); every formation stays within +-316px vertically
  const fitScale = (name) => {
    const cols = stageW <= 760 ? 3 : 8;
    const span = name === 'grid' ? cols*(CW+GAP)-GAP : VIEW[name].w;
    const extent = name === 'grid' ? (Math.ceil(N/cols)-1)*(CH+GAP)/2+CH/2 : 316;
    return clamp(Math.min((stageW-40)/span,(stageH*.42-14)/extent,(stageH*.58-40)/extent),.18,1.3);
  };

  // Drag (or swipe) to turn. Capture only once the pointer has really moved, so taps still click cards.
  let drag = null, lastDragEnd = 0;
  stage.addEventListener('pointerdown', (e) => {
    if (!is3d || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('.stage__corner')) return;
    drag = { id: e.pointerId, x0: e.clientX, x: e.clientX, t: e.timeStamp, captured: false };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.captured && Math.abs(e.clientX - drag.x0) > 6) {
      drag.captured = true;
      dragging = true;
      aim = null;
      vel = 0;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      stage.classList.add('is-dragging');
    }
    if (drag.captured) {
      const dtm = Math.max(8, e.timeStamp - drag.t);
      const d = dx * 0.2 / Math.max(scale, 0.6);
      theta += d;
      vel = vel * 0.5 + (d / dtm) * 1000 * 0.5;
      render();
      kick();
    }
    drag.x = e.clientX;
    drag.t = e.timeStamp;
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.captured) {
      lastDragEnd = performance.now();
      if (reduce || e.timeStamp - drag.t > 90) vel = 0;
      vel = clamp(vel, -240, 240);
    }
    drag = null;
    dragging = false;
    stage.classList.remove('is-dragging');
    kick();
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  // Hovering a card stops the turn so it can be clicked
  cloud.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    hoverHold = !!e.target.closest('.card');
    kick();
  });
  cloud.addEventListener('pointerout', (e) => {
    const to = e.relatedTarget;
    if (!to || !to.closest || !to.closest('.card')) { hoverHold = false; kick(); }
  });

  cloud.addEventListener('click', (e) => {
    const a = e.target.closest('.card__btn');
    if (!a) return;
    e.preventDefault();
    if (performance.now() - lastDragEnd < 120) return;
    pickFamily(a.dataset.family);
  });

  // Roving focus: one tab stop for the whole cloud, arrow keys between cards
  let current = 0;
  function aimAt(i) {
    if (!is3d || formation === 'grid') return;
    const p = morph ? morph.to[i] : cur[i];
    const a = Math.atan2(p.x, p.z) / rad;
    aim = nearestAngle(-a, theta);
  }
  cloud.addEventListener('keydown', (e) => {
    const i = links.indexOf(document.activeElement);
    if (i < 0) return;
    let j = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % N;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + N) % N;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = N - 1;
    if (j === null) return;
    e.preventDefault();
    links[j].focus({ preventScroll: is3d });
  });
  cloud.addEventListener('focusin', (e) => {
    const i = links.indexOf(e.target);
    if (i < 0) return;
    if (i !== current) { links[current].tabIndex = -1; current = i; links[i].tabIndex = 0; }
    focusHold = true;
    if (e.target.matches(':focus-visible')) aimAt(i);
    kick();
  });
  cloud.addEventListener('focusout', (e) => {
    if (!cloud.contains(e.relatedTarget)) { focusHold = false; kick(); }
  });

  function enter3d() {
    is3d = true;
    stage.classList.add('is-3d');
    specimens.classList.add('is-3d');
    measure();
    setFormation(formation, true);
    render();
    kick();
  }
  function exit3d() {
    is3d = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    stage.classList.remove('is-3d', 'is-dragging', 'is-phone-grid');
    stage.style.height = '';
    specimens.classList.remove('is-3d');
    cloud.style.transform = '';
    cards.forEach((c, i) => { c.style.transform = ''; c.style.opacity = ''; c.classList.remove('is-back'); back[i] = false; alpha[i] = 1; });
  }
  const sync3d = () => (reduce ? exit3d() : enter3d());
  sync3d();

  let stageTimer;
  window.addEventListener('resize', () => {
    clearTimeout(stageTimer);
    stageTimer = setTimeout(() => {
      if (!is3d || !visible || document.hidden) return;
      measure();
      setFormation(formation, true);
      render();
      kick();
    }, 120);
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); else { cancelAnimationFrame(raf); raf=0; } }).observe(stage);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf=0; } else kick(); });
  motion.addEventListener('change', () => { syncPauseVisibility(); sync3d(); });

  })();

  /* ---------- Licensing: copy the email ---------- */
  const copyBtn = $('.copy');
  const copyStatus = $('#copy-status');
  if (copyBtn) {
    let copyTimer;
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(copyBtn.dataset.copy);
        copyBtn.textContent = '[ Copied ]';
        copyStatus.textContent = 'Email address copied.';
      } catch (err) {
        // no clipboard access: select the address so it can be copied by hand
        const link = copyBtn.previousElementSibling;
        const range = document.createRange();
        range.selectNodeContents(link);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        copyBtn.textContent = '[ Selected ]';
        copyStatus.textContent = 'Email address selected. Copy it with your keyboard.';
      }
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { copyBtn.textContent = '[ Copy ]'; }, 2400);
    });
  }

  /* ---------- Letters: front-end only ---------- */
  const form = $('.news');
  const email = $('#nl-email');
  const msg = $('#nl-msg');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = email.value.trim();
    const ok = email.checkValidity() && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    if (!ok) {
      form.classList.add('is-error');
      email.setAttribute('aria-invalid', 'true');
      msg.textContent = v ? 'That address looks unfinished. Check the @ and the domain.' : 'Add an email address first.';
      email.focus();
      return;
    }
    form.classList.remove('is-error');
    email.removeAttribute('aria-invalid');
    form.classList.add('is-done');
    msg.innerHTML = 'Noted. The winter letter goes out in early January.<small>This is a concept site: nothing was sent or stored.</small>';
    msg.setAttribute('tabindex', '-1');
    msg.focus();
  });
  email.addEventListener('input', () => {
    if (!form.classList.contains('is-error')) return;
    form.classList.remove('is-error');
    email.removeAttribute('aria-invalid');
    msg.textContent = '';
  });

  /* ---------- Grid overlay: press G ---------- */
  const gridlines = $('.gridlines');
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'g' && e.key !== 'G') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    gridlines.classList.toggle('is-on');
  });
})();
