// People tiles: each person gets a small floor plan, drawn from a seed, in the same line language
// as the service drawings. Writes the <li> list between the @people markers in index.html.
// Run: node _src/build-people.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const PEOPLE = [
  ['Marta Seixas', 'Founding partner'], ['Tomás Aragão', 'Founding partner'],
  ['Joana Freixo', 'Associate, interiors'], ['Henrique Taveira', 'Associate, architecture'],
  ['Clara Weiss', 'Restoration lead'], ['Tiago Brandão', 'Model maker'],
  ['Leonor Maia', 'Project architect'], ['Ama Owusu', 'Project architect'],
  ['Rita Gaspar', 'Architect'], ['Miguel Lacerda', 'Architect, competitions'],
  ['Sofia Antunes', 'Interior designer'], ['Inês Valadares', 'Interior designer'],
  ['Hana Kovač', 'Lighting design'], ['Kenji Arai', 'Drawings and visualisation'],
  ['Nuno Rebelo', 'Site architect'], ['Paulo Fontes', 'Joinery and workshop'],
  ['Diogo Mota', 'Archive and models'], ['Beatriz Couto', 'Studio manager']
];

const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const f = (n) => Math.round(n * 10) / 10;

function plan(name) {
  const r = rng(hash(name));
  const W = 200, H = 250, pad = 22;
  const box = { x: pad, y: pad + 6, w: W - 2 * pad, h: H - 2 * pad - 30 };
  const out = [], thin = [], hatch = [], fills = [];
  // outer walls, sometimes with a notch cut from one corner (an L-plan)
  const notch = r() < 0.45 ? { w: f(box.w * (0.3 + r() * 0.2)), h: f(box.h * (0.22 + r() * 0.2)), right: r() < 0.5 } : null;
  let outline;
  if (notch) {
    const { x, y, w, h } = box;
    outline = notch.right
      ? `M${x} ${y}H${x + w - notch.w}V${y + notch.h}H${x + w}V${y + h}H${x}Z`
      : `M${x + notch.w} ${y}H${x + w}V${y + h}H${x}V${y + notch.h}H${x + notch.w}Z`;
  } else {
    outline = `M${box.x} ${box.y}h${box.w}v${box.h}h${-box.w}Z`;
  }
  out.push(`<path class="pl-wall" d="${outline}"/>`);

  // split the inside into rooms; every partition keeps a door with its swing
  const rooms = [];
  const split = (rm, depth) => {
    const vertical = rm.w > rm.h ? r() < 0.75 : r() < 0.25;
    const len = vertical ? rm.w : rm.h;
    if (depth > 2 || len < 58 || (depth > 0 && r() < 0.2)) { rooms.push(rm); return; }
    const at = f(len * (0.36 + r() * 0.28));
    const door = 15;
    if (vertical) {
      const x = rm.x + at, span = rm.h, d0 = f(rm.y + 6 + r() * (span - door - 12));
      thin.push(`M${x} ${rm.y}V${d0}M${x} ${f(d0 + door)}V${rm.y + rm.h}`);
      hatch.push(`M${x} ${d0}A${door} ${door} 0 0 1 ${f(x + door)} ${f(d0 + door)}`);
      split({ x: rm.x, y: rm.y, w: at, h: rm.h }, depth + 1);
      split({ x, y: rm.y, w: rm.w - at, h: rm.h }, depth + 1);
    } else {
      const y = rm.y + at, span = rm.w, d0 = f(rm.x + 6 + r() * (span - door - 12));
      thin.push(`M${rm.x} ${y}H${d0}M${f(d0 + door)} ${y}H${rm.x + rm.w}`);
      hatch.push(`M${f(d0 + door)} ${y}A${door} ${door} 0 0 1 ${d0} ${f(y - door)}`);
      split({ x: rm.x, y: rm.y, w: rm.w, h: at }, depth + 1);
      split({ x: rm.x, y, w: rm.w, h: rm.h - at }, depth + 1);
    }
  };
  const inner = notch
    ? (notch.right ? { x: box.x, y: box.y + notch.h, w: box.w, h: box.h - notch.h } : { x: box.x, y: box.y + notch.h, w: box.w, h: box.h - notch.h })
    : box;
  if (notch) {
    // the room beside the notch
    const side = notch.right ? { x: box.x, y: box.y, w: box.w - notch.w, h: notch.h } : { x: box.x + notch.w, y: box.y, w: box.w - notch.w, h: notch.h };
    thin.push(`M${side.x} ${f(side.y + side.h)}H${f(side.x + side.w)}`);
    rooms.push(side);
  }
  split(inner, 0);

  // one room gets a stair, one a skylight or a column grid, one a long table
  const pick = (k) => rooms.splice(Math.floor(r() * rooms.length), 1)[0];
  const stair = rooms.length > 2 ? pick() : null;
  if (stair) {
    const across = stair.w > stair.h;
    const n = 7 + Math.floor(r() * 5);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      hatch.push(across ? `M${f(stair.x + stair.w * t)} ${f(stair.y + 4)}V${f(stair.y + stair.h - 4)}` : `M${f(stair.x + 4)} ${f(stair.y + stair.h * t)}H${f(stair.x + stair.w - 4)}`);
    }
    hatch.push(across ? `M${f(stair.x + 6)} ${f(stair.y + stair.h / 2)}H${f(stair.x + stair.w - 8)}` : `M${f(stair.x + stair.w / 2)} ${f(stair.y + stair.h - 6)}V${f(stair.y + 8)}`);
  }
  const special = rooms.length ? pick() : null;
  if (special) {
    if (r() < 0.5) {
      const s = f(Math.min(special.w, special.h) * 0.5);
      const x = f(special.x + (special.w - s) / 2), y = f(special.y + (special.h - s) / 2);
      out.push(`<rect class="pl-sky" x="${x}" y="${y}" width="${s}" height="${s}"/>`);
      hatch.push(`M${x} ${y}l${s} ${s}M${f(x + s)} ${y}l${-s} ${s}`);
    } else {
      for (let i = 1; i <= 2; i++) for (let j = 1; j <= 2; j++) {
        out.push(`<rect class="pl-col" x="${f(special.x + special.w * i / 3 - 2.5)}" y="${f(special.y + special.h * j / 3 - 2.5)}" width="5" height="5"/>`);
      }
    }
  }
  const table = rooms.length ? pick() : null;
  if (table && table.w > 30 && table.h > 30) {
    const tw = f(table.w * 0.55), th = f(Math.min(14, table.h * 0.3));
    fills.push(`<rect class="pl-fill" x="${f(table.x + (table.w - tw) / 2)}" y="${f(table.y + (table.h - th) / 2)}" width="${tw}" height="${th}"/>`);
  }
  // windows: short triple lines in the outer wall
  const wins = 2 + Math.floor(r() * 3);
  for (let i = 0; i < wins; i++) {
    const onX = r() < 0.5, t = 0.15 + r() * 0.6;
    if (onX) { const x = f(box.x + box.w * t), y = r() < 0.5 ? box.y : box.y + box.h; if (notch && y === box.y) continue; out.push(`<path class="pl-win" d="M${x} ${y}h18"/>`); }
    else { const y = f(box.y + box.h * t), x = r() < 0.5 ? box.x : box.x + box.w; if (notch && y < box.y + notch.h) continue; out.push(`<path class="pl-win" d="M${x} ${y}v18"/>`); }
  }
  return `<svg class="person__plan" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">${fills.join('')}<path class="pl-thin" d="${thin.join('')}"/><path class="pl-hatch" d="${hatch.join('')}"/>${out.join('')}</svg>`;
}

const initials = (n) => n.split(' ').map((w) => w[0]).filter((c) => c === c.toUpperCase()).slice(0, 2).join('');
const items = PEOPLE.map(([name, role]) => `          <li class="person"><div class="person__tile">${plan(name)}<span class="person__initials" aria-hidden="true">${initials(name)}</span></div><p class="person__role">${role}</p><p class="person__name">${name}</p></li>`).join('\n');

const file = new URL('../index.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const next = html.replace(/<!--@people-->[\s\S]*?<!--\/@people-->/, `<!--@people-->\n${items}\n<!--/@people-->`);
if (next === html && !html.includes(items)) throw new Error('markers not found');
writeFileSync(file, next);
console.log(PEOPLE.length, 'people written,', items.length, 'chars');
