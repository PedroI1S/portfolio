/* Seedfile — plotting core (no DOM).
   Every drawing on the page is recorded as pen strokes, so any of them can be plotted by the same engine:
   the hero flow field, the eight project plots, the service sketches and the blue-pen portrait.
   Imported by main.js and by _src/bake.mjs (static SVG fallbacks). */

export const TAU = Math.PI * 2;

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeded 3D Perlin noise, roughly -0.7..0.7
export function createNoise(seed) {
  const rand = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  const grad = (h, x, y, z) => {
    const k = h & 15;
    const u = k < 8 ? x : y;
    const v = k < 4 ? y : (k === 12 || k === 14 ? x : z);
    return ((k & 1) === 0 ? u : -u) + ((k & 2) === 0 ? v : -v);
  };
  return (x, y, z) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
           lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
           lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  };
}

export const MODES = ['drift', 'curl', 'vortex', 'quantised'];

// Evenly spaced streamlines (after Jobard & Lefer) through a seeded field,
// then ordered nearest-neighbour so the pen travels like a real plotter.
export function buildFlowPlot(seed, w, h, box) {
  const rand = mulberry32(seed);
  const noise = createNoise(seed);
  const mode = MODES[Math.floor(rand() * MODES.length)];
  const x0 = box.l, y0 = box.t, x1 = w - box.r, y1 = h - box.b;
  const pw = x1 - x0, ph = y1 - y0, short = Math.min(pw, ph);

  const f = (1.2 + rand() * 2.2) / short;
  const z = rand() * 64;
  const rot = rand() * TAU;
  const amp = 0.8 + rand() * 0.9;
  const q = Math.PI / (rand() < 0.5 ? 4 : 3);
  const e = 1.5 * f;
  const vortices = [];
  for (let i = 0, n = 1 + Math.floor(rand() * 3); i < n; i++) {
    vortices.push({
      x: x0 + pw * (0.15 + rand() * 0.7), y: y0 + ph * (0.15 + rand() * 0.7),
      s: rand() < 0.5 ? -1 : 1, r: short * (0.18 + rand() * 0.3)
    });
  }

  const field = (x, y) => {
    const nx = x * f, ny = y * f;
    if (mode === 'curl') {
      const a = noise(nx, ny + e, z) - noise(nx, ny - e, z);
      const b = noise(nx + e, ny, z) - noise(nx - e, ny, z);
      return Math.atan2(-b, a);
    }
    const base = noise(nx, ny, z) * TAU * amp + rot;
    if (mode === 'quantised') return Math.round(base / q) * q;
    if (mode === 'vortex') {
      let vx = Math.cos(base) * 0.5, vy = Math.sin(base) * 0.5;
      for (const v of vortices) {
        const dx = x - v.x, dy = y - v.y, d = Math.hypot(dx, dy) + 1e-3;
        const k = ((v.r * v.r) / (d * d + v.r * v.r)) * v.s;
        vx -= (dy / d) * k; vy += (dx / d) * k;
      }
      return Math.atan2(vy, vx);
    }
    return base;
  };

  const dsep = Math.min(10, Math.max(5, short / 78)) * (0.85 + rand() * 0.35);
  const dtest = dsep * 0.55;
  const step = Math.max(1.5, dsep * 0.3);
  const skip = Math.ceil((dsep * 3) / step);
  const cell = dsep;
  const gw = Math.ceil(w / cell) + 1, gh = Math.ceil(h / cell) + 1;
  const grid = new Array(gw * gh);
  const PX = [], PY = [], PL = [], PS = [];

  const add = (x, y, line, seq) => {
    const p = PX.length;
    PX.push(x); PY.push(y); PL.push(line); PS.push(seq);
    const key = Math.floor(y / cell) * gw + Math.floor(x / cell);
    (grid[key] || (grid[key] = [])).push(p);
  };
  // Is any point of another line (or a distant part of this one) closer than d?
  const near = (x, y, d, line, seq) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), d2 = d * d;
    for (let j = Math.max(0, cy - 1); j <= Math.min(gh - 1, cy + 1); j++) {
      for (let i = Math.max(0, cx - 1); i <= Math.min(gw - 1, cx + 1); i++) {
        const b = grid[j * gw + i];
        if (!b) continue;
        for (let k = 0; k < b.length; k++) {
          const pt = b[k], l = PL[pt];
          if (l < 0 || (l === line && Math.abs(PS[pt] - seq) < skip)) continue;
          const dx = PX[pt] - x, dy = PY[pt] - y;
          if (dx * dx + dy * dy < d2) return true;
        }
      }
    }
    return false;
  };

  const maxSteps = Math.ceil((pw + ph) / step);
  const trace = (sx, sy, line) => {
    const halves = [];
    for (const sgn of [1, -1]) {
      const out = [];
      let x = sx, y = sy, pa = null;
      for (let s = 1; s <= maxSteps; s++) {
        const a1 = field(x, y);
        const a = field(x + Math.cos(a1) * step * 0.5 * sgn, y + Math.sin(a1) * step * 0.5 * sgn);
        const nx = x + Math.cos(a) * step * sgn, ny = y + Math.sin(a) * step * sgn;
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1) break;
        if (pa !== null && Math.cos(a - pa) < -0.2) break;   // the field folds back on itself
        if (near(nx, ny, dtest, line, s * sgn)) break;
        add(nx, ny, line, s * sgn);
        out.push(nx, ny);
        x = nx; y = ny; pa = a;
      }
      halves.push(out);
    }
    const [fwd, bwd] = halves;
    const pts = new Float32Array(fwd.length + bwd.length + 2);
    let o = 0;
    for (let i = bwd.length - 2; i >= 0; i -= 2) { pts[o++] = bwd[i]; pts[o++] = bwd[i + 1]; }
    pts[o++] = sx; pts[o++] = sy;
    for (let i = 0; i < fwd.length; i++) pts[o++] = fwd[i];
    return pts;
  };

  // Seeds: first from beside existing lines (keeps spacing even), then a shuffled jittered grid (fills gaps)
  const cand = [];
  const cs = dsep * 4;
  for (let y = y0 + cs * 0.5; y < y1; y += cs) {
    for (let x = x0 + cs * 0.5; x < x1; x += cs) cand.push([x + (rand() - 0.5) * cs, y + (rand() - 0.5) * cs]);
  }
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cand[i], cand[j]] = [cand[j], cand[i]];
  }

  const lines = [], queue = [];
  let qh = 0, ci = 0, id = 0;
  const minPts = 10, every = 3, maxPts = 160000;
  while (PX.length < maxPts) {
    let sx, sy;
    if (qh < queue.length) { sx = queue[qh++]; sy = queue[qh++]; }
    else if (ci < cand.length) { [sx, sy] = cand[ci++]; }
    else break;
    if (sx < x0 || sx > x1 || sy < y0 || sy > y1) continue;
    if (near(sx, sy, dsep * 0.98, -2, 0)) continue;
    const first = PX.length;
    add(sx, sy, id, 0);
    const pts = trace(sx, sy, id);
    if (pts.length < minPts * 2) {
      for (let pt = first; pt < PX.length; pt++) PL[pt] = -1;
      continue;
    }
    id++;
    lines.push(pts);
    for (let i = 2; i < pts.length - 2; i += 2 * every) {
      const dx = pts[i + 2] - pts[i - 2], dy = pts[i + 3] - pts[i - 1];
      const l = Math.hypot(dx, dy) || 1;
      const ox = (-dy / l) * dsep, oy = (dx / l) * dsep;
      queue.push(pts[i] + ox, pts[i + 1] + oy, pts[i] - ox, pts[i + 1] - oy);
    }
  }

  // Greedy pen path: always start the nearest unplotted line, from whichever end is closer
  const n = lines.length, used = new Uint8Array(n), order = [];
  let px = x0, py = y0;
  for (let k = 0; k < n; k++) {
    let best = 0, bd = Infinity, rev = false;
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const L = lines[i], m = L.length;
      let dx = L[0] - px, dy = L[1] - py, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; rev = false; }
      dx = L[m - 2] - px; dy = L[m - 1] - py; d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; rev = true; }
    }
    used[best] = 1;
    let L = lines[best];
    if (rev) {
      const R = new Float32Array(L.length);
      for (let i = 0; i < L.length; i += 2) { R[i] = L[L.length - 2 - i]; R[i + 1] = L[L.length - 1 - i]; }
      L = R;
    }
    order.push(L);
    px = L[L.length - 2]; py = L[L.length - 1];
  }

  return { mode, strokes: order, box: { x0, y0, x1, y1 } };
}

