// Grevholt · "One pair, three lives" boot elevation.
// Bakes the SVG parts, the pinned stage, three static stills and the ESG mini boot
// into index.html between <!--@name--> … <!--/@name--> markers, so it all works without JS.
// Run: node work/grevholt/_src/boot.mjs   (from site/)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, '..', 'index.html');

// viewBox 0 0 1000 620, toe to the right, lug bottoms on y = 548
const C = {
  edge: '#2B190E',
  quarter: '#74492F', stay: '#5C3923', vamp: '#7A4D32', cap: '#66402A', counter: '#603B25',
  collar: '#3F2618', tab: '#352015', tongue: '#8A5E3F',
  hi: '#A87A57', thread: '#E6D7BC', welt: '#4A3023', sole: '#211F1C', soleTop: '#3A3631',
  worn: '#3A3530', eyelet: '#CFC7B8', eyeletIn: '#2A2522', lace: '#2B211B',
};
const f = (n) => +n.toFixed(1);

// cubic helper for points along the throat (lacing edge)
const cubic = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
};
const throat = [[420, 76], [424, 150], [440, 232], [470, 286]];
const tongueFront = [[465, 68], [470, 140], [482, 220], [500, 296]];

const eyelets = [0.1, 0.23, 0.36, 0.49, 0.62, 0.75, 0.88].map((t) => {
  const [x, y] = cubic(...throat, t);
  return [f(x - 17), f(y)];
});

