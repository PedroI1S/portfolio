import { initFog } from './fog.js?v=4';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const desktopQuery = matchMedia('(min-width: 761px)');
let lenis, fog;
let motionActive = !motionQuery.matches;

// The page is fully rendered before this module runs; enhancement can fail safely.
function clock() {
  const update = () => $$('[data-clock]').forEach(node => {
    const now = new Date();
    node.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    node.dateTime = now.toISOString();
  });
  update();
  setInterval(update, 30000);
  const label = code => {
    if (code === 0) return 'clear';
    if (code <= 3) return 'cloudy';
    if (code <= 48) return 'fog';
    if (code <= 57) return 'drizzle';
    if (code <= 67) return 'rain';
    if (code <= 77) return 'snow';
    if (code <= 82) return 'showers';
    if (code <= 86) return 'snow showers';
    return 'thunderstorms';
  };
  const render = current => {
    if (!Number.isFinite(current?.temperature_2m) || !Number.isFinite(current?.weather_code)) return;
    $$('[data-weather]').forEach(node => {
      node.replaceChildren(document.createTextNode(` · ${Math.round(current.temperature_2m)}° · ${label(current.weather_code)} `));
      const source = document.createElement('a');
      source.href = 'https://open-meteo.com/';
      source.textContent = '↗';
      source.title = 'Weather data by Open-Meteo';
      source.setAttribute('aria-label', 'Weather data by Open-Meteo');
      node.append(source);
    });
  };
  const readWeather = async () => {
    try {
      let cache;
      try { cache = JSON.parse(localStorage.getItem('otherweather-conditions')); } catch { /* Storage may be unavailable. */ }
      if (cache && Date.now() - cache.at >= 0 && Date.now() - cache.at < 15 * 60 * 1000) return render(cache.current);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      try {
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-23.55&longitude=-46.63&current=temperature_2m,weather_code&timezone=America%2FSao_Paulo', { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        render(data.current);
        if (Number.isFinite(data.current?.temperature_2m)) {
          try { localStorage.setItem('otherweather-conditions', JSON.stringify({ at: Date.now(), current: data.current })); } catch { /* Time remains available without storage. */ }
        }
      } finally { clearTimeout(timeout); }
    } catch { /* A failed weather request leaves a truthful local clock. */ }
  };
  setTimeout(readWeather,2000);
  setInterval(readWeather, 15 * 60 * 1000);
}

function header() {
  const head = $('.site-header'), sections = $$('[data-tone]');
  let queued = false;
  const update = () => {
    queued = false;
    const section = sections.findLast(node => { const r = node.getBoundingClientRect(); return r.top <= 85 && r.bottom > 85; });
    if (!section) return;
    head.style.setProperty('--header-ink', section.dataset.ink);
    head.style.setProperty('--header-bg', `color-mix(in srgb, ${section.dataset.bg} 90%, transparent)`);
    const current = section.closest('#work') || section.classList.contains('work-index') || document.body.dataset.page === 'story' ? 'work' : section.id;
    $$('[data-nav]').forEach(a => a.classList.toggle('is-active', a.dataset.nav === current));
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive:true });
  update();
}

function clips() {
  const videos = $$('video[data-src]'), visible = new Set(), hovered = new Set();
  const refresh = video => {
    const mode = video.dataset.play;
    const hoverOnly = mode === 'hover' || mode === 'row';
    const allowed = !hoverOnly || hovered.has(video) || !finePointer.matches;
    if (!motionActive || document.hidden || !visible.has(video) || !allowed || video.closest('.is-playing') || !video.getClientRects().length) return video.pause();
    if (video.getAttribute('src') !== video.dataset.src) { video.src = video.dataset.src; video.load(); }
    video.play().catch(() => {});
  };
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target);
    refresh(entry.target);
  }), {threshold:.15});
  videos.forEach(video => {
    observer.observe(video);
    const target = video.closest('[data-hover-play], .work-row');
    if (target) {
      const enter = () => { hovered.add(video); refresh(video); };
      const leave = () => { hovered.delete(video); refresh(video); };
      target.addEventListener('pointerenter', enter); target.addEventListener('pointerleave', leave);
      target.addEventListener('focusin', enter); target.addEventListener('focusout', leave);
    }
  });
  const all = () => videos.forEach(refresh);
  document.addEventListener('visibilitychange', all);
  document.addEventListener('otherweather:media', all);
  motionQuery.addEventListener('change', all);
}

