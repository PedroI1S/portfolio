// Sowsheet: bakes the axonometric SVG illustrations into index.html.
// Run: node site/work/sowsheet/_src/build.mjs
// Each figure is written between <!--@name--> and <!--/@name--> markers.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const htmlPath = path.join(dir, '..', 'index.html');

/* ---------- palette ---------- */
const C = {
  ground: '#EFE4CF', slabL: '#DDD0B6', slabR: '#C8B99C', gravel: '#D8C9AC',
  stone: '#E6DCC9', joint: '#CDBFA5',
  fenceLit: '#D6CEC1', fenceShade: '#ACA497', fenceTop: '#ECE5D9', fenceLine: '#BCB3A5',
  cane: '#B9A47F',
  c1: '#DCE4F7', c2: '#A9BBEC', c3: '#6F8DDB', c4: '#3B60C5', c5: '#2747A6', c6: '#0B3A8F', c7: '#0A2A66',
  ver: '#EB603C', verDeep: '#C2472A', cream: '#FFF6E4', white: '#FFFDF8',
  shadow: 'rgba(10,42,102,.16)', pencil: '#6B665F',
};

/* ---------- 2:1 axonometric helpers ---------- */
let U = 44;
const ZK = 1.15;
const S2 = Math.SQRT2;
const P = (x, y, z = 0) => [(x - y) * U, (x + y) * U / 2 - z * U * ZK];
const f = (n) => Math.round(n * 10) / 10;
const pts = (a) => a.map((p) => P(...p)).map(([X, Y]) => `${f(X)},${f(Y)}`).join(' ');
const poly = (a, fill, at = '') => `<polygon points="${pts(a)}" fill="${fill}"${at}/>`;
const line = (a, b, stroke, w = 1, at = '') => {
  const [x1, y1] = P(...a), [x2, y2] = P(...b);
  return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${w}"${at}/>`;
};
let uid = 0;
// ground shadows are collected per scene and drawn as one translucent layer,
// so where two shadows overlap the ground doesn't get darker
let GS = [];
const SHADOW_SLOT = '<!--shadows-->';
const gsh = (markup) => { GS.push(markup); return ''; };
const groundShadowEllipse = (x, y, r, k = 1) => { const [X, Y] = P(x, y, 0); return gsh(`<ellipse cx="${f(X)}" cy="${f(Y)}" rx="${f(r * U * S2 * k)}" ry="${f(r * U * S2 / 2)}"/>`); };
const groundShadowPoly = (a) => gsh(`<polygon points="${pts(a)}"/>`);
// shadows are clipped to the plot so nothing falls off the edge of the slab
const flushShadows = (s, len, wid) => {
  const k = id();
  const clip = len ? `<clipPath id="${k}"><polygon points="${pts([[0, 0, 0], [len, 0, 0], [len, wid, 0], [0, wid, 0]])}"/></clipPath>` : '';
  return s.replace(SHADOW_SLOT, `${clip}<g class="shadows" fill="#0A2A66" opacity=".15"${len ? ` clip-path="url(#${k})"` : ''}>${GS.join('')}</g>`);
};
let prefix = 'h';
const id = () => `${prefix}${uid++}`;

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// visible faces of an axis-aligned box: +y face (lit, lower left), +x face (shade, lower right), top
function box(x, y, z, w, d, h, c) {
  return poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], c.left)
    + poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], c.right)
    + poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], c.top);
}

function gEllipse(x, y, z, r, fill, at = '') {
  const [X, Y] = P(x, y, z);
  return `<ellipse cx="${f(X)}" cy="${f(Y)}" rx="${f(r * U * S2)}" ry="${f(r * U * S2 / 2)}" fill="${fill}"${at}/>`;
}

// vertical cylinder, lit on the left ~55%
function cyl(x, y, z, r, h, c) {
  const [X, Yb] = P(x, y, z), [, Yt] = P(x, y, z + h);
  const rx = r * U * S2, ry = rx / 2;
  const sx = X + rx * 0.1, sy = ry * 0.995;
  return `<path d="M${f(X - rx)},${f(Yt)}V${f(Yb)}A${f(rx)},${f(ry)} 0 0 0 ${f(X + rx)},${f(Yb)}V${f(Yt)}Z" fill="${c.shade}"/>`
    + `<path d="M${f(X - rx)},${f(Yt)}V${f(Yb)}A${f(rx)},${f(ry)} 0 0 0 ${f(sx)},${f(Yb + sy)}V${f(Yt + sy)}A${f(rx)},${f(ry)} 0 0 1 ${f(X - rx)},${f(Yt)}Z" fill="${c.lit}"/>`
    + `<ellipse cx="${f(X)}" cy="${f(Yt)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c.top}"/>`;
}

