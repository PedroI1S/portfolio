// The Long Block: bakes the street elevation SVG into ../index.html between
// <!--@street--> and <!--/@street--> markers. Run: node _src/street.mjs
// Units: viewBox 7000 × 600. The block itself runs from S0 to S1 (410 m);
// the ghosted buildings either side are lead-in for wide screens.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const W = 7000, H = 600, S0 = 1800, S1 = 5200;
const BASE = 452;            // where facades meet the pavement
const KERB = 508;            // top of the kerb
const BW = 64, BH = 32;      // benches drawn a touch larger than life: they are the story
const WALL_Y = 484 - BH;     // bench row against the facades (feet at 484)
const KERB_Y = 506 - BH;     // bench row under the trees (feet at 506)

function rng(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(410);
const pick = (a) => a[Math.floor(R() * a.length)];
const n1 = (v) => Math.round(v * 10) / 10;

const C = {
  ink: '#1A1918', frame: '#F3EFE6', glass: '#34322E', paper: '#F5F3EE',
  d1: '#A63F27', d2: '#EDBE3A', d3: '#255B43', d4: '#2A45A3', d5: '#4A2350', hl: '#ECFDAD',
  pave: '#DDD6C8', road: '#CFC7B7', patch: '#EFEBE2',
};
const FACADES = ['#E4DCCB', '#D9CFBB', '#E8E1D3', '#DCCBB0', '#D6CDBF', '#E2D2C4', '#CFD1C3', '#E6D9BE', '#DDD3C6'];
const SHUTTERS = ['#3F6A55', '#5B6E86', '#8E5B3E', '#3F6A55', '#6B7B5E'];
function mix(hex, k, to = C.paper) {
  const a = hex.match(/\w\w/g).map((h) => parseInt(h, 16));
  const b = to.match(/\w\w/g).map((h) => parseInt(h, 16));
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('');
}
const shade = (hex, k) => mix(hex, k, '#000000');

/* ---------- symbols ---------- */
const defs = `<defs>
<symbol id="lb-bench" viewBox="0 0 52 26"><path d="M4 0h44v4H4zM4 6h44v4H4zM6 0h3v13H6zM43 0h3v13h-3zM0 13h52v4H0zM4 17h3.5v9H4zM44.5 17H48v9h-3.5zM0 9h7v2.5H0zM45 9h7v2.5h-7z"/></symbol>
<symbol id="lb-w1" viewBox="0 0 24 38"><rect width="24" height="38" fill="${C.frame}"/><rect x="3" y="3" width="18" height="32" fill="${C.glass}"/><rect x="11.2" y="3" width="1.6" height="32" fill="${C.frame}"/><rect x="3" y="17" width="18" height="1.4" fill="${C.frame}"/></symbol>
<symbol id="lb-w2" viewBox="0 0 24 38"><rect width="24" height="38" fill="currentColor"/><path d="M12 0v38M0 5h24M0 10h24M0 15h24M0 20h24M0 25h24M0 30h24M0 35h24" stroke="#000" stroke-opacity=".22" stroke-width="1"/></symbol>
<symbol id="lb-w3" viewBox="-11 0 46 38"><rect x="-11" width="10" height="38" fill="currentColor"/><rect x="25" width="10" height="38" fill="currentColor"/><path d="M-11 6h10M-11 12h10M-11 18h10M-11 24h10M-11 30h10M25 6h10M25 12h10M25 18h10M25 24h10M25 30h10" stroke="#000" stroke-opacity=".2"/><rect width="24" height="38" fill="${C.frame}"/><rect x="3" y="3" width="18" height="32" fill="${C.glass}"/><rect x="11.2" y="3" width="1.6" height="32" fill="${C.frame}"/></symbol>
<symbol id="lb-door" viewBox="0 0 30 60"><rect width="30" height="60" fill="currentColor"/><rect x="4" y="6" width="9" height="20" fill="#000" fill-opacity=".18"/><rect x="17" y="6" width="9" height="20" fill="#000" fill-opacity=".18"/><rect x="4" y="32" width="9" height="22" fill="#000" fill-opacity=".18"/><rect x="17" y="32" width="9" height="22" fill="#000" fill-opacity=".18"/></symbol>
</defs>`;

/* ---------- drawing helpers ---------- */
function awning(x, y, w, color, depth = 30) {
  // front elevation of a shop awning: striped canvas with a scalloped valance
  const sw = 16, n = Math.max(3, Math.round(w / sw)), s = w / n, r = s / 2, tint = mix(color, 0.62);
  let out = '';
  for (let i = 0; i < n; i++) {
    const sx = x + i * s;
    out += `<path d="M${n1(sx)} ${y}h${n1(s)}v${depth}a${n1(r)} ${n1(r)} 0 0 1 ${n1(-s)} 0z" fill="${i % 2 ? tint : color}"/>`;
  }
  return out + `<rect x="${n1(x - 3)}" y="${y - 4}" width="${n1(w + 6)}" height="5" fill="${C.ink}"/>`;
}

function windows(x, w, top, floors, fh, kind, shutter) {
  let out = '';
  const cols = Math.max(2, Math.floor((w - 30) / 58));
  const gap = (w - cols * 24) / (cols + 1);
  for (let f = 0; f < floors; f++) {
    const wy = top + 22 + f * fh;
    for (let c = 0; c < cols; c++) {
      const wx = x + gap + c * (24 + gap);
      const k = kind === 'mix' ? pick(['w1', 'w2', 'w3']) : kind;
      if (k === 'w3') out += `<use href="#lb-w3" x="${n1(wx - 11)}" y="${wy}" width="46" height="38" color="${shutter}"/>`;
      else out += `<use href="#lb-${k}" x="${n1(wx)}" y="${wy}" width="24" height="38" color="${shutter}"/>`;
    }
  }
  return out;
}

function balcony(x, w, y) {
  let out = `<rect x="${n1(x)}" y="${y}" width="${n1(w)}" height="4" fill="${C.ink}" fill-opacity=".75"/>`;
  out += `<path d="M${n1(x)} ${y - 16}h${n1(w)}`;
  for (let bx = x + 3; bx < x + w; bx += 5) out += `M${n1(bx)} ${y - 16}v16`;
  return out + `" stroke="${C.ink}" stroke-width="1" stroke-opacity=".7" fill="none"/>`;
}

function laundry(x1, x2, y) {
  const mid = (x1 + x2) / 2;
  let out = `<path d="M${x1} ${y}Q${mid} ${y + 26} ${x2} ${y}" stroke="${C.ink}" stroke-width="1" fill="none"/>`;
  const items = ['sheet', 'shirt', 'sheet', 'cloth', 'shirt'];
  const fills = ['#FBF9F4', '#C9D3E0', '#FBF9F4', '#E9D7A6', '#F1E3DC'];
  let t = 0.12;
  items.forEach((it, i) => {
    if (t > 0.9) return;
    const px = x1 + (x2 - x1) * t, py = y + 26 * 2 * t * (1 - t) * 1; // on the quadratic
    const f = fills[i % fills.length];
    if (it === 'sheet') { out += `<rect x="${n1(px)}" y="${n1(py)}" width="30" height="38" fill="${f}" stroke="${C.ink}" stroke-width=".8"/>`; t += 0.24; }
    else if (it === 'shirt') { out += `<path d="M${n1(px)} ${n1(py)}h22l6 8-5 3v20h-24v-20l-5-3z" fill="${f}" stroke="${C.ink}" stroke-width=".8"/>`; t += 0.2; }
    else { out += `<rect x="${n1(px)}" y="${n1(py)}" width="16" height="20" fill="${f}" stroke="${C.ink}" stroke-width=".8"/>`; t += 0.14; }
  });
  return out;
}

function building(o) {
  const { x, w, h } = o;
  const fill = o.fill || pick(FACADES);
  const top = BASE - h, G = 96;
  const shutter = o.shutter || pick(SHUTTERS);
  let out = `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${fill}"/>`;
  out += `<rect x="${x - 4}" y="${top}" width="${w + 8}" height="9" fill="${shade(fill, 0.16)}"/>`;
  out += `<rect x="${x}" y="${top + 9}" width="${w}" height="3" fill="${shade(fill, 0.08)}"/>`;
  out += `<rect x="${x}" y="${BASE - G - 6}" width="${w}" height="5" fill="${shade(fill, 0.1)}"/>`;
  // neighbour seam
  out += `<rect x="${x + w - 1}" y="${top}" width="1.5" height="${h}" fill="${shade(fill, 0.22)}"/>`;
  const fh = 66;
  const floors = Math.max(1, Math.floor((h - G - 20) / fh));
  out += windows(x, w, top + (h - G - 6 - floors * fh) - 8, floors, fh, o.win || 'mix', shutter);
  if (o.balcony) {
    // under the lowest upper floor
    const by = top + (h - G - 6 - floors * fh) - 8 + 22 + (floors - 1) * fh + 38 + 2;
    out += balcony(x + 12, w - 24, by);
  }
  if (o.shop) {
    const s = o.shop, doorW = 30;
    const wx = x + 12, ww = w - 24 - doorW - 8;
    out += `<rect x="${wx}" y="${BASE - G + 28}" width="${ww}" height="${G - 28}" fill="${C.glass}"/>`;
    out += `<rect x="${wx}" y="${BASE - G + 28}" width="${ww}" height="${G - 28}" fill="none" stroke="${C.frame}" stroke-width="3"/>`;
    if (s.goods) out += s.goods(wx, BASE - 26, ww);
    out += `<use href="#lb-door" x="${x + w - 12 - doorW}" y="${BASE - 64}" width="${doorW}" height="64" color="${shade(s.color, 0.25)}"/>`;
    out += awning(x + 8, BASE - G + 12, w - 16, s.color);
    out += `<rect x="${x + w / 2 - s.label.length * 5.4 - 10}" y="${BASE - G - 30}" width="${s.label.length * 10.8 + 20}" height="24" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.5"/>`;
    out += `<text class="lb-sign" x="${x + w / 2}" y="${BASE - G - 12}" text-anchor="middle">${s.label}</text>`;
    if (s.extra) out += s.extra(x, w);
  } else {
    const dx = x + (o.doorAt ?? 0.5) * (w - 30);
    out += `<use href="#lb-door" x="${n1(dx)}" y="${BASE - 66}" width="30" height="66" color="${o.door || shade(shutter, 0.15)}"/>`;
    out += `<rect x="${n1(dx - 4)}" y="${BASE - 70}" width="38" height="4" fill="${shade(fill, 0.18)}"/>`;
    const wy = BASE - G + 10;
    [0.12, 0.88].forEach((k) => {
      const wx = x + k * (w - 24);
      if (Math.abs(wx - dx) > 40) out += `<use href="#lb-w1" x="${n1(wx)}" y="${wy}" width="24" height="38"/>`;
    });
  }
  if (o.laundry) out += laundry(x + 18, x + w - 18, top + 40);
  return out;
}

function tree(x, s = 1, seed = 1) {
  const r = rng(seed);
  const top = 300 - 50 * (s - 1);
  let out = `<rect x="${n1(x - 6 * s)}" y="${n1(top)}" width="${n1(12 * s)}" height="${n1(KERB - top)}" fill="#8C8576"/>`;
  for (let i = 0; i < 5; i++) out += `<ellipse cx="${n1(x + (r() - 0.5) * 8 * s)}" cy="${n1(top + 30 + r() * (KERB - top - 50))}" rx="${n1(3 + r() * 3)}" ry="${n1(5 + r() * 6)}" fill="#C9C1AE"/>`;
  out += `<path d="M${n1(x)} ${n1(top + 40)}l${n1(-30 * s)} ${n1(-46 * s)}M${n1(x)} ${n1(top + 30)}l${n1(26 * s)} ${n1(-50 * s)}" stroke="#8C8576" stroke-width="${n1(6 * s)}" fill="none"/>`;
  const tones = ['#2F5E45', '#3E6E53', '#4F7D60', '#2A5640'];
  const cy = top - 70 * s;
  const blobs = [];
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 62 * s;
    blobs.push({ cx: x + Math.cos(a) * d * 1.35, cy: cy + Math.sin(a) * d * 0.8, rr: (30 + r() * 26) * s });
  }
  blobs.sort((a, b) => a.cy - b.cy);
  blobs.forEach((b, i) => { out += `<circle cx="${n1(b.cx)}" cy="${n1(b.cy)}" r="${n1(b.rr)}" fill="${tones[i % tones.length]}"/>`; });
  return out;
}