function workIndex() {
  const index = $('.work-index');
  if (!index) return;
  const rows = $$('.work-row');
  const filters = $$('[data-filter]');
  const phoneToggle = $('.phone-toggle');
  const status = $('.filter-status');
  const preview = $('.index-preview');
  const previewImage = $('img', preview);
  const previewVideo = $('video', preview);
  let phone = false, activeRow, timer;
  const apply = () => {
    const params = new URLSearchParams(location.search);
    const filter = filters.some(button => button.dataset.filter === params.get('filter')) ? params.get('filter') : 'all';
    phone = params.get('view') === 'phone';
    let count = 0;
    rows.forEach(row => {
      const show = filter === 'all' || row.dataset.tags.split(' ').includes(filter);
      row.hidden = !show;
      if (show) {
        count++;
        if (motionActive && row.animate) row.animate([{ opacity: .35, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: Math.min(count * 12, 180), easing: 'ease-out' });
      }
    });
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
    phoneToggle.setAttribute('aria-pressed', String(phone));
    index.classList.toggle('is-phone', phone);
    status.textContent = `Showing ${filter === 'all' ? 'all ' : ''}${count} concept${count === 1 ? '' : 's'}`;
    preview.classList.toggle('is-phone', phone);
    hide();
  };
  const change = (key, value) => {
    const url = new URL(location.href);
    if (!value || value === 'all') url.searchParams.delete(key); else url.searchParams.set(key, value);
    history.pushState({}, '', url);
    apply();
  };
  const hide = () => {
    clearTimeout(timer);
    activeRow = null;
    preview.classList.remove('is-visible', 'has-video');
    previewVideo.pause();
    index.style.removeProperty('--index-tint');
  };
  const loadClip = row => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (activeRow !== row || !motionActive) return;
      previewVideo.src = `/_studio/media/${row.dataset.slug}-${phone ? 'phone' : 'desktop'}.mp4`;
      previewVideo.play().then(() => { if (activeRow === row) preview.classList.add('has-video'); }).catch(() => {});
    }, 400);
  };
  let x = innerWidth * .6, y = 200, targetX = x, targetY = y, frame;
  const move = () => {
    const dx = targetX - x, dy = targetY - y;
    x += dx * .18; y += dy * .18;
    preview.style.transform = `translate(${x}px,${y}px) rotate(${Math.max(-7, Math.min(7, dx * .08))}deg)`;
    if (Math.abs(dx) + Math.abs(dy) > .4) frame = requestAnimationFrame(move); else frame = 0;
  };
  const position = event => {
    targetX = Math.max(20, Math.min(innerWidth - preview.offsetWidth - 20, event.clientX + 28));
    targetY = Math.max(95, Math.min(innerHeight - preview.offsetHeight - 20, event.clientY - preview.offsetHeight * .4));
    if (!frame) frame = requestAnimationFrame(move);
  };
  rows.forEach(row => {
    const anchor = $('.row-main', row);
    const show = event => {
      if (!finePointer.matches || !desktopQuery.matches) return;
      activeRow = row;
      preview.classList.remove('has-video');
      previewImage.src = `/_studio/media/${row.dataset.slug}-${phone ? 'phone' : 'desktop'}.webp`;
      $('span', preview).textContent = `${$('h2', row).textContent} / ${phone ? 'Phone' : 'Desktop'}`;
      preview.classList.add('is-visible');
      index.style.setProperty('--index-tint', row.dataset.bg);
      if (event.clientX) position(event); else position({ clientX: innerWidth * .6, clientY: innerHeight * .4 });
      loadClip(row);
    };
    anchor.addEventListener('pointerenter', show);
    anchor.addEventListener('pointermove', event => { if (activeRow === row) position(event); });
    anchor.addEventListener('pointerleave', hide);
    anchor.addEventListener('focus', show);
    anchor.addEventListener('blur', hide);
    anchor.addEventListener('click', () => {
      $('h2', row).style.viewTransitionName = 'vt-title';
      $('.row-media', row).style.viewTransitionName = 'vt-media';
    });
  });
  filters.forEach(button => button.addEventListener('click', () => change('filter', button.dataset.filter)));
  phoneToggle.addEventListener('click', () => change('view', phone ? null : 'phone'));
  addEventListener('popstate', apply);
  addEventListener('pagehide', hide);
  apply();
}

