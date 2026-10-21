// Bakes the schematic missions chart into index.html between <!--@map--> markers.
// Run: node site/work/tidewright/_src/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, '..', 'index.html');
const W = 1200, H = 900, CELL = 5;

/* ---------- seeded value noise ---------- */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2507);
const G = 64, lattice = Array.from({ length: G * G }, () => rand() * 2 - 1);
const fade = (t) => t * t * (3 - 2 * t);
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const at = (i, j) => lattice[((j % G + G) % G) * G + ((i % G + G) % G)];
  const u = fade(xf), v = fade(yf);
  const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, oct = 4) => { let s = 0, amp = 1, f = 1, n = 0; for (let k = 0; k < oct; k++) { s += amp * vnoise(x * f, y * f); n += amp; amp *= 0.5; f *= 2.1; } return s / n; };
const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));

/* ---------- height field: >0 land, <0 sea (units ≈ px of the 1200×900 chart) ---------- */
function field(x, y) {
  const xc = 340 - 80 * (y / H);
  let f = xc - x;
  f += 175 * gauss(y - 430, 48) * (x < 520 ? 1 : 0.6);              // Cobble Head
  f -= 46 * gauss(y - 655, 38);                                      // Vennick bay
  f += 26 * fbm(x / 70, y / 70);                                     // ragged coast
  const island = 52 - Math.hypot(x - 842, (y - 772) * 1.25) + 14 * fbm(x / 40 + 9, y / 40);
  f = Math.max(f, island);
  if (f < 0) {
    // offshore, contours wander more the deeper they get
    const depthMix = Math.min(1, -f / 220);
    f += 110 * fbm(x / 260 + 3, y / 260 + 5, 3) * depthMix;
    f -= 150 * gauss(Math.hypot(x - 600, (y - 250) * 1.15), 85);    // Sallow Deep
  } else {
    f += 60 * fbm(x / 120 + 20, y / 120, 3);                         // hills inland
  }
  return f;
}

/* ---------- marching squares on a padded grid, chained into polylines ---------- */
const cols = Math.ceil(W / CELL) + 3, rows = Math.ceil(H / CELL) + 3;
const vals = new Float32Array(cols * rows);
const gx = (i) => (i - 1) * CELL, gy = (j) => (j - 1) * CELL;
for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
  const pad = i === 0 || j === 0 || i === cols - 1 || j === rows - 1;
  vals[j * cols + i] = pad ? -1e4 : field(gx(i), gy(j));
}

function contour(L) {
  const segs = [];
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
    const a = vals[j * cols + i], b = vals[j * cols + i + 1], c = vals[(j + 1) * cols + i + 1], d = vals[(j + 1) * cols + i];
    const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const x0 = gx(i), y0 = gy(j), x1 = x0 + CELL, y1 = y0 + CELL;
    const T = [x0 + CELL * ((L - a) / (b - a)), y0];
    const R = [x1, y0 + CELL * ((L - b) / (c - b))];
    const B = [x0 + CELL * ((L - d) / (c - d)), y1];
    const Lf = [x0, y0 + CELL * ((L - a) / (d - a))];
    const add = (p, q) => segs.push([p, q]);
    switch (idx) {
      case 1: case 14: add(Lf, B); break;
      case 2: case 13: add(B, R); break;
      case 3: case 12: add(Lf, R); break;
      case 4: case 11: add(T, R); break;
      case 5: add(Lf, T); add(B, R); break;
      case 6: case 9: add(T, B); break;
      case 7: case 8: add(Lf, T); break;
      case 10: add(T, R); add(Lf, B); break;
    }
  }
  // chain
  const key = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const ends = new Map();
  segs.forEach((s, k) => { for (const p of s) { const kk = key(p); (ends.get(kk) || ends.set(kk, []).get(kk)).push(k); } });
  const used = new Uint8Array(segs.length), lines = [];
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue;
    used[k] = 1;
    const line = [segs[k][0], segs[k][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const tip = dir ? line[line.length - 1] : line[0];
        const next = (ends.get(key(tip)) || []).find((n) => !used[n]);
        if (next === undefined) break;
        used[next] = 1;
        const s = segs[next];
        const other = key(s[0]) === key(tip) ? s[1] : s[0];
        dir ? line.push(other) : line.unshift(other);
      }
    }
    lines.push(line);
  }
  return lines;
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  let max = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
    if (d > max) { max = d; at = i; }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  return rdp(pts.slice(0, at + 1), eps).slice(0, -1).concat(rdp(pts.slice(at), eps));
}
const n = (v) => Math.round(v * 10) / 10;
const toPath = (lines, minLen = 6) => lines
  .filter((l) => l.length >= minLen)
  .map((l) => {
    const closed = Math.hypot(l[0][0] - l[l.length - 1][0], l[0][1] - l[l.length - 1][1]) < 0.01;
    let p;
    if (closed) {
      let far = 0, best = 0;
      l.forEach((q, i) => { const d = Math.hypot(q[0] - l[0][0], q[1] - l[0][1]); if (d > best) { best = d; far = i; } });
      p = rdp(l.slice(0, far + 1), 0.7).slice(0, -1).concat(rdp(l.slice(far), 0.7));
    } else p = rdp(l, 0.7);
    return 'M' + p.map((q) => `${n(q[0])} ${n(q[1])}`).join('L') + (closed ? 'Z' : '');
  }).join('');