// flat-shaded ball in screen space: shade base, lit disc offset to the light, small highlight
function ballS(X, Y, R, c) {
  const k = id();
  return `<g><clipPath id="${k}"><circle cx="${f(X)}" cy="${f(Y)}" r="${f(R)}"/></clipPath>`
    + `<circle cx="${f(X)}" cy="${f(Y)}" r="${f(R)}" fill="${c.shade}"/>`
    + `<g clip-path="url(#${k})"><circle cx="${f(X - R * 0.24)}" cy="${f(Y - R * 0.22)}" r="${f(R * 0.96)}" fill="${c.base}"/>`
    + (c.hl ? `<ellipse cx="${f(X - R * 0.42)}" cy="${f(Y - R * 0.46)}" rx="${f(R * 0.34)}" ry="${f(R * 0.22)}" transform="rotate(-32 ${f(X - R * 0.42)} ${f(Y - R * 0.46)})" fill="${c.hl}"/>` : '')
    + `</g></g>`;
}
// several balls shaded as one mass: shade silhouette, lit discs clipped to it, highlights on top
function cluster(balls, c, extra = '') {
  const k = id();
  const circles = (dx, dy, s) => balls.map(([X, Y, R]) => `<circle cx="${f(X + dx * R)}" cy="${f(Y + dy * R)}" r="${f(R * s)}"/>`).join('');
  const hl = balls.filter((b) => b[3]).map(([X, Y, R]) => `<ellipse cx="${f(X - R * 0.4)}" cy="${f(Y - R * 0.44)}" rx="${f(R * 0.32)}" ry="${f(R * 0.2)}" transform="rotate(-32 ${f(X - R * 0.4)} ${f(Y - R * 0.44)})"/>`).join('');
  return `<g><clipPath id="${k}">${circles(0, 0, 1)}</clipPath><g fill="${c.shade}">${circles(0, 0, 1)}</g>`
    + `<g clip-path="url(#${k})"><g fill="${c.base}">${circles(-0.2, -0.22, 0.93)}</g>`
    + (c.hl ? `<g fill="${c.hl}">${hl}</g>` : '') + extra + `</g></g>`;
}
const ball = (x, y, z, r, c) => { const [X, Y] = P(x, y, z); return ballS(X, Y, r * U * 1.118, c); };

// pointed leaf, base at (0,0), pointing up, then rotated
function leafS(X, Y, len, wid, rot, fill, rib) {
  const d = `M0,0Q${f(wid)},${f(-len * 0.45)} 0,${f(-len)}Q${f(-wid)},${f(-len * 0.45)} 0,0Z`;
  return `<g transform="translate(${f(X)} ${f(Y)}) rotate(${f(rot)})"><path d="${d}" fill="${fill}"/>`
    + (rib ? `<path d="M0,0L0,${f(-len * 0.8)}" stroke="${rib}" stroke-width="1.2" fill="none"/>` : '') + `</g>`;
}

/* ---------- plants and objects ---------- */
const GREEN = { base: C.c4, shade: C.c5, hl: C.c3 };
const PALE = { base: C.c3, shade: C.c4, hl: C.c2 };

function lettuce(x, y, z, s = 1) {
  const [X, Y] = P(x, y, z);
  let out = `<g class="pop">`;
  const ring = (n, R, len, wid, fill, rib, lift) => {
    const leaves = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      leaves.push({ a, y: Math.sin(a) });
    }
    leaves.sort((p, q) => p.y - q.y);
    for (const l of leaves) {
      const lx = X + Math.cos(l.a) * R * s, ly = Y + Math.sin(l.a) * R * 0.5 * s - lift * s;
      const rot = (Math.atan2(Math.sin(l.a) * 0.5, Math.cos(l.a)) * 180) / Math.PI + 90;
      out += leafS(lx, ly, len * s, wid * s, rot, fill, rib);
    }
  };
  out += `<ellipse cx="${f(X)}" cy="${f(Y + 2)}" rx="${f(20 * s)}" ry="${f(9 * s)}" fill="${C.shadow}"/>`;
  ring(7, 5, 18, 9, C.c3, C.c2, 2);
  ring(5, 3, 13, 7, C.c2, C.c1, 6);
  out += `<circle cx="${f(X)}" cy="${f(Y - 8 * s)}" r="${f(5 * s)}" fill="${C.c1}"/>`;
  return out + `</g>`;
}

function tomato(x, y, z, fruit = true) {
  const [X, Y] = P(x, y, z), [, Yt] = P(x, y, z + 3.3);
  let o = `<g class="pop">`;
  o += `<ellipse cx="${f(X + 6)}" cy="${f(Y + 2)}" rx="22" ry="9" fill="${C.shadow}"/>`;
  o += `<line x1="${f(X + 3)}" y1="${f(Y - 20)}" x2="${f(X + 3)}" y2="${f(Yt)}" stroke="${C.cane}" stroke-width="3" stroke-linecap="round"/>`;
  o += cluster([[X - 2, Y - 22, 22, 1], [X + 14, Y - 30, 15], [X + 10, Y - 62, 20, 1], [X - 10, Y - 86, 17, 1], [X + 8, Y - 108, 15], [X + 2, Y - 128, 11, 1]], GREEN);
  if (fruit) {
    for (const [dx, dy, r] of [[-14, -28, 7], [6, -40, 6.5], [-4, -64, 6], [20, -78, 7], [-16, -96, 5.5], [8, -110, 5]]) {
      o += `<circle cx="${f(X + dx)}" cy="${f(Y + dy)}" r="${r}" fill="${C.ver}"/><circle cx="${f(X + dx - r * 0.35)}" cy="${f(Y + dy - r * 0.35)}" r="${f(r * 0.3)}" fill="${C.cream}" opacity=".8"/>`;
    }
  }
  return o + `</g>`;
}

function beans(x, y, z) {
  const base = [[x - 0.55, y - 0.45], [x + 0.5, y - 0.5], [x + 0.5, y + 0.45], [x - 0.5, y + 0.5]];
  const apex = [x, y, z + 4.3];
  let o = `<g class="pop">`;
  o += gEllipse(x + 0.3, y, z, 0.75, C.shadow);
  const [AX, AY] = P(...apex);
  const leaves = [];
  base.forEach(([bx, by], i) => {
    const [BX, BY] = P(bx, by, z);
    o += `<line x1="${f(BX)}" y1="${f(BY)}" x2="${f(AX + (i - 1.5) * 3)}" y2="${f(AY - 10)}" stroke="${C.cane}" stroke-width="2.6" stroke-linecap="round"/>`;
    for (let t = 0.12; t < 0.9; t += 0.16) {
      const lx = BX + (AX - BX) * t, ly = BY + (AY - BY) * t;
      leaves.push([lx, ly, (i % 2 ? 1 : -1) * (40 + t * 30), t]);
    }
  });
  leaves.forEach(([lx, ly, rot, t], j) => {
    o += leafS(lx, ly, 17 - t * 5, 8, rot, j % 3 ? C.c4 : C.c3, j % 3 ? C.c3 : C.c2);
    if (j % 5 === 2) o += `<circle cx="${f(lx + 5)}" cy="${f(ly - 6)}" r="3" fill="${C.ver}"/>`;
  });
  return o + `</g>`;
}