/* ---------- parts (assembled positions) ---------- */
const lugs = (x0, x1, yTop, h, step, w, r = 2) => {
  let s = '';
  for (let x = x0; x <= x1; x += step) s += `<rect x="${x}" y="${yTop - 2}" width="${w}" height="${h + 2}" rx="${r}"/>`;
  return s;
};
const soleSlab = 'M128,492 L894,490 C910,492 914,506 904,514 C886,526 846,532 804,532 L432,532 C412,532 402,528 382,528 L348,528 C339,528 335,532 335,540 L138,540 C131,540 127,536 127,530 Z';
const parts = {
  sole: `<g fill="${C.sole}">${lugs(440, 780, 532, 9, 30, 18)}${lugs(146, 316, 540, 8, 28, 17)}<path d="${soleSlab}" stroke="#0E0D0C" stroke-width="2" stroke-linejoin="round"/></g>
    <path d="M136,497 L890,495" stroke="${C.soleTop}" stroke-width="3" fill="none"/>
    <path d="M140,516 L330,516 M440,515 L800,515" stroke="#000" stroke-opacity=".28" stroke-width="2" fill="none"/>`,
  // the same sole after nine years: lugs ground down, heel corner worn away, dusty
  soleWorn: `<g fill="${C.worn}">${lugs(444, 776, 532, 3, 30, 14, 1.5)}<path d="M128,492 L894,490 C910,492 914,506 904,514 C886,526 846,532 804,532 L432,532 C412,532 402,528 382,528 L348,528 C339,528 335,532 335,538 L168,538 C150,538 134,530 128,518 Z" stroke="#151311" stroke-width="2" stroke-linejoin="round"/></g>
    <path d="M150,526 C190,532 250,533 320,532 M470,525 C560,528 680,528 780,524" stroke="#77706A" stroke-opacity=".55" stroke-width="2" fill="none"/>
    <ellipse cx="166" cy="530" rx="26" ry="5" fill="#6B655E" opacity=".5"/>`,
  welt: `<path d="M132,472 L866,472 C892,472 906,480 905,491 L127,492 C125,484 127,476 132,472 Z" fill="${C.welt}" stroke="${C.edge}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M146,482.5 L884,482.5" stroke="${C.thread}" stroke-width="2.4" stroke-dasharray="7 6" fill="none"/>`,
  tongue: `<path d="M402,80 C406,62 418,50 436,48 C454,47 463,55 465,68 C470,140 482,220 500,296 L466,298 C450,230 434,150 420,76 Z" fill="${C.tongue}" stroke="${C.edge}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M416,60 C426,54 444,53 454,60" stroke="${C.hi}" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>`,
  vamp: `<path d="M438,472 C434,400 442,330 464,280 C505,330 570,362 640,376 C720,390 800,392 850,404 C892,414 908,440 906,472 Z" fill="${C.vamp}" stroke="${C.edge}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M512,330 C566,358 626,374 690,382" stroke="${C.hi}" stroke-width="3" stroke-linecap="round" fill="none" opacity=".45"/>`,
  cap: `<path d="M736,388 C716,414 710,446 712,472 L906,472 C908,440 892,414 850,404 C812,394 772,389 736,388 Z" fill="${C.cap}" stroke="${C.edge}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M800,402 C836,408 868,420 888,440" stroke="${C.hi}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".5"/>`,
  quarter: `<path d="M148,472 C134,440 132,392 142,350 C150,316 158,280 160,240 C162,190 160,140 166,92 C240,82 350,78 420,76 C424,150 440,232 470,286 C452,330 444,400 450,472 Z" fill="${C.quarter}" stroke="${C.edge}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M148,472 C134,440 132,392 142,350 C150,316 158,280 160,240 C162,190 160,140 166,92 L192,90 C186,140 188,190 186,240 C184,282 176,318 170,350 C164,392 166,440 176,472 Z" fill="${C.stay}" stroke="${C.edge}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M232,150 C300,140 360,138 404,140" stroke="${C.hi}" stroke-width="3" stroke-linecap="round" fill="none" opacity=".3"/>`,
  counter: `<path d="M148,472 C134,440 132,392 142,352 C200,336 270,346 312,380 C332,398 338,440 336,472 Z" fill="${C.counter}" stroke="${C.edge}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M160,362 C210,354 258,364 290,388" stroke="${C.hi}" stroke-width="3" stroke-linecap="round" fill="none" opacity=".35"/>`,
  tab: `<path d="M164,100 C160,78 162,60 168,50 C178,44 191,46 194,55 C196,72 194,90 190,106 Z" fill="${C.tab}" stroke="${C.edge}" stroke-width="2" stroke-linejoin="round"/>`,
  collar: `<path d="M166,92 C240,82 350,78 420,76 L424,102 C352,104 244,108 164,120 Z" fill="${C.collar}" stroke="${C.edge}" stroke-width="2" stroke-linejoin="round"/>`,
  shadow: `<ellipse cx="515" cy="552" rx="420" ry="14" fill="#000" opacity=".45"/>`,
  // patina that nine years of work leaves on the upper (sits over the assembled upper only)
  wear: `<path d="M148,472 C134,440 132,392 142,350 C150,316 158,280 160,240 C162,190 160,140 166,92 C240,82 350,78 420,76 C424,150 440,232 470,286 C505,330 570,362 640,376 C720,390 800,392 850,404 C892,414 908,440 906,472 Z" fill="#26150A" opacity=".24"/>
    <g fill="none" stroke="#2E1A0E" stroke-linecap="round" stroke-width="2.4" opacity=".7">
      <path d="M552,374 C582,390 618,398 654,398"/><path d="M566,362 C592,378 626,386 660,386"/><path d="M560,396 C590,410 622,416 652,416"/>
      <path d="M236,402 C252,396 270,398 284,406"/><path d="M380,300 C392,318 398,338 400,360"/>
    </g>
    <g fill="#C49770" opacity=".38"><ellipse cx="866" cy="438" rx="24" ry="9" transform="rotate(28 866 438)"/><ellipse cx="812" cy="418" rx="14" ry="5" transform="rotate(10 812 418)"/><ellipse cx="190" cy="430" rx="16" ry="7"/></g>`,
  stitches: `<g fill="none" stroke="${C.thread}" stroke-width="2.2" stroke-dasharray="6 5" stroke-linecap="round">
      <path d="M168,113 C244,102 352,98 422,96"/>
      <path d="M146,362 C202,347 268,356 305,388 C323,404 327,440 327,470"/>
      <path d="M462,290 C445,333 437,400 441,470"/><path d="M455,296 C438,338 430,400 434,470"/>
      <path d="M744,392 C725,416 719,446 721,470"/><path d="M753,395 C734,418 728,447 730,470"/>
      <path d="M184,98 C178,140 180,190 178,240 C176,282 168,318 162,350"/>
      <path d="M404,90 C410,150 425,222 450,282"/>
    </g>`,
  eyelets: eyelets.map(([x, y], i) => i < 2
    // top two are speed hooks
    ? `<g><path d="M${x - 4},${y + 6} L${x + 3},${y + 6} C${x + 12},${y + 6} ${x + 14},${y - 8} ${x + 5},${y - 9}" fill="none" stroke="${C.eyelet}" stroke-width="5" stroke-linecap="round"/><circle cx="${x - 4}" cy="${y + 6}" r="4" fill="${C.eyelet}"/></g>`
    : `<circle cx="${x}" cy="${y}" r="7" fill="${C.eyelet}" stroke="#6D665C" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="3" fill="${C.eyeletIn}"/>`).join(''),
  laces: (() => {
    let d = '';
    for (let i = eyelets.length - 1; i > 0; i--) {
      const [x, y] = eyelets[i];
      const [tx, ty] = cubic(...tongueFront, (i - 1) / (eyelets.length - 1) * 0.9 + 0.05);
      d += `M${x},${y} L${f(tx + 6)},${f(ty)} `;
    }
    return `<path d="${d}" fill="none" stroke="${C.lace}" stroke-width="5" stroke-linecap="round"/>
      <g fill="none" stroke="${C.lace}" stroke-width="5" stroke-linecap="round">
        <path d="M444,74 C418,36 384,42 396,62 C404,74 424,76 444,74"/><path d="M444,74 C470,34 508,42 496,64 C488,76 466,78 444,74"/>
        <path d="M444,74 C438,108 428,134 434,166"/><path d="M444,74 C454,104 462,124 458,154"/>
      </g><circle cx="444" cy="74" r="7" fill="${C.lace}"/>`;
  })(),
  spool: `<g transform="translate(846 92)">
      <rect x="-46" y="0" width="92" height="12" rx="3" fill="#BFB5A4"/><rect x="-46" y="104" width="92" height="12" rx="3" fill="#BFB5A4"/>
      <rect x="-36" y="12" width="72" height="92" fill="${C.thread}"/>
      <g stroke="#B8A98F" stroke-width="1.6">${Array.from({ length: 11 }, (_, i) => `<path d="M-36,${f(18 + i * 8)} L36,${f(16 + i * 8)}"/>`).join('')}</g>
    </g>
    <path d="M882,150 C922,166 944,196 930,226 C918,252 936,268 972,262" fill="none" stroke="${C.thread}" stroke-width="2.4" stroke-linecap="round"/>`,
};

