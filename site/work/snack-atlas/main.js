/* Snack Atlas — Playful / Illustrative (pop) concept
   Hero load-in, scroll packing scene, snack crunch, reveals, mobile menu, postcard flip,
   billing toggle, FAQ accordion, sticky footer stack, newsletter. */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Hero ---------- */
  const hero = document.querySelector('.hero');
  const stage = document.querySelector('.stage');
  const pars = stage ? [...stage.querySelectorAll('.par')] : [];

  const showHero = () => requestAnimationFrame(() => hero.classList.add('is-loaded'));
  if (reduceMotion) hero.classList.add('is-loaded');
  else {
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(showHero);
    setTimeout(() => hero.classList.add('is-loaded'), 1500);
  }

  const clamp = (n) => Math.max(0, Math.min(1, n));
  const beat = (p, a, b) => clamp((p - a) / (b - a));
  const mix = (a, b, p) => a + (b - a) * p;
  const smooth = (p) => p * p * (3 - 2 * p);
  const motionSections = [...document.querySelectorAll('.hero, .marquee, .how')];
  const inView = new Map(motionSections.map((el) => [el, false]));
  const how = document.querySelector('.how');
  const packingMedia = window.matchMedia('(min-width: 1041px) and (prefers-reduced-motion: no-preference)');
  let motionFrame = 0;

  const renderPacking = () => {
    if (!how.classList.contains('has-packing')) return;
    const p = clamp(-how.getBoundingClientRect().top / Math.max(1, how.offsetHeight - window.innerHeight));
    how.dataset.progress = p.toFixed(3);
    how.dataset.beat = p < .28 ? '0' : p < .67 ? '1' : '2';
    const mapOut = beat(p, .24, .37);
    const dispatch = smooth(beat(p, .67, .94));
    const box = `translate(${mix(370, 570, dispatch)}px, ${mix(340, 185, dispatch)}px) rotate(${mix(-6, 0, dispatch)}deg) scale(${mix(1, .22, dispatch)})`;
    const style = (sel, props) => Object.assign(how.querySelector(sel).style, props);
    style('.pack-map', { opacity: 1 - mapOut, transform: `translateX(${-60 * mapOut}px)` });
    style('.pack-pin', { transformOrigin: '254px 248px', transform: `scale(${smooth(beat(p, .02, .16))})` });
    style('.pack-country', { opacity: beat(p, .12, .22) });
    style('.pack-route', { clipPath: `inset(0 0 ${100 * (1 - beat(p, 0, .17))}% 0)` });
    for (const sel of ['.pack-box-back', '.pack-box-front']) style(sel, { transform: box, opacity: beat(p, .23, .32) });
    style('.pack-open', { opacity: 1 - beat(p, .63, .69) });
    style('.pack-lid', { clipPath: `inset(${100 * (1 - beat(p, .62, .69))}% 0 0)` });
    style('.pack-stamp-paper', { opacity: beat(p, .73, .89) });
    style('.pack-card', { opacity: beat(p, .68, .78), transform: `translateY(${55 * (1 - dispatch)}px)` });
    style('.pack-postmark', { opacity: beat(p, .93, 1) });
    const starts = [[-240, -250, -40, 65, -22], [220, -230, 20, 70, 16], [-250, -50, 55, 60, -14]];
    starts.forEach(([x, y, endX, endY, r], i) => {
      const t = smooth(beat(p, .29 + i * .1, .45 + i * .1));
      style(`.pack-food--${i + 1}`, {
        opacity: beat(p, .25 + i * .1, .29 + i * .1) * (1 - beat(p, .64, .67)),
        transform: `translate(${mix(x, endX, t)}px, ${mix(y, endY, t)}px) rotate(${mix(r, -r, t)}deg) scale(${mix(1, .7, t)})`
      });
    });
  };
  const renderMotion = () => {
    motionFrame = 0;
    if (document.hidden) return;
    if (!reduceMotion && inView.get(hero)) {
      const y = Math.min(window.scrollY, window.innerHeight * 1.2);
      pars.forEach((p) => p.style.setProperty('--sy', y.toFixed(0)));
    }
    if (inView.get(how)) renderPacking();
  };
  const requestMotion = () => { if (!document.hidden && !motionFrame) motionFrame = requestAnimationFrame(renderMotion); };
  const syncPacking = () => {
    how.classList.toggle('has-packing', packingMedia.matches);
    requestMotion();
  };
  packingMedia.addEventListener('change', syncPacking);
  syncPacking();
  window.addEventListener('scroll', requestMotion, { passive: true });
  window.addEventListener('resize', requestMotion, { passive: true });

  if (stage && !reduceMotion) {
    // mouse parallax: objects drift away from the cursor, each by its own depth
    if (finePointer) {
      let mx = 0, my = 0, raf = 0;
      const apply = () => { pars.forEach((p) => { p.style.setProperty('--mx', mx); p.style.setProperty('--my', my); }); raf = 0; };
      hero.addEventListener('pointermove', (e) => {
        mx = (e.clientX / window.innerWidth - 0.5) * 2;
        my = (e.clientY / window.innerHeight - 0.5) * 2;
        if (!document.hidden && inView.get(hero) && !raf) raf = requestAnimationFrame(apply);
      });
      hero.addEventListener('pointerleave', () => { mx = 0; my = 0; if (!raf) raf = requestAnimationFrame(apply); });
      document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } });
    }

    // tap a snack: it squashes and drops crumbs
    const crumbColours = ['#ffd35a', '#fff3e2', '#c4773a', '#ff8dbf'];
    stage.querySelectorAll('.obj--snack').forEach((obj) => {
      const art = obj.querySelector('svg');
      obj.addEventListener('pointerdown', (e) => {
        art.classList.remove('is-crunched');
        void art.offsetWidth;
        art.classList.add('is-crunched');
        const box = stage.getBoundingClientRect();
        for (let i = 0; i < 9; i++) {
          const c = document.createElement('span');
          const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
          const dist = 40 + Math.random() * 50;
          c.className = 'crumb';
          c.style.left = `${e.clientX - box.left}px`;
          c.style.top = `${e.clientY - box.top}px`;
          c.style.setProperty('--tx', `${Math.cos(a) * dist}px`);
          c.style.setProperty('--ty', `${Math.sin(a) * dist + 30}px`);
          c.style.setProperty('--tr', `${Math.random() * 360}deg`);
          c.style.setProperty('--cc', crumbColours[i % crumbColours.length]);
          stage.appendChild(c);
          c.addEventListener('animationend', () => c.remove());
        }
      });
    });
  }

  // Visibility and intersection must both allow motion. No perpetual rAF loop.
  const syncMotion = () => {
    motionSections.forEach((el) => el.classList.toggle('is-paused', document.hidden || !inView.get(el)));
    if (document.hidden) { cancelAnimationFrame(motionFrame); motionFrame = 0; }
    else requestMotion();
  };
  if ('IntersectionObserver' in window) {
    const pauseIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => inView.set(e.target, e.isIntersecting));
      syncMotion();
    });
    motionSections.forEach((el) => pauseIO.observe(el));
  } else motionSections.forEach((el) => inView.set(el, true));
  document.addEventListener('visibilitychange', syncMotion);
  syncMotion();

  /* ---------- Scroll reveals ---------- */
  const revealTargets = document.querySelectorAll('[data-reveal]');
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

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.querySelector('.nav__menu');
  const menu = document.getElementById('menu');
  if (menuBtn && menu) {
    let closeTimer;
    const setMenu = (open) => {
      clearTimeout(closeTimer);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.textContent = open ? 'Close' : 'Menu';
      root.classList.toggle('menu-open', open);
      document.querySelectorAll('main, .footer').forEach((el) => { el.inert = open; });
      if (open) {
        menu.hidden = false;
        void menu.offsetWidth;
        menu.classList.add('is-open');
        menu.querySelector('a').focus();
      } else {
        menu.classList.remove('is-open');
        closeTimer = setTimeout(() => { menu.hidden = true; }, reduceMotion ? 0 : 600);
      }
    };
    menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
    });
    window.matchMedia('(min-width: 1041px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
  }

  /* ---------- Postcard flip ---------- */
  const postcard = document.getElementById('postcard');
  const flipBtn = document.querySelector('.tile-btn');
  if (postcard && flipBtn) {
    const front = postcard.querySelector('.postcard__front');
    const back = postcard.querySelector('.postcard__back');
    const label = flipBtn.querySelector('.tile-btn__label');
    const setFlip = (flipped) => {
      postcard.classList.toggle('is-flipped', flipped);
      flipBtn.setAttribute('aria-pressed', String(flipped));
      label.textContent = flipped ? 'Flip it back' : 'Flip the postcard';
      front.setAttribute('aria-hidden', String(flipped));
      back.setAttribute('aria-hidden', String(!flipped));
    };
    setFlip(false);
    const toggle = () => setFlip(!postcard.classList.contains('is-flipped'));
    flipBtn.addEventListener('click', toggle);
    postcard.addEventListener('click', toggle);
  }

  /* ---------- Billing toggle ---------- */
  const billing = document.querySelectorAll('input[name="billing"]');
  const nums = document.querySelectorAll('.tier__num');
  const bills = document.querySelectorAll('.tier__bill');
  billing.forEach((input) => input.addEventListener('change', () => {
    const key = input.value;
    bills.forEach((b) => { b.textContent = b.dataset[key]; });
    nums.forEach((n) => {
      const next = n.dataset[key];
      n.textContent = next;
      if (!reduceMotion && n.animate) {
        n.animate([{ transform: 'translateY(40%) rotate(-6deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.34, 1.56, .64, 1)' });
      }
    });
  }));

  /* ---------- FAQ ---------- */
  document.querySelectorAll('.qa button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      btn.closest('.qa').classList.toggle('is-open', open);
    });
  });

  /* ---------- Sticky stack: the footer slides over the FAQ ---------- */
  const faq = document.querySelector('.faq');
  const footer = document.querySelector('.footer');
  if (faq && footer && 'ResizeObserver' in window) {
    const measure = () => {
      root.style.setProperty('--faq-h', `${faq.offsetHeight}px`);
      root.style.setProperty('--footer-h', `${footer.offsetHeight}px`);
    };
    new ResizeObserver(measure).observe(faq);
    new ResizeObserver(measure).observe(footer);
    measure();
  }

  /* ---------- Newsletter (front end only) ---------- */
  const form = document.querySelector('.news');
  if (form) {
    const input = form.querySelector('input');
    const msg = form.querySelector('.news__msg');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input.value.trim() || !input.checkValidity()) {
        msg.textContent = 'Hmm, that email looks a bit stale. Try again?';
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      msg.textContent = 'You’re on the list! First postcard lands Nov 1.';
      form.reset();
    });
  }
})();