function sunflower(x, y, z, cls = 'sway') {
  const [X, Y] = P(x, y, z), [, Yt] = P(x, y, z + 4.8);
  let o = `<g class="pop"><g class="${cls}">`;
  o += `<ellipse cx="${f(X + 8)}" cy="${f(Y + 2)}" rx="16" ry="7" fill="${C.shadow}"/>`;
  o += `<path d="M${f(X)},${f(Y)}C${f(X - 4)},${f(Y - 80)} ${f(X + 6)},${f(Yt + 60)} ${f(X + 2)},${f(Yt)}" stroke="${C.c5}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  o += leafS(X - 1, Y - 60, 30, 13, -62, C.c4, C.c3);
  o += leafS(X + 1, Y - 110, 26, 12, 58, C.c3, C.c2);
  o += leafS(X + 2, Y - 160, 20, 10, -50, C.c4, C.c3);
  const hx = X + 2, hy = Yt;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * 360;
    o += `<ellipse cx="${f(hx)}" cy="${f(hy - 17)}" rx="5.4" ry="11" fill="${i % 2 ? C.ver : C.verDeep}" transform="rotate(${f(a)} ${f(hx)} ${f(hy)})"/>`;
  }
  o += `<circle cx="${f(hx)}" cy="${f(hy)}" r="11" fill="${C.c7}"/><circle cx="${f(hx - 3)}" cy="${f(hy - 3)}" r="4" fill="${C.c5}"/>`;
  return o + `</g></g>`;
}

function tree(x, y, z, kind = 'summer') {
  const [X, Y] = P(x, y, z);
  let o = `<g class="pop">`;
  groundShadowEllipse(x + 1.55, y + 0.35, kind === 'winter' ? 0.5 : 1.6, 1.15);
  o += cyl(x, y, z, 0.17, 3.1, { lit: C.c6, shade: C.c7, top: C.c5 });
  if (kind !== 'winter') {
    const [, Yf] = P(x, y, z + 2.7);
    o += `<path d="M${f(X - 2)},${f(Yf + 6)}Q${f(X - 8)},${f(Yf - 14)} ${f(X - 26)},${f(Yf - 34)}M${f(X + 3)},${f(Yf + 2)}Q${f(X + 12)},${f(Yf - 16)} ${f(X + 24)},${f(Yf - 38)}" stroke="${C.c7}" stroke-width="${f(U * 0.13)}" fill="none" stroke-linecap="round"/>`;
  }
  if (kind === 'winter') {
    const [, Yt] = P(x, y, z + 3.1);
    const br = [[-34, -50], [30, -46], [-14, -72], [18, -78], [-46, -20], [44, -18]];
    o += br.map(([dx, dy]) => `<path d="M${f(X)},${f(Yt + 8)}Q${f(X + dx * 0.4)},${f(Yt + dy * 0.3)} ${f(X + dx)},${f(Yt + dy)}" stroke="${C.c6}" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('');
    return o + `</g>`;
  }
  const pal = kind === 'autumn' ? { base: C.ver, shade: C.verDeep, hl: '#F59272' } : GREEN;
  o += `<g class="sway sway--tree">`;
  const B = (dx, dy, dz, r, hl) => { const [bx, by] = P(x + dx, y + dy, z + dz); return [bx, by, r * U * 1.118, hl]; };
  const canopy = [B(-0.2, -0.2, 5.75, 0.78, 1), B(-0.6, 0.55, 4.2, 0.95, 1), B(0.55, -0.65, 4.35, 0.95), B(0, 0, 4.75, 1.2, 1), B(0.6, 0.5, 3.75, 0.85), B(-0.15, 0.85, 3.55, 0.7)];
  let fruit = '';
  if (kind === 'summer') {
    // offsets in canopy radii from the trunk top, scattered like real fruit, mostly on the lower lit side
    const [cx, cy] = P(x, y, z + 4.4);
    const R = U * 1.3;
    for (const [dx, dy, k] of [[-0.72, 0.32, 1], [-0.38, 0.62, 0.85], [0.08, 0.78, 1], [0.55, 0.42, 0.9], [-0.1, 0.12, 0.8], [0.74, -0.18, 0.85], [-0.6, -0.34, 0.75]]) {
      const ax = cx + dx * R, ay = cy + dy * R, r = U * 0.12 * k;
      fruit += `<circle cx="${f(ax)}" cy="${f(ay)}" r="${f(r)}" fill="${C.ver}"/><circle cx="${f(ax - r * 0.35)}" cy="${f(ay - r * 0.35)}" r="${f(r * 0.3)}" fill="${C.cream}" opacity=".8"/>`;
    }
  }
  o += cluster(canopy, pal, fruit);
  if (kind === 'spring') {
    const r = rng(7);
    for (let i = 0; i < 26; i++) {
      const [bx, by] = P(x, y, z + 4.6);
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 62;
      o += `<circle cx="${f(bx + Math.cos(a) * d)}" cy="${f(by + Math.sin(a) * d * 0.9)}" r="${f(2.2 + r() * 1.8)}" fill="${C.cream}"/>`;
    }
  }
  return o + `</g></g>`;
}

