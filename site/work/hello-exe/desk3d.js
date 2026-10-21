/* hello.exe: the desktop icons as inflated 3D objects.
   Each icon is a few puffy parts (pillows, tubes, chrome text) stacked on each other, drawn in one small
   canvas behind the real icon buttons. The buttons keep the labels, focus and clicks. */
import { THREE, damp, clamp, makeRenderer, rasterDraw, inflate, materials } from './chrome.js?v=10';

const U = 128;        // design units per icon
const R = 168;        // raster px per icon
const K = R / U;

// part helpers: draw in design units, inflate in raster px, return a mesh in design units
const shapes = {
  rr: (x, y, w, h, r) => (c) => { c.beginPath(); c.roundRect(x * K, y * K, w * K, h * K, r * K); c.fill(); },
  circle: (x, y, r) => (c) => { c.beginPath(); c.arc(x * K, y * K, r * K, 0, Math.PI * 2); c.fill(); },
  poly: (pts) => (c) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * K, y * K) : c.moveTo(x * K, y * K))); c.closePath(); c.fill(); },
  stroke: (pts, w) => (c) => { c.lineWidth = w * K; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * K, y * K) : c.moveTo(x * K, y * K))); c.stroke(); },
  text: (str, size, x, y) => (c) => { c.font = `900 ${size * K}px "Unbounded", "Arial Black", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(str, x * K, y * K); },
  all: (...fns) => (c) => fns.forEach((f) => f(c)),
};

function part(draw, mat, { cap = 0, puff = 0.9, z = 0, round = 2.5, smooth = 3 } = {}) {
  const res = inflate(rasterDraw(R, R, draw), { round, smooth, step: 2, puff, cap, scale: 1 / K });
  const mesh = new THREE.Mesh(res.geo, mat);
  mesh.position.z = z;
  mesh.userData.depth = res.depth;
  return mesh;
}

function buildIcons() {
  const M = {
    chrome: materials.chrome(),
    satin: materials.satin(),
    pearl: Object.assign(materials.plastic('#F7F9FC', 0.24), { emissive: new THREE.Color('#FFFFFF'), emissiveIntensity: 0.16 }),
    shade: materials.plastic('#D5DFEB', 0.3),
    blue: materials.plastic('#2C7BDC', 0.18),
    sky: materials.plastic('#7DB3EC', 0.2),
    navy: materials.plastic('#3E7FCF', 0.2),
    sun: materials.plastic('#FFB547', 0.22),
    ceramic: Object.assign(materials.plastic('#EEF4FB', 0.28), { emissive: new THREE.Color('#FFFFFF'), emissiveIntensity: 0.12 }),
  };
  const { rr, circle, poly, stroke, text, all } = shapes;
  const icon = (...parts) => { const g = new THREE.Group(); parts.forEach((p) => g.add(p)); return g; };

  // readme.txt: a pearl page with a folded corner and four blue lines
  const page = part(poly([[30, 8], [78, 8], [100, 30], [100, 120], [30, 120]]), M.pearl, { cap: 9 });
  const readme = icon(
    page,
    part(poly([[78, 8], [100, 30], [78, 30]]), M.shade, { cap: 4, z: page.userData.depth * 0.7 }),
    part(all(rr(42, 46, 44, 8, 4), rr(42, 62, 44, 8, 4), rr(42, 78, 30, 8, 4), rr(42, 94, 40, 8, 4)), M.blue, { cap: 0, puff: 0.8, z: page.userData.depth * 0.85 }),
  );

  // linha.app: a blue gel tile with a white route
  const tile = part(rr(10, 10, 108, 108, 30), M.blue, { cap: 13 });
  const linha = icon(
    tile,
    part(all(stroke([[32, 86], [54, 86], [72, 46], [96, 46]], 12), circle(32, 86, 11), circle(96, 46, 11)), M.pearl, { cap: 0, puff: 0.85, z: tile.userData.depth * 0.85 }),
  );

  // nimbus98.exe: a cloud in front of a sun
  const nimbus = icon(
    part(circle(84, 42, 26), M.sun, { cap: 0, puff: 0.75, z: -6 }),
    part(all(circle(40, 82, 21), circle(64, 64, 28), circle(90, 80, 20), rr(26, 78, 82, 30, 15)), M.pearl, { cap: 12, z: 4 }),
  );

  // azulejo.ttf: a ceramic tile with chrome letters and four corner dots
  const tileC = part(rr(14, 14, 100, 100, 18), M.ceramic, { cap: 7 });
  const azulejo = icon(
    tileC,
    part(text('Aa', 46, 64, 66), M.chrome, { cap: 0, puff: 0.85, z: tileC.userData.depth * 0.8, round: 1.5, smooth: 2 }),
    part(all(circle(30, 30, 6), circle(98, 30, 6), circle(30, 98, 6), circle(98, 98, 6)), M.sky, { cap: 0, puff: 0.8, z: tileC.userData.depth * 0.8 }),
  );

  // pocketfm.dmg: a satin box with two chrome knobs and a blue led
  const box = part(rr(6, 30, 116, 70, 22), M.satin, { cap: 11 });
  const pocket = icon(
    box,
    part(all(circle(42, 65, 21), circle(90, 65, 15)), M.chrome, { cap: 0, puff: 0.7, z: box.userData.depth * 0.85 }),
    part(circle(66, 42, 5), M.blue, { cap: 0, z: box.userData.depth * 0.9 }),
  );

  // granite: a folder with a front flap and a chrome diamond
  const back = part(all(rr(10, 28, 108, 82, 14), rr(10, 16, 46, 30, 12)), M.navy, { cap: 8 });
  const front = part(rr(10, 44, 108, 70, 14), M.sky, { cap: 9, z: back.userData.depth * 0.7 });
  const granite = icon(
    back, front,
    part(poly([[64, 64], [78, 79], [64, 94], [50, 79]]), M.chrome, { cap: 0, puff: 0.8, z: back.userData.depth * 0.7 + front.userData.depth * 0.85 }),
  );

  // Recycle Bin: a chrome bin with a rim, ridges and a crumpled page peeking out
  const body = part(poly([[28, 34], [100, 34], [91, 120], [37, 120]]), M.satin, { cap: 10 });
  const paper = part(all(circle(58, 20, 13), circle(72, 24, 10)), M.pearl, { cap: 0, puff: 0.8, z: -2 });
  const bin = icon(
    paper,
    body,
    part(stroke([[48, 50], [51, 106]], 6), M.chrome, { cap: 0, z: body.userData.depth * 0.85 }),
    part(stroke([[64, 50], [64, 106]], 6), M.chrome, { cap: 0, z: body.userData.depth * 0.85 }),
    part(stroke([[80, 50], [77, 106]], 6), M.chrome, { cap: 0, z: body.userData.depth * 0.85 }),
    part(rr(18, 26, 92, 16, 8), M.chrome, { cap: 0, puff: 0.8, z: body.userData.depth * 0.4 }),
  );
  bin.userData.paper = paper;

  return [readme, linha, nimbus, azulejo, pocket, granite, bin];
}

export function createDeskIcons(canvas, buttons, { reduced = false, theme = 'a' } = {}) {
  const { renderer, scene, setEnv } = makeRenderer(canvas, theme);
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -400, 400);
  camera.position.z = 200;

  const shadowGeo = new THREE.CircleGeometry(0.5, 40);
  const icons = buildIcons().map((obj, i) => {
    const pivot = new THREE.Group();     // springs and pointer tilt
    pivot.add(obj);
    const holder = new THREE.Group();    // placement over the button
    // a hard-edged floor shadow that shrinks as the icon lifts
    const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color: '#0E2240', transparent: true, opacity: 0.16, depthWrite: false }));
    shadow.position.set(0, -U * 0.56, -60);
    holder.add(shadow);
    holder.add(pivot);
    scene.add(holder);
    return {
      holder, pivot, obj, shadow, phase: i * 1.7,
      hover: 0, hoverT: 0, sel: false,
      hop: 0, hopV: 0, sq: 0, sqV: 0, spin: 0, spinT: 0, press: 0, pressT: 0,
      size: 56,
    };
  });

  let w = 1, h = 1, ptX = -1e4, ptY = -1e4;
  function layout() {
    w = canvas.clientWidth; h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.left = 0; camera.right = w; camera.top = 0; camera.bottom = -h;
    camera.updateProjectionMatrix();
    const cr = canvas.getBoundingClientRect();
    buttons.forEach((btn, i) => {
      const art = btn.querySelector('svg') || btn;
      const r = art.getBoundingClientRect();
      const ic = icons[i];
      ic.size = r.width * 1.18;
      ic.holder.position.set(r.left - cr.left + r.width / 2, -(r.top - cr.top + r.height / 2), 0);
      ic.holder.scale.setScalar(ic.size / U);
    });
  }

  let t = 0;
  function step(dt) {
    t += dt;
    icons.forEach((ic) => {
      ic.hover = damp(ic.hover, ic.hoverT, 12, dt);
      ic.press = damp(ic.press, ic.pressT, 22, dt);
      for (let k = 0; k < 2; k++) {
        const h2 = dt / 2;
        ic.hopV += (-ic.hop * 260 - ic.hopV * 14) * h2; ic.hop += ic.hopV * h2;
        ic.sqV += (-ic.sq * 300 - ic.sqV * 12) * h2; ic.sq += ic.sqV * h2;
      }
      ic.spin = damp(ic.spin, ic.spinT, 5, dt);
      // tilt toward the pointer while hovered
      const hp = ic.holder.position;
      const dx = clamp((ptX - hp.x) / 60, -1, 1), dy = clamp((-ptY - hp.y) / 60, -1, 1);
      const p = ic.pivot;
      const idle = reduced ? 0 : 1;
      p.rotation.y = Math.sin(t * 0.9 + ic.phase) * 0.26 * idle + dx * 0.5 * ic.hover + ic.spin;
      p.rotation.x = 0.18 + Math.sin(t * 0.7 + ic.phase) * 0.07 * idle - dy * 0.4 * ic.hover;
      p.rotation.z = Math.sin(t * 0.6 + ic.phase) * 0.03 * idle;
      p.position.y = (Math.sin(t * 1.3 + ic.phase) * 1.6 * idle + ic.hover * 5 + ic.hop * 1) * (U / ic.size);
      const s = 1 + ic.hover * 0.12 - ic.press * 0.1;
      const air = Math.max(0, ic.hover * 0.6 + ic.hop * 0.03);
      ic.shadow.scale.set(U * 0.74 * (1 - air * 0.3), U * 0.13 * (1 - air * 0.3), 1);
      ic.shadow.material.opacity = 0.16 * (1 - air * 0.5);
      p.scale.set(s * (1 + ic.sq * 0.12), s * (1 - ic.sq * 0.12), s * (1 + ic.sq * 0.25));
    });
  }
  const render = () => { if (!document.hidden) renderer.render(scene, camera); };

  let running = false, active = true, last = performance.now();
  const frame = (now) => { const dt = Math.min((now - last) / 1000, 0.05); last = now; step(dt); render(); };
  const sync = () => {
    const on = !reduced && active;
    if (on && !running) { running = true; last = performance.now(); renderer.setAnimationLoop(frame); }
    if (!on && running) { running = false; renderer.setAnimationLoop(null); }
  };
  const still = () => { if (!running && !document.hidden) { step(0.016); render(); } };

  layout();
  step(0.016);
  render();

  return {
    start() { active = true; sync(); still(); },
    stop() { active = false; sync(); },
    resize() { layout(); still(); },
    setTheme(th) { setEnv(th); still(); },
    point(x, y) { ptX = x; ptY = y; },
    hover(i, on) { icons[i].hoverT = on ? 1 : 0; still(); },
    press(i, on) { icons[i].pressT = on ? 1 : 0; },
    select(set) {
      icons.forEach((ic, i) => {
        const on = set.has(i);
        if (on && !ic.sel) ic.hopV += 120; // a little hop when picked
        ic.sel = on;
      });
    },
    open(i) { const ic = icons[i]; ic.sqV += 9; ic.spinT += Math.PI * 2; ic.hopV += 160; still(); },
    refill(i) {
      const paper = icons[i].obj.userData.paper;
      if (paper) paper.visible = true;
      icons[i].hopV += 140;
      still();
    },
    empty(i) {
      const paper = icons[i].obj.userData.paper;
      if (paper) paper.visible = false;
      icons[i].sqV += 12;
      still();
    },
  };
}