/* ---------- explode table: [dx, dy, rot, cx, cy, assembly order] ---------- */
const X = {
  soleA:   [0, 128, 0, 510, 515, 0],
  welt:    [0, 70, 0, 512, 482, 1],
  vamp:    [160, -62, 4, 668, 390, 2],
  quarter: [-120, -30, -5, 300, 280, 3],
  counter: [-230, 108, 9, 236, 410, 4],
  cap:     [186, 44, 10, 806, 440, 5],
  tongue:  [44, -150, 7, 452, 176, 6],
  collar:  [-90, -118, -3, 294, 98, 7],
  tab:     [-180, -150, -14, 178, 76, 8],
};
const tf = (k, e) => {
  const [dx, dy, r, cx, cy] = X[k];
  if (!e) return '';
  return `translate(${f(dx * e)} ${f(dy * e)}) rotate(${f(r * e)} ${cx} ${cy})`;
};
const ORDER = ['soleA', 'welt', 'tongue', 'vamp', 'cap', 'quarter', 'counter', 'tab', 'collar'];
const href = { soleA: 'sole', welt: 'welt', tongue: 'tongue', vamp: 'vamp', cap: 'cap', quarter: 'quarter', counter: 'counter', tab: 'tab', collar: 'collar' };

/* ---------- snippets ---------- */
const sprite = `<svg class="sprite" aria-hidden="true" focusable="false" width="0" height="0"><defs>
${Object.entries(parts).map(([k, v]) => `  <g id="bp-${k}">${v}</g>`).join('\n')}
</defs></svg>`;