function pot(x, y, z, r, h, terracotta, herb = true) {
  let o = `<g class="pop">`;
  groundShadowEllipse(x + 0.28, y + 0.05, r * 1.1, 1.1);
  o += terracotta
    ? cyl(x, y, z, r, h, { lit: C.ver, shade: C.verDeep, top: C.c7 })
    : cyl(x, y, z, r, h, { lit: C.cream, shade: '#D9CDB5', top: C.c7 });
  const [X, Yt] = P(x, y, z + h);
  const rx = r * U * S2;
  o += `<ellipse cx="${f(X)}" cy="${f(Yt)}" rx="${f(rx)}" ry="${f(rx / 2)}" fill="none" stroke="${terracotta ? '#F38A68' : C.white}" stroke-width="2.4"/>`;
  if (herb) {
    const R = rx * 0.55;
    o += cluster([[X - R * 0.62, Yt - R * 0.45, R * 0.72, 1], [X + R * 0.6, Yt - R * 0.5, R * 0.7], [X, Yt - R * 1.05, R * 0.8, 1]], PALE);
  }
  return o + `</g>`;
}

function cat(x, y, z) {
  const [X, Y] = P(x, y, z);
  gsh(`<ellipse cx="${f(X + 8)}" cy="${f(Y + 3)}" rx="34" ry="11"/>`);
  return `<g class="pop cat">`
    + `<path class="tail" d="M${f(X + 24)},${f(Y)}C${f(X + 40)},${f(Y + 10)} ${f(X + 18)},${f(Y + 16)} ${f(X - 6)},${f(Y + 10)}" stroke="${C.c7}" stroke-width="7" fill="none" stroke-linecap="round"/>`
    + `<ellipse cx="${f(X + 4)}" cy="${f(Y - 6)}" rx="27" ry="14" fill="${C.c7}"/>`
    + `<path d="M${f(X - 14)},${f(Y - 17)}Q${f(X + 4)},${f(Y - 24)} ${f(X + 22)},${f(Y - 14)}" stroke="${C.c5}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    + `<circle cx="${f(X - 18)}" cy="${f(Y - 9)}" r="11" fill="${C.c7}"/>`
    + `<path d="M${f(X - 27)},${f(Y - 14)}l-2,-12l9,6zM${f(X - 15)},${f(Y - 19)}l3,-11l6,9z" fill="${C.c7}"/>`
    + `<path d="M${f(X - 24)},${f(Y - 9)}q3,2 6,0M${f(X - 15)},${f(Y - 9)}q3,2 6,0" stroke="${C.c2}" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>`;
}

function wateringCan(x, y, z) {
  const [X, Yt] = P(x, y, z + 0.75);
  groundShadowEllipse(x + 0.3, y + 0.05, 0.4, 1.1);
  return `<g class="pop">`
    + `<path d="M${f(X + 10)},${f(Yt + 12)}L${f(X + 34)},${f(Yt - 14)}" stroke="${C.c5}" stroke-width="5" stroke-linecap="round"/>`
    + `<ellipse cx="${f(X + 36)}" cy="${f(Yt - 16)}" rx="5" ry="7" transform="rotate(40 ${f(X + 36)} ${f(Yt - 16)})" fill="${C.c3}"/>`
    + cyl(x, y, z, 0.34, 0.75, { lit: C.c4, shade: C.c5, top: C.c3 })
    + `<path d="M${f(X - 14)},${f(Yt + 2)}C${f(X - 14)},${f(Yt - 24)} ${f(X + 12)},${f(Yt - 24)} ${f(X + 12)},${f(Yt + 2)}" stroke="${C.c6}" stroke-width="4" fill="none" stroke-linecap="round"/></g>`;
}

function table(x, y, z) {
  const [X, Yb] = P(x, y, z), [, Yt] = P(x, y, z + 1.45);
  groundShadowEllipse(x + 0.55, y + 0.2, 0.72, 1.05);
  let o = `<g class="pop">`;
  o += `<ellipse cx="${f(X)}" cy="${f(Yb)}" rx="13" ry="6" fill="${C.c6}"/>`;
  o += `<line x1="${f(X)}" y1="${f(Yb)}" x2="${f(X)}" y2="${f(Yt)}" stroke="${C.c6}" stroke-width="4"/>`;
  o += cyl(x, y, z + 1.45, 0.72, 0.08, { lit: C.c4, shade: C.c5, top: C.c3 });
  o += cyl(x - 0.1, y + 0.15, z + 1.53, 0.12, 0.24, { lit: C.white, shade: '#E2D7C2', top: C.c6 });
  return o + `</g>`;
}

function stool(x, y, z) {
  const [X, Yb] = P(x, y, z), [, Ys] = P(x, y, z + 1.0);
  const rx = 0.36 * U * S2;
  groundShadowEllipse(x + 0.4, y + 0.1, 0.38, 1.05);
  let o = `<g class="pop">`;
  for (const [dx, dy] of [[-rx * 0.7, 2], [rx * 0.7, 2], [0, rx * 0.4]]) {
    o += `<line x1="${f(X + dx)}" y1="${f(Ys + dy - 2)}" x2="${f(X + dx * 1.15)}" y2="${f(Yb + dy * 0.6)}" stroke="${C.c6}" stroke-width="3" stroke-linecap="round"/>`;
  }
  o += cyl(x, y, z + 1.0, 0.36, 0.1, { lit: C.c4, shade: C.c5, top: C.c3 });
  return o + `</g>`;
}

function kale(x, y, z) {
  const [X, Y] = P(x, y, z);
  let o = `<g class="pop"><ellipse cx="${f(X + 5)}" cy="${f(Y + 2)}" rx="16" ry="7" fill="${C.shadow}"/>`;
  [-38, 34, -14, 12, -2].forEach((rot, i) => { o += leafS(X, Y, 34 - i * 2, 11, rot, i % 2 ? C.c4 : C.c5, C.c3); });
  return o + `</g>`;
}

function strawberry(x, y, z) {
  const [X, Y] = P(x, y, z);
  let o = `<g class="pop">`;
  [[-9, 0, -70], [9, 0, 70], [0, -2, 0], [-5, 3, -30], [6, 3, 30]].forEach(([dx, dy, r]) => { o += leafS(X + dx * 0.3, Y + dy, 14, 7, r, C.c3, C.c2); });
  o += `<path d="M${f(X - 9)},${f(Y + 2)}q-4,6 0,9q4,-1 3,-6z" fill="${C.ver}"/><path d="M${f(X + 8)},${f(Y + 1)}q-3,7 1,9q4,-2 2,-7z" fill="${C.ver}"/>`;
  return o + `</g>`;
}

function bed(x, y, w, d, h, soil = C.c6) {
  const c = { top: C.c3, left: C.c4, right: C.c5 };
  const sx = h * 0.85, sy = h * 0.25;
  groundShadowPoly([[x + w, y, 0], [x + w + sx, y + sy, 0], [x + w + sx, y + d + sy, 0], [x + sx, y + d + sy, 0], [x, y + d, 0]]);
  let o = box(x, y, 0, w, d, h, c);
  for (const t of [0.34, 0.67]) {
    o += line([x, y + d, h * t], [x + w, y + d, h * t], C.c5, 1.2);
    o += line([x + w, y, h * t], [x + w, y + d, h * t], C.c6, 1.2);
  }
  o += poly([[x + 0.13, y + 0.13, h], [x + w - 0.13, y + 0.13, h], [x + w - 0.13, y + d - 0.13, h], [x + 0.13, y + d - 0.13, h]], soil);
  return o;
}

function fences(len, wid, h, opts = {}) {
  let o = '';
  // left fence along x = 0 (we see its +x face, shaded)
  o += box(-0.16, 0, 0, 0.16, wid, h, { top: C.fenceTop, left: C.fenceLit, right: C.fenceShade });
  for (let yy = 0.5; yy < wid; yy += 0.5) o += line([0, yy, 0], [0, yy, h], C.fenceLine, 1);
  // back fence along y = 0 (we see its +y face, lit)
  o += box(-0.16, -0.16, 0, len + 0.16, 0.16, h, { top: C.fenceTop, left: C.fenceLit, right: C.fenceShade });
  for (let xx = 0.5; xx < len; xx += 0.5) o += line([xx, 0, 0], [xx, 0, h], C.fenceLine, 1);
  if (opts.snow) {
    o += poly([[-0.16, -0.16, h], [len, -0.16, h], [len, 0, h], [0, 0, h], [0, wid, h], [-0.16, wid, h]], C.white, ` stroke="${C.white}" stroke-width="5" stroke-linejoin="round"`);
  }
  return o;
}

function slab(len, wid, top) {
  return box(0, 0, -0.42, len, wid, 0.42, { top, left: C.slabL, right: C.slabR });
}

function gravel(len, wid, seed, fill = C.gravel, n = 260) {
  const r = rng(seed);
  let o = '';
  for (let i = 0; i < n; i++) {
    const [X, Y] = P(r() * len, r() * wid, 0);
    o += `<circle cx="${f(X)}" cy="${f(Y)}" r="${f(0.8 + r() * 1.1)}" fill="${fill}"/>`;
  }
  return `<g>${o}</g>`;
}

function dimension(a, b, label, side, from) {
  // a, b: ground points of the dimension line; from: the two plot corners it measures
  const [x1, y1] = P(...a), [x2, y2] = P(...b);
  let ext = '';
  if (from) {
    from.forEach((c, i) => {
      const t = i ? b : a;
      const dx = t[0] - c[0], dy = t[1] - c[1];
      const s0 = [c[0] + dx * 0.25, c[1] + dy * 0.25, -0.42], s1 = [t[0] + dx * 0.3, t[1] + dy * 0.3, 0];
      ext += line(s0, s1, C.pencil, 0.8);
    });
  }
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const ang = side === 'x' ? 26.565 : -26.565;
  const tick = (X, Y) => `<path d="M${f(X - 5)},${f(Y + 5)}L${f(X + 5)},${f(Y - 5)}" stroke="${C.pencil}" stroke-width="1.6"/>`;
  return `<g class="dim">${ext}<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${C.pencil}" stroke-width="1.1"/>${tick(x1, y1)}${tick(x2, y2)}`
    + `<g transform="translate(${f(mx)} ${f(my)}) rotate(${ang})"><rect x="-26" y="-11" width="52" height="20" fill="${C.ground}" opacity="0"/><text x="0" y="${side === 'x' ? 22 : 22}" text-anchor="middle">${label}</text></g></g>`;
}

