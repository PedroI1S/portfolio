/* hello.exe: shared chrome kit.
   The sky environment, distance-field helpers and the inflater that turns any 2D silhouette
   into a puffy, balloon-like mesh. Used by the hero word, the desktop icons and the contact word. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

export { THREE };

export const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const THEMES = {
  // Aqua: blue zenith, a white horizon band and a thin dark line under it give the chrome its blue-to-silver read
  a: { zenith: '#2E62B8', mid: '#7FAFE2', haze: '#CFE6F4', horizon: '#FFFFFF', line: '#101C33', near: '#5F7FAE', far: '#E8EEF1', sun: '#FFF4E6', exposure: 1.0 },
  // Graphite: a night desk lamp. Same geometry, darker sky, cooler highlights
  g: { zenith: '#060B16', mid: '#1E2E50', haze: '#5876AD', horizon: '#E2ECFF', line: '#000000', near: '#1A2338', far: '#4A5878', sun: '#C6DAFF', exposure: 1.4 },
};

/* ---------- Environment: the sky as a sphere plus a few softboxes ---------- */
export function buildEnvironment(renderer, P) {
  const env = new THREE.Scene();
  const c = (hex) => new THREE.Color(hex);
  const sky = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: c(P.zenith) }, mid: { value: c(P.mid) }, haze: { value: c(P.haze) }, horizon: { value: c(P.horizon) },
      line: { value: c(P.line) }, near: { value: c(P.near) }, far: { value: c(P.far) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 zenith, mid, haze, horizon, line, near, far;
      varying vec3 vDir;
      void main() {
        float y = normalize(vDir).y;
        vec3 col;
        if (y >= 0.0) {
          float t = pow(y, 0.6);
          col = mix(horizon, haze, smoothstep(0.0, 0.22, t));
          col = mix(col, mid, smoothstep(0.2, 0.55, t));
          col = mix(col, zenith, smoothstep(0.5, 1.0, t));
          col += horizon * exp(-y * 30.0) * 0.6;
        } else {
          col = mix(near, far, smoothstep(0.1, 0.9, -y));
          col = mix(col, line, smoothstep(0.0, 0.02, -y) * (1.0 - smoothstep(0.05, 0.12, -y)));
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 64, 32), sky));

  const o = new THREE.Vector3();
  const box = (w, h, k, hex, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c(hex).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(o); env.add(m);
  };
  box(16, 2.4, 2.4, '#FFFFFF', 0, 14, 5);      // long overhead strip: the bright band across the top of each letter
  box(1.4, 12, 3.0, '#F2F8FF', -14, 3, 6);     // tall strip, left
  box(1.0, 10, 2.2, P.sun, 13, 2, 7);          // warm strip, right
  box(6, 1.4, 1.6, '#DDE9FF', 2, -3, 15);      // low fill from the camera side, lights the bellies
  box(0.6, 14, 1.4, '#FFFFFF', 5, 1, 14);      // thin vertical glints near the camera
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 12), new THREE.MeshBasicMaterial({ color: c(P.sun).multiplyScalar(8) }));
  sun.position.set(-9, 8, 11);
  env.add(sun);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.015);
  pmrem.dispose();
  env.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } });
  return rt;
}

/* ---------- Distance-field helpers ---------- */
const INF = 1e20;
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const dq = q - v[k]; d[q] = dq * dq + f[v[k]]; }
}
// squared Euclidean distance to the nearest pixel where `feature` is true
function edt(feature, w, h) {
  const n = Math.max(w, h);
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = feature[i] ? 0 : INF;
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
  return grid;
}
// separable box blur, run `passes` times (three passes ≈ gaussian)
function blur(src, w, h, r, passes = 3) {
  let a = src, b = new Float32Array(w * h);
  const win = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += a[row + clamp(i, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        b[row + x] = acc / win;
        acc += a[row + Math.min(x + r + 1, w - 1)] - a[row + Math.max(x - r, 0)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += b[clamp(i, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / win; // safe: this column of `a` is only read below the cursor
        acc += b[Math.min(y + r + 1, h - 1) * w + x] - b[Math.max(y - r, 0) * w + x];
      }
    }
  }
  return a;
}

/* ---------- Rasterising silhouettes ---------- */
/** Draws white shapes with `draw(ctx)` on a W×H canvas and returns their coverage (0–1). */
export function rasterDraw(W, H, draw) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  draw(ctx);
  const px = ctx.getImageData(0, 0, W, H).data;
  const alpha = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) alpha[i] = px[i * 4 + 3] / 255;
  return { alpha, W, H };
}