function lamp(x) {
  return `<rect x="${x - 1.5}" y="300" width="3" height="${KERB - 300}" fill="${C.ink}"/><path d="M${x} 306h16" stroke="${C.ink}" stroke-width="2"/><path d="M${x + 10} 306h12l-2 16h-8z" fill="${C.ink}"/><rect x="${x + 13}" y="309" width="6" height="9" fill="${C.d2}"/>`;
}

function sign(x, label) {
  return `<rect x="${x - 1.5}" y="372" width="3" height="${KERB - 372}" fill="${C.ink}"/><rect x="${x - 34}" y="372" width="68" height="22" fill="${C.d4}" stroke="${C.paper}" stroke-width="2"/><text class="lb-sign lb-sign--street" x="${x}" y="388" text-anchor="middle">${label}</text>`;
}

/* ---------- the street ---------- */
const shops = {
  cafe: { label: 'CAFÉ', color: C.d5, goods: (x, y, w) => `<rect x="${x + 6}" y="${y + 2}" width="${w - 12}" height="3" fill="${C.frame}" fill-opacity=".5"/>` },
  pharmacy: { label: 'PHARMACY', color: C.d3, extra: (x, w) => `<rect x="${x + 6}" y="${BASE - 150}" width="14" height="3" fill="${C.ink}"/><path d="M${x + 22} ${BASE - 166}h10v10h10v10h-10v10h-10v-10h-10v-10h10z" fill="#3E9B6A" stroke="${C.ink}" stroke-width="1"/>` },
  bakery: { label: 'BAKERY', color: C.d1, goods: (x, y, w) => { let o = ''; for (let bx = x + 10; bx < x + w - 20; bx += 22) o += `<ellipse cx="${bx + 8}" cy="${y - 8}" rx="9" ry="5" fill="#C99A55"/>`; return o; } },
  grocer: { label: 'GROCER', color: C.d2, extra: (x, w) => {
    let o = '';
    const fruit = ['#E08A2E', '#E9C33A', '#7DA04A', '#C9472C'];
    for (let i = 0; i < 4; i++) {
      const cx = x + 16 + i * 30;
      o += `<rect x="${cx}" y="${BASE - 4}" width="26" height="22" fill="#B08A5A" stroke="${C.ink}" stroke-width="1"/>`;
      for (let j = 0; j < 3; j++) o += `<circle cx="${cx + 5 + j * 8}" cy="${BASE - 6}" r="4.5" fill="${fruit[(i + j) % 4]}"/>`;
    }
    return o;
  } },
  barber: { label: 'BARBER', color: C.d4, extra: (x) => `<rect x="${x + 4}" y="${BASE - 150}" width="9" height="44" fill="${C.paper}" stroke="${C.ink}" stroke-width="1"/><path d="M${x + 4} ${BASE - 142}l9 -6M${x + 4} ${BASE - 130}l9 -6M${x + 4} ${BASE - 118}l9 -6" stroke="${C.d1}" stroke-width="3"/>` },
  laundrette: { label: 'LAUNDRETTE', color: C.d3, goods: (x, y, w) => { let o = ''; for (let bx = x + 12; bx < x + w - 24; bx += 30) o += `<circle cx="${bx + 10}" cy="${y - 20}" r="9" fill="none" stroke="${C.frame}" stroke-width="2" stroke-opacity=".7"/>`; return o; } },
  bar: { label: 'BAR', color: C.d5 },
};