/* ---------- Pen recorder: the drawing API every generator uses ---------- */
// moveTo / lineTo / arc behave like canvas paths; arcs are flattened into ~3px chords; dot() is a pen dab.
// Points outside the sheet (w × h, 1px slack) lift the pen, so nothing is plotted off the paper.
export function createPen(w = Infinity, h = Infinity) {
  const out = [];
  let cur = null, lx = NaN, ly = NaN;
  const inside = (x, y) => x >= -1 && x <= w + 1 && y >= -1 && y <= h + 1;
  const pen = {
    moveTo(x, y) {
      cur = null; lx = x; ly = y;
      if (inside(x, y)) { cur = [x, y]; out.push(cur); }
    },
    lineTo(x, y) {
      lx = x; ly = y;
      if (!inside(x, y)) { cur = null; return; }
      if (cur) cur.push(x, y);
      else { cur = [x, y]; out.push(cur); }
    },
    arc(cx, cy, r, a0, a1) {
      const n = Math.max(6, Math.ceil((Math.abs(a1 - a0) * r) / 3));
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (i === 0) {
          if (Math.abs(x - lx) < 0.01 && Math.abs(y - ly) < 0.01) continue;
          pen.moveTo(x, y);
        } else pen.lineTo(x, y);
      }
    },
    dot(x, y) { pen.moveTo(x, y); pen.lineTo(x + 0.4, y); },
    strokes() { return out.filter((st) => st.length >= 4).map((st) => Float32Array.from(st)); }
  };
  return pen;
}