// beat-2 leader lines (stage + still 2): anchor → elbow → end
const LEADERS = [
  { id: 'a', d: 'M590,384 L620,152 L930,152', dot: [590, 384] },
  { id: 'b', d: 'M820,430 L856,300 L996,300', dot: [820, 430] },
  { id: 'c', d: 'M640,482 L640,590 L990,590', dot: [640, 482] },
];
const NUM = { a: [904, 136], b: [968, 284], c: [962, 574] }; // number tags on the static still, matching the facts list
const leaders = (cls) => LEADERS.map((l, i) => `<g class="${cls}" data-leader="${l.id}"><path d="${l.d}" pathLength="1"/><circle cx="${l.dot[0]}" cy="${l.dot[1]}" r="5"/>${cls === 'still__leader' ? `<text x="${NUM[l.id][0]}" y="${NUM[l.id][1]}">${i + 1}</text>` : ''}</g>`).join('');

const soleA = (extra = '', wornOpacity = 0, attrs = '') => `<g data-part="soleA"${attrs}${extra}><use href="#bp-sole"/><use class="boot__worn" href="#bp-soleWorn" opacity="${wornOpacity}"/></g>`;

const stage = `<svg class="boot" viewBox="0 0 1000 620" overflow="visible" focusable="false">
  <use data-part="shadow" href="#bp-shadow" opacity="0"/>
  ${soleA('', 0, ` data-x="${X.soleA.join(' ')}"`)}
  <use data-part="soleB" href="#bp-sole" opacity="0"/>
  ${ORDER.filter((k) => k !== 'soleA').map((k) => `<use data-part="${k}" href="#bp-${href[k]}" data-x="${X[k].join(' ')}"/>`).join('\n  ')}
  <use data-part="wear" href="#bp-wear" opacity="0"/>
  <use data-part="stitches" href="#bp-stitches" opacity="0"/>
  <use data-part="eyelets" href="#bp-eyelets" opacity="0"/>
  <use data-part="laces" href="#bp-laces" opacity="0"/>
  <use data-part="spool" href="#bp-spool"/>
  ${leaders('boot__leader')}
</svg>`;

// static states: 1 material (exploded), 2 build (assembled + leaders), 3 repair (worn upper, old sole dropped, new sole home)
const still = (state) => {
  const e = state === 1 ? 1 : 0;
  const uses = ORDER.filter((k) => k !== 'soleA').map((k) => `<use href="#bp-${href[k]}"${e ? ` transform="${tf(k, e)}"` : ''}/>`).join('');
  const sA = state === 3
    ? `<g transform="translate(0 92)" opacity=".38"><use href="#bp-soleWorn"/></g><use href="#bp-sole"/>`
    : `<g${e ? ` transform="${tf('soleA', e)}"` : ''}><use href="#bp-sole"/></g>`;
  const extras = state === 1 ? '<use href="#bp-spool"/>'
    : `${state === 3 ? '<use href="#bp-wear"/>' : ''}<use href="#bp-stitches"/><use href="#bp-eyelets"/><use href="#bp-laces"/>${state === 2 ? leaders('still__leader') : ''}`;
  const vb = state === 1 ? '-130 -120 1250 810' : '96 16 920 640';
  return `<svg class="life__still" viewBox="${vb}" aria-hidden="true" focusable="false">${state === 1 ? '' : '<use href="#bp-shadow"/>'}${sA}${uses}${extras}</svg>`;
};

const esg = `<svg class="esg-boot" viewBox="110 30 810 540" aria-hidden="true" focusable="false"><g class="esg-boot__upper">${ORDER.filter((k) => k !== 'soleA').map((k) => `<use href="#bp-${href[k]}"/>`).join('')}<use href="#bp-wear"/><use href="#bp-stitches"/><use href="#bp-eyelets"/><use href="#bp-laces"/></g><g class="esg-boot__sole"><use href="#bp-sole"/></g></svg>`;

let html = readFileSync(htmlPath, 'utf8');
const put = (name, body) => {
  const re = new RegExp(`(<!--@${name}-->)[\\s\\S]*?(<!--/@${name}-->)`);
  if (!re.test(html)) throw new Error(`marker ${name} missing`);
  html = html.replace(re, `$1\n${body}\n$2`);
};
put('sprite', sprite);
put('stage', stage);
put('still1', still(1));
put('still2', still(2));
put('still3', still(3));
put('esgboot', esg);
writeFileSync(htmlPath, html);
console.log('baked', Object.keys(parts).length, 'parts');