/* ---------- hero scene ---------- */
function hero() {
  prefix = 'h'; uid = 0; U = 44; GS = [];
  const L = 10, W = 8;
  let s = '';
  s += slab(L, W, C.ground);
  s += gravel(L, W, 3);
  // patio slabs, front right
  let pat = '';
  for (let xx = 5.8; xx < L - 0.05; xx += 1.05) {
    for (let yy = 4.4; yy < W - 0.05; yy += 1.2) {
      pat += poly([[xx + 0.05, yy + 0.05, 0], [Math.min(xx + 1.0, L - 0.05), yy + 0.05, 0], [Math.min(xx + 1.0, L - 0.05), Math.min(yy + 1.15, W - 0.05), 0], [xx + 0.05, Math.min(yy + 1.15, W - 0.05), 0]], C.stone);
    }
  }
  s += `<g>${pat}</g>`;
  // stepping stones, with a little thickness so they read as stone, not shadow
  for (const [xx, yy] of [[4.8, 3.2], [4.2, 4.1], [3.9, 5.2], [4.0, 6.3], [4.3, 7.4]]) {
    s += cyl(xx, yy, 0, 0.36, 0.07, { lit: '#DCD0BA', shade: '#C7B9A0', top: '#EDE4D3' });
  }
  s += SHADOW_SLOT;
  // the fences cast long bands on the ground
  groundShadowPoly([[0, 0, 0], [1.25, 0.35, 0], [1.25, W, 0], [0, W, 0]]);
  groundShadowPoly([[0, 0, 0], [L, 0, 0], [L, 0.55, 0], [0.4, 0.55, 0]]);
  s += fences(L, W, 3.4);
  s += tree(1.25, 1.25, 0);
  // bed A along the back fence
  s += `<g class="pop">${bed(2.6, 0.35, 6.9, 1.55, 0.9)}`
    + poly([[2.73, 0.48, 0.9], [4.7, 0.48, 0.9], [4.25, 1.77, 0.9], [2.73, 1.77, 0.9]], 'rgba(6,22,62,.5)') + `</g>`;
  s += lettuce(3.25, 1.15, 0.9) + lettuce(4.1, 1.05, 0.9, 0.95);
  s += beans(5.35, 1.1, 0.9);
  s += tomato(6.75, 1.1, 0.9) + tomato(7.85, 1.15, 0.9);
  s += sunflower(9.0, 1.05, 0.9);
  // bed B along the left fence
  s += `<g class="pop">${bed(0.35, 3.1, 1.55, 4.4, 0.9)}`
    + poly([[0.48, 3.23, 0.9], [1.25, 3.23, 0.9], [1.25, 7.37, 0.9], [0.48, 7.37, 0.9]], 'rgba(6,22,62,.5)') + `</g>`;
  s += kale(1.1, 3.75, 0.9) + kale(1.15, 4.75, 0.9) + strawberry(1.1, 5.7, 0.9) + strawberry(1.1, 6.4, 0.9) + strawberry(1.15, 7.05, 0.9);
  s += wateringCan(3.0, 4.7, 0);
  // herbs by the (off-page) kitchen door
  // painter's order: back to front by x + y
  s += pot(8.4, 3.2, 0, 0.28, 0.6, false) + pot(9.2, 2.7, 0, 0.42, 0.85, true) + pot(9.3, 3.85, 0, 0.34, 0.7, false);
  s += stool(6.55, 6.6, 0) + table(8.0, 6.0, 0) + stool(8.9, 7.05, 0);
  s += cat(5.8, 7.0, 0);
  // dimensions
  s += dimension([0, W + 0.9, 0], [L, W + 0.9, 0], '5.0 m', 'x', [[0, W], [L, W]]);
  s += dimension([L + 0.9, 0, 0], [L + 0.9, W, 0], '4.0 m', 'y', [[L, 0], [L, W]]);
  // anchors for the margin notes
  const a = (name, p) => { const [X, Y] = P(...p); return `<circle class="anchor" data-anchor="${name}" cx="${f(X)}" cy="${f(Y)}" r="1" fill="none"/>`; };
  s += a('shade', [3.6, 1.3, 1.6]) + a('herbs', [9.2, 3.25, 1.7]) + a('cat', [5.6, 7.0, 0.5]);
  s = flushShadows(s, L, W);
  return `<svg class="art" viewBox="-420 -268 940 712" role="img" aria-labelledby="art-title"><title id="art-title">Axonometric plan of a small walled garden: a raised bed of lettuce, beans, tomatoes and a sunflower along the back fence, a bed of kale and strawberries along the side, an apple tree in the shady corner, herb pots, a bistro table and a sleeping cat on the patio.</title>${s}</svg>`;
}