// Run a generator with a fresh pen. Generators may return { width } for a broader pen (stipple).
export function record(gen, w, h, seed) {
  const pen = createPen(w, h);
  const opts = gen(pen, w, h, mulberry32(seed), createNoise(seed)) || {};
  return { strokes: pen.strokes(), width: opts.width || 1 };
}

// Where a line o + s·d crosses a polygon's edges, sorted along s (pairs are inside spans)
function crossings(P, ox, oy, dx, dy) {
  const ss = [];
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
    const ex = bx - ax, ey = by - ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const s = ((ax - ox) * ey - (ay - oy) * ex) / den;
    const t = ((ax - ox) * dy - (ay - oy) * dx) / den;
    if (t >= 0 && t < 1) ss.push(s);
  }
  return ss.sort((a, b) => a - b);
}

// Parallel hatching clipped to a polygon, drawn back and forth like a plotter would
function hatchPoly(pen, P, angle, spacing) {
  let cx = 0, cy = 0, R = 0;
  P.forEach(([x, y]) => { cx += x / P.length; cy += y / P.length; });
  P.forEach(([x, y]) => { R = Math.max(R, Math.hypot(x - cx, y - cy)); });
  const ux = Math.cos(angle), uy = Math.sin(angle);
  let flip = false;
  for (let t = -R; t <= R; t += spacing) {
    const ox = cx - uy * t, oy = cy + ux * t;
    const ss = crossings(P, ox, oy, ux, uy);
    for (let k = 0; k + 1 < ss.length; k += 2) {
      let s0 = ss[k], s1 = ss[k + 1];
      if (flip) [s0, s1] = [s1, s0];
      pen.moveTo(ox + ux * s0, oy + uy * s0);
      pen.lineTo(ox + ux * s1, oy + uy * s1);
    }
    flip = !flip;
  }
}