/* ---------- compose ---------- */
const out = [];
out.push(`<rect class="c-sea" width="${W}" height="${H}"/>`);
const depths = [[-40, 10], [-110, 20], [-200, 30], [-300, 40], [-400, 50]];
out.push(`<path class="c-iso" d="${toPath(depths.flatMap(([L]) => contour(L)))}"/>`);
out.push(`<path class="c-iso c-iso--deep" d="${toPath(contour(-520))}"/>`);

// routes under the land
out.push('<path class="c-cable" d="M884 300C800 360 712 468 640 470S530 440 470 432"/>');
out.push('<path class="c-pipe" d="M1210 742L1000 640 846 600 640 610"/>');
out.push('<path class="c-break" d="M262 598Q370 566 452 528"/>');
out.push('<path class="c-break" d="M268 712Q330 700 372 676"/>');

out.push(`<path class="c-land" d="${toPath(contour(0), 3)}"/>`);
out.push(`<path class="c-topo" d="${toPath([...contour(60), ...contour(130)])}"/>`);

// turbine arrays: staggered grids
const arrays = [
  { id: 'A', x0: 700, x1: 860, y0: 92, y1: 200 },
  { id: 'C', x0: 800, x1: 960, y0: 222, y1: 322 },
  { id: 'B', x0: 950, x1: 1130, y0: 336, y1: 452 },
];
const dots = [];
for (const a of arrays) {
  let r = 0;
  for (let y = a.y0; y <= a.y1; y += 36, r++) for (let x = a.x0 + (r % 2) * 22; x <= a.x1; x += 44) dots.push(`<circle cx="${x}" cy="${y}" r="3.2"/>`);
}
out.push(`<g class="c-turbines">${dots.join('')}</g>`);
out.push('<g class="c-arrays"><text x="672" y="102">A</text><text x="772" y="232">C</text><text x="1144" y="346">B</text></g>');

// labels
out.push(`<g class="c-labels">
<text x="842" y="70" class="c-l-caps">HARROW BANK WIND</text>
<text x="600" y="214" class="c-l-serif" text-anchor="middle">Sallow Deep</text>
<text x="66" y="652" class="c-l-caps c-l-land">VENNICK</text>
<text x="96" y="400" class="c-l-serif c-l-land">Cobble Head</text>
<text x="842" y="846" class="c-l-serif" text-anchor="middle">Skerry Holm</text>
<text x="720" y="532" class="c-l-small" transform="rotate(-11 720 532)">EXPORT CABLE</text>
<text x="862" y="586" class="c-l-small" transform="rotate(14.6 862 586)">EASTGATE PIPELINE</text>
<text x="80" y="160" class="c-l-caps c-l-land">HARROW COAST</text>
</g>`);

// graticule ticks + labels
const ticks = [];
for (let x = 150; x < W; x += 150) ticks.push(`M${x} 0v10M${x} ${H}v-10`);
for (let y = 150; y < H; y += 150) ticks.push(`M0 ${y}h10M${W} ${y}h-10`);
out.push(`<path class="c-tick" d="${ticks.join('')}"/>`);
const lon = ['2°30′E', '2°40′E', '2°50′E', '3°00′E', '3°10′E', '3°20′E', '3°30′E'];
const lat = ['54°30′N', '54°25′N', '54°20′N', '54°15′N', '54°10′N'];
out.push(`<g class="c-grat">${lon.map((t, k) => `<text x="${150 * (k + 1)}" y="26" text-anchor="middle">${t}</text>`).join('')}${lat.map((t, k) => `<text x="1186" y="${150 * (k + 1) + 4}" text-anchor="end">${t}</text>`).join('')}</g>`);

// scale bar and north arrow
out.push(`<g class="c-scale" transform="translate(940 842)"><path d="M0 0h180M0-6v12M90-4v8M180-6v12"/><text x="0" y="-12">0</text><text x="90" y="-12" text-anchor="middle">5</text><text x="180" y="-12" text-anchor="end">10 nmi</text></g>`);
out.push(`<g class="c-north" transform="translate(1130 92)"><path d="M0-26L9 12 0 5-9 12Z"/><text y="34" text-anchor="middle">N</text></g>`);

const svg = out.join('\n');
const html = readFileSync(htmlPath, 'utf8');
const next = html.replace(/<!--@map-->[\s\S]*?<!--\/@map-->/, `<!--@map-->${svg}<!--/@map-->`);
writeFileSync(htmlPath, next);
console.log('map bytes', svg.length);
