/* Nice & Specific — Editorial / Magazine concept
   Nameplate fit + letter rise, clipping arrival and drift, the 1.4M counter, headline line reveals,
   running head folio, the Detail Pass (pinned scroll scrub), case-study preview reel, quote carousel, mobile menu. */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();

  /* ---------- Nameplates: set the type to fill the measure exactly ---------- */
  const plates = [...document.querySelectorAll('.np, .back__np')];
  const fit = (el) => {
    const set = el.querySelector('.np__set');
    const cs = getComputedStyle(el);
    const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const size = parseFloat(cs.fontSize);
    const w = set.getBoundingClientRect().width;
    if (w > 0 && avail > 0) el.style.fontSize = `${(size * avail / w).toFixed(2)}px`;
  };
  const fitAll = () => plates.forEach(fit);
  fitAll();

  const cover = document.querySelector('.cover');
  let started = false;
  let introDone;
  const intro = new Promise((r) => { introDone = r; });
  const start = () => {
    if (started) return;
    started = true;
    fitAll();
    root.classList.add('np-go');
    // letters ~1.8 s, highlighter at 0.7 s, clippings land 1.0–1.8 s (CSS); the counter waits for all of it
    setTimeout(introDone, reduceMotion ? 0 : 1800);
    // the highlighter swipes across the cover line once the nameplate has landed
    setTimeout(() => cover && cover.classList.add('is-ready'), reduceMotion ? 0 : 700);
  };
  fontsReady.then(start);
  setTimeout(start, 1500);

  let fitTimer;
  window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitAll, 120); });

  /* ---------- 1.4M: ticks up from 0 once, after the cover has arrived ---------- */
  const tick = document.querySelector('.tick');
  if (tick && !reduceMotion && 'IntersectionObserver' in window) {
    const to = Number(tick.dataset.to);
    const fmt = (v) => (v >= 999500 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : String(Math.round(v)));
    tick.textContent = '0';
    const run = () => {
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min((now - t0) / 1200, 1);
        tick.textContent = t >= 1 ? fmt(to) : fmt(to * (1 - Math.pow(2, -10 * t)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const tickIO = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      tickIO.disconnect();
      intro.then(run);
    }, { threshold: 0.6 });
    tickIO.observe(tick);
  }

  /* ---------- Headlines: split into words, stagger by line ---------- */
  const splits = [...document.querySelectorAll('[data-split]')];
  splits.forEach((el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('span');
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
  });
  const indexLines = () => splits.forEach((el) => {
    let top = null, line = -1;
    el.querySelectorAll('.w').forEach((w) => {
      const t = w.offsetTop;
      if (top === null || Math.abs(t - top) > 4) { line++; top = t; }
      w.style.setProperty('--li', line);
    });
  });
  indexLines();
  fontsReady.then(indexLines);

  /* ---------- Scroll reveals ---------- */
  const revealTargets = document.querySelectorAll('[data-reveal], [data-split]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });
    revealTargets.forEach((el) => io.observe(el));
  }

  /* ---------- Running head: wordmark after the nameplate, folio per section ---------- */
  const rh = document.querySelector('.rh');
  const np = document.querySelector('.np');
  const pageEl = document.querySelector('.rh__page');
  const sectionEl = document.querySelector('.rh__section');
  if (rh && np && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      rh.classList.toggle('is-scrolled', !e.isIntersecting && e.boundingClientRect.top < 0);
    }, { rootMargin: `-${rh.offsetHeight}px 0px 0px 0px` }).observe(np);

    const folios = document.querySelectorAll('[data-folio]');
    const folioIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        pageEl.textContent = `p. ${e.target.dataset.folio}`;
        sectionEl.textContent = e.target.dataset.name;
      });
    }, { rootMargin: '-45% 0px -54% 0px' });
    folios.forEach((s) => folioIO.observe(s));
  }

  /* ---------- Clippings drift a little slower than the page ---------- */
  const clips = [...document.querySelectorAll('.clip')];
  if (clips.length && !reduceMotion) {
    const speeds = [0.1, 0.2];
    let coverVisible = true, ticking = false;
    const narrow = window.matchMedia('(max-width: 760px)');
    const update = () => {
      ticking = false;
      if (!coverVisible) return;
      // on phones the clippings sit under the buttons, so they stay put
      const y = narrow.matches ? 0 : Math.min(window.scrollY, window.innerHeight * 1.2);
      clips.forEach((clip, i) => {
        const travel = Math.min(y * speeds[i % 2], 60);
        clip.style.setProperty('--py', `${(-travel).toFixed(1)}px`);
        clip.style.setProperty('--pr', `${((i ? -1 : 1) * Math.min(y / 400, 1) * 2).toFixed(2)}deg`);
      });
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { coverVisible = e.isIntersecting; if (coverVisible) update(); }).observe(cover);
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    narrow.addEventListener('change', update);
  }


  /* ---------- The Detail Pass: a brochure becomes a headline (pinned, scrubbed by native scroll) ---------- */
  const pass = document.querySelector('.pass');
  if (pass && !reduceMotion && 'IntersectionObserver' in window && window.CSS && CSS.supports('position', 'sticky')) {
    root.classList.add('pass-live');
    const runway = pass.querySelector('.pass__runway');
    const stage = pass.querySelector('.pass__stage');
    const sheet = pass.querySelector('.pass__sheet');
    const barsEl = pass.querySelector('.pass__bars');
    const heads = [...pass.querySelectorAll('.pass__head')];
    const ink = pass.querySelector('.pass__ink');
    const card = pass.querySelector('.pass__card');
    const steps = [...pass.querySelectorAll('.pass__steps li')];
    const targets = [...pass.querySelectorAll('[data-nope]'), pass.querySelector('.pass__buried')];
    const workTitle = document.getElementById('work-title');

    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const seg = (p, a, b) => clamp01((p - a) / (b - a));
    const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const out = (t) => 1 - Math.pow(1 - t, 3);
    const lerp = (a, b, t) => a + (b - a) * t;

    // per sweep: [starts, lands, has faded]. The fourth lands on the buried sentence and stays.
    const WIN = [[0.10, 0.15, 0.19], [0.17, 0.22, 0.26], [0.24, 0.29, 0.33], [0.31, 0.38, 1]];
    let M = null, tags = [], active = false, ticking = false, lastP = -1, phase = -1, lastW = 0;

    const measure = () => {
      sheet.style.transform = 'none';
      tags.forEach((t) => t.remove());
      tags = [];
      barsEl.textContent = '';
      const cs = getComputedStyle(stage);
      const W = stage.clientWidth, H = stage.clientHeight;
      const padT = parseFloat(cs.paddingTop), padB = parseFloat(cs.paddingBottom), padX = parseFloat(cs.paddingLeft);
      const sw = sheet.offsetWidth, sh = sheet.offsetHeight;
      const fit = Math.min(1, (H - padT - padB) / sh, (W - 2 * padX) / sw);
      const sRect = sheet.getBoundingClientRect();

      const groups = targets.map((t, i) => {
        const rects = [...t.getClientRects()].filter((r) => r.width > 2);
        const total = rects.reduce((a, r) => a + r.width, 0) || 1;
        let acc = 0;
        const bars = rects.map((r) => {
          const el = document.createElement('i');
          el.className = 'pass__bar';
          el.style.cssText = `left:${(r.left - sRect.left - 2).toFixed(1)}px;top:${(r.top - sRect.top + r.height * 0.2).toFixed(1)}px;width:${(r.width + 4).toFixed(1)}px;height:${(r.height * 0.7).toFixed(1)}px`;
          barsEl.appendChild(el);
          const from = acc / total;
          acc += r.width;
          return { el, from, to: acc / total };
        });
        let tag = null;
        if (i < 3 && rects.length) {
          const last = rects[rects.length - 1];
          tag = document.createElement('span');
          tag.className = 'pass__nope';
          tag.textContent = 'nope';
          sheet.appendChild(tag);
          tags.push(tag);
          const tw = tag.offsetWidth, th = tag.offsetHeight;
          let x = last.right - sRect.left + 6;
          if (x + tw > sw - 8) x = last.right - sRect.left - tw;
          tag.style.left = `${x.toFixed(1)}px`;
          tag.style.top = `${(last.top - sRect.top + (last.height - th) / 2).toFixed(1)}px`;
        }
        return { bars, tag };
      });

      // the buried sentence's box, in sheet coordinates
      const br = [...targets[3].getClientRects()].filter((r) => r.width > 2);
      const bx0 = Math.min(...br.map((r) => r.left)) - sRect.left, bx1 = Math.max(...br.map((r) => r.right)) - sRect.left;
      const by0 = Math.min(...br.map((r) => r.top)) - sRect.top, by1 = Math.max(...br.map((r) => r.bottom)) - sRect.top;

      const hw = heads[0].offsetWidth, hh = heads[0].offsetHeight;
      const headFont = parseFloat(getComputedStyle(heads[0]).fontSize);
      const endFont = workTitle ? parseFloat(getComputedStyle(workTitle).fontSize) : headFont * 0.62;
      const kEnd = Math.min(1, endFont / headFont);
      const top = padT;
      const dyEnd = top + (hh * kEnd) / 2 - H / 2;

      // the first reel card rises into the space under the settled headline
      const cardTop = top + hh * kEnd + Math.max(20, H * 0.03);
      let cardH = H - cardTop - Math.max(20, H * 0.03);
      let cardW = (cardH * 9) / 16;
      if (cardW > W * 0.62) { cardW = W * 0.62; cardH = (cardW * 16) / 9; }
      card.style.width = `${cardW.toFixed(1)}px`;
      card.style.height = `${cardH.toFixed(1)}px`;
      card.style.top = `${cardTop.toFixed(1)}px`;
      card.style.marginLeft = `${(-cardW / 2).toFixed(1)}px`;

      M = {
        W, H, fit, sw, sh, groups,
        scx: sheet.offsetLeft + sw / 2, scy: sheet.offsetTop + sh / 2,
        bcx: (bx0 + bx1) / 2, bcy: (by0 + by1) / 2, bh: by1 - by0, hw, hh, kEnd, dyEnd, cardTop,
        stick: parseFloat(cs.top) || 0,
      };
      lastW = window.innerWidth;
      lastP = -1;
    };

    const render = (p) => {
      const m = M;
      const dim = 1 - 0.92 * inOut(seg(p, 0.40, 0.47));
      const bur = 1 - seg(p, 0.46, 0.51);
      sheet.style.setProperty('--dim', dim.toFixed(3));
      sheet.style.setProperty('--bur', bur.toFixed(3));

      m.groups.forEach((g, i) => {
        const [a, b, c] = WIN[i];
        const sweep = seg(p, a, b);
        const alpha = i < 3 ? (1 - 0.8 * seg(p, b + 0.005, c)) * dim : bur;
        g.bars.forEach((bar) => {
          const t = clamp01((sweep - bar.from) / (bar.to - bar.from || 1));
          bar.el.style.transform = `scaleX(${out(t).toFixed(4)})`;
          bar.el.style.opacity = alpha.toFixed(3);
        });
        if (g.tag) {
          const on = seg(p, b - 0.01, b + 0.02);
          g.tag.style.opacity = (on * dim).toFixed(3);
          g.tag.style.transform = `translate3d(0, ${((1 - on) * 6).toFixed(2)}px, 0) rotate(-5deg)`;
        }
      });

      const S = m.fit * (1 - 0.04 * inOut(seg(p, 0.40, 0.65)));
      sheet.style.transform = `scale(${S.toFixed(4)})`;

      // the clone starts exactly over the buried sentence, then flies to the centre at full size
      const sx = m.scx + (m.bcx - m.sw / 2) * S - m.W / 2;
      const sy = m.scy + (m.bcy - m.sh / 2) * S - m.H / 2;
      const k0 = (m.bh * S) / m.hh;
      const mv = inOut(seg(p, 0.46, 0.65));
      const st = inOut(seg(p, 0.68, 0.86));
      const hx = lerp(sx, 0, mv);
      const hy = lerp(lerp(sy, 0, mv), m.dyEnd, st);
      const k = lerp(lerp(k0, 1, mv), m.kEnd, st);
      const hT = `translate(-50%, -50%) translate3d(${hx.toFixed(2)}px, ${hy.toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
      const hO = seg(p, 0.45, 0.50).toFixed(3);
      heads.forEach((h) => { h.style.transform = hT; h.style.opacity = hO; });

      // the turn: ink wipes up behind the headline (STYLE recipe 6), then the first card rises
      const w = inOut(seg(p, 0.65, 0.85));
      ink.style.clipPath = `inset(${((1 - w) * 100).toFixed(2)}% 0 0 0)`;
      const c = out(seg(p, 0.84, 0.98));
      card.style.transform = `translate3d(0, ${((1 - c) * (m.H - m.cardTop + 24)).toFixed(1)}px, 0)`;
      card.style.opacity = Math.min(1, c * 2.5).toFixed(3);

      const ph = p < 0.10 ? 0 : p < 0.40 ? 1 : 2;
      if (ph !== phase) { phase = ph; steps.forEach((li, i) => li.classList.toggle('is-on', i === ph)); }
    };

    const frame = () => {
      ticking = false;
      if (!M) return;
      const r = runway.getBoundingClientRect();
      const p = clamp01((M.stick - r.top) / (r.height - M.H));
      if (Math.abs(p - lastP) < 0.00005) return;
      lastP = p;
      render(p);
    };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
    window.addEventListener('scroll', () => { if (active) request(); }, { passive: true });
    new IntersectionObserver(([e]) => { active = e.isIntersecting; if (active) request(); }, { rootMargin: '100px 0px' }).observe(runway);

    const remeasure = () => { measure(); frame(); };
    let passTimer;
    window.addEventListener('resize', () => {
      // phones fire resize when the URL bar slides; only a real width change moves the layout
      if (M && window.innerWidth === lastW && Math.abs(stage.clientHeight - M.H) < 2) return;
      clearTimeout(passTimer);
      passTimer = setTimeout(remeasure, 150);
    });
    remeasure();
    fontsReady.then(remeasure);
  }

  /* ---------- Recent work: auto-advancing previews ---------- */
  const reel = document.querySelector('.reel');
  if (reel) {
    const track = reel.querySelector('.reel__track');
    const cases = [...track.querySelectorAll('.case')];
    const countEl = reel.querySelector('.reel__count b');
    const titleEl = reel.querySelector('.reel__title');
    const pauseBtn = reel.querySelector('.ctl--pause');
    const pauseText = pauseBtn.querySelector('.ctl__text');
    const PREVIEW = 6500; // ms per card
    const pad = (n) => String(n).padStart(2, '0');

    let idx = 0, elapsed = 0, last = 0, raf = 0, shownSec = -1;
    let playing = !reduceMotion, inView = false, held = false, lastManual = -Infinity;

    const paint = () => {
      const c = cases[idx];
      const p = Math.min(elapsed / PREVIEW, 1);
      c.style.setProperty('--p', p.toFixed(4));
      if (!reduceMotion) {
        // a slow push-in and pan, so the photo cards feel like they are playing
        c.style.setProperty('--kb', (1 + 0.1 * p).toFixed(4));
        c.style.setProperty('--pan', `${(-4 * p).toFixed(3)}%`);
      }
      const sec = Math.floor(elapsed / 1000);
      if (sec !== shownSec) {
        shownSec = sec;
        const tc = c.querySelector('.tc-now');
        if (tc) tc.textContent = `00:${pad(sec)}`;
      }
    };

    const keepInView = (force) => {
      if (track.scrollWidth <= track.clientWidth + 2) return;
      if (!force && performance.now() - lastManual < 8000) return;
      const c = cases[idx].getBoundingClientRect();
      const t = track.getBoundingClientRect();
      const inset = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
      if (c.left < t.left + inset - 1 || c.right > t.right + 1) {
        track.scrollTo({ left: track.scrollLeft + (c.left - t.left) - inset, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    };

    const setActive = (i, follow = true, force = false) => {
      const prev = cases[idx];
      prev.classList.remove('is-active', 'is-playing');
      prev.removeAttribute('aria-current');
      prev.style.setProperty('--p', 0);
      prev.style.setProperty('--kb', 1);
      prev.style.setProperty('--pan', '0%');
      const prevTc = prev.querySelector('.tc-now');
      if (prevTc) prevTc.textContent = '00:00';

      idx = (i + cases.length) % cases.length;
      elapsed = 0; shownSec = -1;
      const c = cases[idx];
      c.classList.add('is-active');
      c.setAttribute('aria-current', 'true');
      countEl.textContent = pad(idx + 1);
      titleEl.textContent = c.querySelector('.case__title').textContent;
      paint();
      sync();
      if (follow) keepInView(force);
    };

    const frame = (now) => {
      raf = 0;
      if (!running()) return;
      elapsed += Math.min(now - last, 100);
      last = now;
      if (elapsed >= PREVIEW) { setActive(idx + 1); return; }
      paint();
      raf = requestAnimationFrame(frame);
    };
    const running = () => playing && inView && !held && !document.hidden;
    function sync() {
      const on = running();
      cases[idx].classList.toggle('is-playing', on);
      if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    const setPlaying = (on) => {
      playing = on;
      reel.classList.toggle('is-paused', !on);
      pauseBtn.setAttribute('aria-label', on ? 'Pause previews' : 'Play previews');
      pauseText.textContent = on ? 'Pause' : 'Play';
      sync();
    };

    pauseBtn.addEventListener('click', () => setPlaying(!playing));
    reel.querySelector('.ctl--prev').addEventListener('click', () => setActive(idx - 1, true, true));
    reel.querySelector('.ctl--next').addEventListener('click', () => setActive(idx + 1, true, true));
    cases.forEach((c, i) => c.querySelector('.case__btn').addEventListener('click', () => {
      if (i === idx) { setPlaying(!playing); return; }
      setActive(i, true, true);
      if (!playing) setPlaying(true);
    }));

    // hold while someone tabs through the cards; don't drag the track around while someone is swiping it
    track.addEventListener('focusin', (e) => { if (e.target.matches(':focus-visible')) { held = true; sync(); } });
    track.addEventListener('focusout', (e) => { if (!track.contains(e.relatedTarget)) { held = false; sync(); } });
    ['pointerdown', 'wheel', 'touchstart'].forEach((t) => track.addEventListener(t, () => { lastManual = performance.now(); }, { passive: true }));
    document.addEventListener('visibilitychange', sync);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { threshold: 0.25 }).observe(track);
    } else {
      inView = true;
    }

    setPlaying(playing);
    setActive(0, false);
  }

  /* ---------- Kind words: quote carousel ---------- */
  const quotes = document.querySelector('.quotes');
  if (quotes) {
    const slides = [...quotes.querySelectorAll('.quote')];
    const countEl = quotes.querySelector('.quotes__count b');
    let q = 0;
    const show = (i) => {
      slides[q].classList.remove('is-active');
      slides[q].setAttribute('aria-hidden', 'true');
      q = (i + slides.length) % slides.length;
      slides[q].classList.add('is-active');
      slides[q].removeAttribute('aria-hidden');
      countEl.textContent = String(q + 1).padStart(2, '0');
    };
    slides.forEach((s, i) => { if (i !== q) s.setAttribute('aria-hidden', 'true'); });
    quotes.querySelector('.ctl--prev').addEventListener('click', () => show(q - 1));
    quotes.querySelector('.ctl--next').addEventListener('click', () => show(q + 1));
    quotes.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(q - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(q + 1); }
    });
  }

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.querySelector('.rh__menu');
  const menu = document.getElementById('menu');
  if (menuBtn && menu) {
    const setMenu = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.textContent = open ? 'Close' : 'Menu';
      menu.classList.toggle('is-open', open);
      root.classList.toggle('menu-open', open);
      if (open) menu.querySelector('a').focus();
    };
    menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
    });
    window.matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
  }
})();