const parts = [];      // drawn back to front
const ghost = [];      // lead-in buildings outside the block

// lead-in: the next blocks, ghosted
function ghostRow(from, to, seed) {
  const r = rng(seed);
  let x = from;
  while (x < to - 60) {
    const w = Math.min(to - x, 150 + Math.floor(r() * 170));
    ghost.push(building({ x, w, h: 250 + Math.floor(r() * 150), win: 'mix', balcony: r() < 0.4 }));
    x += w;
  }
  for (let tx = from + 140; tx < to - 80; tx += 300 + Math.floor(r() * 120)) ghost.push(tree(tx, 0.9, tx));
}
ghostRow(0, 1710, 3);
ghostRow(5290, W, 5);

// the block, north to south
const row = [
  { x: 1800, w: 230, h: 330, shop: shops.cafe, balcony: true },
  { x: 2030, w: 210, h: 300, shop: shops.pharmacy },
  { x: 2240, w: 190, h: 372, laundry: true, win: 'w3' },
  { x: 2430, w: 240, h: 320, balcony: true, doorAt: 0.3 },
  { x: 2670, w: 200, h: 290, shop: shops.bakery },
  { x: 2870, w: 220, h: 310, shop: shops.grocer, balcony: true },
  { x: 3090, w: 260, h: 384, laundry: true, doorAt: 0.7 },
  { x: 3350, w: 150, h: 280, shop: shops.barber },
  { x: 3500, w: 180, h: 300, shop: shops.laundrette },
  { x: 3680, w: 220, h: 244, school: true },
  { x: 4080, w: 200, h: 340, balcony: true, doorAt: 0.2 },
  { x: 4280, w: 220, h: 326, win: 'w2', doorAt: 0.75 },
  { x: 4960, w: 240, h: 320, shop: shops.bar, balcony: true },
];
row.forEach((b) => {
  if (b.school) {
    const { x, w, h } = b, top = BASE - h, fill = '#E2D2C4';
    let o = `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${fill}"/><rect x="${x - 4}" y="${top}" width="${w + 8}" height="9" fill="${shade(fill, 0.16)}"/>`;
    for (let i = 0; i < 4; i++) {
      const wx = x + 20 + i * 50;
      o += `<rect x="${wx}" y="${top + 34}" width="34" height="62" fill="${C.frame}"/><rect x="${wx + 3}" y="${top + 37}" width="28" height="56" fill="${C.glass}"/><path d="M${wx + 17} ${top + 37}v56M${wx + 3} ${top + 64}h28" stroke="${C.frame}" stroke-width="1.6"/>`;
      o += `<rect x="${wx}" y="${top + 124}" width="34" height="50" fill="${C.frame}"/><rect x="${wx + 3}" y="${top + 127}" width="28" height="44" fill="${C.glass}"/>`;
    }
    o += `<rect x="${x + w / 2 - 44}" y="${BASE - 64}" width="88" height="20" fill="${C.paper}" stroke="${C.ink}" stroke-width="1.5"/><text class="lb-sign" x="${x + w / 2}" y="${BASE - 49}" text-anchor="middle">SCHOOL</text>`;
    o += `<use href="#lb-door" x="${x + w / 2 - 15}" y="${BASE - 40}" width="30" height="40" color="#2F3A55"/>`;
    // the yard: a set-back block behind it, a climbing frame, a slide and the fence
    o += `<g opacity=".6"><rect x="3900" y="${BASE - 236}" width="180" height="236" fill="#D9CFBB"/><rect x="3896" y="${BASE - 236}" width="188" height="8" fill="${shade('#D9CFBB', 0.16)}"/>${windows(3900, 180, BASE - 236 + 4, 2, 66, 'w2', '#5B6E86')}</g>`;
    o += `<path d="M4010 ${BASE}v-58h52v58M4010 ${BASE - 40}h52M4010 ${BASE - 20}h52M4036 ${BASE - 58}v58" stroke="${C.d4}" stroke-width="3" fill="none"/>`;
    o += `<path d="M3936 ${BASE}v-44l34 -18 6 8 -28 16v38z" fill="${C.d2}" stroke="${C.ink}" stroke-width="1.2"/><path d="M3970 ${BASE - 62}v62M3980 ${BASE - 54}v54" stroke="${C.ink}" stroke-width="2"/>`;
    o += `<path d="M3900 ${BASE - 46}h180`;
    for (let fx = 3902; fx <= 4080; fx += 8) o += `M${fx} ${BASE - 46}v46`;
    o += `" stroke="${C.ink}" stroke-width="1.6" fill="none"/>`;
    parts.push(o);
  } else parts.push(building(b));
});

