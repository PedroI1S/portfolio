/* SORT® — Kinetic / Big Typography concept
   Wordmark rise + a logo that sorts itself, offset shop grid with live sorting,
   quick view with a real size picker, a front-end bag, menu, marquee skew. */
(() => {
  const root = document.documentElement;
  const rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => rmq.matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ---------- Products ---------- */
  const PRODUCTS = {
    tee:   { n: 1, name: 'Heavy Tee', price: 48, cat: 'Wear', img: 'tee',
             desc: 'A boxy, dropped-shoulder tee in cotton thick enough to stand up on its own. Small cream SORT on the chest, nothing on the back.',
             specs: [['Cotton', '280 gsm, combed'], ['Fit', 'Boxy, size down for regular'], ['Weight', '300 g'], ['Made', 'Porto, PT']],
             sizes: ['XS', 'S', 'M', 'L', 'XL'] },
    cap:   { n: 2, name: 'Field Cap', price: 34, cat: 'Wear', img: 'cap',
             desc: 'Unstructured six-panel cap in washed cotton twill, with SORT embroidered in cobalt and a strap that actually stays put.',
             specs: [['Cotton', 'Washed twill'], ['Fit', 'Adjustable strap'], ['Weight', '95 g'], ['Made', 'Leicester, UK']],
             sizes: ['One size'] },
    tote:  { n: 3, name: 'Carry Tote', price: 28, cat: 'Carry', img: 'tote',
             desc: 'Undyed 16 oz canvas with a gusset deep enough for a laptop, a lunch and the samples nobody asked you to bring back.',
             specs: [['Canvas', '16 oz, undyed'], ['Measures', '40 × 42 × 12 cm'], ['Weight', '260 g'], ['Made', 'Porto, PT']],
             sizes: ['One size'] },
    crew:  { n: 4, name: 'Loopback Crew', price: 86, cat: 'Wear', img: 'crew',
             desc: 'Grey marl loopback sweatshirt, brushed soft inside, with one small cobalt tab at the hem so you can find it in the pile.',
             specs: [['Cotton', '400 gsm loopback'], ['Fit', 'Relaxed, true to size'], ['Weight', '620 g'], ['Made', 'Porto, PT']],
             sizes: ['XS', 'S', 'M', 'L', 'XL'] },
    scarf: { n: 5, name: 'Stripe Scarf', price: 64, cat: 'Wear', img: 'scarf',
             desc: 'Lambswool in two blocks of cobalt and cream. Long enough to wrap twice, short enough not to end up in the door.',
             specs: [['Wool', '100% lambswool'], ['Measures', '180 × 30 cm'], ['Weight', '180 g'], ['Made', 'Leicester, UK']],
             sizes: ['One size'] },
    mug:   { n: 6, name: 'Desk Mug', price: 22, cat: 'Desk', img: 'mug',
             desc: 'Steel camping mug with a cream enamel coat and a cobalt rim. It will chip eventually. That is part of the deal.',
             specs: [['Enamel', 'On steel'], ['Holds', '350 ml'], ['Weight', '210 g'], ['Made', 'Porto, PT']],
             sizes: ['One size'] },
  };
  const euro = (v) => '€' + v;
  const pad = (n) => String(n).padStart(2, '0');

  /* ---------- 1 · Masthead intro ---------- */
  const mast = $('.mast');
  const wm = $('.wm');
  const svg = $('.wm__svg');
  const letterEls = $$('.wm__slot .wm__l');

  // letters rise in random order
  shuffle(letterEls).forEach((el, i) => el.style.setProperty('--d', `${120 + i * 70 + Math.round(Math.random() * 40)}ms`));
  const startIntro = () => {
    mast.classList.add('is-in');
    wm.classList.add('is-in');
    setTimeout(() => { wm.classList.add('is-settled'); scheduleDemo(); }, reduced() ? 0 : 1900);
  };
  if (reduced()) startIntro();
  else requestAnimationFrame(() => requestAnimationFrame(startIntro));
  // safety: if rAF is paused (background tab), still reveal
  setTimeout(() => { if (!mast.classList.contains('is-in')) startIntro(); }, 600);

  /* ---------- Wordmark that sorts itself ---------- */
  const GAP = 34, H = 712, ROWGAP = 64, GRIDW = 1800, REG_HOME = 3520, REG_W = 142.4;
  const slots = {};
  $$('.wm__slot').forEach((g) => { slots[g.dataset.l] = { g, path: $('.wm__l', g), x: +g.dataset.x, w: +g.dataset.w }; });
  const regSlot = $('.wm__regslot');
  const narrowMq = window.matchMedia('(max-width: 599px)');
  const MODES = [
    { key: 'ours',  shop: 'ours',   order: ['S', 'O', 'R', 'T'], state: 'Sorted our way',  say: 'our way: S, O, R, T' },
    { key: 'az',    shop: 'az',     order: ['O', 'R', 'S', 'T'], state: 'Sorted A–Z',      say: 'A to Z: O, R, S, T' },
    { key: 'width', shop: 'weight', order: ['S', 'T', 'R', 'O'], state: 'Sorted by width', say: 'by width, narrowest first: S, T, R, O' },
  ];
  let modeIndex = 0;
  let order = MODES[0].order.slice();
  let busy = false;

  function layout(ord) {
    const pos = {};
    if (narrowMq.matches) {
      // 2 × 2 block, each row justified to the block width
      [[ord[0], ord[1]], [ord[2], ord[3]]].forEach(([a, b], r) => {
        pos[a] = { x: 0, y: r * (H + ROWGAP) };
        pos[b] = { x: GRIDW - slots[b].w, y: r * (H + ROWGAP) };
      });
      return { pos, reg: GRIDW + 22, vb: `0 0 ${GRIDW + 22 + REG_W} ${2 * H + ROWGAP}` };
    }
    let x = 0;
    ord.forEach((l) => { pos[l] = { x, y: 0 }; x += slots[l].w + GAP; });
    return { pos, reg: REG_HOME, vb: `0 0 ${REG_HOME + REG_W} ${H}` };
  }
  function place() {
    const { pos, reg, vb } = layout(order);
    svg.setAttribute('viewBox', vb);
    for (const l in slots) slots[l].g.style.transform = `translate(${pos[l].x - slots[l].x}px, ${pos[l].y}px)`;
    regSlot.style.transform = `translate(${reg - REG_HOME}px, 0px)`;
  }
  place();
  narrowMq.addEventListener('change', place);

  const sortBtn = $('[data-wm-sort]');
  const stateEl = $('[data-wm-state]');
  const wmLive = $('[data-wm-live]');

  async function swapAt(i, signal) {
    signal?.throwIfAborted();
    const a = slots[order[i]].path, b = slots[order[i + 1]].path;
    const out = { duration: 260, easing: 'cubic-bezier(.7, 0, .84, 0)', fill: 'forwards' };
    const back = { duration: 520, easing: 'cubic-bezier(.23, 1, .32, 1)', fill: 'forwards' };
    // the left letter dives under, the right one jumps over
    const animations = [];
    const cancel = () => animations.forEach((animation) => animation.cancel());
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      const da = a.animate([{ transform: 'translateY(0%)' }, { transform: 'translateY(112%)' }], out);
      const db = b.animate([{ transform: 'translateY(0%)' }, { transform: 'translateY(-112%)' }], out);
      animations.push(da, db);
      await Promise.all([da.finished, db.finished]);
      signal?.throwIfAborted();
      [order[i], order[i + 1]] = [order[i + 1], order[i]];
      place();
      const ra = a.animate([{ transform: 'translateY(112%)' }, { transform: 'translateY(0%)' }], back);
      const rb = b.animate([{ transform: 'translateY(-112%)' }, { transform: 'translateY(0%)' }], back);
      animations.push(ra, rb);
      da.cancel(); db.cancel();
      await Promise.all([ra.finished, rb.finished]);
    } finally {
      cancel();
      signal?.removeEventListener('abort', cancel);
    }
  }

  async function sortLogo(mode) {
    const rank = Object.fromEntries(mode.order.map((l, i) => [l, i]));
    stateEl.textContent = 'Sorting…';
    if (reduced()) {
      order = mode.order.slice();
      place();
    } else {
      // a visible bubble sort: one adjacent swap at a time
      for (let pass = 0; pass < order.length; pass++) {
        let swapped = false;
        for (let i = 0; i < order.length - 1 - pass; i++) {
          if (rank[order[i]] > rank[order[i + 1]]) {
            await swapAt(i);
            swapped = true;
          }
        }
        if (!swapped) break;
      }
    }
    stateEl.textContent = mode.state;
    const next = MODES[(modeIndex + 1) % MODES.length];
    const nextLabel = next.key === 'az' ? 'A–Z' : next.key === 'width' ? 'by width' : 'our way';
    sortBtn.textContent = `Sort the logo ${nextLabel} ↻`;
    sortBtn.setAttribute('aria-label', `Sort the logo ${nextLabel} and products ${next.shop === 'weight' ? 'by weight' : nextLabel}`);
  }
  sortBtn.addEventListener('click', () => dispatchSort('logo'));
  // clicking the wordmark itself sorts it too (pointer only; the button is the accessible control)
  wm.addEventListener('click', () => { if (wm.classList.contains('is-settled')) dispatchSort('logo'); });

  /* A single, reversible exchange on the first idle visit. Input always wins. */
  const demoKey = 'sort-logo-demo-v2';
  let demoTimer = null, demoController = null, demoOrder = null, interacted = false;
  function cancelDemo() {
    interacted = true;
    clearTimeout(demoTimer);
    if (demoController) {
      demoController.abort();
      demoController = null;
      order = demoOrder.slice();
      place();
    }
  }
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach((event) =>
    window.addEventListener(event, cancelDemo, { once: true, passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelDemo(); });
  rmq.addEventListener('change', () => { if (reduced()) cancelDemo(); });
  function scheduleDemo() {
    if (reduced() || interacted) return;
    try { if (sessionStorage.getItem(demoKey)) return; } catch { /* storage may be unavailable */ }
    demoTimer = setTimeout(async () => {
      if (interacted || reduced() || document.hidden || busy || wm.getBoundingClientRect().bottom <= 0) return;
      try { sessionStorage.setItem(demoKey, '1'); } catch { /* the demo still works without storage */ }
      const controller = new AbortController();
      demoController = controller;
      demoOrder = order.slice();
      try {
        await swapAt(1, controller.signal);
        await swapAt(1, controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      } finally {
        if (demoController === controller) demoController = null;
      }
    }, 900);
  }

  /* ---------- Scroll reveals ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      // hover photos sit behind a zero-area clip, which lazy loading never sees: fetch them now
      $$('.card__img--alt', e.target).forEach((img) => { img.loading = 'eager'; });
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
  $$('.card').forEach((c, i) => { c.style.setProperty('--cd', `${(i % 4) * 110}ms`); revealIO.observe(c); });
  $$('.totem, .foot, .archive__list').forEach((el) => revealIO.observe(el));
  if (reduced()) $$('.card, .totem, .foot, .archive__list').forEach((el) => { el.classList.add('is-in'); $$('.card__img--alt', el).forEach((img) => { img.loading = 'eager'; }); });

  /* ---------- Shop sort (FLIP) ---------- */
  const list = $('[data-cards]');
  const sortBtns = $$('[data-sort]');
  const shopLive = document.createElement('p');
  shopLive.className = 'sr-only';
  shopLive.setAttribute('aria-live', 'polite');
  $('.shop').append(shopLive);
  const SORTS = {
    ours:   { cmp: (a, b) => a.dataset.order - b.dataset.order, say: 'our way' },
    az:     { cmp: (a, b) => a.dataset.name.localeCompare(b.dataset.name), say: 'A to Z' },
    price:  { cmp: (a, b) => a.dataset.price - b.dataset.price, say: 'by price, lowest first' },
    weight: { cmp: (a, b) => a.dataset.weight - b.dataset.weight, say: 'by weight, lightest first' },
  };
  async function sortProducts(key, linked = false) {
    const btn = sortBtns.find((b) => b.dataset.sort === key);
    if (btn.classList.contains('is-active')) return;
    sortBtns.forEach((b) => { const on = b === btn; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    const cards = $$('.card', list);
    const first = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
    cards.slice().sort(SORTS[btn.dataset.sort].cmp).forEach((c) => list.append(c));
    shopLive.textContent = `Products sorted ${SORTS[btn.dataset.sort].say}.`;
    if (reduced()) return;
    const moves = $$('.card', list).map((c, i) => {
      const a = first.get(c), b = c.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy) return;
      return c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration: linked ? 900 : 1000, easing: 'cubic-bezier(.19, 1, .22, 1)', delay: linked ? 0 : i * 45, fill: 'backwards' });
    });
    await Promise.all(moves.filter(Boolean).map((animation) => animation.finished));
  }

  async function handoff(key) {
    if (reduced()) return;
    const bar = $('[data-sort-handoff]');
    const rule = $('.mast__rule').getBoundingClientRect();
    const target = sortBtns.find((b) => b.dataset.sort === key).getBoundingClientRect();
    const startX = Math.min(rule.width - 96, Math.max(0, sortBtn.getBoundingClientRect().left - rule.left));
    const endX = target.left - rule.left;
    const endY = target.bottom - parseFloat(getComputedStyle(sortBtns[0]).fontSize) * .6 - 2 - rule.top;
    bar.hidden = false;
    const animation = bar.animate([
      { transform: `translate(${startX}px, 0px)`, width: '96px' },
      { transform: `translate(${endX}px, 0px)`, width: `${target.width}px`, offset: .55 },
      { transform: `translate(${endX}px, ${endY}px)`, width: `${target.width}px` },
    ], { duration: 350, easing: 'cubic-bezier(.65, 0, .35, 1)', fill: 'forwards' });
    try { await animation.finished; } finally { bar.hidden = true; animation.cancel(); }
  }

  // Both controls use one dispatcher; logo modes hand their order to the goods.
  async function dispatchSort(source, key) {
    cancelDemo();
    if (busy) return;
    busy = true;
    const controls = [sortBtn, ...sortBtns];
    controls.forEach((b) => b.setAttribute('aria-disabled', 'true'));
    try {
      if (source === 'logo') {
        wm.classList.add('is-in', 'is-settled');
        modeIndex = (modeIndex + 1) % MODES.length;
        const mode = MODES[modeIndex];
        await sortLogo(mode);
        await handoff(mode.shop);
        await sortProducts(mode.shop, true);
        wmLive.textContent = `Logo sorted ${mode.say}. Products sorted ${SORTS[mode.shop].say}.`;
      } else {
        await sortProducts(key);
      }
    } finally {
      controls.forEach((b) => b.removeAttribute('aria-disabled'));
      busy = false;
    }
  }
  sortBtns.forEach((btn) => btn.addEventListener('click', () => dispatchSort('shop', btn.dataset.sort)));

  /* ---------- Sheets (quick view + bag) ---------- */
  let lastFocus = null;
  const lock = (on) => root.classList.toggle('is-locked', on);
  function openSheet(dlg) {
    lastFocus = document.activeElement;
    dlg.showModal();
    lock(true);
    requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add('is-open')));
    if (!reduced()) setTimeout(() => dlg.classList.add('is-open'), 60);
  }
  function closeSheet(dlg, then) {
    if (!dlg.open) return;
    dlg.classList.remove('is-open');
    const done = () => {
      dlg.close();
      lock(!!$('dialog[open]'));
      if (then) then();
      else if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    };
    if (reduced()) done(); else setTimeout(done, 650);
  }
  $$('.sheet').forEach((dlg) => {
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(dlg); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) closeSheet(dlg); });
    $$('[data-sheet-close]', dlg).forEach((b) => b.addEventListener('click', () => closeSheet(dlg)));
  });

  /* Quick view */
  const qv = $('[data-qv-dialog]');
  const qvForm = $('[data-qv-form]');
  const qvMedia = $('.qv__media', qv);
  const qvImg = $('[data-qv-img]'), qvAlt = $('[data-qv-img-alt]');
  const qvStatus = $('[data-qv-status]');
  const qvAdd = $('[data-qv-add]');
  const viewBtns = $$('[data-view]', qv);
  let current = null;

  function setView(v) {
    qvMedia.classList.toggle('is-detail', v === 1);
    viewBtns.forEach((b) => { const on = +b.dataset.view === v; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
  }
  viewBtns.forEach((b) => b.addEventListener('click', () => setView(+b.dataset.view)));

  function openQuickView(id, trigger) {
    const p = PRODUCTS[id];
    current = id;
    const card = trigger.closest('.card');
    const mainAlt = $('.card__img', card).alt;
    qvImg.src = `img/sort-${p.img}.jpg`; qvImg.alt = mainAlt;
    qvAlt.src = `img/sort-${p.img}-b.jpg`; qvAlt.alt = `Detail of the ${p.name}.`;
    setView(0);
    $('[data-qv-index]').textContent = `( ${pad(p.n)} / 06 )`;
    $('[data-qv-cat]').textContent = p.cat;
    $('[data-qv-name]').textContent = p.name;
    $('[data-qv-price]').textContent = euro(p.price);
    $('[data-qv-desc]').textContent = p.desc;
    $('[data-qv-specs]').innerHTML = p.specs.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const one = p.sizes.length === 1;
    $('[data-qv-sizes]').innerHTML = p.sizes.map((s) =>
      `<label class="size"><input type="radio" name="size" value="${s}"${one ? ' checked' : ''}><span>${s}</span></label>`).join('');
    qvStatus.textContent = '';
    qvAdd.textContent = 'Add to bag';
    openSheet(qv);
  }
  $$('[data-qv]').forEach((b) => b.addEventListener('click', () => openQuickView(b.dataset.qv, b)));

  qvForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const chosen = $('input[name="size"]:checked', qvForm);
    if (!chosen) {
      qvStatus.textContent = 'Pick a size first.';
      $('input[name="size"]', qvForm).focus();
      return;
    }
    addToBag(current, chosen.value);
    const p = PRODUCTS[current];
    const n = bag.length;
    qvStatus.textContent = `Added: ${p.name}${chosen.value === 'One size' ? '' : ', ' + chosen.value}. Bag (${n}).`;
    qvAdd.textContent = 'Add another';
  });

  /* Bag */
  const bag = [];
  const bagDlg = $('[data-bag-dialog]');
  const bagList = $('[data-bag-list]');
  const chip = $('[data-chip]');
  function renderBag() {
    $$('[data-bag-count]').forEach((el) => { el.textContent = bag.length; });
    $('[data-bag-empty]').hidden = bag.length > 0;
    bagList.innerHTML = bag.map((it, i) => {
      const p = PRODUCTS[it.id];
      return `<li class="bag__item"><img src="img/sort-${p.img}-600.jpg" alt="" width="1086" height="1448">
        <span><b>${p.name}</b>${it.size} · ${euro(p.price)}</span>
        <button class="u-link" type="button" data-remove="${i}" aria-label="Remove ${p.name}, ${it.size}">Remove</button></li>`;
    }).join('');
    $('[data-bag-total]').textContent = euro(bag.reduce((s, it) => s + PRODUCTS[it.id].price, 0));
  }
  function addToBag(id, size) {
    bag.push({ id, size });
    renderBag();
    chip.classList.remove('is-bump'); void chip.offsetWidth; chip.classList.add('is-bump');
  }
  bagList.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    bag.splice(+b.dataset.remove, 1);
    renderBag();
    const next = $('[data-remove]', bagList) || $('[data-sheet-close]', bagDlg);
    next.focus();
  });
  function openBag() {
    renderBag();
    if (qv.open) closeSheet(qv, () => openSheet(bagDlg));
    else openSheet(bagDlg);
  }
  $$('[data-open-bag]').forEach((b) => b.addEventListener('click', () => {
    if (menu.classList.contains('is-open')) closeMenu(false);
    openBag();
  }));
  renderBag();

  /* Floating bag chip: visible once the masthead has scrolled away */
  // (and hidden again over the footer, which has its own bag link)
  const seen = new Map();
  const chipIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => seen.set(e.target, e.isIntersecting));
    const show = ![...seen.values()].some(Boolean);
    chip.classList.toggle('is-shown', show);
    chip.tabIndex = show ? 0 : -1;
    chip.setAttribute('aria-hidden', String(!show));
  }, { rootMargin: '0px 0px -40px 0px' });
  [mast, $('.foot__cols')].forEach((el) => chipIO.observe(el));

  /* ---------- Menu ---------- */
  const menu = $('#menu');
  const menuBtn = $('.menu-btn');
  const menuClose = $('[data-menu-close]');
  function openMenu() {
    menu.hidden = false;
    void menu.offsetWidth;
    menu.classList.add('is-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    lock(true);
    menuClose.focus();
  }
  function closeMenu(restore = true) {
    menu.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    lock(!!$('dialog[open]'));
    setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, reduced() ? 0 : 900);
    if (restore) menuBtn.focus();
  }
  menuBtn.addEventListener('click', openMenu);
  menuClose.addEventListener('click', () => closeMenu());
  $$('a.menu__item', menu).forEach((a) => a.addEventListener('click', () => closeMenu(false)));
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key !== 'Tab') return;
    const f = $$('a, button', menu);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- Inline media slot: cycles the six products while in view ---------- */
  const cycler = $('[data-cycler]');
  if (cycler) {
    const imgs = $$('img', cycler);
    let k = 0, timer = null, intersecting = false;
    const tick = () => {
      imgs[k].classList.remove('is-on');
      k = (k + 1) % imgs.length;
      imgs[k].classList.add('is-on');
    };
    const syncCycler = () => {
      const playing = intersecting && !document.hidden && !reduced();
      if (playing && timer === null) {
        cycler.classList.add('is-cycling');
        imgs[k].classList.add('is-on');
        timer = setInterval(tick, 650);
      } else if (!playing && timer !== null) { clearInterval(timer); timer = null; }
    };
    new IntersectionObserver(([e]) => {
      intersecting = e.isIntersecting;
      syncCycler();
    }).observe(cycler);
    document.addEventListener('visibilitychange', syncCycler);
    rmq.addEventListener('change', syncCycler);
  }

  /* ---------- Marquee: skews with scroll velocity, pauses off-screen ---------- */
  const marquee = $('.marquee');
  const track = $('[data-marquee]');
  if (marquee && track) {
    let raf = 0, lastY = window.scrollY, skew = 0, visible = false;
    const loop = () => {
      const y = window.scrollY;
      const v = y - lastY; lastY = y;
      const target = Math.max(-14, Math.min(14, -v * 0.7));
      skew += (target - skew) * 0.18;
      if (Math.abs(skew) < 0.01 && !v) skew = 0;
      track.style.transform = `skewX(${skew.toFixed(2)}deg)`;
      raf = visible ? requestAnimationFrame(loop) : 0;
    };
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      marquee.classList.toggle('is-paused', !visible);
      if (visible && !raf && !reduced()) { lastY = window.scrollY; raf = requestAnimationFrame(loop); }
    }).observe(marquee);
  }
})();
