/* Kamen Lodge — altitude and warmth. Plain, native scroll; no animation libraries. */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const meters = (n) => `${Math.round(n).toLocaleString('en-US')} m`;
  const hero = document.querySelector('.hero');
  const heroTrack = document.querySelector('.hero-track');
  const heroLetters = [...hero.querySelectorAll('.hero__mark span')];
  const heroSub = hero.querySelector('.hero__sub');
  const heroCue = hero.querySelector('.hero__cue');
  const header = document.querySelector('.header');
  const main = document.getElementById('main');
  const footer = document.querySelector('.footer');
  const menu = document.getElementById('menu');
  const menuLinks = [...menu.querySelectorAll('.menu__list a')];
  const heroQuery = window.matchMedia('(min-width: 1024px)');
  const pinQuery = window.matchMedia('(min-width: 1024px) and (min-height: 600px)');
  const setPins = () => {
    root.classList.toggle('can-hero', !reduceMotion && heroQuery.matches);
    root.classList.toggle('can-pin', !reduceMotion && pinQuery.matches);
  };
  setPins();
  heroLetters.forEach((s, i) => s.style.setProperty('--i', i));

  /* ---------- Metres loader → hero altitude ---------- */
  const startHero = () => {
    hero.classList.add('is-in');
    setTimeout(() => hero.classList.add('intro-done'), 2400);
  };
  const loader = document.getElementById('loader');
  let seen = false;
  try { seen = sessionStorage.getItem('kamen-intro') === '1'; } catch (e) { /* storage blocked */ }
  if (!loader || reduceMotion || seen) {
    loader?.classList.add('is-gone');
    startHero();
  } else {
    root.classList.add('is-locked');
    main.inert = true;
    header.inert = true;
    footer.inert = true;
    const num = loader.querySelector('.loader__num');
    const heroImg = hero.querySelector('.hero__img');
    let imgReady = heroImg.complete;
    const markReady = () => { imgReady = true; };
    heroImg.addEventListener('load', markReady, { once: true });
    heroImg.addEventListener('error', markReady, { once: true });
    const t0 = performance.now();
    let done = false, shown = 480;
    const finish = () => {
      if (done) return;
      done = true;
      num.textContent = '1,140';
      try { sessionStorage.setItem('kamen-intro', '1'); } catch (e) { /* storage blocked */ }
      const hadFocus = loader.contains(document.activeElement);
      const target = hero.querySelector('.hero__alt');
      const from = loader.querySelector('.loader__count').getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const flight = document.createElement('span');
      flight.className = 'altitude-flight';
      flight.textContent = '1,140 m';
      flight.setAttribute('aria-hidden', 'true');
      flight.style.cssText = `left:${from.left}px;top:${from.top}px;font-size:${getComputedStyle(num).fontSize}`;
      document.body.appendChild(flight);
      target.classList.add('is-landing');
      loader.querySelector('.loader__count').style.opacity = '0';
      flight.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${14 / parseFloat(getComputedStyle(num).fontSize)})`, opacity: 1 }
      ], { duration: 1100, easing: 'cubic-bezier(.65,0,.2,1)', fill: 'forwards' });
      setTimeout(() => { flight.remove(); target.classList.remove('is-landing'); }, 1100);
      loader.classList.add('is-leaving');
      root.classList.remove('is-locked');
      main.inert = header.inert = footer.inert = false;
      startHero();
      setTimeout(() => { loader.classList.add('is-gone'); loader.inert = true; }, 1250);
      if (hadFocus) { main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true }); }
    };
    const tick = () => {
      if (done) return;
      const t = clamp((performance.now() - t0) / 1900);
      const eased = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const progress = imgReady ? eased : Math.min(eased, .9);
      shown = Math.round(480 + progress * 660);
      num.textContent = shown.toLocaleString('en-US');
      if (shown >= 1140) { setTimeout(finish, 180); return; }
      setTimeout(tick, 30);
    };
    tick();
    setTimeout(finish, 3000);
    loader.querySelector('.loader__skip').addEventListener('click', finish);
  }

  /* ---------- One scroll update, pinned scenes and chapter chrome ---------- */
  const rail = document.querySelector('.rail');
  const index = document.querySelector('.chapter-index');
  const indexNum = index.querySelector('.chapter-index__num');
  const indexName = index.querySelector('.chapter-index__name');
  const altitudes = [...document.querySelectorAll('[data-altitude]')];
  const chapters = [...document.querySelectorAll('.chapter')];
  const toned = [heroTrack, ...chapters, footer];
  const toneOf = (el) => el.classList.contains('chapter--light') ? 'light' : el === heroTrack ? 'image' : 'dark';
  const seams = [...document.querySelectorAll('.seam__back')];
  const prologue = document.querySelector('[data-words]');
  let words = [], litCount = -1;
  if (prologue && !reduceMotion) {
    const text = prologue.textContent.trim();
    prologue.setAttribute('aria-label', text);
    prologue.innerHTML = text.split(/\s+/).map((w) => `<span class="w" aria-hidden="true">${w}</span>`).join(' ');
    words = [...prologue.querySelectorAll('.w')];
  }
  const arrival = document.querySelector('.arrival');
  const route = arrival.querySelector('.map__route');
  const routeLength = route.getTotalLength();
  const shuttle = arrival.querySelector('.map__shuttle');
  const map = arrival.querySelector('.map');
  const mapAltitude = arrival.querySelector('.map__alt-num');
  const beatEls = [...arrival.querySelectorAll('[data-beat]')];
  const sauna = document.querySelector('.sauna');
  const saunaMedia = sauna.querySelector('.sauna__media');
  const ritualSteps = [...sauna.querySelectorAll('[data-temp]')];
  const ritualLabels = ['I. Heat · sauna air', 'II. Cold · lake water', 'III. Rest · foot bath'];
  const phone = window.matchMedia('(max-width: 767px)');
  let lastTone = '', lastIdxTone = '', lastChapter = '', lastAltitude = '', lastRitual = -1;
  let carouselSync = () => {};
  function update() {
    const vh = window.innerHeight, y = window.scrollY;
    const max = root.scrollHeight - vh;
    rail.style.setProperty('--progress', max > 0 ? clamp(y / max).toFixed(4) : 0);
    const hr = heroTrack.getBoundingClientRect();
    const heroP = root.classList.contains('can-hero') ? clamp(-hr.top / (hr.height - vh)) : 0;
    const pastHero = root.classList.contains('can-hero') ? heroP > .9 : hr.bottom < vh * .45;
    header.classList.toggle('is-shown', pastHero || root.classList.contains('menu-open'));
    index.classList.toggle('is-shown', pastHero && footer.getBoundingClientRect().top > vh - 60 && !root.classList.contains('menu-open'));
    let headTone = 'image', idxTone = 'image', current = null;
    for (const el of toned) {
      const r = el.getBoundingClientRect();
      if (r.top <= 36 && r.bottom > 36) headTone = toneOf(el);
      const iy = phone.matches ? 36 : vh * .5;
      if (r.top <= iy && r.bottom > iy) idxTone = toneOf(el);
      if (el.dataset.chapter && r.top <= vh * .5) current = el;
    }
    if (heroP > .94) headTone = hr.bottom > 36 ? 'light' : headTone;
    if (!root.classList.contains('menu-open') && headTone !== lastTone) header.dataset.tone = headTone;
    lastTone = headTone;
    if (idxTone !== lastIdxTone) { index.dataset.tone = idxTone; lastIdxTone = idxTone; }
    const ch = current ? current.dataset.chapter : '00';
    if (ch !== lastChapter) {
      lastChapter = ch;
      indexNum.textContent = ch;
      indexName.textContent = current ? current.dataset.name : 'prologue';
      menuLinks.forEach((a) => {
        if (a.hash === `#${current ? current.id : 'prologue'}`) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    }
    const ar = arrival.getBoundingClientRect();
    const arrivalP = root.classList.contains('can-pin') ? clamp(-ar.top / (ar.height - vh)) : clamp((vh * .6 - ar.top) / Math.max(1, ar.height - vh * .6));
    const roadP = clamp(arrivalP / .88);
    const altitude = current === arrival ? 480 + 660 * roadP : hr.bottom > vh ? 480 + 660 * heroP : 1140;
    const altitudeText = meters(altitude);
    if (altitudeText !== lastAltitude) { altitudes.forEach((el) => el.textContent = altitudeText); lastAltitude = altitudeText; }
    mapAltitude.textContent = Math.round(reduceMotion ? 1140 : 480 + 660 * roadP).toLocaleString('en-US');
    if (root.classList.contains('can-hero')) {
      hero.style.setProperty('--push', (1 + heroP * .65).toFixed(4));
      hero.style.setProperty('--night', (heroP * .55).toFixed(3));
      hero.style.setProperty('--bloom', (.25 + clamp(heroP / .7) * .75).toFixed(3));
      const flood = clamp((heroP - .75) / .18);
      hero.style.setProperty('--flood-scale', (.1 + flood * 32).toFixed(3));
      hero.style.setProperty('--flood-opacity', clamp(flood * 3).toFixed(3));
      hero.style.setProperty('--paper', clamp((heroP - .9) / .1).toFixed(3));
      hero.style.setProperty('--mist', (1 - clamp(heroP * 4)).toFixed(3));
      hero.classList.toggle('is-scrubbing', heroP > 0 || hero.classList.contains('intro-done'));
      heroLetters.forEach((s, i) => {
        const p = clamp((heroP - i * .045) / .22);
        s.style.transform = `translateY(${-p * 6}vh)`;
        s.style.opacity = 1 - p;
        s.style.fontVariationSettings = `"ELGR" 2, "ELSH" ${(12 * (1 - p)).toFixed(2)}`;
      });
      heroSub.style.opacity = 1 - clamp(heroP * 3);
      heroCue.style.opacity = 1 - clamp(heroP * 5);
    } else {
      heroLetters.forEach((s) => { s.style.removeProperty('transform'); s.style.removeProperty('opacity'); s.style.removeProperty('font-variation-settings'); });
      heroSub.style.removeProperty('opacity'); heroCue.style.removeProperty('opacity');
    }
    if (root.classList.contains('can-pin')) {
      route.style.setProperty('--route', (1 - roadP).toFixed(4));
      const point = route.getPointAtLength(routeLength * roadP);
      shuttle.setAttribute('cx', point.x); shuttle.setAttribute('cy', point.y);
      map.style.setProperty('--map-scale', .86 + .14 * clamp(-ar.top / vh));
      beatEls.forEach((b) => b.classList.toggle('is-on', arrivalP >= Number(b.dataset.beat) * .3));
    } else {
      route.style.removeProperty('--route');
      shuttle.setAttribute('cx', 470); shuttle.setAttribute('cy', 232);
      beatEls.forEach((b) => b.classList.add('is-on'));
    }
    const sr = sauna.getBoundingClientRect();
    sauna.classList.toggle('is-active', !reduceMotion && !document.hidden && sr.top < vh && sr.bottom > 0);
    let ritual = 0;
    ritualSteps.forEach((step, i) => { if (step.getBoundingClientRect().top < vh * .65) ritual = i; });
    if (ritual !== lastRitual) {
      lastRitual = ritual;
      saunaMedia.dataset.ritual = ritualSteps[ritual].dataset.ritual;
      saunaMedia.querySelector('.sauna__degrees').textContent = `${ritualSteps[ritual].dataset.temp}°`;
      saunaMedia.querySelector('.sauna__state').textContent = ritualLabels[ritual];
      ritualSteps.forEach((step, i) => step.classList.toggle('is-current', i === ritual));
    }
    carouselSync();
    if (reduceMotion) return;
    for (const s of seams) {
      const r = s.ownerSVGElement.getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) continue;
      s.style.setProperty('--seam-shift', `${((r.top / vh) * 26).toFixed(1)}px`);
    }
    if (words.length) {
      const r = prologue.getBoundingClientRect();
      const n = Math.round(clamp((vh * .82 - r.top) / (r.height + vh * .25)) * words.length);
      if (n !== litCount) { words.forEach((w, i) => w.classList.toggle('is-on', i < n)); litCount = n; }
    }
  }
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  document.addEventListener('visibilitychange', onScroll);
  [heroQuery, pinQuery].forEach((q) => q.addEventListener('change', () => { setPins(); update(); }));
  /* ---------- Reveals ---------- */
  const revealTargets = document.querySelectorAll('[data-reveal], .chapter__title, .finale__title, .table__media, .stat');
  const countUp = (el) => {
    const to = Number(el.dataset.count), from = Number(el.dataset.from || 0);
    const fmt = (v) => (el.dataset.format === 'thousands' ? v.toLocaleString('en-US') : String(v));
    if (reduceMotion) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 1400;
    const step = () => {
      const t = clamp((performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = fmt(from);
    requestAnimationFrame(step);
  };

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        e.target.querySelectorAll('[data-count]').forEach(countUp);
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });
    revealTargets.forEach((el) => io.observe(el));
  }


  /* ---------- Weighted cursor; runs only while visible and moving ---------- */
  const pill = document.createElement('div');
  pill.className = 'cursor-pill'; pill.setAttribute('aria-hidden', 'true');
  document.body.appendChild(pill);
  const attachPill = (el, label) => {
    if (!finePointer || reduceMotion) return;
    el.classList.add('has-pill');
    let raf = 0, tx = 0, ty = 0, x = 0, y = 0, active = false;
    const frame = () => {
      raf = 0;
      if (!active || document.hidden) return;
      x += (tx - x) * .18; y += (ty - y) * .18;
      pill.style.transform = `translate3d(${x - 42}px, ${y - 42}px, 0)`;
      if (Math.abs(tx - x) + Math.abs(ty - y) > .2) raf = requestAnimationFrame(frame);
    };
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      active = true; tx = x = e.clientX; ty = y = e.clientY;
      pill.textContent = label; pill.classList.add('is-on'); frame();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(frame);
    });
    const hide = () => { active = false; cancelAnimationFrame(raf); raf = 0; pill.classList.remove('is-on', 'is-pressed'); };
    el.addEventListener('pointerleave', hide);
    el.addEventListener('pointerdown', () => pill.classList.add('is-pressed'));
    el.addEventListener('pointerup', () => pill.classList.remove('is-pressed'));
    document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  };

  /* ---------- Centre-snapping rooms, native touch and keyboard ---------- */
  const carousel = document.querySelector('[data-carousel]');
  if (carousel) {
    const track = carousel.querySelector('.carousel__track');
    const slides = [...track.children];
    const cur = carousel.querySelector('.carousel__cur');
    const [prev, next] = carousel.querySelectorAll('.carousel__btn');
    carousel.querySelector('.carousel__total').textContent = String(slides.length).padStart(2, '0');
    const offsetOf = (i) => slides[i].offsetLeft + slides[i].offsetWidth / 2 - track.clientWidth / 2;
    const currentIndex = () => {
      let best = 0;
      slides.forEach((s, i) => { if (Math.abs(offsetOf(i) - track.scrollLeft) < Math.abs(offsetOf(best) - track.scrollLeft)) best = i; });
      return best;
    };
    const sync = () => {
      const i = currentIndex();
      cur.textContent = String(i + 1).padStart(2, '0');
      prev.disabled = i === 0; next.disabled = i === slides.length - 1;
      slides.forEach((s, n) => {
        const offset = (offsetOf(n) - track.scrollLeft) / s.offsetWidth;
        s.style.setProperty('--slide-scale', reduceMotion ? 1 : 1 - .08 * clamp(Math.abs(offset)));
        s.style.setProperty('--slide-opacity', 1 - .3 * clamp(Math.abs(offset)));
        s.style.setProperty('--slide-x', `${reduceMotion ? 0 : clamp(offset, -1, 1) * 8}%`);
        s.classList.toggle('is-current', i === n);
      });
    };
    carouselSync = () => {
      const r = track.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) sync();
    };
    const go = (i) => track.scrollTo({ left: offsetOf(clamp(i, 0, slides.length - 1)), behavior: reduceMotion ? 'auto' : 'smooth' });
    prev.addEventListener('click', () => go(currentIndex() - 1));
    next.addEventListener('click', () => go(currentIndex() + 1));
    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault(); go(currentIndex() + (e.key === 'ArrowRight' ? 1 : -1));
    });
    window.addEventListener('resize', sync);
    sync();
    let down = false, dragging = false, startX = 0, startLeft = 0, lastX = 0, lastT = 0, vel = 0;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; dragging = false;
      startX = lastX = e.clientX; startLeft = track.scrollLeft; lastT = performance.now(); vel = 0;
    });
    track.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!dragging && Math.abs(dx) > 4) { dragging = true; track.classList.add('is-dragging'); track.setPointerCapture(e.pointerId); }
      if (!dragging) return;
      const now = performance.now();
      vel = (e.clientX - lastX) / Math.max(1, now - lastT);
      lastX = e.clientX; lastT = now;
      track.scrollLeft = startLeft - dx;
    });
    const release = () => {
      if (!down) return;
      down = false;
      if (!dragging) return;
      const projected = track.scrollLeft - vel * 220;
      let best = 0;
      slides.forEach((s, i) => { if (Math.abs(offsetOf(i) - projected) < Math.abs(offsetOf(best) - projected)) best = i; });
      track.classList.remove('is-dragging'); go(best);
      setTimeout(() => { dragging = false; }, 0);
    };
    window.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);
    track.addEventListener('click', (e) => { if (dragging) e.preventDefault(); }, true);
    track.addEventListener('dragstart', (e) => e.preventDefault());
    attachPill(track, 'Drag');
  }

  /* ---------- Snow line: one accessible Summer / Winter switch ---------- */
  const stage = document.querySelector('[data-season]');
  if (stage) {
    const toggle = stage.querySelector('.season-stage__toggle');
    const now = stage.querySelector('.season-stage__now');
    const status = stage.querySelector('.season-stage__status');
    let winter = false, snow = 0, raf = 0;
    let from = 0, target = 0, started = 0, duration = 0;
    const paint = () => {
      stage.style.setProperty('--snow-y', `${85 - snow * 70}%`);
      now.textContent = meters(2600 - snow * 1460);
      if (snow === 0 || snow === 1) status.textContent = snow === 1 ? 'Winter. Snow line at the lodge, 1,140 metres.' : 'Summer. Snow line above 2,600 metres.';
    };
    const frame = (t) => {
      raf = 0;
      if (document.hidden) return;
      const p = clamp((t - started) / duration);
      snow = from + (target - from) * (1 - Math.pow(1 - p, 3));
      if (p === 1) snow = target;
      paint();
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      cancelAnimationFrame(raf); raf = 0;
      from = snow; target = winter ? 1 : 0;
      duration = winter ? 1600 : 900; started = performance.now();
      if (reduceMotion) { snow = target; paint(); }
      else raf = requestAnimationFrame(frame);
    };
    toggle.addEventListener('click', () => {
      winter = !winter;
      toggle.setAttribute('aria-pressed', String(winter));
      toggle.textContent = winter ? 'Summer view' : 'Winter view';
      kick();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else kick();
    });
    paint();
  }

  /* ---------- Menu with current chapter and a contained keyboard path ---------- */
  const menuBtn = header.querySelector('.header__menu');
  const menuLabel = menuBtn.querySelector('.header__menu-label');
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuLabel.textContent = open ? 'Close' : 'Menu';
    menu.hidden = !open; main.inert = footer.inert = open;
    root.classList.toggle('menu-open', open); root.classList.toggle('is-locked', open);
    header.dataset.tone = open ? 'dark' : lastTone;
    if (open) { header.classList.add('is-shown'); menuLinks[0].focus(); } else { update(); }
  };
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  header.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { if (!menu.hidden) setMenu(false); }));
  menu.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    setMenu(false);
    if (a.hash) { const dest = document.querySelector(a.hash); dest?.setAttribute('tabindex', '-1'); dest?.focus({ preventScroll: true }); }
  });
  document.addEventListener('keydown', (e) => {
    if (menu.hidden) return;
    if (e.key === 'Escape') { setMenu(false); menuBtn.focus(); }
    if (e.key === 'Tab') {
      const focusables = [...header.querySelectorAll('a,button'), ...menu.querySelectorAll('a')];
      const i = focusables.indexOf(document.activeElement);
      if (e.shiftKey && i === 0) { e.preventDefault(); focusables[focusables.length - 1].focus(); }
      if (!e.shiftKey && i === focusables.length - 1) { e.preventDefault(); focusables[0].focus(); }
    }
  });
  update();
  /* ---------- Booking form (front end only) ---------- */
  const form = document.querySelector('.booking');
  if (form) {
    const arrivalInput = form.elements.arrival;
    const today = new Date();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    arrivalInput.min = iso(today);
    const status = form.querySelector('.booking__status');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let firstBad = null;
      [...form.querySelectorAll('[required]')].forEach((f) => {
        const bad = !f.value.trim() || !f.validity.valid || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
        f.setAttribute('aria-invalid', String(bad));
        if (bad && !firstBad) firstBad = f;
      });
      if (firstBad) {
        status.textContent = 'Please choose an arrival date from today onward, and add your name and a valid email.';
        firstBad.focus();
        return;
      }
      const d = new Date(`${arrivalInput.value}T12:00:00`);
      const when = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
      const name = form.elements.name.value.trim().split(/\s+/)[0];
      status.textContent = `Thank you, ${name}. ${form.elements.nights.value} nights in a ${form.elements.room.value === 'Surprise us' ? 'room of our choosing' : form.elements.room.value} from ${when} would be a fine choice. This is a concept site, so nothing was sent.`;
    });
    form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid') === 'true') e.target.removeAttribute('aria-invalid'); });
  }
})();