// the square, set back: a low arcade behind, a fountain, three big planes
{
  let o = `<g opacity=".72"><rect x="4500" y="${BASE - 210}" width="460" height="210" fill="#E8E1D3"/><rect x="4496" y="${BASE - 210}" width="468" height="8" fill="${shade('#E8E1D3', 0.16)}"/>`;
  for (let ax = 4518; ax < 4940; ax += 52) o += `<path d="M${ax} ${BASE}v-62a18 18 0 0 1 36 0v62z" fill="${C.glass}" fill-opacity=".55"/>`;
  for (let ax = 4522; ax < 4940; ax += 52) o += `<use href="#lb-w2" x="${ax}" y="${BASE - 170}" width="24" height="38" color="#8E5B3E"/>`;
  o += `</g>`;
  o += `<rect x="4500" y="${BASE}" width="460" height="${KERB - BASE}" fill="#E7E1D4"/>`;
  // fountain
  o += `<path d="M4600 ${KERB - 4}l8 -34h124l8 34z" fill="#C9C1AE" stroke="${C.ink}" stroke-width="1.4"/><rect x="4662" y="${KERB - 92}" width="16" height="54" fill="#C9C1AE" stroke="${C.ink}" stroke-width="1.4"/><path d="M4636 ${KERB - 92}h68l-10 12h-48z" fill="#C9C1AE" stroke="${C.ink}" stroke-width="1.4"/><path d="M4646 ${KERB - 82}q-6 22 -16 40M4694 ${KERB - 82}q6 22 16 40M4670 ${KERB - 100}v-14" stroke="#7FA2B8" stroke-width="2" fill="none"/>`;
  parts.push(o);
}