/* ---------- The eight project plots (work ledger and plot reel). Sizes are relative to w. ---------- */
export const PLOTS = {
  rings(pen, w, h, rand, noise) {
    // constant-amplitude wobble, so neighbouring rings never cross
    const cx = w * (0.3 + rand() * 0.4), cy = h * (0.35 + rand() * 0.3);
    const gap = w / 70, max = Math.hypot(w, h) * 0.7, amp = w * 0.07;
    const seg = Math.max(90, Math.round(w / 3));
    for (let r = gap; r < max; r += gap) {
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * TAU;
        const rr = r + noise(Math.cos(a) * 1.3 + 4, Math.sin(a) * 1.3 + 4, (r / w) * 1.4) * amp * Math.min(1, r / (w * 0.15));
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        i ? pen.lineTo(x, y) : pen.moveTo(x, y);
      }
    }
  },
  ridges(pen, w, h, rand, noise) {
    // 36 kiln firings overlaid: ramp, hold, cool, each read from its own log
    const left = w * 0.06, right = w * 0.96, base = h * 0.88, top = h * 0.12;
    pen.moveTo(left, base); pen.lineTo(right, base);
    for (let k = 0; k <= 12; k++) {
      const x = left + ((right - left) * k) / 12;
      pen.moveTo(x, base); pen.lineTo(x, base + h * 0.025);
    }
    for (let j = 0; j < 36; j++) {
      const peak = 0.78 + rand() * 0.2, ramp = 0.26 + rand() * 0.14, hold = 0.18 + rand() * 0.16, tau = 0.12 + rand() * 0.1;
      for (let i = 0; i <= 240; i++) {
        const t = i / 240;
        let T;
        if (t < ramp) { const u = t / ramp; T = peak * u * u * (3 - 2 * u); }
        else if (t < ramp + hold) T = peak + noise(t * 40, j * 0.7, 2.2) * 0.025;
        else T = peak * Math.exp(-(t - ramp - hold) / tau);
        T += noise(t * 12, j * 0.37, 5.5) * 0.02;
        const x = left + t * (right - left), y = base - T * (base - top);
        i ? pen.lineTo(x, y) : pen.moveTo(x, y);
      }
    }
  },
  harmonograph(pen, w, h, rand) {
    const f1 = 2 + Math.floor(rand() * 2), f2 = f1 + 1;
    const p = [rand() * TAU, rand() * TAU, rand() * TAU, rand() * TAU];
    const ax = w * 0.4, ay = h * 0.42, cx = w / 2, cy = h / 2;
    for (let i = 0; i < 7000; i++) {
      const t = i * 0.03, d = Math.exp(-0.0055 * t);
      const x = cx + ax * d * (Math.sin(f1 * t + p[0]) * 0.62 + Math.sin(f2 * 1.004 * t + p[1]) * 0.38);
      const y = cy + ay * d * (Math.sin(f2 * t + p[2]) * 0.62 + Math.sin(f1 * 1.003 * t + p[3]) * 0.38);
      i ? pen.lineTo(x, y) : pen.moveTo(x, y);
    }
  },
  truchet(pen, w, h, rand) {
    const s = w / 16;
    const arc = (cx, cy, r, a0) => {
      pen.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
      pen.arc(cx, cy, r, a0, a0 + Math.PI / 2);
    };
    for (let y = 0, row = 0; y < h - 0.5; y += s, row++) {
      // serpentine rows, as a plotter would run them
      const xs = [];
      for (let x = 0; x < w - 0.5; x += s) xs.push(x);
      if (row % 2) xs.reverse();
      for (const x of xs) {
        const flip = rand() < 0.5;
        for (const r of [s / 3, s / 2, (2 * s) / 3]) {
          if (flip) { arc(x, y, r, 0); arc(x + s, y + s, r, Math.PI); }
          else { arc(x + s, y, r, Math.PI / 2); arc(x, y + s, r, -Math.PI / 2); }
        }
      }
    }
  },
  stipple(pen, w, h, rand, noise) {
    const n = Math.min(Math.floor((w * h) / 2), 36000), dot = Math.max(1.4, w / 330);
    const cx = w * 0.5, cy = h * 0.52, pts = [];
    for (let i = 0; i < n; i++) {
      const x = rand() * w, y = rand() * h;
      const v = noise((x / w) * 3, (y / h) * 2, 1.7) + 0.6;
      const r = Math.hypot((x - cx) / (w * 0.44), (y - cy) / (h * 0.46));
      const d = Math.max(0, v) ** 1.4 * Math.max(0, 1 - r * r);
      if (rand() < d * 0.75) pts.push([x, y]);
    }
    // dab them in serpentine bands
    const band = h / 28;
    pts.sort((a, b) => {
      const ra = Math.floor(a[1] / band), rb = Math.floor(b[1] / band);
      return ra - rb || (ra % 2 ? b[0] - a[0] : a[0] - b[0]);
    });
    pts.forEach(([x, y]) => pen.dot(x, y));
    return { width: dot };
  },
  hatch(pen, w, h, rand) {
    const cols = 7, rows = 5, cw = w / cols, ch = h / rows;
    const V = [];
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const edge = i === 0 || j === 0 || i === cols || j === rows;
        V.push([i * cw + (edge ? 0 : (rand() - 0.5) * cw * 0.6), j * ch + (edge ? 0 : (rand() - 0.5) * ch * 0.6)]);
      }
    }
    const at = (i, j) => V[j * (cols + 1) + i];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const P = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
        if (rand() > 0.12) hatchPoly(pen, P, rand() * Math.PI, (w / 256) * (2.4 + rand() * 4.5));
        pen.moveTo(P[0][0], P[0][1]);
        for (let k = 1; k <= 4; k++) pen.lineTo(P[k % 4][0], P[k % 4][1]);
      }
    }
  },
  streams(pen, w, h, rand, noise) {
    // neighbouring lines share their displacement, so they braid into ribbons instead of collapsing
    const n = 64, st = w / 160;
    for (let i = 0; i < n; i++) {
      const y0 = ((i + 0.5) / n) * h * 1.2 - h * 0.1;
      const xs = [];
      for (let x = 0; x <= w + st; x += st) xs.push(x);
      if (i % 2) xs.reverse();
      xs.forEach((x, k) => {
        const y = y0 + noise((x / w) * 2.2, (y0 / h) * 1.1, 5.3) * h * 0.42 + noise((x / w) * 9, i * 0.08, 2.1) * h * 0.02;
        k ? pen.lineTo(x, y) : pen.moveTo(x, y);
      });
    }
  },
  circles(pen, w, h, rand, noise) {
    const s = w / 14;
    for (let y = s / 2, row = 0; y < h; y += s, row++) {
      const xs = [];
      for (let x = s / 2; x < w; x += s) xs.push(x);
      if (row % 2) xs.reverse();
      for (const x of xs) {
        const v = noise((x / w) * 3, (y / h) * 2, 9.1) + 0.5;
        const r = Math.max(s * 0.04, v * s * 0.5);
        pen.moveTo(x + r, y); pen.arc(x, y, r, 0, TAU);
        if (v > 0.62) { pen.moveTo(x + r * 0.5, y); pen.arc(x, y, r * 0.5, 0, TAU); }
      }
    }
  }
};

