/* Corkwood Public — Organic / Nature / Soft (linen) concept, v2
   The bench assembles itself on scroll (bench.js), scene grounds cross-fade (linen, tints, workshop),
   four product rooms, framed photographs that open to full bleed, place plans that draw in,
   cork rings for the guarantee, and a live 3D configurator that reuses the same renderer. */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mobileQ = window.matchMedia('(max-width: 700px)');
  const roomsQ = window.matchMedia('(min-width: 901px)');
  const panelQ = window.matchMedia('(hover: hover) and (min-width: 1101px)');
  const hasBuild = root.classList.contains('has-build');
  const has3d = root.classList.contains('has-3d');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const vh = () => window.innerHeight;

  /* ---------- Split headings into word spans ---------- */
  const splitWords = (el) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const outer = document.createElement('span');
            const inner = document.createElement('span');
            outer.className = 'w';
            inner.textContent = part;
            inner.style.setProperty('--i', i++);
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
  };
  document.querySelectorAll('[data-words]').forEach(splitWords);

  /* ---------- Scroll reveals ---------- */
  const heroTitle = document.querySelector('.build__title');
  const revealTargets = document.querySelectorAll('[data-reveal], [data-words]:not(.build__title), .drawings');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
    revealTargets.forEach((el) => io.observe(el));
  }

  /* ---------- Hero: the bench builds itself ---------- */
  const build = document.querySelector('.build');
  const buildStage = build.querySelector('.build__stage');
  const buildMount = build.querySelector('.build__canvas');
  const photo = build.querySelector('.build__photo');
  const countN = build.querySelector('.build__count-n');
  const configSec = document.getElementById('configure');
  const configMount = configSec.querySelector('.config__canvas');
  const configStage = configSec.querySelector('.config__stage');

  let bench = null;
  let benchPromise = null;
  let mountedIn = null;
  let buildVisible = true;
  let configVisible = false;
  let built = false;
  let introDone = !hasBuild;

  const showHeadline = () => heroTitle.classList.add('is-in');
  const endWait = () => { root.classList.remove('intro-wait'); root.classList.add('intro-go'); };

  // Callout: one element that follows the canvas between hero and configurator
  const callout = document.createElement('div');
  callout.className = 'callout';
  callout.setAttribute('aria-hidden', 'true');
  callout.innerHTML = '<span class="callout__line"></span><span class="callout__dot"></span><span class="callout__label"></span>';
  const calloutLabel = callout.querySelector('.callout__label');
  const calloutLine = callout.querySelector('.callout__line');
  // Label sits up and to the right of the part, flips left near the edge, and centres above the part on narrow stages.
  const onCallout = (info) => {
    if (!info) { callout.classList.remove('is-on'); return; }
    const host = callout.parentElement;
    const w = host ? host.clientWidth : window.innerWidth;
    if (calloutLabel.textContent !== info.label) calloutLabel.textContent = info.label;
    const lw = calloutLabel.offsetWidth;
    const { x, y } = info;
    let left = 36, top = -58, angle = -38;
    if (x + 36 + lw > w - 12) {
      if (x - 36 - lw >= 12) { left = -36 - lw; angle = -142; }
      else { left = clamp(-lw / 2, 12 - x, w - 12 - x - lw); top = -84; angle = -90; }
    }
    calloutLabel.style.left = `${left}px`;
    calloutLabel.style.top = `${top}px`;
    calloutLine.style.transform = `rotate(${angle}deg)`;
    calloutLine.style.width = angle === -90 ? '50px' : '';
    callout.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    callout.classList.add('is-on');
  };

  const heroFraming = () => (mobileQ.matches
    ? { cx: 0.5, cy: 0.54, fill: 0.3, maxW: 0.78 }
    : { cx: 0.62, cy: 0.555, fill: 0.6, maxW: 0.62 });
  const configFraming = () => ({ cx: 0.55, cy: 0.55, fill: 0.52, maxW: 0.86 });

  // The photograph the model dissolves into, placed over the model's finished silhouette
  const PHOTO_BOX = { x0: 0.075, x1: 0.954, y0: 0.254, y1: 0.836 };
  const placePhoto = () => {
    if (!bench || mountedIn !== 'hero') return;
    const b = bench.heroBox();
    const W = (b.x1 - b.x0) / (PHOTO_BOX.x1 - PHOTO_BOX.x0);
    Object.assign(photo.style, {
      width: `${W}px`, left: `${b.x0 - PHOTO_BOX.x0 * W}px`, top: `${b.y0 - PHOTO_BOX.y0 * W}px`,
      right: 'auto', bottom: 'auto', translate: 'none',
    });
  };

  function loadBench() {
    if (!has3d) return Promise.reject(new Error('no webgl'));
    if (benchPromise) return benchPromise;
    const canvas = document.createElement('canvas');
    benchPromise = import('./bench.js?v=25')
      .then((mod) => mod.createBench(canvas, {
        mobile: mobileQ.matches,
        maxDpr: mobileQ.matches ? 1.5 : 2,
        onPlaced: (n) => {
          const t = String(n).padStart(2, '0');
          if (countN.textContent !== t) {
            countN.textContent = t;
            countN.classList.remove('is-tick');
            void countN.offsetWidth;
            countN.classList.add('is-tick');
          }
        },
        onCallout,
        onLost: () => fallback(),
      }))
      .then((b) => { bench = b; return b; });
    return benchPromise;
  }

  function fallback() {
    root.classList.remove('has-build', 'has-3d', 'intro-wait');
    configSec.classList.remove('is-3d');
    if (bench) { bench.setActive(false); bench.canvas.remove(); }
    bench = null;
    showHeadline();
    introDone = true;
  }

  function mount(where) {
    if (!bench) return;
    if (where === 'config') {
      if (mountedIn !== 'config') {
        bench.mount(configMount, 'config', configFraming());
        configMount.appendChild(callout);
        mountedIn = 'config';
        configSec.classList.add('is-3d');
        syncConfig(false);
      }
      bench.setActive(true);
    } else if (where === 'hero' && hasBuild) {
      if (mountedIn !== 'hero') {
        bench.mount(buildMount, 'hero', heroFraming());
        buildMount.appendChild(callout);
        mountedIn = 'hero';
        placePhoto();
      }
      bench.setActive(!built);
    } else {
      bench.setActive(false);
    }
  }
  const updateMount = () => mount(configVisible ? 'config' : buildVisible ? 'hero' : null);

  if (hasBuild) {
    const atTop = window.scrollY < vh() * 0.4;
    const safety = setTimeout(() => { endWait(); showHeadline(); }, 4000);
    loadBench().then(() => {
      clearTimeout(safety);
      mount('hero');
      if (atTop && window.scrollY < vh() * 0.4) {
        bench.playIntro();
        requestAnimationFrame(() => {
          endWait();
          setTimeout(() => { showHeadline(); }, 1400);
          setTimeout(() => { introDone = true; }, 2200);
        });
      } else {
        bench.skipIntro();
        endWait();
        showHeadline();
        introDone = true;
      }
      onScroll();
    }).catch(() => { clearTimeout(safety); fallback(); });
  } else {
    showHeadline();
  }

  // Configurator only needs the module when it comes near (reduced motion, or a deep link)
  if (has3d && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      configVisible = e.isIntersecting;
      if (configVisible) loadBench().then(updateMount).catch(() => {});
      else updateMount();
    }, { rootMargin: '200px 0px' }).observe(configStage);
  }
  if (hasBuild) {
    new IntersectionObserver(([e]) => { buildVisible = e.isIntersecting; updateMount(); }).observe(build);
  }

  // Hover (desktop) or tap (touch) a part for its callout
  const pointTo = (stage, mountEl, mode) => {
    const at = (e) => {
      const r = mountEl.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    if (finePointer) {
      stage.addEventListener('pointermove', (e) => {
        if (!bench || mountedIn !== mode || !introDone || (mode === 'hero' && built)) return;
        bench.hover(...at(e));
      });
      stage.addEventListener('pointerleave', () => { if (bench && mountedIn === mode) bench.leave(); });
    } else {
      stage.addEventListener('click', (e) => {
        if (!bench || mountedIn !== mode || (mode === 'hero' && built)) return;
        if (e.target.closest('a, button, input, label')) return;
        if (!bench.hover(...at(e))) bench.leave();
      });
    }
  };
  if (hasBuild) pointTo(buildStage, buildMount, 'hero');
  if (has3d) pointTo(configStage, configMount, 'config');

  function updateBuild() {
    if (!hasBuild) return;
    const r = build.getBoundingClientRect();
    const total = Math.max(1, r.height - vh());
    const p = clamp(-r.top / total, 0, 1);
    build.classList.toggle('is-scrolled', p > 0.02);
    if (!bench) return;
    bench.setProgress(clamp(p / 0.86, 0, 1));
    const nowBuilt = p >= 0.9;
    if (nowBuilt !== built) {
      built = nowBuilt;
      build.classList.toggle('is-built', built);
      if (built) bench.leave();
      if (mountedIn === 'hero') bench.setActive(!built && buildVisible);
    }
  }

  /* ---------- Scene grounds: linen, the four room tints, the dark workshop ---------- */
  const sceneEls = [...document.querySelectorAll('[data-scene]')];
  const rooms = document.querySelector('.rooms');
  const roomCards = [...rooms.querySelectorAll('.card')];
  const roomDots = [...rooms.querySelectorAll('.rooms__dots li')];
  const ROOM_TINTS = ['--room-sand', '--room-sage', '--room-clay', '--room-sky'];
  let roomIndex = -1;
  const roomsMode = () => !reduceMotion && roomsQ.matches;

  function updateRooms() {
    if (!roomsMode()) return;
    const r = rooms.getBoundingClientRect();
    const q = clamp(-r.top / Math.max(1, r.height - vh()), 0, 0.9999);
    const i = Math.floor(q * 4);
    if (i === roomIndex) return;
    roomIndex = i;
    roomCards.forEach((c, k) => {
      c.classList.toggle('is-current', k === i);
      c.classList.add('is-in');
      if (k !== i && c.classList.contains('is-open')) setDetails(c, false);
    });
    roomDots.forEach((d, k) => d.classList.toggle('is-on', k === i));
  }

  let sceneKey = '';
  function updateScene() {
    const line = vh() * 0.55;
    let active = sceneEls[0];
    for (const el of sceneEls) if (el.getBoundingClientRect().top < line) active = el;
    let scene = active.dataset.scene;
    let ground = 'var(--bg)';
    if (scene === 'dark') ground = 'var(--earth)';
    else if (scene === 'rooms') {
      if (roomsMode() && roomIndex >= 0 && rooms.getBoundingClientRect().bottom > line) ground = `var(${ROOM_TINTS[roomIndex]})`;
      else scene = 'linen';
    }
    const key = scene + ground;
    if (key === sceneKey) return;
    sceneKey = key;
    root.dataset.scene = scene;
    root.style.setProperty('--ground', ground);
  }

  /* ---------- Materials: each photograph opens from a frame to full bleed ---------- */
  const chapters = [...document.querySelectorAll('.chapter')];
  function updateChapters() {
    if (reduceMotion) return;
    const h = vh();
    chapters.forEach((ch) => {
      const r = ch.getBoundingClientRect();
      if (r.bottom < -h || r.top > h * 1.5) return;
      const travel = Math.max(1, r.height - h);
      const o = clamp((h * 0.6 - r.top) / (h * 0.6 + travel * 0.45), 0, 1);
      ch.querySelector('.chapter__media').style.setProperty('--p', (1 - easeIO(o)).toFixed(4));
      ch.classList.toggle('is-open', o > 0.7);
    });
  }

  /* ---------- Impact: the cork rings draw as you scroll, the 92 counts up ---------- */
  const ringBox = document.querySelector('.impact__ring');
  const rings = [...document.querySelectorAll('.ring')];
  function updateRings() {
    if (reduceMotion || !ringBox) return;
    const r = ringBox.getBoundingClientRect();
    const t = clamp((vh() * 0.92 - r.top) / (r.height * 0.95), 0, 1);
    rings.forEach((ring, i) => { ring.style.strokeDashoffset = (1 - clamp(t * 5 - i, 0, 1)).toFixed(4); });
  }
  const count = document.querySelector('[data-count]');
  if (count && !reduceMotion && 'IntersectionObserver' in window) {
    const target = Number(count.dataset.count);
    count.textContent = '0';
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (now) => {
        const k = clamp((now - t0) / 1200, 0, 1);
        count.textContent = String(Math.round(easeOut(k) * target));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(count);
  }

  /* ---------- Places: rows open a drawn plan ---------- */
  const placeRows = [...document.querySelectorAll('.places .row')];
  const drawPlan = (plan) => {
    plan.classList.remove('is-drawn');
    void plan.getBoundingClientRect();
    requestAnimationFrame(() => plan.classList.add('is-drawn'));
  };
  let activeRow = null;
  const activateRow = (row) => {
    if (row === activeRow) return;
    if (activeRow) {
      activeRow.classList.remove('is-active');
      activeRow.querySelector('.row__btn').setAttribute('aria-expanded', 'false');
    }
    activeRow = row;
    row.classList.add('is-active');
    row.querySelector('.row__btn').setAttribute('aria-expanded', 'true');
    drawPlan(row.querySelector('.plan'));
  };
  let planIO = null;
  function setupPlaces() {
    const panel = panelQ.matches;
    if (planIO) { planIO.disconnect(); planIO = null; }
    placeRows.forEach((row) => {
      const plan = row.querySelector('.plan');
      row.classList.remove('is-active');
      row.querySelector('.row__btn').setAttribute('aria-expanded', panel ? 'false' : 'true');
      plan.classList.toggle('is-drawn', reduceMotion);
    });
    activeRow = null;
    if (panel) {
      // first plan draws when the list scrolls into view
      planIO = new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !activeRow) activateRow(placeRows[0]);
      }, { threshold: 0.3 });
      planIO.observe(document.querySelector('.rows'));
    } else if (!reduceMotion && 'IntersectionObserver' in window) {
      planIO = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { drawPlan(e.target); planIO.unobserve(e.target); } });
      }, { threshold: 0.35 });
      placeRows.forEach((row) => planIO.observe(row.querySelector('.plan')));
    } else {
      placeRows.forEach((row) => row.querySelector('.plan').classList.add('is-drawn'));
    }
  }
  placeRows.forEach((row) => {
    const btn = row.querySelector('.row__btn');
    const go = () => { if (panelQ.matches) activateRow(row); };
    row.addEventListener('mouseenter', go);
    btn.addEventListener('focus', go);
    btn.addEventListener('click', go);
  });
  setupPlaces();
  panelQ.addEventListener('change', setupPlaces);

  /* ---------- Nav: hide on the way down, return on the way up ---------- */
  const nav = document.querySelector('.nav');
  let lastY = window.scrollY;
  const updateNav = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 40);
    if (!root.classList.contains('menu-open')) {
      if (y > lastY + 6 && y > 240) nav.classList.add('is-hidden');
      else if (y < lastY - 6 || y <= 240) nav.classList.remove('is-hidden');
    }
    lastY = y;
  };
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));

  /* ---------- One rAF-throttled scroll handler ---------- */
  let ticking = false;
  function onScroll() {
    updateNav();
    updateBuild();
    updateRooms();
    updateChapters();
    updateRings();
    updateScene();
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', () => {
    roomIndex = -1;
    if (bench && mountedIn === 'hero') { bench.setView(heroFraming()); placePhoto(); }
    if (bench && mountedIn === 'config') bench.setView(configFraming());
    onScroll();
  });
  onScroll();

  /* ---------- Mobile menu: the pill opens into a panel ---------- */
  const menuBtn = document.querySelector('.nav__menu');
  const menu = document.getElementById('menu');
  const scrim = document.querySelector('.scrim');
  if (menuBtn && menu) {
    const label = menuBtn.querySelector('.nav__menu-label');
    const behind = [document.getElementById('main'), document.querySelector('.footer'), document.querySelector('.nav__logo')];
    const setMenu = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      label.textContent = open ? 'Close' : 'Menu';
      menu.classList.toggle('is-open', open);
      root.classList.toggle('menu-open', open);
      behind.forEach((el) => { if (el) el.inert = open; });
      if (open) {
        nav.classList.remove('is-hidden');
        menu.querySelector('a').focus({ preventScroll: true });
      }
    };
    menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    scrim.addEventListener('click', () => setMenu(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
  }

  /* ---------- Product cards: details panel ---------- */
  function setDetails(card, open) {
    const btn = card.querySelector('.card__more');
    btn.setAttribute('aria-expanded', String(open));
    card.classList.toggle('is-open', open);
    btn.querySelector('span').textContent = open ? 'Close' : 'Details';
  }
  document.querySelectorAll('.card__more').forEach((btn) => {
    const card = btn.closest('.card');
    btn.addEventListener('click', () => setDetails(card, btn.getAttribute('aria-expanded') !== 'true'));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && card.classList.contains('is-open')) { setDetails(card, false); btn.focus(); }
    });
  });

  /* ---------- Configurator ---------- */
  const form = document.querySelector('.config__form');
  const BASES = {
    cork:     { name: 'Natural cork',   alt: 'Sobreiro bench with a natural cork base.',                  weight: { '1.6': 46, '2.0': 64, '2.4': 82 }, support: ['block', 'blocks'], lead: '6 weeks' },
    graphite: { name: 'Graphite steel', alt: 'Sobreiro bench with a graphite recycled-steel frame.',       weight: { '1.6': 52, '2.0': 68, '2.4': 84 }, support: ['frame', 'frames'], lead: '5 weeks' },
    clay:     { name: 'Clay steel',     alt: 'Sobreiro bench with a clay-coloured recycled-steel frame.', weight: { '1.6': 52, '2.0': 68, '2.4': 84 }, support: ['frame', 'frames'], lead: '7 weeks' },
  };
  const LENGTHS = { '1.6': { seats: 3, supports: 2, slats: 7 }, '2.0': { seats: 4, supports: 3, slats: 14 }, '2.4': { seats: 5, supports: 4, slats: 21 } };
  const out = (key) => document.querySelector(`[data-out="${key}"]`);
  const imgs = [...configStage.querySelectorAll('img')];

  function syncConfig(animate) {
    const baseKey = form.elements.base.value;
    const lenKey = form.elements.len.value;
    if (bench && mountedIn === 'config') bench.setConfig({ base: baseKey, len: lenKey }, animate && !reduceMotion);
    return { baseKey, lenKey };
  }

  function updateConfig(announce) {
    const { baseKey, lenKey } = syncConfig(true);
    const base = BASES[baseKey];
    const len = LENGTHS[lenKey];
    imgs.forEach((img) => {
      const on = img.dataset.base === baseKey;
      img.classList.toggle('is-active', on);
      if (on) { img.alt = base.alt; img.removeAttribute('aria-hidden'); }
      else { img.alt = ''; img.setAttribute('aria-hidden', 'true'); }
    });
    const parts = `${len.supports} ${base.support[1]}, ${len.slats} slats`;
    out('name').textContent = base.name;
    out('len').textContent = `${lenKey} m`;
    out('seats-cap').textContent = `${len.seats} seats`;
    out('seats').textContent = String(len.seats);
    out('parts').textContent = parts;
    out('weight').textContent = `${base.weight[lenKey]} kg`;
    out('lead').textContent = base.lead;
    const subject = `Sobreiro bench, ${base.name.toLowerCase()}, ${lenKey} m`;
    out('mail').href = `mailto:studio@corkwood.example?subject=${encodeURIComponent(subject)}`;
    if (announce) {
      out('status').textContent = `${base.name}, ${lenKey} metres: ${len.seats} seats, ${parts}, ${base.weight[lenKey]} kilograms, ${base.lead} lead time.`;
    }
  }
  form.addEventListener('change', () => updateConfig(true));
  form.addEventListener('submit', (e) => e.preventDefault());
  updateConfig(false);

  /* ---------- Newsletter (front end only) ---------- */
  const letter = document.querySelector('.letter');
  if (letter) {
    const input = letter.querySelector('input');
    const status = letter.querySelector('.letter__status');
    letter.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input.value.trim() || !input.checkValidity()) {
        input.setAttribute('aria-invalid', 'true');
        status.classList.add('is-error');
        status.textContent = 'Please enter a full email address, like name@example.com.';
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      status.classList.remove('is-error');
      status.textContent = 'Thank you. This is a concept site, so no email was sent.';
      letter.reset();
    });
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true' && input.checkValidity()) {
        input.removeAttribute('aria-invalid');
        status.classList.remove('is-error');
        status.textContent = '';
      }
    });
  }
})();