function collection() {
  const track = $('.collection-track');
  if (!track) return;
  const cards = $$('.strip-card', track);
  let startX, startScroll, dragging = false, moved = false;
  const update = () => {
    const index = Math.max(0, Math.min(cards.length - 1, Math.round(track.scrollLeft / (cards[0].offsetWidth + 25))));
    $('[data-strip-count]').textContent = String(index + 1).padStart(2, '0');
    $('[data-strip-style]').textContent = cards[index].dataset.style;
    $('.strip-progress span').style.transform = `scaleX(${Math.max(.04, track.scrollLeft / Math.max(1, track.scrollWidth - track.clientWidth))})`;
  };
  track.addEventListener('scroll', update, { passive: true });
  $$('[data-strip]').forEach(button => button.addEventListener('click', () => track.scrollBy({left: (cards[0].offsetWidth + 25) * Number(button.dataset.strip), behavior: motionActive ? 'smooth' : 'instant'})));
  update();
  track.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || track.closest('.is-pinned')) return;
    startX = event.clientX; startScroll = track.scrollLeft; dragging = true; moved = false;
  });
  track.addEventListener('pointermove', event => {
    if (!dragging) return;
    const delta = startX - event.clientX;
    if (Math.abs(delta) > 5) { moved = true; event.preventDefault(); }
    track.scrollLeft = startScroll + delta;
  });
  addEventListener('pointerup', () => { dragging = false; });
  track.addEventListener('dragstart', event => event.preventDefault());
  track.addEventListener('click', event => { if (moved) { event.preventDefault(); moved = false; } });
  track.addEventListener('keydown', event => {
    if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    track.scrollBy({ left: (cards[0].offsetWidth + 25) * (event.key === 'ArrowRight' ? 1 : -1), behavior: motionActive ? 'smooth' : 'instant' });
  });
}

function embeds() {
  const stage = $('.play-stage');
  if (!stage) return;
  const device = $('.play-device');
  const target = $('.embed-target');
  const video = $('.play-clip');
  const play = $('.play-concept');
  const stop = $('.stop-concept');
  const buttons = $$('[data-device]');
  let iframe, view = 'phone';
  const layout = () => {
    if (!iframe) return;
    const width = view === 'phone' ? 390 : 1440;
    const height = view === 'phone' ? 844 : 900;
    iframe.style.width = `${width}px`; iframe.style.height = `${height}px`;
    iframe.style.transform = `scale(${target.clientWidth / width})`;
  };
  const unload = (restoreFocus = false) => {
    if (!iframe) return;
    const hadFocus = document.activeElement === iframe;
    iframe.remove(); iframe = null;
    device.classList.remove('is-playing');
    if (play) play.hidden = false;
    if (stop) stop.hidden = true;
    document.dispatchEvent(new Event('otherweather:media'));
    if (restoreFocus || hadFocus) play?.focus({ preventScroll: true });
  };
  const load = () => {
    unload();
    iframe = document.createElement('iframe');
    iframe.title = `${$('.story-hero h1').textContent.replace('°', '')} live concept — ${view} view`;
    iframe.src = play.dataset.src;
    iframe.setAttribute('allow', 'fullscreen');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-pointer-lock');
    iframe.setAttribute('referrerpolicy', 'same-origin');
    iframe.setAttribute('data-lenis-prevent', '');
    iframe.addEventListener('load', () => {
      try { iframe.contentDocument.addEventListener('keydown', event => { if (event.key === 'Escape') unload(true); }); } catch { /* Standalone navigation may change origin. */ }
    });
    target.append(iframe);
    device.classList.add('is-playing');
    play.hidden = true; stop.hidden = false;
    video.pause();
    layout();
    stop.focus({ preventScroll: true });
  };
  play?.addEventListener('click', load);
  stop?.addEventListener('click', () => unload(true));
  buttons.forEach(button => button.addEventListener('click', () => {
    view = button.dataset.device;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    stage.dataset.view = view;
    const wasPlaying = Boolean(iframe);
    unload();
    video.pause();
    video.poster = `/_studio/media/${stage.dataset.slug}-${view}.webp`;
    video.dataset.src = `/_studio/media/${stage.dataset.slug}-${view}.mp4`;
    video.removeAttribute('src');
    video.load();
    if (wasPlaying) load(); else document.dispatchEvent(new Event('otherweather:media'));
  }));
  new ResizeObserver(layout).observe(device);
  new IntersectionObserver(entries => { if (!entries[0].isIntersecting) unload(); }, { rootMargin: '120px' }).observe(device);
  addEventListener('pagehide', () => unload());
  document.addEventListener('keydown', event => { if (event.key === 'Escape') unload(true); });
}