// kiosk at the kerb
parts.push(`<rect x="4318" y="${KERB - 84}" width="56" height="80" fill="${C.d3}"/><rect x="4326" y="${KERB - 70}" width="40" height="30" fill="${C.glass}"/><path d="M4310 ${KERB - 84}h72l-8 -16h-56z" fill="${C.d2}" stroke="${C.ink}" stroke-width="1.2"/><path d="M4346 ${KERB - 100}v-10" stroke="${C.ink}" stroke-width="2"/><rect x="4324" y="${KERB - 34}" width="44" height="14" fill="${C.paper}"/><text class="lb-sign lb-sign--sm" x="4346" y="${KERB - 23}" text-anchor="middle">KIOSK</text>`);

// pavement and road under everything in front of the facades
const ground = `<rect x="0" y="${BASE}" width="${W}" height="${KERB - BASE}" fill="${C.pave}"/><rect x="0" y="${KERB}" width="${W}" height="4" fill="${C.ink}"/><rect x="0" y="${KERB + 4}" width="${W}" height="44" fill="${C.road}"/><path d="M0 ${KERB + 26}H${W}" stroke="${C.paper}" stroke-width="3" stroke-dasharray="26 22"/>`;

// cross streets at both ends of the block
const corners = `${sign(1770, 'SIDE ST.')}${sign(5230, 'SIDE ST.')}`;

