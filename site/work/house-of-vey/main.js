/* House of Vey: Experimental / Scroll Storytelling concept
   Gate (an arch that becomes the front door), the house (three.js, see house.js) driven by scroll,
   bag side panel with colourways (bags.js), collection grid, menu, reveals. */
(() => {
  const html = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const audio = window.VeyAudio;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const header = document.querySelector('.header');
  const main = document.getElementById('main');
  const footer = document.querySelector('.footer');
  const gate = document.getElementById('gate');
  const house = document.getElementById('house');
  const roomEls = [...document.querySelectorAll('.room')];

  /* ---------- Justified lockups: words travel from the centre out to the edges ---------- */
  function animateLock(lock, baseDelay = 0) {
    if (reduceMotion || !lock.animate) return;
    lock.querySelectorAll('.lock__line').forEach((line, li) => {
      const items = [...line.children];
      const lineBox = line.getBoundingClientRect();
      const fs = parseFloat(getComputedStyle(line).fontSize);
      const gap = items.length > 3 ? 0.06 * fs : 0.3 * fs;
      const widths = items.map((el) => el.getBoundingClientRect().width);
      const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
      let x = lineBox.left + (lineBox.width - total) / 2;
      items.forEach((el, k) => {
        const dx = x - el.getBoundingClientRect().left;
        x += widths[k] + gap;
        el.animate([
          { transform: `translateX(${dx}px)`, opacity: 0 },
          { transform: `translateX(${dx}px)`, opacity: 1, offset: 0.14 },
          { transform: 'none', opacity: 1 }
        ], { duration: 1700, delay: baseDelay + li * 110, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'backwards' });
      });
    });
  }

  /* ---------- Sound toggles ---------- */
  const soundBtns = document.querySelectorAll('[data-sound]');
  const syncSound = () => {
    const on = audio ? audio.isOn() : false;
    soundBtns.forEach((b) => {
      b.setAttribute('aria-pressed', String(on));
      const s = b.querySelector('[data-sound-state]');
      if (s) s.textContent = on ? 'on' : 'off';
    });
  };
  soundBtns.forEach((b) => b.addEventListener('click', () => {
    if (!audio) return;
    audio.setOn(!audio.isOn());
    syncSound();
  }));
  syncSound();

  /* ---------- The house: three.js scene (house.js) ---------- */
  let houseScene = null, pendingStop = -1;
  let gated = html.classList.contains('is-gated');
  let entering = false;
  const webgl = (() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  })();
  if (house && webgl) {
    house.classList.add('house--3d', 'is-loading');
    const onHouse = (api) => {
      houseScene = api;
      if (!api) { house.classList.remove('house--3d', 'is-loading'); return; }   // no 3D after all: the rooms become a list
      if (api && !gated && !entering) api.arrive({ instant: true });
      if (api && pendingStop >= 0) { window.scrollTo(0, api.stopTop(pendingStop)); api.kick(); pendingStop = -1; }
    };
    if (window.VeyHouse) onHouse(window.VeyHouse);
    window.addEventListener('vey:house', (e) => onHouse(e.detail));
    // if the module never arrives (blocked CDN, old browser), fall back to the list
    setTimeout(() => { if (!houseScene && !window.VeyHouse) house.classList.remove('house--3d', 'is-loading'); }, 20000);
  }

  /* ---------- Gate ---------- */
  const setInert = (on) => [header, main, footer].forEach((el) => { if (el) el.inert = on; });

  // the house is open: hand the page over (scroll, header, focus)
  function opened(focus) {
    entering = false;
    gate.hidden = true;
    html.classList.remove('is-gated', 'is-entering');
    setInert(false);
    if (focus) {
      const title = document.getElementById('house-title');
      title.setAttribute('tabindex', '-1');
      title.focus({ preventScroll: true });
    }
  }

  function enter({ instant = false, focus = false } = {}) {
    if (!gated || entering) return;
    entering = true;
    window.scrollTo(0, 0);
    if (instant || reduceMotion) {
      gated = false;
      gate.classList.add('is-gone');
      houseScene && houseScene.arrive({ instant: true });
      opened(focus);
      return;
    }
    gate.getAnimations({ subtree: true }).forEach((a) => a.finish());
    gate.classList.add('is-leaving');
    // the 3D house opens the arch into its front door; without it the gate simply lifts away
    const go = (api) => {
      gated = false;
      if (api) {
        html.classList.add('is-entering');
        api.arrive({ onDone: () => opened(focus) });
      } else {
        gate.classList.add('is-fading');
        setTimeout(() => opened(focus), 700);
      }
    };
    if (houseScene || !house.classList.contains('house--3d')) go(houseScene);
    else {
      gate.classList.add('is-waiting');
      const wait = (e) => { clearTimeout(timer); window.removeEventListener('vey:house', wait); gate.classList.remove('is-waiting'); go(e ? e.detail : null); };
      const timer = setTimeout(() => wait(null), 8000);
      window.addEventListener('vey:house', wait);
    }
  }

  if (gate && gated) {
    setInert(true);
    const ready = () => {
      if (gate.classList.contains('is-ready')) return;
      gate.querySelectorAll('.lock').forEach((l, i) => animateLock(l, 60 + i * 90));
      gate.classList.add('is-ready');
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(ready));
    setTimeout(ready, 1800);

    gate.querySelector('[data-enter]').addEventListener('click', (e) => {
      e.preventDefault();
      enter({ focus: true });
    });
    // the skip link and deep links bypass the gate
    document.querySelector('.skip').addEventListener('click', () => enter({ instant: true }));
    if (location.hash && location.hash !== '#house' && location.hash !== '#gate' && document.querySelector(location.hash)) {
      enter({ instant: true });
      const room = /^#room-(\d)$/.exec(location.hash);
      if (room && house.classList.contains('house--3d')) pendingStop = Number(room[1]);   // walk to it once the house is up
      else requestAnimationFrame(() => document.querySelector(location.hash).scrollIntoView());
    }
  }

  window.addEventListener('vey:open', (e) => openPanel(e.detail));

  function goStop(s) {
    if (!houseScene) { document.getElementById(s ? `room-${s}` : 'house').scrollIntoView(); return; }
    window.scrollTo({ top: houseScene.stopTop(s), behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  /* ---------- Bag panel ---------- */
  const panel = document.getElementById('panel');
  const P = (sel) => panel.querySelector(sel);
  let panelIndex = -1, closeTimer = 0;

  function openPanel(i) {
    const room = roomEls[i];
    if (!room || !panel.showModal) return;
    clearTimeout(closeTimer);
    panelIndex = i;
    P('[data-p-room]').textContent = room.querySelector('.eyebrow').textContent.replace(/\s+/g, ' ').trim().replace(/^(Room \d+) /, '$1 · ');
    P('[data-p-name]').textContent = room.querySelector('.room__name').textContent;
    const src = room.querySelector('[data-bag]');
    const img = P('[data-p-img]');
    const current = bags ? bags.selected[i] : 0;
    img.src = src.getAttribute('src'); img.alt = src.alt;
    P('.panel__figure').querySelectorAll('.panel__previous').forEach((n) => n.remove());
    P('.panel__figure').style.setProperty('--room', room.style.getPropertyValue('--room'));

    const sw = P('[data-p-swatches]');
    sw.textContent = '';
    const items = [...room.querySelectorAll('.swatches li')];
    const legend = P('[data-p-colour]'), note = P('[data-p-note]');
    const pick = (k, animate) => {
      legend.textContent = items[k].textContent;
      note.textContent = k === 0
        ? 'Shown here. In stock at the house.'
        : `Made to order in ${items[k].textContent.toLowerCase()}, about six weeks.`;
      if (bags) recolour(i, k, animate);
    };
    items.forEach((li, k) => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="colour" value="${li.textContent}"${k === current ? ' checked' : ''}><span class="chip" style="--c:${li.style.getPropertyValue('--c')}"></span><span class="sr">${li.textContent}</span>`;
      label.querySelector('input').addEventListener('change', () => pick(k, true));
      sw.appendChild(label);
    });
    pick(current, false);

    const spec = P('[data-p-spec]');
    spec.textContent = '';
    spec.appendChild(room.querySelector('.spec').cloneNode(true));

    if (!panel.open) panel.showModal();
    panel.scrollTop = 0;
    requestAnimationFrame(() => panel.classList.add('is-open'));
    html.classList.add('panel-open');
    houseScene && houseScene.setPanel(i);
    audio && audio.chime();
  }

  function closePanel(immediate) {
    if (!panel.open) return;
    panel.classList.remove('is-open');
    html.classList.remove('panel-open');
    houseScene && houseScene.setPanel(-1);
    if (immediate || reduceMotion) panel.close();
    else closeTimer = setTimeout(() => panel.close(), 420);
  }

  /* ---------- Colourways: one recoloured cut-out feeds the panel, the room and the collection ---------- */
  const bags = window.VeyBags;
  const tileImgs = [...document.querySelectorAll('.tile__img img')];
  function recolour(i, k, animate) {
    bags.selected[i] = k;
    bags.get(i, k).then((res) => {
      if (bags.selected[i] !== k) return;
      const img = P('[data-p-img]');
      if (panelIndex === i && img.getAttribute('src') !== res.url) {
        if (animate && !reduceMotion) {
          const prev = img.cloneNode();
          prev.className = 'panel__previous';
          prev.removeAttribute('data-p-img');
          img.parentNode.appendChild(prev);
          img.src = res.url;
          (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => {
            prev.classList.add('is-gone');
            setTimeout(() => prev.remove(), 300);
          });
        } else img.src = res.url;
        img.alt = roomEls[i].querySelector('[data-bag]').alt.replace(/^([^:]+):/, `$1 in ${roomEls[i].querySelectorAll('.swatches li')[k].textContent.toLowerCase()}:`);
      }
      if (tileImgs[i]) tileImgs[i].src = res.url;
      roomEls[i].querySelector('[data-bag]').src = res.url;
      houseScene && houseScene.setColour(i, `${i}:${k}`, res.canvas);
    }).catch(() => {});
  }

  if (panel) {
    panel.addEventListener('cancel', (e) => { e.preventDefault(); closePanel(); });
    panel.addEventListener('click', (e) => {
      const r = panel.getBoundingClientRect();
      if (e.target === panel && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) closePanel();
    });
    P('[data-close]').addEventListener('click', () => closePanel());
    P('[data-close-to]').addEventListener('click', () => closePanel(true));
    P('[data-p-walk]').addEventListener('click', (e) => {
      e.preventDefault();
      const i = panelIndex;
      closePanel(true);
      goStop(i + 1);
    });
  }

  document.querySelectorAll('[data-open]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (!panel || !panel.showModal) return;
      e.preventDefault();
      openPanel(Number(el.dataset.open));
    });
  });

  /* ---------- Menu ---------- */
  const menuBtn = document.querySelector('.header__menu');
  const menu = document.getElementById('menu');
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.querySelectorAll('[data-menu-label]').forEach((s) => { s.textContent = open ? 'Close' : 'Menu'; });
    menu.hidden = !open;
    menu.classList.toggle('is-open', open);
    html.classList.toggle('menu-open', open);
    [main, footer].forEach((el) => { el.inert = open; });
    header.classList.toggle('is-menu', open);
    if (open) { header.classList.remove('is-light'); menu.querySelector('a').focus(); } else onScroll();
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    setMenu(false);
    if (a.dataset.stop !== undefined && houseScene) { e.preventDefault(); goStop(Number(a.dataset.stop)); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); }
  });
  // in-page links to rooms go to their place in the walk
  document.querySelectorAll('a[href="#house"]:not([data-stop])').forEach((a) => a.addEventListener('click', (e) => {
    if (!houseScene) return;
    e.preventDefault(); goStop(0);
  }));

  /* ---------- Header contrast + progress rail ---------- */
  const collection = document.getElementById('collection');
  const railFill = document.querySelector('.rail__fill');
  let ticking = false;
  function onScroll() {
    ticking = false;
    const top = collection.offsetTop - window.scrollY, bottom = top + collection.offsetHeight;
    const cream = (top <= 40 && bottom > 40) || (html.classList.contains('portal-cream') && bottom > 40);
    header.classList.toggle('is-light', !menu.classList.contains('is-open') && cream);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    railFill.style.transform = `scaleY(${max > 0 ? clamp(window.scrollY / max) : 0})`;
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('vey:layout', onScroll);
  onScroll();

  /* ---------- Reveals ---------- */
  const revealTargets = document.querySelectorAll('[data-reveal]');
  const visitLock = document.querySelector('.lock--visit');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-in'));
    visitLock && visitLock.classList.add('is-in');
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        if (e.target === visitLock) { animateLock(visitLock, 0); visitLock.classList.add('is-in'); }
        else e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealTargets.forEach((el) => io.observe(el));
    if (visitLock) io.observe(visitLock);
  }
})();