function pointerDetails() {
  if (!finePointer.matches || !motionActive) return;
  const cursor = $('.cursor');
  let x = -100, y = -100, tx = x, ty = y, frame;
  const contextAtPointer=()=>{
    const label=document.elementFromPoint(tx,ty)?.closest('[data-cursor]')?.dataset.cursor;
    cursor.classList.toggle('is-labeled',Boolean(label));
    $('span',cursor).textContent=label||'';
  };
  const draw = () => {
    x += (tx - x) * .26; y += (ty - y) * .26;
    cursor.style.transform = `translate(${x - cursor.offsetWidth / 2}px,${y - cursor.offsetHeight / 2}px)`;
    if (Math.abs(tx - x) + Math.abs(ty - y) > .25) frame = requestAnimationFrame(draw); else frame = 0;
  };
  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    tx = event.clientX; ty = event.clientY;
    contextAtPointer();
    if (!frame) frame = requestAnimationFrame(draw);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { tx = -100; ty = -100; if (!frame) frame = requestAnimationFrame(draw); });
  addEventListener('scroll',contextAtPointer,{passive:true});
  $$('[data-tilt]').forEach(pair => {
    const desktop = $('.device-desktop', pair), phone = $('.device-phone', pair);
    pair.addEventListener('pointermove', event => {
      if (!motionActive) return;
      const box = pair.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - .5;
      const y = (event.clientY - box.top) / box.height - .5;
      desktop.style.transform = `perspective(1800px) rotateY(${x * 10 - 4}deg) rotateX(${-y * 7 + 2}deg)`;
      phone.style.transform = `translate(${x * 16}px,${y * 10}px) rotate(${4 + x * 5}deg)`;
      const forecast=pair.closest('[data-weather-front]');
      if(forecast)fog?.setLens(forecast,{video:$('video',desktop),x:event.clientX,y:event.clientY,radius:85});
    }, { passive: true });
    pair.addEventListener('pointerleave', () => { desktop.style.transform = ''; phone.style.transform = ''; const forecast=pair.closest('[data-weather-front]');if(forecast)fog?.setLens(forecast,null); });
  });
  $$('.magnetic').forEach(button => {
    button.addEventListener('pointermove', event => {
      const box = button.getBoundingClientRect();
      button.style.transform = `translate(${(event.clientX - box.left - box.width / 2) * .16}px,${(event.clientY - box.top - box.height / 2) * .2}px)`;
    });
    button.addEventListener('pointerleave', () => { button.style.transform = ''; });
  });
  const wordmark = $('.footer-word');
  wordmark?.addEventListener('pointermove', event => {
    $$('.footer-letters > span', wordmark).forEach(letter => {
      const box = letter.getBoundingClientRect();
      const distance = Math.abs(event.clientX - box.left - box.width / 2);
      letter.style.fontVariationSettings = `'wdth' ${100 + Math.max(0, 1 - distance / 160) * 25}`;
    });
  });
  wordmark?.addEventListener('pointerleave', () => $$('.footer-letters > span', wordmark).forEach(letter => { letter.style.fontVariationSettings = ''; }));
}

function toys() {
  const type = $('[data-type-toy]');
  type?.addEventListener('pointermove', event => {
    if (!motionActive) return;
    const rect = type.getBoundingClientRect();
    type.style.fontVariationSettings = `'wdth' ${75 + (event.clientX - rect.left) / rect.width * 50}, 'wght' ${350 + (event.clientY - rect.top) / rect.height * 300}`;
  }, { passive: true });
  type?.addEventListener('pointerleave', () => { type.style.fontVariationSettings = ''; });
  const isobars = $('.isobar-toy');
  isobars?.addEventListener('pointermove', event => {
    if (!motionActive) return;
    const rect = isobars.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 600;
    const y = (event.clientY - rect.top) / rect.height * 190;
    $$('path', isobars).forEach((path, i) => {
      const base = 20 + i * 12;
      const bend = Math.max(0, 1 - Math.abs(y - base) / 140) * (y < base ? 50 : -50);
      path.setAttribute('d', `M-20 ${base} Q${x} ${base + bend} 620 ${base}`);
    });
  }, { passive: true });
  isobars?.addEventListener('pointerleave', () => $$('path', isobars).forEach((path, i) => path.setAttribute('d', `M-20 ${20 + i * 12} Q300 ${20 + i * 12} 620 ${20 + i * 12}`)));
  const timeline = $('[data-timeline-toy]');
  timeline?.addEventListener('pointermove', event => {
    if (!motionActive) return;
    const rect = timeline.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    $('i', timeline).style.left = `${x * 100}%`;
    $$('span', timeline).forEach((span, i) => { span.style.color = i <= Math.floor(x * 4) ? '#f0f1ed' : '#8a98b0'; });
  }, { passive: true });
}