/* ---------- seasons strip ---------- */
function season(kind) {
  prefix = kind.slice(0, 2) + 's'; uid = 0; U = 30; GS = [];
  const L = 7, W = 5.4;
  const ground = kind === 'winter' ? '#E9ECF2' : C.ground;
  let s = slab(L, W, ground);
  s += gravel(L, W, 11, kind === 'winter' ? '#D3D9E4' : C.gravel, 120);
  s += SHADOW_SLOT;
  groundShadowPoly([[0, 0, 0], [L, 0, 0], [L, 0.5, 0], [0.4, 0.5, 0]]);
  s += fences(L, W, 3.1, { snow: kind === 'winter' });
  s += tree(1.3, 1.3, 0, kind === 'spring' ? 'spring' : kind);
  const soil = kind === 'winter' ? C.white : C.c6;
  s += `<g class="pop">${bed(2.7, 0.35, 4.0, 1.5, 0.9, soil)}</g>`;
  if (kind === 'spring') {
    s += lettuce(3.3, 1.1, 0.9, 0.55) + lettuce(4.2, 1.1, 0.9, 0.55) + lettuce(5.1, 1.1, 0.9, 0.55) + lettuce(6.0, 1.1, 0.9, 0.5);
  } else if (kind === 'summer') {
    s += tomato(4.0, 1.1, 0.9) + tomato(5.1, 1.1, 0.9) + sunflower(6.15, 1.05, 0.9, '');
  } else if (kind === 'autumn') {
    s += ball(3.5, 1.1, 1.25, 0.45, { base: C.ver, shade: C.verDeep, hl: '#F59272' })
      + ball(4.7, 1.0, 1.2, 0.38, { base: C.ver, shade: C.verDeep, hl: '#F59272' })
      + kale(5.9, 1.1, 0.9);
    const r = rng(5);
    for (let i = 0; i < 26; i++) {
      const [X, Y] = P(1.5 + r() * 4.5, 1.8 + r() * 3.2, 0);
      s += `<ellipse cx="${f(X)}" cy="${f(Y)}" rx="3.4" ry="1.8" transform="rotate(${f(r() * 180)} ${f(X)} ${f(Y)})" fill="${r() > 0.4 ? C.ver : C.verDeep}"/>`;
    }
  } else {
    const [X, Y] = P(5.0, 3.6, 0);
    // a robin, for company
    gsh(`<ellipse cx="${f(X + 4)}" cy="${f(Y + 3)}" rx="11" ry="4"/>`);
    s += `<g class="pop"><ellipse cx="${f(X)}" cy="${f(Y - 8)}" rx="10" ry="8" fill="${C.c6}"/><circle cx="${f(X + 8)}" cy="${f(Y - 15)}" r="6" fill="${C.c6}"/><ellipse cx="${f(X + 5)}" cy="${f(Y - 8)}" rx="5" ry="6" fill="${C.ver}"/><path d="M${f(X + 13)},${f(Y - 16)}l5,1l-5,2z" fill="${C.c7}"/><path d="M${f(X - 9)},${f(Y - 9)}l-9,-4l1,6z" fill="${C.c7}"/></g>`;
  }
  s += pot(6.3, 3.9, 0, 0.42, 0.8, true, kind !== 'winter');
  s = flushShadows(s, L, W);
  return `<svg class="season__art" viewBox="-190 -210 420 380" aria-hidden="true" focusable="false">${s}</svg>`;
}

