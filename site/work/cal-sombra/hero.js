/* Cal & Sombra — hero study model.
   Eleven white slabs on a transparent canvas; their shadows fall on the page. Scroll sets the sun
   and tips the camera from a low oblique into plan, where SVG dimension lines draw themselves on. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.min.js';
import { SLABS, PLAN, sunAt, sunVector } from './sun.js?v=15';

const RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fmt = (n) => `${n.toFixed(1)} m`;

export function createHero({ canvas, overlay, lowPower = false, finePointer = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap was folded into PCFShadowMap in r18x; shadow.radius gives the soft edge.
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 400);

  /* ---------- the model ---------- */
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.12 });
  const model = new THREE.Group();
  for (const [x0, z0, x1, z1, h, base, rot] of SLABS) {
    const geo = new THREE.BoxGeometry(x1 - x0, h, z1 - z0);
    const mesh = new THREE.Mesh(geo, white);
    mesh.position.set((x0 + x1) / 2, base + h / 2, (z0 + z1) / 2);
    mesh.rotation.y = -rot * RAD;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
    mesh.add(edges);
    model.add(mesh);
  }
  scene.add(model);

  // the page is the ground: only the shadow is drawn
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.13 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // physical light units: a white card model wants roughly π × the legacy intensities
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd2d2d2, 3.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(lowPower ? 1024 : 1536);
  sun.shadow.radius = 5;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 });
  scene.add(sun, sun.target);

  /* ---------- dimension overlay (SVG, projected from the plan every frame) ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent = overlay) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  };
  const { x0, z0, x1, z1, court, courtZ } = PLAN;
  const off = 1.9;
  // each line is a list of 3D points on the ground; they draw on in this order
  const lines = [
    [[x0, z1 + 0.4], [x0, z1 + off + 0.5]], [[x1, z1 + 0.4], [x1, z1 + off + 0.5]], [[x0, z1 + off], [x1, z1 + off]],
    [[x1 + 0.4, z0], [x1 + off + 0.5, z0]], [[x1 + 0.4, z1], [x1 + off + 0.5, z1]], [[x1 + off, z0], [x1 + off, z1]],
    [[court[0], courtZ], [court[1], courtZ]],
    [[x0 + 0.4, z0 - 1.2], [x0 + 0.4, z0 - 3.4]]
  ].map((pts) => ({ pts, node: el('path', { pathLength: 1, class: 'dim__line' }) }));
  const ticks = [[x0, z1 + off], [x1, z1 + off], [x1 + off, z0], [x1 + off, z1], [court[0], courtZ], [court[1], courtZ]]
    .map((pt) => ({ pt, node: el('path', { class: 'dim__tick' }) }));
  const north = { pt: [x0 + 0.4, z0 - 1.2], node: el('circle', { class: 'dim__line', r: 9, pathLength: 1 }) };
  const labels = [
    { pt: [(x0 + x1) / 2, z1 + off], text: fmt(x1 - x0), dy: -8 },
    { pt: [x1 + off, z0 + (z1 - z0) * 0.8], text: fmt(z1 - z0), dy: -8, along: true },
    { pt: [(court[0] + court[1]) / 2, courtZ], text: fmt(court[1] - court[0]), dy: -8 },
    { pt: [x0 + 0.4, z0 - 3.4], text: 'N', dy: -8 },
    { pt: [7.2, -4.95], text: '+7.20', dy: 4 },
    { pt: [-2.6, -6.075], text: '+5.40', dy: -7 },
    { pt: [-6.1, -3.7], text: '+3.45', dy: 4 }
  ].map((l) => ({ ...l, node: Object.assign(el('text', { class: 'dim__label', 'text-anchor': 'middle' }), { textContent: l.text }) }));

  const v = new THREE.Vector3();
  let W = 1, H = 1;
  const toScreen = ([x, z], y = 0) => {
    v.set(x, y, z).project(camera);
    return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
  };

  function drawOverlay(p) {
    const show = p > 0.5;
    overlay.style.visibility = show ? 'visible' : 'hidden';
    if (!show) return;
    lines.forEach((l, i) => {
      const s = l.pts.map((pt) => toScreen(pt));
      l.node.setAttribute('d', `M${s[0][0].toFixed(1)} ${s[0][1].toFixed(1)}L${s[1][0].toFixed(1)} ${s[1][1].toFixed(1)}`);
      l.node.style.strokeDashoffset = 1 - smooth(0.56 + i * 0.03, 0.8 + i * 0.03, p);
    });
    const tk = smooth(0.78, 0.9, p);
    ticks.forEach((t) => {
      const [x, y] = toScreen(t.pt);
      t.node.setAttribute('d', `M${(x - 5).toFixed(1)} ${(y + 5).toFixed(1)}L${(x + 5).toFixed(1)} ${(y - 5).toFixed(1)}`);
      t.node.style.opacity = tk;
    });
    const [nx, ny] = toScreen(north.pt);
    north.node.setAttribute('cx', nx.toFixed(1));
    north.node.setAttribute('cy', ny.toFixed(1));
    north.node.style.strokeDashoffset = 1 - smooth(0.7, 0.9, p);
    const lo = smooth(0.82, 0.96, p);
    labels.forEach((l) => {
      let [x, y] = toScreen(l.pt);
      let rot = '';
      if (l.along) {
        const [ax, ay] = toScreen([l.pt[0], z0]);
        const [bx, by] = toScreen([l.pt[0], z1]);
        const a = Math.atan2(by - ay, bx - ax) / RAD;
        rot = ` rotate(${(a - 180).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`;
        x += 14;
      }
      l.node.setAttribute('x', x.toFixed(1));
      l.node.setAttribute('y', (y + l.dy).toFixed(1));
      l.node.setAttribute('transform', rot.trim());
      l.node.style.opacity = lo;
    });
  }

  /* ---------- camera ---------- */
  const pose = { R: 40, anchor: [0.5, 0.5] };
  function frame() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    const aspect = W / H;
    const k = 2 * Math.tan(camera.fov / 2 * RAD);
    const portrait = aspect < 0.9;
    // plan fit: the model plus its dimension strings take ~60% of the height, ~70% of the width
    const fitH = (z1 - z0 + 5) / (portrait ? 0.42 : 0.6) / k;
    const fitW = (x1 - x0 + 7) / (portrait ? 0.98 : 0.66) / (k * aspect);
    pose.R = Math.max(fitH, fitW);
    pose.anchor = portrait ? [0.5, 0.53] : [0.575, 0.47];
    renderer.setSize(W, H, false);
    camera.aspect = aspect;
  }

  const state = { p: 0, hour: 7, yaw: 0, pitch: 0, ty: 0, tp: 0 };
  function update() {
    const t = smooth(0.12, 0.86, state.p);
    const phi = lerp(27, 90, t) * RAD + state.pitch;
    const theta = lerp(-16, 0, t) * RAD + state.yaw;
    const R = pose.R * lerp(1.04, 1, t);
    const target = [lerp(0.6, 0, t), lerp(1.6, 0, t), lerp(0.4, 0, t)];
    camera.position.set(
      target[0] + R * Math.cos(phi) * Math.sin(theta),
      target[1] + R * Math.sin(phi),
      target[2] + R * Math.cos(phi) * Math.cos(theta)
    );
    camera.rotation.set(-phi, theta, 0, 'YXZ');
    const [ax, ay] = pose.anchor;
    camera.setViewOffset(W, H, (0.5 - lerp(ax + 0.025, ax, t)) * W, (0.5 - lerp(ay + 0.08, ay, t)) * H, W, H);
    camera.updateProjectionMatrix();

    const { el, az } = sunAt(state.hour);
    const s = sunVector(Math.max(el, 7), az);
    sun.position.set(s[0] * 60, s[1] * 60, s[2] * 60);
    edgeMat.opacity = lerp(0.1, 0.32, t);

    renderer.render(scene, camera);
    drawOverlay(state.p);
  }

  /* ---------- loop: render only while something is moving ---------- */
  let raf = 0, active = false, dirty = true;
  const tick = () => {
    raf = 0;
    if (!active) return;
    // pointer orbit eases toward its target
    const dy = state.ty - state.yaw, dp = state.tp - state.pitch;
    const moving = Math.abs(dy) > 1e-4 || Math.abs(dp) > 1e-4;
    if (moving) { state.yaw += dy * 0.08; state.pitch += dp * 0.08; }
    if (dirty || moving) { dirty = false; update(); }
    if (moving) raf = requestAnimationFrame(tick);
  };
  const kick = () => { dirty = true; if (active && !raf) raf = requestAnimationFrame(tick); };

  if (finePointer) {
    window.addEventListener('pointermove', (e) => {
      state.ty = ((e.clientX / window.innerWidth) - 0.5) * 5 * RAD;
      state.tp = ((e.clientY / window.innerHeight) - 0.5) * -2.5 * RAD;
      kick();
    }, { passive: true });
  }

  frame();
  update();

  return {
    set(p, hour) {
      if (p === state.p && hour === state.hour) return;
      state.p = p; state.hour = hour;
      kick();
    },
    setActive(on) {
      active = on;
      if (on) kick();
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    },
    resize() { frame(); dirty = true; update(); }
  };
}