function navigation() {
  // Native cross-document transitions may be skipped when the destination's
  // opt-in arrives after its first paint. Ordinary navigation still succeeds.
  // Own their lifecycle promises so a browser skip is not an unhandled error.
  const settleTransition=event=>{
    const transition=event.viewTransition;
    if(!transition)return;
    transition.ready.catch(()=>{});
    transition.finished.catch(()=>{});
    transition.updateCallbackDone?.catch(()=>{});
  };
  addEventListener('pageswap',settleTransition);
  addEventListener('pagereveal',settleTransition);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-live]');
    if (!link || !motionActive || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    $('.page-wipe').style.background = link.dataset.color || '#315cff';
    document.body.classList.add('is-leaving');
    setTimeout(() => { location.href = link.href; }, 430);
  });
  addEventListener('pageshow', () => document.body.classList.remove('is-leaving'));
  document.addEventListener('focusin', event => {
    if (!lenis || event.target === document.body || event.target.tagName === 'IFRAME') return;
    const rect = event.target.getBoundingClientRect();
    if (rect.top < 80 || rect.bottom > innerHeight) lenis.scrollTo(event.target, { offset: -120, immediate: true });
  });
}

function motion() {
  if (!motionActive) return;
  const regions = $$('[data-fog]');
  if (regions.length) {
    regions.forEach(region => {
      region.dataset.fogTone = region.dataset.fog;
      $('.fog-static', region).setAttribute('data-fog-blur', '');
      if (region.classList.contains('hero')) {
        const twin = document.createElement('div');
        twin.className = 'hero-twin'; twin.dataset.fogTwin = '';
        twin.setAttribute('aria-hidden', 'true'); twin.inert = true;
        const copy = $('.hero-content', region).cloneNode(true);
        $$('[id]', copy).forEach(node => node.removeAttribute('id'));
        twin.append(copy); region.append(twin);
      }
    });
    fog = initFog({canvas:$('.fog-canvas'), regions, fronts:[]});
  }
  const steps = $$('.process-step');
  if (steps.length) {
    const observer = new IntersectionObserver(entries => {
      const active = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!active) return;
      const i = steps.indexOf(active.target);
      steps.forEach((step,j) => step.classList.toggle('is-current', i === j));
      $('.needle').style.transform = `rotate(${-75 + i * 50}deg)`;
    }, {rootMargin:'-25% 0px -25% 0px',threshold:[0,.25,.5,.75,1]});
    steps.forEach(step => observer.observe(step));
  }
}

function reel() {
  const video = $('[data-reel]');
  if (!video || !motionActive) return;
  const projects = JSON.parse(video.dataset.reel), ticks = $$('[data-tick]');
  let index = 0, visible = false, timer;
  const show = () => {
    const project = projects[index], phone = !desktopQuery.matches;
    video.poster = project[phone ? 'pposter' : 'dposter'];
    video.src = project[phone ? 'phone' : 'desktop'];
    video.play().catch(() => {});
    $('[data-behind-name]').textContent = project.name;
    $('[data-behind-number]').textContent = String(project.n).padStart(2,'0');
    $('[data-behind-link]').href = `/projects/${project.slug}/`;
    ticks.forEach((tick,i) => tick.classList.toggle('is-current', i === index));
  };
  const refresh = () => {
    clearInterval(timer);
    if (!visible || document.hidden) return video.pause();
    if (!video.getAttribute('src')) show(); else video.play().catch(() => {});
    timer = setInterval(() => { index = (index + 1) % projects.length; show(); },8000);
  };
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; refresh(); },{threshold:.1}).observe(video);
  document.addEventListener('visibilitychange',refresh);
  desktopQuery.addEventListener('change',() => { if (visible) show(); });
}

clock(); header(); clips(); workIndex(); collection(); embeds(); navigation(); toys(); reel();
if (motionActive) {
  pointerDetails();
  requestAnimationFrame(() => requestAnimationFrame(motion));
}
motionQuery.addEventListener('change', () => location.reload());