/* ---------- feature spots ---------- */
function spotPlot() {
  prefix = 'f1'; uid = 0; U = 26; GS = [];
  let s = box(0, 0, -0.3, 6, 4.5, 0.3, { top: C.ground, left: C.slabL, right: C.slabR });
  s += SHADOW_SLOT;
  s += `<polygon points="${pts([[0.5, 0.5, 0], [5.5, 0.5, 0], [5.5, 4, 0], [0.5, 4, 0]])}" fill="none" stroke="${C.c4}" stroke-width="2" stroke-dasharray="7 5"/>`;
  for (const p of [[0.5, 0.5], [5.5, 0.5], [5.5, 4], [0.5, 4]]) s += gEllipse(p[0], p[1], 0, 0.12, C.c4);
  // tape measure case + tape
  s += `<polygon points="${pts([[1.2, 4.0, 0.02], [5.5, 4.0, 0.02], [5.5, 4.35, 0.02], [1.2, 4.35, 0.02]])}" fill="${C.cream}" stroke="${C.c6}" stroke-width="1"/>`;
  for (let t = 1.5; t < 5.4; t += 0.5) s += line([t, 4.0, 0.02], [t, 4.18, 0.02], C.c6, 1);
  s += cyl(0.95, 4.2, 0, 0.55, 0.55, { lit: C.ver, shade: C.verDeep, top: '#F38A68' });
  // pencil
  const [X, Y] = P(3.4, 2.0, 0.1);
  s += `<g transform="translate(${f(X)} ${f(Y)}) rotate(-28)"><rect x="-44" y="-5" width="70" height="10" fill="${C.c4}"/><rect x="-44" y="-5" width="70" height="4" fill="${C.c3}"/><path d="M26,-5L40,0L26,5Z" fill="${C.cream}"/><path d="M35,-2L40,0L35,2Z" fill="${C.c7}"/><rect x="-52" y="-5" width="8" height="10" fill="${C.ver}"/></g>`;
  s = flushShadows(s, 6, 4.5);
  return `<svg class="spot" viewBox="-150 -50 330 200" aria-hidden="true" focusable="false">${s}</svg>`;
}

function spotSun() {
  prefix = 'f2'; uid = 0; U = 26; GS = [];
  let s = box(0, 0, -0.3, 6, 4.5, 0.3, { top: C.ground, left: C.slabL, right: C.slabR });
  s += SHADOW_SLOT;
  // the long afternoon shadow the sun map is about
  groundShadowPoly([[0.6, 1.0, 0], [3.4, 1.0, 0], [5.6, 3.6, 0], [2.4, 3.6, 0]]);
  s += bed(0.6, 0.5, 2.8, 1.0, 0.9);
  s += lettuce(1.3, 1.0, 0.9, 0.5) + lettuce(2.1, 1.0, 0.9, 0.5) + lettuce(2.9, 1.0, 0.9, 0.5);
  const [ax, ay] = P(-0.5, 4.5, 3.2), [bx, by] = P(6.5, 0, 3.6), [cx, cy] = P(1.5, 1.0, 6.4);
  s += `<path d="M${f(ax)},${f(ay)}Q${f(cx)},${f(cy - 30)} ${f(bx)},${f(by)}" stroke="${C.pencil}" stroke-width="1.6" stroke-dasharray="3 6" fill="none" stroke-linecap="round"/>`;
  const sx = (ax + 2 * cx + bx) / 4 + 30, sy = (ay + 2 * (cy - 30) + by) / 4 + 4;
  s += `<g class="sun" transform="translate(${f(sx)} ${f(sy)})">` + Array.from({ length: 10 }, (_, i) => `<line x1="0" y1="-20" x2="0" y2="-27" stroke="${C.ver}" stroke-width="3" stroke-linecap="round" transform="rotate(${i * 36})"/>`).join('')
    + `<circle r="14" fill="${C.ver}"/><circle cx="-4" cy="-4" r="5" fill="#F59272"/></g>`;
  s = flushShadows(s, 6, 4.5);
  return `<svg class="spot" viewBox="-150 -110 330 260" aria-hidden="true" focusable="false">${s}</svg>`;
}