/* ---------- Service sketches: 120 × 28 strips that re-seed on hover ---------- */
export const MICRO = [
  function glyphs(pen, w, h, rand) {      // generative identities: a row of made-up letterforms
    const n = 7, cw = w / n;
    for (let i = 0; i < n; i++) {
      const x0 = i * cw + 3, x1 = (i + 1) * cw - 3;
      const k = 3 + Math.floor(rand() * 3);
      for (let j = 0; j <= k; j++) {
        const x = x0 + rand() * (x1 - x0), y = 3 + rand() * (h - 6);
        j ? pen.lineTo(x, y) : pen.moveTo(x, y);
      }
    }
  },
  function waves(pen, w, h, rand) {       // installations: three overlapping signals
    for (let j = 0; j < 3; j++) {
      const f = 1 + rand() * 3.5, ph = rand() * TAU, a = (h / 2 - 3) * (0.35 + rand() * 0.65);
      for (let x = 0; x <= w; x += 1.5) {
        const y = h / 2 + Math.sin((x / w) * TAU * f + ph) * a;
        x ? pen.lineTo(x, y) : pen.moveTo(x, y);
      }
    }
  },
  function bars(pen, w, h, rand) {        // data tools: a bar series on a baseline
    const n = 22;
    let v = 0.3 + rand() * 0.4;
    pen.moveTo(0, h - 2); pen.lineTo(w, h - 2);
    for (let i = 0; i < n; i++) {
      v = Math.min(1, Math.max(0.08, v + (rand() - 0.5) * 0.45));
      const x = 2 + (i * (w - 4)) / (n - 1);
      pen.moveTo(x, h - 2); pen.lineTo(x, h - 2 - v * (h - 5));
    }
  },
  function hatching(pen, w, h, rand) {    // plotter editions: one hatched sheet
    hatchPoly(pen, [[1, 1], [w - 1, 1], [w - 1, h - 1], [1, h - 1]], rand() * Math.PI, 3 + rand() * 2.5);
  },
  function dots(pen, w, h, rand) {        // workshops: a room of twelve, and then some
    const cols = 15, rows = 3, sx = w / cols, sy = h / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = sx * (i + 0.5), y = sy * (j + 0.5), r = 0.6 + rand() * (Math.min(sx, sy) / 2 - 1);
        pen.moveTo(x + r, y); pen.arc(x, y, r, 0, TAU);
      }
    }
  }
];