// trees and lamps at the kerb
const treesX = [[1828, 1], [2330, 1.05], [2620, 0.95], [3200, 1.1], [3460, 1], [3850, 0.9], [4170, 1.05], [4560, 1.25], [4850, 1.3], [5120, 1]];
const trees = treesX.map(([x, s], i) => tree(x, s, 100 + i)).join('');
const lamps = [2205, 2990, 3605, 4440, 5080].map(lamp).join('');

/* ---------- 41 benches ----------
   row: w = against the facade, k = at the kerb. gone: month + what replaced it.
   no: the council's inventory number (not walking order). */
const benches = [
  [1850, 'k', 33], [1990, 'w', 5], [2090, 'w', 1, { taken: true }], [2180, 'k', 38], [2290, 'w', 14],
  [2400, 'k', 27], [2480, 'w', 6], [2560, 'k', 21], [2700, 'w', 29], [2780, 'k', 10],
  [2905, 'w', 8, { gone: 'March', now: 'a planter' }], [2965, 'w', 9, { gone: 'March', now: 'a planter' }],
  [3040, 'k', 36], [3130, 'w', 19], [3270, 'k', 2], [3310, 'w', 31, { gone: 'January', now: 'nothing at all' }],
  [3395, 'w', 24], [3520, 'k', 22, { gone: 'April', now: 'a bicycle rack' }], [3545, 'w', 15], [3640, 'k', 41],
  [3720, 'w', 11], [3790, 'k', 3, { gone: 'October', now: 'nothing at all' }],
  [3925, 'k', 39, { fresh: true }], [3990, 'k', 40, { fresh: true }], [4055, 'k', 37, { fresh: true }],
  [4120, 'w', 16], [4220, 'k', 26, { gone: 'May', now: 'nothing at all' }], [4250, 'w', 7], [4400, 'k', 30],
  [4440, 'w', 35, { gone: 'June', now: 'a planter' }], [4540, 'w', 12], [4600, 'k', 25],
  [4760, 'k', 23, { gone: 'August', now: 'a bicycle rack' }], [4790, 'w', 17, { star: true }], [4900, 'k', 34],
  [4930, 'w', 13], [4990, 'w', 18], [5040, 'k', 28, { gone: 'September', now: 'nothing at all' }],
  [5100, 'w', 20], [5160, 'k', 4], [2630, 'w', 32],
].sort((a, b) => a[0] - b[0]);

