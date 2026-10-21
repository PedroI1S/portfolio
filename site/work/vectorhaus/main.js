/* Vectorhaus — Glass / Gradient Tech concept
   Accessible command palette, scroll reveals and word scrub, bento vignettes
   (typed deploy log, latency chart, eleven warm pools, interactive dot globe,
   scale-to-zero chart), code tabs with copy, pricing calculator. */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Calls back with true/false as an element enters or leaves the viewport.
  const watch = (el, cb, opts) => {
    if (!el) return;
    if (!hasIO) { cb(true); return; }
    new IntersectionObserver(([e]) => cb(e.isIntersecting), opts).observe(el);
  };

  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Header ---------- */
  const header = $('.header');
  let scrollTick = false;
  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
    scrubStatements();
    window.vectorhausField?.updateScene();
    scrollTick = false;
  };
  window.addEventListener('scroll', () => {
    if (!scrollTick) { scrollTick = true; requestAnimationFrame(onScroll); }
  }, { passive: true });

  /* ---------- Command palette ---------- */
  const dialog = $('#commands'), trigger = $('.command-trigger');
  let returnFocus = null;
  const openCommands = () => {
    if (dialog.open) return;
    returnFocus = document.activeElement;
    dialog.showModal();
    document.body.classList.add('has-dialog');
    $('nav a', dialog).focus();
  };
  const closeCommands = () => dialog.close();
  trigger.addEventListener('click', openCommands);
  $('.commands__close').addEventListener('click', closeCommands);
  dialog.addEventListener('close', () => {
    document.body.classList.remove('has-dialog');
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', e => {
    if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeCommands(); }
    if (e.target.closest('nav a')) closeCommands();
  });
  document.addEventListener('keydown', e => {
    const editing = e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !editing)) { e.preventDefault(); openCommands(); }
    if (!dialog.open || e.key !== 'Tab') return;
    const focusable = $$('a[href],button:not([disabled])', dialog);
    const first = focusable[0], last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $('.commands__install').addEventListener('click', async () => {
    let ok = false;
    try { await navigator.clipboard.writeText('pip install vectorhaus'); ok = true; }
    catch {
      const text = document.createElement('textarea'); text.value = 'pip install vectorhaus';
      text.style.cssText = 'position:fixed;opacity:0'; dialog.append(text); text.select();
      try { ok = document.execCommand('copy'); } catch {}
      text.remove(); $('.commands__install').focus();
    }
    $('.commands__status').textContent = ok ? 'Copied pip install vectorhaus to the clipboard.' : 'Select and copy: pip install vectorhaus';
  });

  /* ---------- Reveals ---------- */
  $$('.bento .tile').forEach((t, i) => t.style.setProperty('--delay', `${(i < 2 ? i : i - 2) * 90}ms`));
  $$('.steps li').forEach((li, i) => li.style.setProperty('--delay', `${i * 90}ms`));
  const revealTargets = $$('[data-reveal]');
  if (reduceMotion || !hasIO) {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealTargets.forEach((el) => io.observe(el));
  }

  /* ---------- Statement word scrub ---------- */
  const statements = $$('[data-scrub]');
  const scrubWords = [];
  if (!reduceMotion) {
    statements.forEach((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const s = document.createElement('span');
          s.className = 'sw';
          s.textContent = part;
          frag.append(s);
          scrubWords.push(s);
        });
        node.replaceWith(frag);
      });
    });
  }
  function scrubStatements() {
    if (!scrubWords.length) return;
    const line = window.innerHeight * 0.6;
    for (const w of scrubWords) {
      const top = w.getBoundingClientRect().top;
      w.classList.toggle('is-lit', top < line);
    }
  }
  onScroll();
  window.addEventListener('resize', scrubStatements);

  /* ---------- Glass hover highlight ---------- */
  if (finePointer) {
    $$('.tile').forEach((tile) => {
      tile.addEventListener('pointermove', (e) => {
        const r = tile.getBoundingClientRect();
        tile.style.setProperty('--mx', `${e.clientX - r.left}px`);
        tile.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  /* ---------- Deploy: type once; time stops outside the viewport ---------- */
  const termCode = $('.term__body code');
  if (termCode && !reduceMotion && innerWidth >= 700) {
    const tile = termCode.closest('.tile');
    const lines = $$('.ln', termCode).map(line => line.cloneNode(true));
    const original = lines.map(line => line.cloneNode(true));
    const pre = termCode.parentElement;
    pre.style.minHeight = `${pre.offsetHeight}px`;
    let elapsed = 0, last = 0, raf = 0, visible = false, done = false;
    const prompt = $('.t-prompt', lines[0]).cloneNode(true);
    const command = lines[0].textContent.slice(prompt.textContent.length);
    const typed = document.createElement('span');
    termCode.replaceChildren(prompt, typed);
    let shownLines = 0;
    const frame = now => {
      elapsed += last ? Math.min(now - last, 60) : 0; last = now;
      typed.textContent = command.slice(0, Math.floor(Math.max(0, elapsed - 200) / 22));
      const count = clamp(Math.floor((elapsed - command.length * 22 - 350) / 350), 0, lines.length - 1);
      while (shownLines < count) { shownLines++; termCode.append('\n', lines[shownLines]); }
      if (shownLines === lines.length - 1) { done = true; termCode.replaceChildren(); original.forEach((line, i) => { if (i) termCode.append('\n'); termCode.append(line); }); return; }
      raf = requestAnimationFrame(frame);
    };
    const sync = () => { cancelAnimationFrame(raf); last = 0; if (visible && !document.hidden && !done) raf = requestAnimationFrame(frame); };
    watch(tile, v => { visible = v; sync(); });
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('resize', () => {
      if (innerWidth >= 700 || done) return;
      done = true; cancelAnimationFrame(raf); pre.style.minHeight = '';
      termCode.replaceChildren();
      original.forEach((line, i) => { if (i) termCode.append('\n'); termCode.append(line); });
    });
  }

  // CSS vignette loops obey the same visibility rules as the field.
  $$('.tile--warm, .tile--route').forEach(tile => {
    let visible = false;
    const sync = () => tile.classList.toggle('is-animating', visible && !document.hidden && !reduceMotion);
    watch(tile, v => { visible = v; sync(); });
    document.addEventListener('visibilitychange', sync);
  });

  /* ---------- Observe: latency chart ---------- */
  const lat = $('.lat');
  if (lat) {
    const tile = lat.closest('.tile');
    const N = 48, W = 400, H = 160, MAX = 450;
    const rand = mulberry32(7);
    const p50 = [], p90 = [];
    let phase = 0;
    const next = () => {
      phase++;
      const base = 176 + 9 * Math.sin(phase / 6.5) + (rand() - 0.5) * 16;
      const spike = rand() > 0.93 ? 70 + rand() * 50 : 0;
      p50.push(base);
      p90.push(base + 112 + 14 * Math.sin(phase / 4.3) + (rand() - 0.5) * 34 + spike);
      if (p50.length > N) { p50.shift(); p90.shift(); }
    };
    for (let i = 0; i < N; i++) next();

    const y = (v) => H - (clamp(v, 0, MAX) / MAX) * H;
    const path = (arr) => {
      let d = '';
      arr.forEach((v, i) => {
        const x = (i / (N - 1)) * W;
        d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y(v).toFixed(1)}`;
      });
      return d;
    };
    const lineP50 = $('[data-line="p50"]', lat), lineP90 = $('[data-line="p90"]', lat), area = $('.lat__area', lat);
    const dot50 = $('.lat__dot--p50', lat), dot90 = $('.lat__dot--p90', lat);
    const read50 = $('[data-read="p50"]', lat), read90 = $('[data-read="p90"]', lat);
    const render = () => {
      const d50 = path(p50);
      lineP50.setAttribute('d', d50);
      lineP90.setAttribute('d', path(p90));
      area.setAttribute('d', `${d50}L${W} ${H}L0 ${H}Z`);
      const v50 = p50[N - 1], v90 = p90[N - 1];
      dot50.style.top = `${(y(v50) / H) * 100}%`;
      dot90.style.top = `${(y(v90) / H) * 100}%`;
      read50.textContent = `${Math.round(v50)} ms`;
      read90.textContent = `${Math.round(v90)} ms`;
    };
    render();

    $$('.pchip', lat).forEach((chip) => {
      chip.addEventListener('click', () => {
        const on = chip.getAttribute('aria-pressed') !== 'true';
        chip.setAttribute('aria-pressed', String(on));
        lat.classList.toggle(`hide-${chip.dataset.series}`, !on);
      });
    });

    if (!reduceMotion) {
      let timer = 0;
      const tick = () => { if (!document.hidden) { next(); render(); } };
      watch(tile, (v) => {
        clearInterval(timer);
        if (v) timer = setInterval(tick, 1600);
      });
    }
  }

  /* ---------- Route: dot globe ---------- */
  const globe = $('.globe__svg');
  if (globe) {
    const tile = globe.closest('.tile');
    // Coarse continent outlines as [lon, lat] (Antarctica left out: at this tilt it reads as a rim artifact).
    // Even-odd fill, so inland seas listed after their continent (Baltic, Black Sea, Caspian) cut holes.
    const LAND = [
      [[-168,65.6],[-163,69.5],[-156,71.3],[-148,70.3],[-140,69.6],[-130,70],[-122,69.5],[-115,68.5],[-108,68.2],[-98,68.5],[-94,71.5],[-86,69.5],[-82,66.5],[-86,64],[-93,61.5],[-94.5,58.5],[-92,57],[-85,55.3],[-82.3,52.5],[-79.5,51.5],[-78.8,55],[-77,58.5],[-77.5,61.5],[-73,62.2],[-70,60],[-65,60.3],[-61.5,56.5],[-57,52.5],[-55.6,51.3],[-59.5,48],[-64.5,48.8],[-66,45],[-70,43.7],[-70.5,41.8],[-74,40.6],[-75.5,38.5],[-76.3,35.5],[-78.5,33.8],[-81,31.5],[-80.2,27],[-80.3,25.3],[-81.7,25.9],[-82.7,28.5],[-84,30],[-86.5,30.4],[-89.5,30.2],[-90.5,29.1],[-94,29.6],[-97.2,27.8],[-97.6,24.5],[-97.5,21.5],[-96.3,19.3],[-94.5,18.2],[-91.5,18.5],[-90.5,21],[-87.5,21.5],[-87.6,19],[-88.3,16],[-86,15.9],[-83.3,15],[-83.6,11.5],[-81.7,9],[-79.5,9.5],[-77.4,8.6],[-78.5,7.6],[-80.5,7.3],[-81.5,8.2],[-84.8,9.8],[-85.8,11.5],[-87.5,13.1],[-91.5,14],[-94,16.1],[-96.5,15.7],[-100,17],[-104.5,19.2],[-105.6,21.5],[-105.8,23.5],[-108.5,25.5],[-111,28],[-112.8,30.5],[-114.7,31.5],[-112.5,28.5],[-110.3,24.2],[-109.5,23.1],[-112,24.8],[-114.2,28],[-115.7,30.5],[-117.1,32.6],[-118.5,34],[-120.6,34.6],[-122.4,37.2],[-123.8,39.5],[-124.3,42],[-124,46.2],[-124.7,48.4],[-123,49],[-125.5,50.5],[-128,52],[-130.3,54.5],[-133,57],[-136.5,58.5],[-140,59.7],[-145,60.4],[-148.5,59.8],[-151.8,59.2],[-154,57.5],[-156.5,56.3],[-160,55.3],[-162.5,55],[-158,58.6],[-161.8,58.8],[-162.3,60.2],[-165.3,61.5],[-164.5,63.2],[-161,64.5],[-165,64.5]],
      [[-88,73.5],[-80,73.8],[-75,72.5],[-70,70.8],[-67,69.4],[-62,66.8],[-63.5,64.8],[-65.5,62.5],[-70,62.7],[-74.5,64.2],[-78,64.6],[-73.5,66.5],[-74,68],[-80,69.8],[-86,70]],
      [[-92,76.5],[-80,76.2],[-77,78.5],[-73,79.5],[-63,81.8],[-70,82.8],[-80,83],[-90,81.5],[-96,79],[-97,77]],
      [[-125,71.8],[-123,74.3],[-115,75.5],[-105,73.5],[-101,72.8],[-101,69.5],[-106,68.8],[-113,68.4],[-118,69],[-118,70.8]],
      [[-73,78.2],[-66,80.5],[-60,81.8],[-45,82.6],[-30,83.5],[-20,82],[-17,80],[-18.5,77],[-19,74],[-22,71.5],[-23,70],[-26,68.5],[-32,68],[-37,65.8],[-40.5,65],[-42.5,62.5],[-44,60],[-48,61],[-50,62.8],[-52,64.5],[-53.5,67],[-54.5,69.5],[-55,71.5],[-57,74.5],[-61,76],[-68,76.5]],
      [[-24,65.5],[-22,66.4],[-18,66.2],[-14.5,66.1],[-13.5,65],[-15,64.3],[-18.5,63.4],[-22.5,63.8]],
      [[-84.9,21.9],[-82,23.2],[-80,23.1],[-77.2,21.6],[-74.2,20.2],[-77.6,19.8],[-81.8,22.2]],
      [[-74.4,18.6],[-72.8,19.9],[-69.9,19.7],[-68.4,18.6],[-71.4,17.6],[-74.4,18.3]],
      [[-77.3,8.6],[-75.5,10.8],[-71.6,12.4],[-70,11.5],[-68,10.6],[-64,10.6],[-61.5,10.6],[-60,8.5],[-57,6],[-53,5.6],[-51,4],[-50,1.5],[-49,-0.5],[-44.5,-2.3],[-41,-2.9],[-37.5,-4.6],[-35.2,-5.4],[-34.8,-7.5],[-35.3,-9.5],[-37.2,-11.5],[-38.9,-13.5],[-39.1,-17.5],[-40.2,-20.5],[-41.8,-22.8],[-44.5,-23.3],[-47.5,-24.9],[-48.6,-28],[-50.2,-30.5],[-52.5,-33.5],[-54,-34.8],[-56.5,-36.4],[-57.6,-38.2],[-62,-39],[-62.3,-40.8],[-65,-41],[-64.5,-42.6],[-65.5,-45],[-67.5,-46.5],[-66,-48],[-68.5,-50.5],[-69,-52.3],[-68.4,-54],[-66.5,-55],[-70,-55.3],[-73,-53.5],[-74.7,-51],[-75.5,-48],[-74,-44],[-73.6,-40],[-73.4,-37.2],[-71.7,-33],[-71.4,-29],[-70.5,-25],[-70.2,-20],[-70.4,-18.4],[-73,-16.5],[-76.2,-13.8],[-77.5,-11],[-79.5,-7.5],[-81.2,-5.6],[-80.4,-3.5],[-80.9,-1.5],[-80,0.8],[-78.8,1.8],[-77.8,3.8],[-77.3,6],[-77.8,7.4]],
      [[-5.9,35.8],[-6.8,34],[-9.6,30.4],[-10,29],[-13.2,27.6],[-14.5,26],[-16.5,23.8],[-17,21],[-16.3,19.3],[-16.5,16],[-17.4,14.7],[-16.8,13.2],[-16.7,12.3],[-15,11],[-13.5,9.5],[-12.4,7.4],[-10.5,6.3],[-7.6,4.4],[-5,5.1],[-2,4.8],[1,5.9],[3.4,6.4],[5,5.6],[6.1,4.3],[8.4,4.6],[9.6,3.5],[9.5,1.5],[9.3,-0.5],[11.8,-3],[12,-5.5],[13,-8],[13.6,-11],[12.4,-14],[11.8,-17],[13.4,-20.8],[14.5,-22.9],[15.2,-27],[16.5,-28.6],[17.4,-31],[18.4,-34.2],[20,-34.8],[22.5,-34],[25.6,-34],[27.9,-33],[30,-31.3],[31.3,-29.4],[32.6,-26.9],[32.8,-25.9],[35.4,-24.2],[35.5,-21.8],[34.8,-19.8],[36.8,-18],[39.4,-16.5],[40.6,-14.5],[40.5,-10.5],[39.3,-8],[39.5,-6.5],[38.9,-5],[40.5,-2.5],[41.5,-1.7],[43.4,0.6],[46,2.3],[48,4.5],[49.8,7.8],[51.2,10.5],[51.3,11.8],[48.5,11.3],[45,10.4],[43.3,11.6],[42.7,12.7],[41.2,14.6],[39.8,15.6],[38.6,18],[37.3,21],[36.5,22.4],[35.6,23.9],[34.6,26],[33.8,27.3],[32.6,29.9],[32.3,31.3],[30,31.4],[28.5,30.9],[25.2,31.6],[22.5,32.8],[20.5,32.5],[19.9,31.2],[18.5,30.6],[15.6,31.5],[13.2,32.9],[11.2,33.2],[10.3,34.3],[11,35.3],[10.2,37],[8.5,36.9],[5,36.8],[1.4,36.6],[-1.2,35.7],[-2.2,35.1],[-5,35.2]],
      [[49.3,-12],[50.4,-15.5],[49.5,-17.5],[48.5,-20.5],[47.2,-24.8],[45.2,-25.5],[44,-24.8],[43.4,-21.8],[44.3,-19.5],[44.1,-16.8],[46.4,-15.7],[47.8,-14.2]],
      [[-9.5,37],[-8.8,41],[-9.2,43],[-8,43.7],[-4.5,43.4],[-1.8,43.4],[-1.2,45.5],[-1.5,46.5],[-2.5,47.3],[-4.6,47.9],[-4.4,48.6],[-1.6,48.7],[-1.2,49.7],[0.2,49.6],[1.6,50.2],[2.5,51.1],[4,51.6],[4.8,52.9],[6.8,53.5],[8.6,53.9],[8.6,55.4],[8.1,56.6],[9.9,57.6],[10.6,57.6],[11.9,57.7],[11.2,59],[8,58.1],[5.6,58.9],[5,61],[5.2,62.2],[7.5,63.2],[10,64],[12.5,65.8],[14.5,67.6],[16,68.6],[18.8,69.8],[23,70.6],[25.8,71.1],[28.5,70.9],[31,70.3],[33,69.4],[36.5,69],[41,67.6],[44.2,68.4],[46,67.8],[53.5,68.4],[58.5,68.8],[60.5,69.6],[64.8,69.4],[68.5,68.3],[66.8,70.6],[68.2,72.5],[70.5,73.2],[72.8,72.2],[80,72.5],[86.5,74.5],[88,75.5],[95,76.2],[100,77.2],[104.3,77.7],[106,77],[112,75.6],[113.5,73.5],[120,73],[127,73.4],[129.5,72],[132.5,71.2],[139.5,72.4],[146,72.3],[152,70.9],[160,70.4],[167,69.7],[170.5,70.1],[176,69.8],[180,69],[180,65],[178.5,64.6],[177,62.5],[173.5,61.8],[170,60],[166,59.9],[163.5,59.9],[162.5,57.8],[163.2,56.1],[162.1,54.8],[160.3,53.6],[158.5,52.8],[156.7,51.1],[156,53],[155.6,56],[156.8,57.7],[158.3,58],[160,60.5],[156,61.6],[152,59.2],[148.5,59.3],[145,59.4],[142,59],[138.5,56.5],[137.5,54],[140.5,53.5],[141.3,52.2],[140.5,49.5],[140,47.5],[138.3,46],[135.5,43.8],[133,42.8],[131.2,42.6],[129.7,41.2],[129.4,40],[128,38.6],[129.4,37],[129.4,35.3],[127.5,34.6],[126.3,34.5],[126.5,36.7],[126.1,37.7],[125.2,38.4],[125.2,39.6],[124.2,39.9],[122,39.1],[121.2,40.8],[119.5,39.8],[118,39.2],[117.6,38.5],[118.8,37.5],[120.6,37.8],[122.5,37.3],[119.5,35],[120.3,34.3],[120.9,32.6],[121.9,31.6],[121.9,29.5],[121.5,28.4],[120.4,27],[119.5,25.7],[118,24.5],[116.5,23],[114.5,22.4],[111,21.5],[109.7,21.6],[108.3,21.6],[106.7,20.7],[105.8,19.2],[106.6,17.5],[107.8,16.3],[108.8,15.3],[109.3,13],[109.2,11.6],[108,10.7],[106.8,10.3],[105,8.7],[104.8,10.1],[103.5,10.6],[102.6,12.2],[101,12.7],[100.1,13.4],[99.3,10.3],[100.3,8.4],[100.5,7.3],[101.3,6.9],[102.3,6.1],[103.4,4.6],[103.5,2.8],[104.2,1.4],[103.4,1.3],[101.3,2.8],[100.4,4.2],[100.3,6.4],[98.3,8.2],[98.6,9.9],[98.5,11.5],[98.2,13.2],[97.7,16.4],[96.6,16.6],[94.4,16],[94.3,17.8],[93.6,19.5],[92.4,20.7],[91.8,22.3],[90.5,22],[89.1,21.7],[87.5,21.5],[86.8,20.6],[85.2,19.5],[84.1,18.3],[82.3,16.6],[80.3,15.7],[80.2,13.3],[79.8,11.5],[79.4,10.3],[78.2,8.9],[77.5,8.1],[76.6,8.9],[75.8,11.2],[74.8,12.9],[73.5,16],[72.9,18.9],[72.5,21.6],[70.4,20.9],[69,22.4],[68.7,23.5],[67.5,24.1],[66.6,25.4],[64,25.3],[61.6,25.2],[59,25.4],[57.3,25.9],[56.5,27.1],[54.6,26.6],[51.5,27.9],[50.1,30.1],[48.5,30],[48,29.2],[49,27.6],[50.2,26.3],[51.5,25.8],[51.6,24.3],[53.7,24.1],[55.5,25.4],[56.3,26.3],[56.4,24.8],[57.2,23.8],[58.8,23.5],[59.8,22.4],[58.6,20.6],[57.7,19.1],[56.8,18.6],[55.3,17.4],[53.1,16.6],[52.2,15.8],[49.5,14.6],[48,14],[45.5,13.1],[43.6,12.7],[43.3,13.6],[42.7,15.6],[42.8,16.6],[41.2,19],[39.2,21.3],[38.4,23.6],[37.4,25],[35.6,27.6],[34.9,29.4],[34.2,27.7],[33.5,28.3],[32.6,29.9],[32.3,31.3],[34.2,31.3],[34.9,32.8],[35.5,34.2],[35.9,35.4],[36.2,36.6],[34.6,36.8],[32.8,36.1],[31,36.8],[30,36.3],[28.2,36.7],[27.3,37.4],[26.4,38.4],[26.6,39.4],[26.2,40],[26,40.9],[24.5,40.9],[23.5,40.3],[22.6,40.5],[22.9,39.3],[23.3,38.2],[22.7,37.5],[21.7,36.8],[21.1,37.9],[20.7,38.9],[20,39.6],[19.4,40.4],[19.5,41.8],[18.5,42.4],[17,43.2],[15.6,44],[14.9,44.9],[13.7,45.6],[12.4,45.4],[12.3,44.3],[13.6,43.5],[14.2,42.4],[16,41.4],[18.5,40.1],[17.1,39.5],[16.6,38.6],[15.7,37.95],[16.1,38.9],[15.6,40.1],[14.3,40.9],[13.5,41.2],[12.2,41.8],[11.1,42.4],[10.5,43.2],[10.2,43.9],[8.8,44.4],[7.6,43.8],[6.6,43.1],[5,43.4],[3.9,43.5],[3.1,43.1],[3.2,42],[2.2,41.3],[0.9,41],[-0.1,39.5],[0.2,38.8],[-0.7,37.6],[-2.1,36.7],[-4.4,36.7],[-5.6,36],[-6.4,36.8],[-7.4,37.2],[-8.9,37]],
      [[10.6,54.4],[12,54.2],[14,54],[16.5,54.6],[18.6,54.6],[21,55.3],[21.1,56.8],[22.6,57.6],[24.3,57.2],[24.2,58.3],[23.4,59],[26,59.6],[29.8,59.9],[28,60.5],[25,60.2],[22.9,59.9],[21.4,60.7],[21.5,62.5],[23,63.8],[25.3,65.2],[24.6,65.8],[22.3,65.8],[21.2,64.2],[19,63.3],[17.4,61.6],[17.3,60.5],[18.8,59.7],[18,59],[16.7,57.6],[16.4,56.2],[14.5,56],[12.9,55.6],[12.6,56.4],[11.9,57.6],[10.6,57.5],[10.3,56.6],[10.9,56.3],[10.2,55.5]],
      [[27.5,42.5],[28,41.6],[29,41.2],[31.3,41.1],[33.5,42],[35,42],[36.5,41.3],[38.4,40.9],[40,41],[41.6,41.6],[41.5,42.7],[39.8,43.4],[38,44.4],[36.6,45.2],[35,45],[33.5,44.5],[32.5,45.4],[33.6,46],[31.7,46.6],[30.2,45.8],[29.6,45.2],[28.6,44.2]],
      [[46.8,44.6],[47.5,45.6],[49,46.4],[51.3,47],[53,46.8],[53.2,45.3],[51.3,44.5],[50.8,44],[52.7,41.7],[53,40.5],[54,39.5],[53.9,37.3],[51.8,36.7],[50.3,37.4],[49,38.5],[49.4,40.2],[49.6,40.6],[48.6,41.8],[47.5,43]],
      [[-5.7,50.1],[-3.4,50.6],[-1.2,50.7],[1.4,51.2],[1.7,52.7],[0.3,53.4],[-0.2,54.2],[-1.5,55.4],[-2.1,56.3],[-1.8,57.6],[-3.3,58.6],[-5,58.6],[-6.2,57.4],[-5.6,56.4],[-6.3,55.6],[-4.9,54.9],[-3.2,54.2],[-3.1,53.4],[-4.6,53.2],[-4.4,52.3],[-5.3,51.8],[-3.2,51.4],[-4.5,51.1]],
      [[-6,52.1],[-6.1,53.6],[-5.9,54.6],[-7.3,55.3],[-8.5,54.9],[-10,54.2],[-9.9,53.4],[-10.3,52.1],[-9.6,51.6],[-8.2,51.8]],
      [[52.5,71.4],[56.5,70.6],[57.5,72.3],[61,75.5],[68.6,76.8],[65,76.6],[58,75.4],[55.3,73.5],[53.7,72.6]],
      [[11,78.8],[16,76.6],[21,77.5],[27,79.8],[20,80.4],[13,79.9]],
      [[142,46],[143.5,46.4],[143.2,49.5],[144.6,49],[143,52.5],[142.6,54.3],[141.8,53.3],[142,49.3],[141.9,47.6]],
      [[129.7,33.1],[130.2,31.3],[131.4,31.6],[132,33.2],[133.5,33.4],[134.7,33.8],[135.4,33.5],[136.9,34.3],[138.8,34.7],[139.9,35],[140.9,35.7],[140.6,36.8],[141.1,38.3],[141.9,39.7],[141.4,41.4],[140.3,41.2],[139.9,40],[140,39],[139.4,38.1],[138.5,37.4],[137.2,36.8],[136.1,36],[135.5,35.6],[133.1,35.6],[132.4,35.4],[131.2,34.4],[130.9,33.9]],
      [[140,41.5],[141.2,41.8],[143.2,42],[145.6,43.3],[145,44.2],[142,45.4],[141.6,44.3],[141.3,43.2],[140.4,43.3],[139.8,42.3]],
      [[121,25.1],[121.9,24.6],[120.8,22],[120.1,23]],
      [[120.6,18.5],[122.3,18.4],[122.2,16],[124,13.4],[125.5,12.3],[126.6,7.3],[125.4,5.6],[123.7,7.7],[122,7],[122.6,10],[121.9,11.8],[120.4,14.4],[119.8,16.3]],
      [[79.9,9.8],[81.4,8.4],[81.9,7.4],[81.3,6.2],[80,6.1],[79.7,8.1]],
      [[95.3,5.6],[97.5,5.2],[100.3,2.4],[103.7,-1],[106,-3.3],[105.8,-5.8],[104.5,-5.9],[102.3,-4],[100.5,-1.5],[98.7,1.7],[97.1,3.2]],
      [[105.2,-6.8],[106.5,-6],[108.3,-6.3],[110.5,-6.9],[112.6,-6.9],[114.4,-7.7],[114.4,-8.7],[111,-8.2],[108,-7.8],[106.4,-7.4]],
      [[109.6,1.9],[109.2,0],[110.2,-1.7],[111.8,-3.3],[114.5,-3.5],[116.3,-3.9],[116.5,-2],[117.5,0],[117.8,1.2],[118.9,4.8],[117.3,6.9],[116,6.3],[115.3,5],[113.8,4.3],[111.6,2.6],[110.9,1.7]],
      [[119.4,-5.5],[120.4,-5.6],[121,-2.6],[123.3,-0.9],[125,1.5],[124.4,0.4],[121.6,0.6],[120.1,0.3],[119.6,-1.3]],
      [[131,-1.3],[134,-0.9],[135.3,-2.8],[137.9,-1.5],[141,-2.6],[144.5,-3.9],[146.1,-5.3],[147.8,-6.7],[150.3,-10.4],[147.2,-10.1],[146,-8.1],[143.3,-8.9],[141.1,-9.2],[139,-8.1],[137.7,-5.3],[134.6,-3.9],[132.8,-4.1],[132,-2.8]],
      [[113.6,-22],[114.2,-26],[115.1,-30.5],[115,-34.1],[117.9,-35.1],[122,-33.9],[124.2,-32.9],[126.2,-32.3],[129,-31.7],[131.2,-31.5],[133.8,-32.1],[135.3,-34.6],[137.8,-32.6],[138.6,-34.8],[139.7,-37.2],[141,-38.1],[143.6,-38.8],[146.3,-39.1],[147.9,-37.9],[150,-37.4],[150.8,-34.6],[152.5,-32.4],[153.6,-28.6],[153.1,-25.3],[150.8,-22.6],[149.3,-21.2],[146.3,-18.9],[145.4,-16],[145.3,-14.9],[143.6,-14],[142.5,-10.7],[141.6,-12.9],[141.5,-15.2],[140.8,-17.4],[139.3,-17.4],[137.7,-16.1],[135.9,-15],[135.9,-13.3],[137,-12.2],[136.6,-11.9],[133.4,-11.7],[131.3,-11.2],[129.9,-13.2],[129.4,-14.9],[127.8,-14.2],[126.6,-13.9],[125.2,-14.6],[124.3,-16.4],[122.3,-17.5],[121.6,-18.6],[119.5,-20.1],[117.8,-20.6],[116.8,-20.6],[114.9,-21.5]],
      [[172.7,-34.4],[174.6,-36.2],[175.9,-37.5],[178.5,-37.7],[177.9,-39.2],[176.8,-40.2],[175.2,-41.6],[174.6,-41.2],[173.5,-42.5],[172.8,-43.8],[171.2,-44.5],[170.6,-45.9],[169,-46.6],[166.6,-46],[167.5,-44.4],[170,-43],[171.6,-41.7],[172.7,-40.5],[174.3,-41.1],[174.9,-39.8],[173.8,-39.2],[174.6,-38],[174.3,-36.5]]
    ];
    const boxes = LAND.map((poly) => {
      let x0 = 999, x1 = -999, y0 = 999, y1 = -999;
      poly.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
      return [x0, x1, y0, y1];
    });
    const inPoly = (poly, x, y) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    const isLand = (lon, lat) => {
      let n = 0;
      for (let p = 0; p < LAND.length; p++) {
        const b = boxes[p];
        if (lon < b[0] || lon > b[1] || lat < b[2] || lat > b[3]) continue;
        if (inPoly(LAND[p], lon, lat)) n++;
      }
      return n % 2 === 1;
    };

    const D = Math.PI / 180, R = 100, STEP = 3.4;
    const dots = [];
    let row = 0;
    for (let lat = -88 + STEP / 2; lat < 88; lat += STEP, row++) {
      const count = Math.max(1, Math.round((360 / STEP) * Math.cos(lat * D)));
      for (let k = 0; k < count; k++) {
        const lon = -180 + ((k + (row % 2) * 0.5) / count) * 360;
        if (isLand(lon, lat)) dots.push([Math.sin(lat * D), Math.cos(lat * D), lon * D]);
      }
    }
    const REGIONS = [[39, -77.5], [37.6, -122.4], [-23.4, -46.5], [51.5, -0.5], [50, 8.6], [59.6, 17.9], [-26.1, 28.2], [19.1, 72.9], [1.35, 104], [35.8, 140.4], [-33.9, 151.2]];
    const ns = 'http://www.w3.org/2000/svg';
    const pinsG = $('.globe__pins', globe);
    const pins = REGIONS.map(([la, lo], i) => {
      const g = document.createElementNS(ns, 'g');
      const ring = document.createElementNS(ns, 'circle');
      ring.setAttribute('class', 'pin__ring'); ring.setAttribute('r', '3.6');
      ring.style.animationDelay = `${(i * 0.37) % 2.4}s`;
      const core = document.createElementNS(ns, 'circle');
      core.setAttribute('class', 'pin__core'); core.setAttribute('r', '2.8');
      g.append(ring, core);
      pinsG.append(g);
      return { g, s: Math.sin(la * D), c: Math.cos(la * D), l: lo * D };
    });
    const backPath = $('.globe__back', globe), rimPath = $('.globe__rim', globe), frontPath = $('.globe__front', globe);
    const tilt = 20 * D, st = Math.sin(tilt), ct = Math.cos(tilt);
    let lon0 = -77.5 * D, targetLon = lon0;
    let dragging = false, dragX = 0, lastPick = performance.now(), selected = 0;
    const regionButtons = $$('[data-region]');
    const regionNames = ['Ashburn', 'San Francisco', 'São Paulo', 'London', 'Frankfurt', 'Stockholm', 'Johannesburg', 'Mumbai', 'Singapore', 'Tokyo', 'Sydney'];
    const chooseRegion = (index, manual = false) => {
      selected = index;
      regionButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
      $('.pool__selected').textContent = `${regionNames[index]} / pool ready`;
      if (manual) $('#pool-status').textContent = `${regionNames[index]} pool selected.`;
      $('.globe__region').textContent = `${regionNames[index]} / ${regionButtons[index].textContent.toUpperCase()}`;
      globe.setAttribute('aria-label', `Globe showing eleven GPU regions. Selected: ${regionNames[index]}.`);
      targetLon = REGIONS[index][1] * D;
      while (targetLon - lon0 > Math.PI) targetLon -= Math.PI * 2;
      while (targetLon - lon0 < -Math.PI) targetLon += Math.PI * 2;
      if (manual) lastPick = performance.now() + 10000;
      if (reduceMotion || !finePointer) { lon0 = targetLon; renderGlobe(); }
    };
    regionButtons.forEach((button, i) => button.addEventListener('click', () => chooseRegion(i, true)));
    if (finePointer && !reduceMotion) {
      globe.addEventListener('pointerdown', e => { dragging = true; dragX = e.clientX; globe.setPointerCapture(e.pointerId); lastPick = performance.now() + 15000; });
      globe.addEventListener('pointermove', e => { if (!dragging) return; lon0 -= (e.clientX - dragX) * .012; targetLon = lon0; dragX = e.clientX; renderGlobe(); });
      const release = () => { dragging = false; };
      globe.addEventListener('pointerup', release); globe.addEventListener('pointercancel', release);
    }

    const renderGlobe = () => {
      let back = '', rim = '', front = '';
      for (let i = 0; i < dots.length; i++) {
        const [s, c, l] = dots[i];
        const dl = l - lon0, cdl = Math.cos(dl);
        const x = R * c * Math.sin(dl);
        const y = -R * (ct * s - st * c * cdl);
        const z = st * s + ct * c * cdl;
        const p = `M${x.toFixed(1)} ${y.toFixed(1)}h0`;
        if (z > 0.32) front += p; else if (z > 0) rim += p; else if (z > -0.6) back += p;
      }
      backPath.setAttribute('d', back);
      rimPath.setAttribute('d', rim);
      frontPath.setAttribute('d', front);
      pins.forEach((pin) => {
        const dl = pin.l - lon0, cdl = Math.cos(dl);
        const z = st * pin.s + ct * pin.c * cdl;
        const x = R * pin.c * Math.sin(dl);
        const y = -R * (ct * pin.s - st * pin.c * cdl);
        pin.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        pin.g.style.opacity = clamp(z * 4, 0, 1).toFixed(2);
      });
    };
    renderGlobe();

    if (!reduceMotion && finePointer) {
      let raf = 0, last = 0, acc = 0, visible = false;
      const loop = (now) => {
        raf = requestAnimationFrame(loop);
        const dt = last ? Math.min(now - last, 100) : 16;
        last = now;
        acc += dt;
        if (acc < 33) return; // ~30 fps is plenty for a slow spin
        if (!dragging) lon0 += (targetLon - lon0) * Math.min(1, acc / 260);
        if (now - lastPick > 2800) { chooseRegion((selected + 1) % REGIONS.length); lastPick = now; }
        acc = 0;
        renderGlobe();
      };
      const sync = () => {
        cancelAnimationFrame(raf);
        if (visible && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); }
      };
      watch(tile, (v) => { visible = v; sync(); });
      document.addEventListener('visibilitychange', sync);
    }
  }

  /* ---------- Scale: scale-to-zero chart ---------- */
  const scale = $('.scale');
  if (scale) {
    const tile = scale.closest('.tile');
    const W = 400, H = 140, PER_REPLICA = 60, RATE = 1.95;
    const g = (h, c, w, a) => a * Math.exp(-(((h - c) / w) ** 2));
    const traffic = (h) => Math.max(0, g(h, 14, 3.4, 1700) + g(h, 20.6, 2.6, 1150) + g(h, -3.4, 2.6, 1150) + g(h, 9.6, 1.7, 520) - 140);
    const replicas = (h) => Math.ceil(traffic(h) / PER_REPLICA);
    const samples = [];
    for (let i = 0; i <= 240; i++) { const h = i / 10; samples.push([h, traffic(h), replicas(h)]); }
    const top = Math.max(...samples.map((s) => s[2])) * PER_REPLICA * 1.12;
    const sx = (h) => (h / 24) * W, sy = (v) => H - (v / top) * H;
    let area = `M0 ${H}`;
    samples.forEach(([h, t]) => { area += `L${sx(h).toFixed(1)} ${sy(t).toFixed(1)}`; });
    area += `L${W} ${H}Z`;
    let step = '', prev = null;
    samples.forEach(([h, , r]) => {
      const x = sx(h).toFixed(1), yy = sy(r * PER_REPLICA).toFixed(1);
      if (prev === null) step = `M${x} ${yy}`;
      else if (r !== prev) step += `L${x} ${sy(prev * PER_REPLICA).toFixed(1)}L${x} ${yy}`;
      prev = r;
    });
    step += `L${W} ${sy(prev * PER_REPLICA).toFixed(1)}`;
    $('.scale__area', scale).setAttribute('d', area);
    $('.scale__step', scale).setAttribute('d', step);

    const cursor = $('.scale__cursor', scale), tEl = $('.scale__time', scale), rEl = $('.scale__rep', scale), cEl = $('.scale__cost', scale);
    const setHour = (h) => {
      h = ((h % 24) + 24) % 24;
      const r = replicas(h);
      const hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10;
      cursor.style.left = `${(h / 24) * 100}%`;
      tEl.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      rEl.textContent = r;
      cEl.textContent = `$${(r * RATE).toFixed(2)}/h`;
      scale.classList.toggle('is-zero', r === 0);
    };
    let hour = 4.17;
    setHour(hour);

    if (!reduceMotion) {
      let raf = 0, last = 0, visible = false, hovering = false;
      const loop = (now) => {
        raf = requestAnimationFrame(loop);
        const dt = last ? Math.min(now - last, 100) : 16;
        last = now;
        if (hovering) return;
        hour += (dt / 1000) * 1.5; // a day every 16 s
        setHour(hour);
      };
      const sync = () => {
        cancelAnimationFrame(raf);
        if (visible && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); }
      };
      watch(tile, (v) => { visible = v; sync(); });
      document.addEventListener('visibilitychange', sync);
      const plot = $('.scale__plot', scale);
      if (finePointer) {
        plot.addEventListener('pointermove', (e) => {
          hovering = true;
          const r = plot.getBoundingClientRect();
          hour = clamp((e.clientX - r.left) / r.width, 0, 0.999) * 24;
          setHour(hour);
        });
        plot.addEventListener('pointerleave', () => { hovering = false; });
      }
    }
  }

  /* ---------- Code tabs + copy ---------- */
  const tabs = $$('.tab');
  if (tabs.length) {
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
    const pill = $('.tabs__pill');
    let current = 0;
    const movePill = () => {
      const t = tabs[current];
      pill.style.width = `${t.offsetWidth}px`;
      pill.style.transform = `translateX(${t.offsetLeft}px)`;
    };
    const select = (i, focus) => {
      current = i;
      tabs.forEach((t, j) => {
        const on = i === j;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
      movePill();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in keys)) return;
        e.preventDefault();
        select((keys[e.key] + tabs.length) % tabs.length, true);
      });
    });
    select(0);
    if ('ResizeObserver' in window) new ResizeObserver(movePill).observe($('.tabs'));
    if (document.fonts) document.fonts.ready.then(movePill);

    const copyBtn = $('.copy');
    const status = $('#copy-status');
    const labels = $$('.copy__label', copyBtn);
    let resetTimer = 0;
    const fallbackCopy = (text) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    };
    copyBtn.addEventListener('click', async () => {
      const panel = panels[current];
      const text = $('code', panel).textContent;
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (err) { ok = fallbackCopy(text); }
      labels.forEach((l) => { l.textContent = ok ? 'Copied' : 'Press ⌘C'; });
      copyBtn.classList.toggle('is-done', ok);
      status.textContent = ok ? `${panel.dataset.lang} example copied to the clipboard.` : 'Copy failed. Select the code to copy it.';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        labels.forEach((l) => { l.textContent = 'Copy'; });
        copyBtn.classList.remove('is-done');
      }, 1800);
    });
  }

  /* ---------- Pricing calculator ---------- */
  const calc = $('.calc');
  if (calc) {
    const GPUS = [
      { id: 'T4', mem: '16 GB', hr: 0.59 },
      { id: 'L4', mem: '24 GB', hr: 0.80 },
      { id: 'A10', mem: '24 GB', hr: 1.10 },
      { id: 'L40S', mem: '48 GB', hr: 1.95 },
      { id: 'A100', mem: '80 GB', hr: 2.50 },
      { id: 'H100', mem: '80 GB', hr: 3.95 },
      { id: 'H200', mem: '141 GB', hr: 4.60 }
    ];
    const ladder = (mantissas, from, to) => {
      const out = [];
      for (let e = -2; e <= 7; e++) {
        mantissas.forEach((m) => {
          const v = +(m * 10 ** e).toPrecision(3);
          if (v >= from - 1e-9 && v <= to + 1e-9) out.push(v);
        });
      }
      return out;
    };
    const SECS = ladder([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8], 0.1, 30);
    const REQS = ladder([1, 1.5, 2, 3, 4, 5, 7.5], 100, 5e6);
    const DAYS = 365 / 12, HOURS = 730;

    const gpuIn = $('#gpu'), secsIn = $('#secs'), reqsIn = $('#reqs');
    secsIn.max = SECS.length - 1;
    reqsIn.max = REQS.length - 1;
    const out = {
      gpu: $('#gpu-out'), secs: $('#secs-out'), reqs: $('#reqs-out'),
      total: $('#total'), totalSr: $('#total-status'),
      hours: $('#r-hours'), rate: $('#r-rate'), always: $('#r-always'), save: $('#r-save'), peak: $('#r-peak')
    };
    const gpuTicks = $$('.field:first-child .ticks span', calc);
    const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    const money = (v) => (v >= 100 ? `$${int.format(Math.round(v))}` : `$${v.toFixed(2)}`);
    const secsText = (s) => `${s < 1 ? s.toFixed(s * 100 % 10 ? 2 : 1) : s % 1 ? s.toFixed(1) : s} s`;
    const reqsText = (r) => (r >= 1e6 ? `${+(r / 1e6).toFixed(2)}M` : int.format(r));

    let shown = null, tweenRaf = 0, srTimer = 0;
    const paintTotal = (v) => { out.total.textContent = money(v); };
    const showTotal = (v) => {
      cancelAnimationFrame(tweenRaf);
      if (reduceMotion || shown === null) { shown = v; paintTotal(v); return; }
      const from = shown, t0 = performance.now();
      const stepT = (now) => {
        const k = Math.min(1, (now - t0) / 450);
        shown = from + (v - from) * (1 - (1 - k) ** 3);
        paintTotal(shown);
        if (k < 1) tweenRaf = requestAnimationFrame(stepT);
      };
      tweenRaf = requestAnimationFrame(stepT);
    };

    const fill = (input) => {
      input.style.setProperty('--p', `${((input.value - input.min) / (input.max - input.min)) * 100}%`);
    };

    const update = () => {
      const gpu = GPUS[+gpuIn.value], secs = SECS[+secsIn.value], reqs = REQS[+reqsIn.value];
      const gpuSeconds = secs * reqs * DAYS;
      const cost = (gpuSeconds / 3600) * gpu.hr;
      const avgConcurrency = (secs * reqs) / 86400;
      const peak = Math.max(1, Math.ceil(avgConcurrency * 3));
      const alwaysOn = peak * gpu.hr * HOURS;
      const save = clamp(Math.floor((1 - cost / alwaysOn) * 100), 0, 99);
      const hours = gpuSeconds / 3600;

      out.gpu.innerHTML = `${gpu.id} <span>${gpu.mem} · $${gpu.hr.toFixed(2)}/h</span>`;
      out.secs.textContent = secsText(secs);
      out.reqs.textContent = reqsText(reqs);
      gpuIn.setAttribute('aria-valuetext', `${gpu.id}, ${gpu.mem.replace('GB', 'gigabytes')}, ${gpu.hr.toFixed(2)} dollars per hour`);
      secsIn.setAttribute('aria-valuetext', `${secsText(secs).replace(' s', '')} seconds`);
      reqsIn.setAttribute('aria-valuetext', `${int.format(reqs)} requests per day`);
      gpuTicks.forEach((t, i) => t.classList.toggle('is-on', i === +gpuIn.value));
      [gpuIn, secsIn, reqsIn].forEach(fill);

      showTotal(cost);
      out.hours.textContent = `${hours < 10 ? hours.toFixed(1) : int.format(Math.round(hours))} h`;
      out.rate.textContent = `$${gpu.hr.toFixed(2)}/h · $${(gpu.hr / 3600).toFixed(5)}/s`;
      out.always.textContent = `${money(alwaysOn)}/mo`;
      out.save.textContent = `${save}% less`;
      out.peak.textContent = `${peak} × ${gpu.id}`;

      clearTimeout(srTimer);
      srTimer = setTimeout(() => {
        out.totalSr.textContent = `Estimated ${money(cost)} per month, ${save}% less than ${peak} always-on ${gpu.id} GPUs.`;
      }, 700);
    };
    [gpuIn, secsIn, reqsIn].forEach((el) => el.addEventListener('input', update));
    gpuTicks.forEach((t, i) => t.addEventListener('click', () => { gpuIn.value = i; update(); }));
    $('.calc__controls').addEventListener('submit', (e) => e.preventDefault());
    update();
    out.totalSr.textContent = '';
  }
})();