/* ---------- The blue-pen figure: three people, one continuous line each ---------- */
export function portrait(pen, w, h, rand) {
  // [R, r, centre x, centre y, pen offset as a multiple of r]: looped rosettes that overlap without merging
  const people = [[8, 3, 0.32, 0.55, 1.5], [10, 3, 0.5, 0.45, 1.4], [12, 5, 0.68, 0.55, 1.45]];
  const s = Math.min(w, h) * 0.36;
  people.forEach(([R, r, fx, fy, dk]) => {
    const d = r * dk, k = s / (R - r + d), rot = rand() * TAU;
    const turns = r / gcd(R, r), steps = 300 * turns;
    for (let j = 0; j <= steps; j++) {
      const t = (j / steps) * TAU * turns;
      const x0 = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
      const y0 = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
      const x = w * fx + k * (x0 * Math.cos(rot) - y0 * Math.sin(rot));
      const y = h * fy + k * (x0 * Math.sin(rot) + y0 * Math.cos(rot));
      j ? pen.lineTo(x, y) : pen.moveTo(x, y);
    }
  });
}
function gcd(a, b) { return b ? gcd(b, a % b) : a; }

/* ---------- Plot engine: a job is strokes plus a cost table; a cursor plots it forward ---------- */
// Cost ≈ plotter time: line drawn + a pen-down allowance + pen-up travel at four times the speed.
export function createJob(strokes, { width = 1, penDown = 4, travelRate = 0.25, homeX = 0, homeY = 0 } = {}) {
  const n = strokes.length;
  const lens = new Float64Array(n), down = new Float64Array(n);
  let total = 0, px = homeX, py = homeY;
  for (let i = 0; i < n; i++) {
    const L = strokes[i];
    let len = 0;
    for (let j = 2; j < L.length; j += 2) len += Math.hypot(L[j] - L[j - 2], L[j + 1] - L[j - 1]);
    total += Math.hypot(L[0] - px, L[1] - py) * travelRate + penDown;
    down[i] = total; lens[i] = len; total += len;
    px = L[L.length - 2]; py = L[L.length - 1];
  }
  return { strokes, n, lens, down, total, width, homeX, homeY };
}

export function createCursor(job) {
  return { li: 0, pi: 0, cost: 0, x: job.homeX, y: job.homeY, fx: job.homeX, fy: job.homeY, up: true };
}

export const isDone = (job, cur) => cur.li >= job.n;

// Plot forward to `target` cost, drawing on ctx (or just moving the cursor when ctx is null).
// onDown(i, fromX, fromY, toX, toY) fires each time the pen lands, for drawing pen-up travel.
export function advance(ctx, job, cur, target, onDown) {
  const { strokes, down, lens } = job;
  if (ctx) ctx.beginPath();
  while (cur.li < job.n && cur.cost < target) {
    const L = strokes[cur.li];
    if (cur.pi === 0) {
      if (target < down[cur.li]) {
        // still in the air: slide along the travel move
        const t0 = cur.li ? down[cur.li - 1] + lens[cur.li - 1] : 0;
        const air = Math.max(1e-6, down[cur.li] - t0);
        const f = Math.min(1, Math.max(0, (target - t0) / air));
        cur.x = cur.fx + (L[0] - cur.fx) * f; cur.y = cur.fy + (L[1] - cur.fy) * f;
        cur.cost = target; cur.up = true;
        break;
      }
      if (onDown) onDown(cur.li, cur.fx, cur.fy, L[0], L[1]);
      cur.cost = down[cur.li]; cur.pi = 2; cur.x = L[0]; cur.y = L[1]; cur.up = false;
    }
    if (ctx) ctx.moveTo(cur.x, cur.y);
    while (cur.pi < L.length && cur.cost < target) {
      const x = L[cur.pi], y = L[cur.pi + 1];
      cur.cost += Math.hypot(x - cur.x, y - cur.y);
      if (ctx) ctx.lineTo(x, y);
      cur.x = x; cur.y = y; cur.pi += 2;
    }
    if (cur.pi >= L.length) {
      cur.cost = down[cur.li] + lens[cur.li];
      cur.fx = cur.x; cur.fy = cur.y;
      cur.li++; cur.pi = 0; cur.up = true;
    }
  }
  if (ctx) ctx.stroke();
}