if (benches.length !== 41) throw new Error(`expected 41 benches, got ${benches.length}`);
const gone = benches.filter((b) => b[3]?.gone).length;
if (gone !== 9) throw new Error(`expected 9 removed, got ${gone}`);
if (new Set(benches.map((b) => b[2])).size !== 41) throw new Error('inventory numbers must be unique');

let wallRow = '', kerbRow = '', marks = '';
benches.forEach(([x, rowKey, no, f = {}]) => {
  const y = rowKey === 'w' ? WALL_Y : KERB_Y;
  const bx = x - BW / 2, k = BW / 52;
  const data = `data-bench data-x="${x}" data-no="${no}"${f.gone ? ` data-gone="${f.gone}" data-now="${f.now}"` : ''}`;
  let o = '';
  if (f.fresh) o += `<rect x="${bx - 7}" y="${y + 11}" width="${BW + 14}" height="15" fill="${C.hl}"/>`;
  if (f.gone) {
    if (f.now === 'nothing at all') o += `<rect x="${bx + 2}" y="${y + BH - 3}" width="${BW - 4}" height="6" fill="${C.patch}"/>`;
    if (f.now === 'a planter') o += `<rect x="${bx + 5}" y="${y + 10 * k}" width="${BW - 10}" height="${22 * k}" fill="#B9A58A" stroke="${C.ink}" stroke-width="1"/><circle cx="${bx + 17 * k}" cy="${y + 7 * k}" r="${10 * k}" fill="#4F7D60"/><circle cx="${bx + 33 * k}" cy="${y + 2 * k}" r="${12 * k}" fill="#3E6E53"/><circle cx="${bx + 48 * k}" cy="${y + 7 * k}" r="${10 * k}" fill="#4F7D60"/>`;
    if (f.now === 'a bicycle rack') o += `<path d="M${bx + 10} ${y + BH}v-17a8.5 8.5 0 0 1 17 0v17M${bx + 37} ${y + BH}v-17a8.5 8.5 0 0 1 17 0v17" stroke="${C.ink}" stroke-width="2.8" fill="none"/>`;
    o += `<use href="#lb-bench" x="${bx}" y="${y}" width="${BW}" height="${BH}" fill="none" stroke="${C.d1}" stroke-width="1.5" stroke-dasharray="3.5 2.5" ${data}/>`;
  } else {
    o += `<use href="#lb-bench" x="${bx}" y="${y}" width="${BW}" height="${BH}" fill="${C.ink}" ${data}/>`;
    if (f.taken) o += `<rect x="${bx + 12}" y="${y + 11}" width="20" height="5" fill="#F7F3EA" stroke="${C.ink}" stroke-width=".8"/><rect x="${bx + 39}" y="${y + 5}" width="15" height="11" rx="2" fill="#8E5B3E"/>`;
  }
  if (f.star) marks += `<path d="M${x} ${y + BH + 3}V${KERB + 22}" stroke="${C.ink}" stroke-width="1.2"/><rect x="${x - 4}" y="${KERB + 26}" width="88" height="22" fill="${C.hl}"/><text class="lb-num" x="${x + 4}" y="${KERB + 43}">No. 17</text>`;
  if (rowKey === 'w') wallRow += o; else kerbRow += o;
});

