// Bakes the three static "Year 0 / 3 / 7" contour figures into index.html (JS-off and
// reduced-motion fallback), using the same terrain code as main.js.
// Run: node site/work/brisure-capital/_src/bake.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(join(dir, 'main.js'), 'utf8');
const core = js.slice(js.indexOf('/*@terrain*/'), js.indexOf('/*/terrain*/'));
const { createNoise, traceContours } = new Function(`${core}; return { createNoise, heightAt, traceContours };`)();

const W = 480, H = 300, S = 2;          // trace at 480×300, write integers at 2× (viewBox 960×600)
const cubicOut = (x) => 1 - Math.pow(1 - x, 3);
const noise = createNoise(46);

function figure(p) {
  const company = { x: W * 0.64, y: H * 0.44, amp: 0.15 + 0.85 * cubicOut(p), sigma: 0.16 * Math.max(W, H * 0.75) };
  const segs = { minor: [], major: [] };
  traceContours(W, H, {
    noise, t: 3.2 + 0.9 * p, cell: 6, octaves: 2, scale: 3.6 / Math.max(W, H),
    lo: -0.62, hi: 1.62, levels: 24, majorEvery: 4, bumps: [company], calm: 0.8
  }, (m, x1, y1, x2, y2) => segs[m ? 'major' : 'minor'].push([x1, y1, x2, y2]));
  const path = (list) => chain(list).map((pts) => {
    const q = pts.map(([x, y]) => [Math.round(x * S), Math.round(y * S)]);
    let d = `M${q[0][0]} ${q[0][1]}`;
    let rel = '';
    for (let i = 1; i < q.length; i++) {
      const dx = q[i][0] - q[i - 1][0], dy = q[i][1] - q[i - 1][1];
      if (dx === 0 && dy === 0) continue;
      rel += `${rel ? ' ' : ''}${dx} ${dy}`.replace(/ -/g, '-');
    }
    return rel ? `${d}l${rel}` : '';
  }).join('');
  const cx = Math.round(company.x * S), cy = Math.round(company.y * S);
  return `<svg viewBox="0 0 ${W * S} ${H * S}" aria-hidden="true">` +
    `<path d="${path(segs.minor)}" fill="none" stroke="rgba(255,255,255,.26)" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="${path(segs.major)}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.6" stroke-linejoin="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="11" fill="#e41613" stroke="#fff" stroke-width="4"/></svg>`;
}

// join segments that share endpoints into polylines
function chain(segs) {
  const key = (x, y) => `${Math.round(x * 100)},${Math.round(y * 100)}`;
  const ends = new Map();
  const used = new Uint8Array(segs.length);
  segs.forEach(([x1, y1, x2, y2], i) => {
    for (const k of [key(x1, y1), key(x2, y2)]) { if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); }
  });
  const next = (x, y) => (ends.get(key(x, y)) || []).find((i) => !used[i]);
  const lines = [];
  segs.forEach((s, i) => {
    if (used[i]) return;
    used[i] = 1;
    const pts = [[s[0], s[1]], [s[2], s[3]]];
    for (const atEnd of [true, false]) {
      for (;;) {
        const [x, y] = atEnd ? pts[pts.length - 1] : pts[0];
        const j = next(x, y);
        if (j === undefined) break;
        used[j] = 1;
        const [a, b, c, d] = segs[j];
        const far = key(a, b) === key(x, y) ? [c, d] : [a, b];
        atEnd ? pts.push(far) : pts.unshift(far);
      }
    }
    lines.push(pts);
  });
  return lines;
}

let html = readFileSync(join(dir, 'index.html'), 'utf8');
for (const [name, p] of [['fig0', 0], ['fig3', 3 / 7], ['fig7', 1]]) {
  const re = new RegExp(`<!--@${name}-->[\\s\\S]*?<!--/${name}-->`);
  const svg = figure(p);
  html = html.replace(re, `<!--@${name}-->${svg}<!--/${name}-->`);
  console.log(name, (svg.length / 1024).toFixed(1), 'KB');
}
writeFileSync(join(dir, 'index.html'), html);