/** Rasterises a word in a heavy face; letters overlap so the balloons fuse into one piece. */
export function rasterText(text, { fontPx = 300, family = '"Unbounded", "Arial Black", sans-serif', spacingEm = -0.075 } = {}) {
  const pad = Math.ceil(fontPx * 0.14);
  const probe = document.createElement('canvas').getContext('2d');
  const font = `900 ${fontPx}px ${family}`;
  probe.font = font;
  if ('letterSpacing' in probe) probe.letterSpacing = `${spacingEm * fontPx}px`;
  const m = probe.measureText(text);
  const W = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight) + pad * 2;
  const H = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + pad * 2;
  return rasterDraw(W, H, (ctx) => {
    ctx.font = font;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacingEm * fontPx}px`;
    ctx.fillText(text, pad + m.actualBoundingBoxLeft, pad + m.actualBoundingBoxAscent);
  });
}

/* ---------- The inflater ---------- */
/**
 * Puffs a coverage mask into a closed mesh (front and back shells meeting at the outline).
 * round  – blur radius that rounds every corner of the silhouette (px)
 * smooth – blur radius on the distance field; melts medial-axis creases (px)
 * step   – grid spacing (px)
 * puff   – height as a share of the local half-thickness (≈1 is a round tube)
 * cap    – soft limit on the distance (px): 0 for balloons, small for flat-topped pillows
 * scale  – world units per raster px; origin is the raster centre unless `center` is true
 */
export function inflate({ alpha, W, H }, { round = 3, smooth = 4, step = 3, puff = 0.92, cap = 0, scale = 1, center = false } = {}) {
  let cover = blur(Float32Array.from(alpha), W, H, Math.max(1, Math.round(round)));
  const inside = new Uint8Array(W * H), outside = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { inside[i] = cover[i] >= 0.5 ? 1 : 0; outside[i] = 1 - inside[i]; }

  // signed distance in pixels: positive inside
  const dIn = edt(outside, W, H), dOut = edt(inside, W, H);
  let sdf = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) sdf[i] = inside[i] ? Math.sqrt(dIn[i]) - 0.5 : -(Math.sqrt(dOut[i]) - 0.5);
  // smoothing the distance (not the height) keeps the field linear at the edge
  sdf = blur(sdf, W, H, Math.max(1, Math.round(smooth)));

  const S = (x, y) => {
    x = clamp(x, 0, W - 1.001); y = clamp(y, 0, H - 1.001);
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * W + x0;
    return (sdf[i] * (1 - fx) + sdf[i + 1] * fx) * (1 - fy) + (sdf[i + W] * (1 - fx) + sdf[i + W + 1] * fx) * fy;
  };
  const grad = (x, y) => [(S(x + 1, y) - S(x - 1, y)) / 2, (S(x, y + 1) - S(x, y - 1)) / 2];

  let smax = 0;
  for (let i = 0; i < W * H; i++) if (sdf[i] > smax) smax = sdf[i];
  // soft cap: s' ≈ s near the edge (keeps the round rim), levels off at `cap` (flat top)
  const soft = (s) => (cap > 0 ? cap * (1 - Math.exp(-s / cap)) : s);
  const dsoft = (s) => (cap > 0 ? Math.exp(-s / cap) : 1);
  const smaxEff = soft(smax);
  // h = k·√s': a vertical tangent at the outline, like a balloon
  const k = Math.sqrt(smaxEff) * puff;

  const nx = Math.floor((W - 1) / step) + 1, ny = Math.floor((H - 1) / step) + 1;
  const sg = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) sg[j * nx + i] = S(i * step, j * step);

  const vid = new Int32Array(nx * ny).fill(-1);
  const pos = [], nor = [], hgt = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const vertex = (i, j) => {
    const key = j * nx + i;
    if (vid[key] >= 0) return vid[key];
    let x = i * step, y = j * step, s = sg[key], h, n;
    if (s <= 0) {
      // outside corner: slide it onto the outline (Newton steps along the gradient)
      for (let it = 0; it < 5; it++) {
        const [gx, gy] = grad(x, y);
        const gg = gx * gx + gy * gy + 1e-6;
        s = S(x, y);
        x -= (s * gx) / gg; y -= (s * gy) / gg;
      }
      const [gx, gy] = grad(x, y);
      const l = Math.hypot(gx, gy) || 1;
      h = 0; n = [-gx / l, gy / l, 0];
    } else {
      const [gx, gy] = grad(x, y);
      const sp = soft(s);
      h = k * Math.sqrt(sp);
      const dh = ((k * 0.5) / Math.sqrt(Math.max(sp, 0.35))) * dsoft(s);
      const ax = -dh * gx, ay = dh * gy, l = Math.hypot(ax, ay, 1);
      n = [ax / l, ay / l, 1 / l];
    }
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    pos.push(x, y); nor.push(n[0], n[1], n[2]); hgt.push(h);
    vid[key] = hgt.length - 1;
    return vid[key];
  };

  const tris = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const s0 = sg[j * nx + i], s1 = sg[j * nx + i + 1], s2 = sg[(j + 1) * nx + i + 1], s3 = sg[(j + 1) * nx + i];
      if (s0 <= 0 && s1 <= 0 && s2 <= 0 && s3 <= 0) continue;
      const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i + 1, j + 1), d = vertex(i, j + 1);
      // split along the diagonal that keeps the most inside corners together
      if ((s0 > 0 && s2 > 0) || !(s1 > 0 && s3 > 0)) tris.push(a, c, b, a, d, c);
      else tris.push(a, d, b, b, d, c);
    }
  }

  const n = hgt.length;
  const cx = center ? (minX + maxX) / 2 : W / 2, cy = center ? (minY + maxY) / 2 : H / 2;
  const P = new Float32Array(n * 6), N = new Float32Array(n * 6);
  for (let v = 0; v < n; v++) {
    const X = (pos[v * 2] - cx) * scale, Y = -(pos[v * 2 + 1] - cy) * scale, Z = hgt[v] * scale;
    const a = nor[v * 3], b = nor[v * 3 + 1], c = nor[v * 3 + 2];
    P[v * 3] = X; P[v * 3 + 1] = Y; P[v * 3 + 2] = Z;
    N[v * 3] = a; N[v * 3 + 1] = b; N[v * 3 + 2] = c;
    P[(n + v) * 3] = X; P[(n + v) * 3 + 1] = Y; P[(n + v) * 3 + 2] = -Z;
    N[(n + v) * 3] = a; N[(n + v) * 3 + 1] = b; N[(n + v) * 3 + 2] = -c;
  }
  const idx = new Uint32Array(tris.length * 2);
  let t = 0;
  for (let q = 0; q < tris.length; q += 3) {
    const a = tris[q], b = tris[q + 1], c = tris[q + 2];
    if (hgt[a] === 0 && hgt[b] === 0 && hgt[c] === 0) continue; // flat slivers on the outline
    idx[t++] = a; idx[t++] = b; idx[t++] = c;
    idx[t++] = n + a; idx[t++] = n + c; idx[t++] = n + b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, t), 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return { geo, width: (maxX - minX) * scale, height: (maxY - minY) * scale, depth: puff * smaxEff * scale };
}

/* ---------- Materials ---------- */
export const materials = {
  chrome: () => new THREE.MeshPhysicalMaterial({
    color: '#DCE6F3', metalness: 1, roughness: 0.07,
    iridescence: 0.85, iridescenceIOR: 1.45, iridescenceThicknessRange: [180, 560],
  }),
  satin: () => new THREE.MeshPhysicalMaterial({ color: '#C9D4E3', metalness: 1, roughness: 0.22 }),
  plastic: (color, rough = 0.2) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }),
};

/** A renderer with the sky environment, ready for one of the theme keys. */
export function makeRenderer(canvas, theme) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  let envRT = null;
  const setEnv = (t) => {
    const P = THEMES[t] || THEMES.a;
    const next = buildEnvironment(renderer, P);
    scene.environment = next.texture;
    renderer.toneMappingExposure = P.exposure;
    if (envRT) envRT.dispose();
    envRT = next;
  };
  setEnv(theme);
  return { renderer, scene, setEnv };
}
