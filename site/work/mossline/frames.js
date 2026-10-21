/* Mossline · image-sequence player (canvas 2D).
   createSequence({ base, count, ext, width, height, canvas, fit, step, groups }) → { load(priority), draw(index), ready, … }
   Frames load progressively (every 8th, then every 4th, then the rest) as ImageBitmaps.
   Until a frame arrives, draw() shows the nearest loaded one. */

const DPR_CAP = 2;

export function createSequence({ base, count, ext = 'webp', width, height, canvas, fit = 'contain', pad = 4, version = '', groups = null, step = 1, maxScale = 1.35 }) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const frames = new Array(count).fill(null);   // ImageBitmap | null
  const state = new Uint8Array(count);          // 0 idle, 1 loading, 2 ready, 3 failed
  let loaded = 0;
  let started = false;
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });
  const listeners = new Set();
  let lastDrawn = -1;
  let lastKey = '';

  // `step` > 1: only every step-th rendered frame is shipped; index i maps to file i * step
  const url = (i) => `${base}${String(i * step).padStart(pad, '0')}.${ext}${version ? `?v=${version}` : ''}`;

  // progressive order: stride 8, then 4, then 2, then 1 (optionally group by group, e.g. intro before idle)
  const order = [];
  const seen = new Uint8Array(count);
  (groups || [[0, count - 1]]).forEach(([g0, g1]) => {
    [8, 4, 2, 1].forEach((s) => {
      for (let i = g0; i <= g1; i += s) if (!seen[i]) { seen[i] = 1; order.push(i); }
    });
    if (!seen[g1]) { seen[g1] = 1; order.push(g1); }
  });

  async function fetchFrame(i, priority, attempt = 0) {
    state[i] = 1;
    try {
      const res = await fetch(url(i), { priority });
      if (!res.ok) throw new Error(res.status);
      const blob = await res.blob();
      frames[i] = await createImageBitmap(blob);
      state[i] = 2;
      loaded++;
      if (i === order[0]) resolveReady();
      listeners.forEach((fn) => fn(i, loaded));
    } catch (e) {
      // flaky connections: retry twice with a short backoff before giving up on this frame
      if (attempt < 2) { await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); return fetchFrame(i, priority, attempt + 1); }
      state[i] = 3;
      if (i === order[0]) resolveReady();
    }
  }

  function load(priority = 'auto', concurrency = 8) {
    if (started) return ready;
    started = true;
    let cursor = 0;
    const next = () => {
      while (cursor < order.length && state[order[cursor]]) cursor++;
      if (cursor >= order.length) return null;
      return order[cursor++];
    };
    const worker = async () => {
      for (let i = next(); i !== null; i = next()) await fetchFrame(i, priority);
    };
    for (let k = 0; k < concurrency; k++) worker();
    return ready;
  }

  function nearest(i) {
    i = Math.max(0, Math.min(count - 1, Math.round(i)));
    if (state[i] === 2) return i;
    for (let d = 1; d < count; d++) {
      if (i - d >= 0 && state[i - d] === 2) return i - d;
      if (i + d < count && state[i + d] === 2) return i + d;
    }
    return -1;
  }

  // backing store follows the layout CSS box (offsetWidth/offsetHeight, unaffected by CSS scale transforms),
  // multiplied by DPR and maxScale so scaling up during scroll never blurs, capped at the native frame size
  function resize() {
    const cssW = canvas.offsetWidth || canvas.getBoundingClientRect().width;
    const cssH = canvas.offsetHeight || canvas.getBoundingClientRect().height;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * maxScale;
    let w = Math.max(1, cssW * dpr), h = Math.max(1, cssH * dpr);
    // keep the backing store aspect-matched to the CSS box, capped so neither axis exceeds the native frame
    const s = Math.max(w / width, h / height);
    if (s > 1) { w /= s; h /= s; }
    w = Math.round(w); h = Math.round(h);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      lastKey = '';
    }
  }

  // where the frame sits inside the canvas (canvas pixels)
  function placement() {
    const cw = canvas.width, ch = canvas.height;
    const k = fit === 'cover' ? Math.max(cw / width, ch / height) : Math.min(cw / width, ch / height);
    const dw = width * k, dh = height * k;
    return { x: (cw - dw) / 2, y: (ch - dh) / 2, w: dw, h: dh };
  }

  // draw(index): fractional indices crossfade between neighbours when step === 1 (smooth slow playback);
  // when step > 1 (the cut turn/push-in), snap to the nearest loaded frame so fast rotation never ghosts/double-exposes
  function draw(index, blend = true) {
    const useBlend = blend && step === 1;
    const a = nearest(useBlend ? Math.floor(index) : Math.round(index));
    if (a < 0) return false;
    const frac = index - Math.floor(index);
    const b = useBlend && frac > 0.01 ? nearest(Math.ceil(index)) : a;
    const key = `${a}|${b}|${b !== a ? frac.toFixed(3) : ''}|${canvas.width}x${canvas.height}`;
    if (key === lastKey) return true;
    lastKey = key;
    const p = placement();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.drawImage(frames[a], p.x, p.y, p.w, p.h);
    if (b !== a) {
      ctx.globalAlpha = frac;
      ctx.drawImage(frames[b], p.x, p.y, p.w, p.h);
      ctx.globalAlpha = 1;
    }
    lastDrawn = a;
    return true;
  }

  // anchor (normalised in the frame) → CSS pixels relative to the layout canvas box
  function project(nx, ny) {
    const p = placement();
    const cssW = canvas.offsetWidth || canvas.getBoundingClientRect().width;
    const cssH = canvas.offsetHeight || canvas.getBoundingClientRect().height;
    const sx = cssW / (canvas.width || 1), sy = cssH / (canvas.height || 1);
    return { x: (p.x + nx * p.w) * sx, y: (p.y + ny * p.h) * sy };
  }

  const has = (i) => state[i] === 2;
  const hasRange = (a, b) => { for (let i = a; i <= b; i++) if (state[i] !== 2) return false; return true; };
  const onLoad = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  return { load, draw, ready, resize, project, nearest, has, hasRange, onLoad, get loaded() { return loaded; }, count, canvas };
}
