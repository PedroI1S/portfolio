// Static SVG exports of the project plots, for the no-JS page (reel grid and ledger panels).
// Run from the piece folder:  node _src/bake.mjs
// Jekyll ignores _src/, so this file never ships.
import { readFileSync, writeFileSync } from 'node:fs';
import { PLOTS, portrait, record } from '../plot.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sheets = [...html.matchAll(/<li data-plot="(\w+)" data-seed="(\d+)"/g)].map((m) => [m[1], Number(m[2])]);
if (sheets.length !== 8) throw new Error(`expected 8 reel sheets, found ${sheets.length}`);

const r1 = (v) => Math.round(v * 10) / 10;
const pathData = (strokes) => strokes.map((s) => {
  let d = `M${r1(s[0])} ${r1(s[1])}`, px = r1(s[0]), py = r1(s[1]);
  for (let i = 2; i < s.length; i += 2) {
    const x = r1(s[i]), y = r1(s[i + 1]);
    d += `l${r1(x - px)} ${r1(y - py)}`;
    px = x; py = y;
  }
  return d;
}).join('').replace(/(\D)0\./g, '$1.').replace(/-0\./g, '-.');

const svg = (w, h, bg, ink, { strokes, width }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
  `<rect width="${w}" height="${h}" fill="${bg}"/>` +
  `<path d="${pathData(strokes)}" fill="none" stroke="${ink}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`;

sheets.forEach(([kind, seed], i) => {
  const out = svg(384, 256, '#000', '#cecece', record(PLOTS[kind], 384, 256, seed));
  const file = `plots/fig-${String(i + 1).padStart(2, '0')}.svg`;
  writeFileSync(new URL(`../${file}`, import.meta.url), out);
  console.log(file, kind, `${(out.length / 1024).toFixed(0)} KB`);
});
const p = svg(480, 360, '#fff', '#0000ff', record(portrait, 480, 360, 0x7e3));
writeFileSync(new URL('../plots/portrait.svg', import.meta.url), p);
console.log('plots/portrait.svg', `${(p.length / 1024).toFixed(0)} KB`);