const svg = `<svg class="lb-svg" viewBox="0 0 ${W} ${H}" data-s0="${S0}" data-s1="${S1}" data-metres="410" role="img" aria-labelledby="lb-title lb-desc" preserveAspectRatio="xMinYMid meet">
<title id="lb-title">The Long Block: an elevation drawing of the whole street, north to south.</title>
<desc id="lb-desc">410 metres of one street: shopfronts with striped awnings (a café, a pharmacy, a bakery, a grocer, a barber, a laundrette and a bar), plane trees at the kerb, washing lines, a school with a fenced yard and a small square with a fountain. All 41 public benches are drawn: 32 still standing, three of them new by the school gate, and 9 removed this year, shown as dashed outlines beside the planters, bicycle racks or bare paving that replaced them. Bench no. 17 stands under the planes in the square.</desc>
${defs}
${ground}
<g class="lb-ghost">${ghost.join('')}</g>
${parts.join('')}
${corners}
${wallRow}
${trees}
${lamps}
${kerbRow}
${marks}
</svg>`;

const file = path.join(here, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const re = /<!--@street-->[\s\S]*?<!--\/@street-->/;
if (!re.test(html)) throw new Error('markers <!--@street--> … <!--/@street--> not found');
html = html.replace(re, `<!--@street-->\n${svg}\n<!--/@street-->`);
fs.writeFileSync(file, html);
console.log(`street baked: ${svg.length} chars, ${benches.length} benches, ${gone} gone`);
