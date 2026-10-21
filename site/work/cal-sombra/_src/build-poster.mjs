// Static plan poster: the study model from above with the 10:30 shadow and its dimension strings.
// Used when WebGL is missing, motion is reduced or JS is off. Run: node _src/build-poster.mjs
import { writeFileSync } from 'node:fs';
import { SLABS, PLAN, FROZEN_HOUR, sunAt } from '../sun.js';

const S = 40;                      // px per metre
const { x0, z0, x1, z1, court, courtZ } = PLAN;
// margins in metres: north arrow above, dimension strings right and below
// the 10:30 shadows reach ~4 m west and ~5.5 m north of the walls, so those margins are wider
const vx = (x0 - 4.8) * S, vy = (z0 - 6.0) * S;
const vw = (x1 - x0 + 4.8 + 3.4) * S, vh = (z1 - z0 + 6.0 + 3.0) * S;
const P = (x, z) => `${(x * S).toFixed(1)},${(z * S).toFixed(1)}`;

const { el, az } = sunAt(FROZEN_HOUR);
const RAD = Math.PI / 180;
const k = 1 / Math.tan(el * RAD);
const sx = Math.sin(az * RAD) * k, sz = -Math.cos(az * RAD) * k; // ground offset per metre of height

const corners = ([a, b, c, d, , , rot]) => {
  const cx = (a + c) / 2, cz = (b + d) / 2, hx = (c - a) / 2, hz = (d - b) / 2;
  const r = rot * RAD, co = Math.cos(r), si = Math.sin(r);
  return [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([x, z]) => [cx + x * co - z * si, cz + x * si + z * co]);
};
const hull = (pts) => {
  pts = pts.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.reverse()) { while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
};

let shadows = '', walls = '';
for (const s of SLABS) {
  const [, , , , h, base] = s;
  const foot = corners(s);
  const pts = [];
  for (const [x, z] of foot) for (const y of [base, base + h]) pts.push([x + sx * y, z + sz * y]);
  shadows += `<polygon points="${hull(pts).map(([x, z]) => P(x, z)).join(' ')}"/>`;
  walls += `<polygon points="${foot.map(([x, z]) => P(x, z)).join(' ')}"/>`;
}

const off = 1.9;
const line = (a, b) => `<path d="M${P(...a)}L${P(...b)}"/>`;
const tick = ([x, z]) => `<path d="M${((x * S) - 5).toFixed(1)},${((z * S) + 5).toFixed(1)}l10,-10"/>`;
let gap = 8; // label offset from its line, scaled with the type
const label = ([x, z], text, extra = '') => `<text x="${(x * S).toFixed(1)}" y="${(z * S - gap).toFixed(1)}"${extra}>${text}</text>`;
const dims = [
  line([x0, z1 + 0.4], [x0, z1 + off + 0.5]), line([x1, z1 + 0.4], [x1, z1 + off + 0.5]), line([x0, z1 + off], [x1, z1 + off]),
  line([x1 + 0.4, z0], [x1 + off + 0.5, z0]), line([x1 + 0.4, z1], [x1 + off + 0.5, z1]), line([x1 + off, z0], [x1 + off, z1]),
  line([court[0], courtZ], [court[1], courtZ]), line([x0 + 0.4, z0 - 1.2], [x0 + 0.4, z0 - 3.4]),
  tick([x0, z1 + off]), tick([x1, z1 + off]), tick([x1 + off, z0]), tick([x1 + off, z1]), tick([court[0], courtZ]), tick([court[1], courtZ]),
  `<circle cx="${((x0 + 0.4) * S).toFixed(1)}" cy="${((z0 - 1.2) * S).toFixed(1)}" r="9"/>`
].join('');
const labelsFor = (size) => {
gap = size * 0.6;
const mx = (x1 + off) * S + size * 1.05, my = (z0 + (z1 - z0) * 0.8) * S;
return [
  label([(x0 + x1) / 2, z1 + off], `${(x1 - x0).toFixed(1)} m`),
  `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" transform="rotate(-90 ${mx.toFixed(1)} ${my.toFixed(1)})">${(z1 - z0).toFixed(1)} m</text>`,
  label([(court[0] + court[1]) / 2, courtZ], `${(court[1] - court[0]).toFixed(1)} m`),
  label([x0 + 0.4, z0 - 3.4], 'N'),
  label([7.2, -4.95 + 0.3], '+7.20'), label([-2.6, -6.075], '+5.40'), label([-6.1, -3.7 + 0.3], '+3.45')
].join('');
};

// desktop shows the drawing near 1:1; phones shrink it ~3x, so they get heavier lines and bigger numerals
for (const [file, wall, dim, size] of [['plan-1030.svg', 1.2, 1, 13], ['plan-1030-m.svg', 2.6, 2.2, 30]]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx.toFixed(0)} ${vy.toFixed(0)} ${vw.toFixed(0)} ${vh.toFixed(0)}">` +
    `<g fill="#000" opacity=".13">${shadows}</g>` +
    `<g fill="#fff" stroke="#111" stroke-width="${wall}" stroke-linejoin="miter">${walls}</g>` +
    `<g fill="none" stroke="#111" stroke-width="${dim}">${dims}</g>` +
    `<g fill="#111" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${size}" letter-spacing=".3" text-anchor="middle">${labelsFor(size)}</g>` +
    `</svg>\n`;
  writeFileSync(new URL(`../img/${file}`, import.meta.url), svg);
  console.log(file, svg.length, 'bytes; viewBox', vw.toFixed(0), 'x', vh.toFixed(0));
}