function spotNudge() {
  prefix = 'f3'; uid = 0; U = 26; GS = [];
  let s = box(0, 0, -0.3, 6, 4.5, 0.3, { top: C.ground, left: C.slabL, right: C.slabR });
  s += SHADOW_SLOT;
  // phone lying flat
  s += box(0.8, 0.9, 0, 2.6, 4.6 - 0.9 - 0.4, 0.18, { top: C.c7, left: C.c5, right: C.c6 });
  s += poly([[0.95, 1.05, 0.18], [3.25, 1.05, 0.18], [3.25, 3.15, 0.18], [0.95, 3.15, 0.18]], C.c1);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x0 = 1.08 + i * 0.53, y0 = 1.25 + j * 0.46;
    s += poly([[x0, y0, 0.18], [x0 + 0.4, y0, 0.18], [x0 + 0.4, y0 + 0.34, 0.18], [x0, y0 + 0.34, 0.18]], (i === 2 && j === 1) ? C.ver : C.c2);
  }
  // seed packet standing
  s += box(4.0, 1.4, 0, 1.3, 0.22, 2.1, { top: C.cream, left: C.cream, right: '#E2D6BE' });
  const [X, Y] = P(4.65, 1.62, 1.05);
  s += `<g transform="translate(${f(X)} ${f(Y)}) skewY(26.565)"><rect x="-13" y="-22" width="26" height="30" rx="2" fill="${C.c4}"/><path d="M0,4V-10M0,-6Q-8,-14 -9,-6Q-2,-4 0,-6M0,-10Q7,-18 9,-10Q3,-8 0,-10" stroke="${C.cream}" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
  // notification bubble
  const [nx, ny] = P(1.4, 2.0, 2.8);
  s += `<g class="ping" transform="translate(${f(nx)} ${f(ny)})"><rect x="-40" y="-16" width="96" height="30" rx="6" fill="${C.white}" stroke="${C.c6}" stroke-width="1.5"/><rect x="-33" y="-9" width="16" height="16" rx="3" fill="${C.ver}"/><rect x="-11" y="-8" width="56" height="5" rx="2.5" fill="${C.c3}"/><rect x="-11" y="1" width="38" height="5" rx="2.5" fill="${C.c2}"/></g>`;
  s = flushShadows(s, 6, 4.5);
  return `<svg class="spot" viewBox="-150 -70 330 220" aria-hidden="true" focusable="false">${s}</svg>`;
}

/* ---------- planner: static example bed (main.js re-renders it) ---------- */
const SUN = [[2, 3, 3, 4, 4, 5], [3, 4, 4, 5, 6, 6], [4, 5, 5, 6, 7, 7], [4, 5, 6, 7, 8, 8]];
const EXAMPLE = { '0,1': 'lettuce', '0,3': 'lettuce', '1,3': 'strawberry', '1,4': 'beans', '1,5': 'beans', '2,1': 'marigold', '2,4': 'tomato', '2,5': 'tomato', '3,2': 'basil', '3,3': 'basil', '3,5': 'marigold' };
function staticBed() {
  let o = '';
  SUN.forEach((row, r) => row.forEach((h, c) => {
    const p = EXAMPLE[`${r},${c}`];
    o += `<div class="cell" style="--h:${h}"><span class="cell__sun">${h} h</span>`
      + (p ? `<span class="plant"><svg role="img" aria-label="${p} in ${'ABCD'[r]}${c + 1}"><use href="#i-${p}"/></svg></span>` : '') + `</div>`;
  }));
  return o;
}

/* ---------- write ---------- */
let html = fs.readFileSync(htmlPath, 'utf8');
const put = (name, svg) => {
  const re = new RegExp(`(<!--@${name}-->)[\\s\\S]*?(<!--/@${name}-->)`);
  if (!re.test(html)) throw new Error(`marker ${name} missing`);
  html = html.replace(re, `$1${svg}$2`);
};
put('hero', hero());
for (const k of ['spring', 'summer', 'autumn', 'winter']) put(k, season(k));
put('spot-plot', spotPlot());
put('spot-sun', spotSun());
put('spot-nudge', spotNudge());
put('bed', staticBed());
// The live bed reuses the hero's original plants, at their original drawing scale.
// Keep these in the sprite so season changes only animate existing SVG instances.
U = 44;
const livePlants = {
  tomato: () => tomato(0, 0, 0),
  beans: () => `<g transform="scale(.73)">${beans(0, 0, 0)}</g>`,
  lettuce: () => lettuce(0, 0, 0, 1.15),
  strawberry: () => `<g transform="scale(1.5)">${strawberry(0, 0, 0)}</g>`,
  courgette: () => kale(0, 0, 0) + '<use href="#i-courgette" x="-24" y="-12" width="34" height="34"/>',
  basil: () => `<g transform="scale(.85 1.15)">${kale(0, 0, 0)}</g>`,
  mint: () => '<use href="#i-mint" x="-28" y="-70" width="56" height="72"/>',
  marigold: () => '<path d="M0 0V-48M0-16L-12-25M0-24L12-33" fill="none" stroke="#0B3A8F" stroke-width="2.5"/><use href="#i-marigold" x="-20" y="-76" width="40" height="40"/>',
};
const liveSymbols = Object.entries(livePlants).map(([name, draw]) => {
  prefix = `live-${name}-`; uid = 0; GS = [];
  return `<symbol id="s-${name}" viewBox="-65 -180 130 200">${draw()}</symbol>`;
}).join('');
const liveMarker = /<!--@live-symbols-->[\s\S]*?<!--\/@live-symbols-->/;
if (liveMarker.test(html)) html = html.replace(liveMarker, `<!--@live-symbols-->${liveSymbols}<!--/@live-symbols-->`);
else html = html.replace('</symbol>\n  </svg>', `</symbol>\n<!--@live-symbols-->${liveSymbols}<!--/@live-symbols-->\n  </svg>`);
fs.writeFileSync(htmlPath, html);
console.log('baked', (html.length / 1024).toFixed(0), 'KB');
