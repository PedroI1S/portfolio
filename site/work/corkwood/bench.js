/* Corkwood Public — the Sobreiro bench specimen (Three.js r170).
   One renderer and one model, shared by the hero assembly and the configurator.
   Parts are instanced (slats, blocks, brackets, frames, bolts) so the scene stays under 12 meshes. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const { clamp, lerp, degToRad } = THREE.MathUtils;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const seg = (v, a, b) => clamp((v - a) / (b - a), 0, 1);

/* ---------- Dimensions (metres) ---------- */
const SEAT_H = 0.45;
const SLAT_T = 0.075;
const SLAT_W = 0.104;
const GAP = 0.011;
const SEAT_D = 4 * SLAT_W + 3 * GAP;
const BLOCK_W = 0.27;
const BLOCK_H = SEAT_H - SLAT_T;
const BLOCK_D = 0.42;
const TILT = 0.22;                 // backrest lean, radians
const BACK_W = SLAT_W;            // back slats are the same part as seat slats
const BACK_GAP = 0.014;
const BACK_BASE = 0.045;           // gap between seat and lowest back slat
const END = 0.16;                 // block centre from the bench end
const BAYS = { '1.6': 1, '1.8': 1, '2.0': 2, '2.4': 3 };
const HERO_LEN = '1.8';           // the specimen in the hero matches the photograph's proportions
const MAX_SUP = 4;
const MAX_SLATS = 21;
const MAX_BOLTS = 16;
const SEAT_ROWS = 4;
const ROWS = 7;

const UP = new THREE.Vector3(0, 1, 0);
const BACK_U = new THREE.Vector3(0, Math.cos(TILT), -Math.sin(TILT));
const BACK_N = new THREE.Vector3(0, Math.sin(TILT), Math.cos(TILT));
const BACK_O = new THREE.Vector3(0, SEAT_H + BACK_BASE, -SEAT_D / 2 + SLAT_T * 0.5 - 0.012);
const BACK_TOP = 3 * BACK_W + 2 * BACK_GAP;
const BRACKET_C = BACK_O.clone().addScaledVector(BACK_U, (-0.33 + BACK_TOP - 0.015) / 2).addScaledVector(BACK_N, -(SLAT_T / 2 + 0.006));
const Q_ID = new THREE.Quaternion();
const Q_BACK = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -(Math.PI / 2 + TILT));
const Q_BRACKET = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -TILT);

const COLORS = {
  graphite: new THREE.Color('#3d3b39'),
  clay: new THREE.Color('#b8694c'),
  steel: new THREE.Color('#b9b5ae'),
  key: new THREE.Color('#2b2826'),
};

const seatZ = (r) => SEAT_D / 2 - SLAT_W / 2 - r * (SLAT_W + GAP);
const backCentre = (k) => BACK_O.clone().addScaledVector(BACK_U, k * (BACK_W + BACK_GAP) + BACK_W / 2);

/* ---------- Layout: where every instance sits for a given length ---------- */
function layout(len) {
  const N = BAYS[len];
  const L = +len;
  const sx = [];
  for (let s = 0; s <= N; s++) sx.push(-(L / 2 - END) + (s * (L - 2 * END)) / N);
  const edges = [-L / 2, ...sx.slice(1, N), L / 2];
  const slats = [];
  for (let b = 0; b < N; b++) {
    const x0 = edges[b] + (b > 0 ? 0.003 : 0);
    const x1 = edges[b + 1] - (b < N - 1 ? 0.003 : 0);
    const cx = (x0 + x1) / 2;
    const len1 = x1 - x0;
    for (let r = 0; r < ROWS; r++) {
      if (r < SEAT_ROWS) slats.push({ pos: new THREE.Vector3(cx, SEAT_H - SLAT_T / 2, seatZ(r)), quat: Q_ID, len: len1, bay: b, row: r });
      else {
        const c = backCentre(r - SEAT_ROWS);
        slats.push({ pos: new THREE.Vector3(cx, c.y, c.z), quat: Q_BACK, len: len1, bay: b, row: r });
      }
    }
  }
  const supports = sx.map((x) => ({ x }));
  const bolts = [];
  sx.forEach((x, s) => {
    for (let r = 0; r < SEAT_ROWS; r++) bolts.push({ pos: new THREE.Vector3(x, SEAT_H + 0.004, seatZ(r)), sup: s, row: r });
  });
  return { N, L, sx, slats, supports, bolts };
}

/* ---------- Geometry ---------- */
function frameGeometry() {
  // One side frame in the YZ plane: front leg, seat rail, rear leg, and a back post that follows the backrest.
  const r = 0.016;
  const yTop = SEAT_H - SLAT_T - r;
  const zf = SEAT_D / 2 - 0.05;
  const zb = -SEAT_D / 2 + 0.04;
  const k = 0.05;
  const P = (z, y) => new THREE.Vector3(0, y, z);
  const u = new THREE.CurvePath();
  u.add(new THREE.LineCurve3(P(zf, 0), P(zf, yTop - k)));
  u.add(new THREE.QuadraticBezierCurve3(P(zf, yTop - k), P(zf, yTop), P(zf - k, yTop)));
  u.add(new THREE.LineCurve3(P(zf - k, yTop), P(zb + k, yTop)));
  u.add(new THREE.QuadraticBezierCurve3(P(zb + k, yTop), P(zb, yTop), P(zb - 0.006, yTop - k)));
  u.add(new THREE.LineCurve3(P(zb - 0.006, yTop - k), P(zb - 0.03, 0)));
  // back post: from the rear rail up behind the back slats
  const post0 = BACK_O.clone().addScaledVector(BACK_U, -0.06).addScaledVector(BACK_N, -(SLAT_T / 2 + r));
  const post1 = BACK_O.clone().addScaledVector(BACK_U, BACK_TOP - 0.02).addScaledVector(BACK_N, -(SLAT_T / 2 + r));
  const p = new THREE.CurvePath();
  p.add(new THREE.QuadraticBezierCurve3(P(zb + k * 0.4, yTop), P(post0.z + 0.01, yTop), post0));
  p.add(new THREE.LineCurve3(post0, post1));
  const g1 = new THREE.TubeGeometry(u, 96, r, 10, false);
  const g2 = new THREE.TubeGeometry(p, 40, r, 10, false);
  const cap = (pt) => new THREE.SphereGeometry(r, 10, 6).translate(pt.x, pt.y, pt.z);
  return mergeGeometries([g1, g2, cap(post1)].map((g) => g.toNonIndexed()));
}

function boltGeometry() {
  const head = new THREE.CylinderGeometry(0.012, 0.012, 0.008, 6).toNonIndexed();
  const washer = new THREE.CylinderGeometry(0.016, 0.016, 0.002, 18).translate(0, -0.005, 0).toNonIndexed();
  const shank = new THREE.CylinderGeometry(0.0045, 0.0045, 0.11, 8).translate(0, -0.06, 0).toNonIndexed();
  return mergeGeometries([head, washer, shank]);
}

function keyGeometry() {
  // drawn a little over life size so it reads at hero scale
  const r = 0.0065;
  const long = new THREE.CylinderGeometry(r, r, 0.18, 6).translate(0, 0.09, 0).toNonIndexed();
  const short = new THREE.CylinderGeometry(r, r, 0.075, 6).rotateZ(Math.PI / 2).translate(0.034, 0.18, 0).toNonIndexed();
  const knee = new THREE.SphereGeometry(r, 6, 4).translate(0, 0.18, 0).toNonIndexed();
  return mergeGeometries([long, short, knee]);
}

function shadowBlobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.25)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noiseTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 40;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

/* Per-instance UV offset/flip/scale so the same photo crop never repeats on neighbouring parts. */
function withInstanceUv(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aUv;')
      .replace('#include <uv_vertex>', [
        '#include <uv_vertex>',
        '#ifdef USE_MAP',
        '  vMapUv = vec2(vMapUv.x * aUv.z + aUv.x, mix(vMapUv.y, 1.0 - vMapUv.y, aUv.y));',
        '#endif',
        '#ifdef USE_BUMPMAP',
        '  vBumpMapUv = vec2(vBumpMapUv.x * aUv.z + aUv.x, mix(vBumpMapUv.y, 1.0 - vBumpMapUv.y, aUv.y));',
        '#endif',
      ].join('\n'));
  };
  material.customProgramCacheKey = () => 'instance-uv';
  return material;
}

function instancedUv(geometry, count, fn) {
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [o, f, s] = fn(i);
    arr.set([o, f, s], i * 3);
  }
  geometry.setAttribute('aUv', new THREE.InstancedBufferAttribute(arr, 3));
  return geometry.getAttribute('aUv');
}

/* Deterministic pseudo-random per index */
const hash = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* ---------- Labels for the hover callouts ---------- */
function labelFor(kind, i, ctx) {
  const n = String(i + 1).padStart(2, '0');
  if (kind === 'slat') return `Slat ${n} · maritime pine · replaced in two minutes`;
  if (kind === 'block') return `Block ${n} · pressed cork · lifts out with four bolts`;
  if (kind === 'bolt') return `Bolt ${n} · stainless M10 · one key fits every bolt`;
  if (kind === 'frame') return `Frame ${n} · recycled steel · powder-coated ${ctx.base === 'clay' ? 'clay' : 'graphite'}`;
  if (kind === 'bracket') return `Back bracket ${n} · recycled steel · bolts into the block`;
  return 'Hex key · 8 mm · the only tool a bench ever needs';
}

/* ======================================================================= */
export async function createBench(canvas, opts = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.still });
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);

  /* Lights: a soft key from the front left (shadows fall back and right, as in the photographs) */
  const hemi = new THREE.HemisphereLight(0xfdf8f0, 0xcdb79c, 0.75);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff3e4, 2.1);
  key.position.set(-2.4, 3.6, 2.8);
  key.castShadow = true;
  key.shadow.mapSize.set(opts.mobile ? 1024 : 2048, opts.mobile ? 1024 : 2048);
  key.shadow.camera.left = -2;
  key.shadow.camera.right = 2;
  key.shadow.camera.top = 2;
  key.shadow.camera.bottom = -2;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 10;
  key.shadow.radius = 9;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xf3efe8, 0.45);
  fill.position.set(2.5, 1.2, 1.5);
  scene.add(fill);

  /* Textures */
  const loader = new THREE.TextureLoader();
  const load = (url) => new Promise((res) => loader.load(url, res, undefined, () => res(null)));
  const [pineTex, corkTex] = await Promise.all([load(opts.pine || 'img/tex-pine.jpg'), load(opts.cork || 'img/tex-cork.jpg')]);
  [pineTex, corkTex].forEach((t) => {
    if (!t) return;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  });
  if (pineTex) { pineTex.wrapS = THREE.MirroredRepeatWrapping; pineTex.wrapT = THREE.MirroredRepeatWrapping; }
  if (corkTex) { corkTex.wrapS = corkTex.wrapT = THREE.RepeatWrapping; }

  /* Materials: matte, museum-lit */
  const pineMat = withInstanceUv(new THREE.MeshStandardMaterial({ color: 0xffffff, map: pineTex, roughness: 0.74, bumpMap: pineTex, bumpScale: 0.35, envMapIntensity: 0.7 }));
  const corkMat = withInstanceUv(new THREE.MeshStandardMaterial({ color: 0xffffff, map: corkTex, roughness: 0.96, bumpMap: corkTex, bumpScale: 1.4, envMapIntensity: 0.5 }));
  const noise = noiseTexture();
  const frameMat = new THREE.MeshStandardMaterial({ color: COLORS.graphite.clone(), roughness: 0.52, metalness: 0.15, bumpMap: noise, bumpScale: 0.25 });
  const bracketMat = new THREE.MeshStandardMaterial({ color: COLORS.graphite.clone(), roughness: 0.55, metalness: 0.15, bumpMap: noise, bumpScale: 0.25 });
  const boltMat = new THREE.MeshStandardMaterial({ color: COLORS.steel, roughness: 0.38, metalness: 0.75 });
  const keyMat = new THREE.MeshStandardMaterial({ color: COLORS.key, roughness: 0.45, metalness: 0.6 });

  /* Meshes */
  const slatGeo = new RoundedBoxGeometry(1, SLAT_T, SLAT_W, 4, 0.018);
  const slatUv = instancedUv(slatGeo, MAX_SLATS, (i) => [hash(i) * 2, hash(i + 40) > 0.5 ? 1 : 0, 1]);
  const slats = new THREE.InstancedMesh(slatGeo, pineMat, MAX_SLATS);

  const blockGeo = new RoundedBoxGeometry(BLOCK_W, BLOCK_H, BLOCK_D, 4, 0.024);
  instancedUv(blockGeo, MAX_SUP, (i) => [hash(i + 7), hash(i + 9) > 0.5 ? 1 : 0, 1]);
  const blocks = new THREE.InstancedMesh(blockGeo, corkMat, MAX_SUP);

  const bracketLen = BACK_TOP + 0.33 - 0.015;
  const bracketGeo = new THREE.BoxGeometry(0.045, bracketLen, 0.012);
  const brackets = new THREE.InstancedMesh(bracketGeo, bracketMat, MAX_SUP);

  const frames = new THREE.InstancedMesh(frameGeometry(), frameMat, MAX_SUP);
  const bolts = new THREE.InstancedMesh(boltGeometry(), boltMat, MAX_BOLTS);
  const keyMesh = new THREE.Mesh(keyGeometry(), keyMat);

  const blobTex = shadowBlobTexture();
  const blobs = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: 0x2a1d12, opacity: 0.85 }),
    MAX_SUP
  );
  blobs.renderOrder = 1;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ color: 0x3b2817, opacity: 0.2, depthWrite: false }));
  ground.receiveShadow = true;
  ground.renderOrder = 0;

  const bench = new THREE.Group();
  [slats, blocks, brackets, frames, bolts, keyMesh].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    bench.add(m);
  });
  scene.add(ground, blobs, bench);

  const white = new THREE.Color(1, 1, 1);
  const glow = new THREE.Color(1.12, 1.08, 1.0);
  [slats, blocks, brackets, frames, bolts].forEach((m) => {
    for (let i = 0; i < m.count; i++) m.setColorAt(i, white);
    m.instanceColor.needsUpdate = true;
  });

  /* ---------- State ---------- */
  const state = {
    mode: 'hero',
    a: 0,                    // hero assembly progress 0..1
    intro: opts.still ? 1e9 : -1,   // seconds since the intro started; -1 = waiting
    introStart: 0,
    time: 0,
    cfg: { base: 'cork', len: '1.6' },
    from: null,              // config tween snapshots
    tween: 1,
    baseTween: 1,
    baseFrom: 'cork',
    colorFrom: COLORS.graphite.clone(),
    camR: 4,
    camRFrom: 4,
    hover: null,
    active: false,
    dirty: true,
  };
  let hero = layout(HERO_LEN);
  let cur = layout('1.6');
  let prev = cur;

  /* ---------- Hero choreography ---------- */
  // Exploded offsets for each part of the 1.6 m bench (2 blocks, 7 slats, 8 bolts, a key).
  const EX = { blocks: [], slats: [], bolts: [] };
  [-1, 1].forEach((sg) => EX.blocks.push({
    // tipped out to the sides, floating; they turn upright as they rise into place
    pos: new THREE.Vector3(sg * 0.24, 0.13, 0.1),
    rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, sg * 0.32, sg * 0.85)),
  }));
  for (let r = 0; r < ROWS; r++) {
    const side = r % 2 ? 1 : -1;
    if (r < SEAT_ROWS) EX.slats.push({
      // a loose stack above the blocks, lowest row lands first
      pos: new THREE.Vector3(side * 0.08, 0.17 + r * 0.095, 0.16 + r * 0.03),
      rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side * 0.07, side * 0.025)),
    });
    else {
      const k = r - SEAT_ROWS;
      // fanned out behind the seat in the plane of the backrest
      const off = BACK_U.clone().multiplyScalar(0.3 + k * 0.1).addScaledVector(BACK_N, -0.3);
      off.x = -side * 0.07;
      EX.slats.push({ pos: off, rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05 * side, -side * 0.06, 0)) });
    }
  }
  // bolts hang in a neat line above their holes
  for (let j = 0; j < 8; j++) EX.bolts.push({ pos: new THREE.Vector3(0, 0.78 + (j % 4) * 0.014, 0) });
  const KEY_BOLT = 4;   // front bolt on the right-hand block
  const EX_KEY = { pos: new THREE.Vector3(-0.5, 0.56, 0.34), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0.9, 1.1)) };

  // Schedule in assembly progress (0..1)
  const T_BLOCK = [[0.03, 0.22], [0.09, 0.28]];
  const T_SLAT = (i) => [0.27 + i * 0.055, 0.27 + i * 0.055 + 0.15];
  const T_BOLT = (j) => [0.7 + j * 0.012, 0.7 + j * 0.012 + 0.08];
  const T_KEY = { in: [0.83, 0.9], turn: [0.9, 0.95], out: [0.955, 1] };
  // Intro: fly in from depth, blocks first, slats 90 ms apart
  const D_BLOCK = [0, 0.08];
  const D_SLAT = (i) => 0.3 + i * 0.09;
  const D_BOLT = (j) => 0.86 + j * 0.025;
  const D_KEY = 1.05;
  const FLY = 0.95;

  const dummy = new THREE.Object3D();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const q1 = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const e1 = new THREE.Euler();
  const away = new THREE.Vector3();

  const introOffset = (delay, out) => {
    if (state.intro < 0) { out.copy(away).multiplyScalar(9); return 0; }
    const f = easeOut(clamp((state.intro - delay) / FLY, 0, 1));
    out.copy(away).multiplyScalar(7 * (1 - f)).addScaledVector(UP, 0.5 * (1 - f) * (1 - f));
    return f;
  };

  const drift = (i, weight) => (weight <= 0 ? 0 : Math.sin(state.time * 0.85 + i * 1.7) * 0.009 * weight);

  function placeHero() {
    const a = state.a;
    let placed = 0;
    // blocks + brackets + blobs
    for (let s = 0; s < 2; s++) {
      const t = ease(seg(a, ...T_BLOCK[s]));
      if (t >= 0.999) placed++;
      const ex = EX.blocks[s];
      const f = introOffset(D_BLOCK[s], v2);
      v1.set(hero.sx[s], BLOCK_H / 2, 0).addScaledVector(ex.pos, 1 - t);
      v1.y += Math.sin(Math.PI * t) * 0.06 + drift(s, 1 - t);
      v1.add(v2);
      q1.copy(ex.rot).slerp(Q_ID, t);
      e1.set((1 - f) * 0.9, (1 - f) * 0.6, 0);
      q1.multiply(q2.setFromEuler(e1));
      dummy.position.copy(v1);
      dummy.quaternion.copy(q1);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      blocks.setMatrixAt(s, dummy.matrix);
      // bracket rides with its block (it sits in a slot in the cork)
      const bc = BRACKET_C;
      v2.set(0, bc.y - BLOCK_H / 2, bc.z).applyQuaternion(q1).add(v1);
      dummy.position.copy(v2);
      dummy.quaternion.copy(q1).multiply(Q_BRACKET);
      dummy.updateMatrix();
      brackets.setMatrixAt(s, dummy.matrix);
      // contact shadow grows as the block lands
      const land = seg(t, 0.6, 1);
      dummy.position.set(hero.sx[s] + 0.03, 0.002, -0.02);
      dummy.quaternion.copy(Q_ID);
      dummy.scale.set(0.62 * land + 0.001, 1, 0.78 * land + 0.001);
      dummy.updateMatrix();
      blobs.setMatrixAt(s, dummy.matrix);
    }
    blocks.count = brackets.count = blobs.count = 2;
    frames.count = 0;
    // slats: slide in, then drop
    for (let i = 0; i < ROWS; i++) {
      const sl = hero.slats[i];
      const t = seg(a, ...T_SLAT(i));
      if (t >= 0.999) placed++;
      const ex = EX.slats[i];
      const tx = easeOut(seg(t, 0, 0.75));
      const ty = ease(seg(t, 0.25, 1));
      const f = introOffset(D_SLAT(i), v2);
      v1.copy(sl.pos);
      v1.x += ex.pos.x * (1 - tx);
      v1.z += ex.pos.z * (1 - ty);
      v1.y += ex.pos.y * (1 - ty) + drift(i + 3, 1 - t);
      v1.add(v2);
      q1.copy(ex.rot).slerp(Q_ID, ease(t)).multiply(sl.quat);
      e1.set(0, (1 - f) * 0.9, (1 - f) * 0.5);
      q1.premultiply(q2.setFromEuler(e1));
      dummy.position.copy(v1);
      dummy.quaternion.copy(q1);
      dummy.scale.set(sl.len, 1, 1);
      dummy.updateMatrix();
      slats.setMatrixAt(i, dummy.matrix);
    }
    slats.count = ROWS;
    slatUv.array.forEach((_, k) => { if (k % 3 === 2) slatUv.array[k] = 1; });
    slatUv.needsUpdate = true;
    // bolts: descend while turning; the key's bolt gets a last quarter-turn
    const kTurn = ease(seg(a, ...T_KEY.turn));
    for (let j = 0; j < 8; j++) {
      const b = hero.bolts[j];
      const t = ease(seg(a, ...T_BOLT(j)));
      const f = introOffset(D_BOLT(j), v2);
      v1.copy(b.pos).addScaledVector(EX.bolts[j].pos, 1 - t);
      v1.y += drift(j + 11, 1 - t) + v2.y;
      v1.x += v2.x;
      v1.z += v2.z;
      dummy.position.copy(v1);
      dummy.quaternion.setFromAxisAngle(UP, (1 - t) * Math.PI * 5 + (j === KEY_BOLT ? kTurn * Math.PI / 2 : 0) + (1 - f) * 2);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bolts.setMatrixAt(j, dummy.matrix);
    }
    bolts.count = 8;
    // the key swings in, makes a quarter-turn, then lifts away before the photograph takes over
    const kin = ease(seg(a, ...T_KEY.in));
    const kout = ease(seg(a, ...T_KEY.out));
    const target = hero.bolts[KEY_BOLT].pos;
    const f = introOffset(D_KEY, v2);
    v1.copy(target).add(EX_KEY.pos.clone().multiplyScalar(1 - kin));
    v1.y += 0.008 + drift(19, 1 - kin) + kout * 0.42;
    v1.x += kout * 0.25;
    v1.add(v2);
    q1.copy(EX_KEY.rot).slerp(Q_ID, kin);
    q1.premultiply(q2.setFromAxisAngle(UP, kTurn * Math.PI / 2 + 0.6));
    q1.multiply(q2.setFromEuler(e1.set(kout * 0.6, 0, -kout * 0.8)));
    keyMesh.position.copy(v1);
    keyMesh.quaternion.copy(q1);
    const ks = 1 - seg(a, 0.975, 1);
    keyMesh.scale.setScalar(Math.max(ks, 0.0001));
    keyMesh.visible = ks > 0.001;
    [slats, blocks, brackets, bolts, blobs].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    return placed;
  }

  /* ---------- Configurator ---------- */
  // Snapshot of every slot's transform so length changes can tween between layouts.
  function configTransforms(lay, base) {
    const out = { slats: [], blocks: [], frames: [], brackets: [], bolts: [], blobs: [] };
    lay.slats.forEach((s, i) => out.slats[i] = { pos: s.pos.clone(), quat: s.quat, sx: s.len, vis: 1 });
    lay.supports.forEach((s, i) => {
      const cork = base === 'cork' ? 1 : 0;
      out.blocks[i] = { pos: new THREE.Vector3(s.x, BLOCK_H / 2, 0), vis: cork };
      const bc = BRACKET_C;
      out.brackets[i] = { pos: new THREE.Vector3(s.x, bc.y, bc.z), vis: cork };
      out.frames[i] = { pos: new THREE.Vector3(s.x, 0, 0), vis: 1 - cork };
      out.blobs[i] = { pos: new THREE.Vector3(s.x + 0.03, 0.002, -0.02), vis: 1 };
    });
    lay.bolts.forEach((b, i) => out.bolts[i] = { pos: b.pos.clone(), vis: 1 });
    return out;
  }

  let cfgFrom = configTransforms(cur, 'cork');
  let cfgTo = cfgFrom;

  function mix(list0, list1, i, t, fallback) {
    const a0 = list0[i];
    const a1 = list1[i];
    if (a0 && a1) return { pos: v1.copy(a0.pos).lerp(a1.pos, t), vis: lerp(a0.vis, a1.vis, t), sx: a0.sx !== undefined ? lerp(a0.sx, a1.sx, t) : 1, quat: a1.quat || Q_ID };
    const only = a0 || a1;
    if (!only) return null;
    const grow = a1 ? t : 1 - t;
    return { pos: v1.copy(only.pos), vis: only.vis * grow, sx: only.sx !== undefined ? only.sx : 1, quat: only.quat || Q_ID, grow };
  }

  function placeConfig() {
    const t = ease(state.tween);
    const tb = ease(state.baseTween);
    const nSl = Math.max(cfgFrom.slats.length, cfgTo.slats.length);
    for (let i = 0; i < nSl; i++) {
      const m = mix(cfgFrom.slats, cfgTo.slats, i, t);
      dummy.position.copy(m.pos);
      if (m.grow !== undefined) dummy.position.y += (1 - m.grow) * 0.25;
      dummy.quaternion.copy(m.quat);
      const g = m.grow !== undefined ? m.grow : 1;
      dummy.scale.set(Math.max(m.sx * g, 0.0001), Math.max(g, 0.0001), Math.max(g, 0.0001));
      dummy.updateMatrix();
      slats.setMatrixAt(i, dummy.matrix);
      slatUv.array[i * 3 + 2] = m.sx / 1.6;
    }
    slats.count = nSl;
    slatUv.needsUpdate = true;
    const nSup = Math.max(cfgFrom.blocks.length, cfgTo.blocks.length);
    for (let i = 0; i < nSup; i++) {
      // blocks sink into the ground and steel frames rise out of it (anchored at y = 0)
      const mb = mix(cfgFrom.blocks, cfgTo.blocks, i, t);
      const vb = baseVis('cork', tb) * (mb.grow !== undefined ? mb.grow : 1);
      dummy.position.set(mb.pos.x, (BLOCK_H * vb) / 2, mb.pos.z);
      dummy.quaternion.copy(Q_ID);
      const kb = vb < 0.02 ? 0.0001 : 1;   // fully gone, not a flat square left on the ground
      dummy.scale.set(kb, Math.max(vb, 0.0001), kb);
      dummy.updateMatrix();
      blocks.setMatrixAt(i, dummy.matrix);
      const mk = mix(cfgFrom.brackets, cfgTo.brackets, i, t);
      dummy.position.copy(mk.pos);
      dummy.position.y -= (1 - vb) * 0.6;
      dummy.quaternion.copy(Q_BRACKET);
      dummy.scale.set(kb, Math.max(vb, 0.0001), kb);
      dummy.updateMatrix();
      brackets.setMatrixAt(i, dummy.matrix);
      const mf = mix(cfgFrom.frames, cfgTo.frames, i, t);
      const vf = (1 - baseVis('cork', tb)) * (mf.grow !== undefined ? mf.grow : 1);
      dummy.position.copy(mf.pos);
      dummy.quaternion.copy(Q_ID);
      const kf = vf < 0.02 ? 0.0001 : 1;
      dummy.scale.set(kf, Math.max(vf, 0.0001), kf);
      dummy.updateMatrix();
      frames.setMatrixAt(i, dummy.matrix);
      const ml = mix(cfgFrom.blobs, cfgTo.blobs, i, t);
      const g = ml.grow !== undefined ? ml.grow : 1;
      dummy.position.copy(ml.pos);
      dummy.scale.set((0.62 * vb + 0.3 * (1 - vb)) * g + 0.001, 1, (0.78 * vb + 0.62 * (1 - vb)) * g + 0.001);
      dummy.updateMatrix();
      blobs.setMatrixAt(i, dummy.matrix);
    }
    blocks.count = brackets.count = frames.count = blobs.count = nSup;
    const nB = Math.max(cfgFrom.bolts.length, cfgTo.bolts.length);
    for (let i = 0; i < nB; i++) {
      const m = mix(cfgFrom.bolts, cfgTo.bolts, i, t);
      const g = m.grow !== undefined ? m.grow : 1;
      dummy.position.copy(m.pos);
      dummy.position.y += (1 - g) * 0.3;
      dummy.quaternion.setFromAxisAngle(UP, (1 - g) * Math.PI * 3);
      dummy.scale.setScalar(Math.max(g, 0.0001));
      dummy.updateMatrix();
      bolts.setMatrixAt(i, dummy.matrix);
    }
    bolts.count = nB;
    keyMesh.visible = false;
    // steel colour tween
    const target = state.cfg.base === 'clay' ? COLORS.clay : COLORS.graphite;
    frameMat.color.copy(state.colorFrom).lerp(target, tb);
    [slats, blocks, brackets, frames, bolts, blobs].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  }

  function baseVis(kind, tb) {
    const from = state.baseFrom === 'cork' ? 1 : 0;
    const to = state.cfg.base === 'cork' ? 1 : 0;
    // cork out first, steel in second, so the two never overlap
    if (from === to) return to;
    return to === 1 ? seg(tb, 0.35, 1) : 1 - seg(tb, 0, 0.6);
  }

  /* ---------- Camera ---------- */
  const target = new THREE.Vector3(0, 0.42, 0);
  const view = { cx: 0.5, cy: 0.5, fill: 0.6, maxW: 0.6 };
  let width = 1;
  let height = 1;

  function benchPoints(lay, base) {
    // corners of every part box in its assembled place, for framing and the photo match
    const pts = [];
    const corners = (cx, cy, cz, hx, hy, hz, q) => {
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        pts.push(new THREE.Vector3(sx * hx, sy * hy, sz * hz).applyQuaternion(q || Q_ID).add(new THREE.Vector3(cx, cy, cz)));
      }
    };
    lay.slats.forEach((s) => corners(s.pos.x, s.pos.y, s.pos.z, s.len / 2, SLAT_T / 2, SLAT_W / 2, s.quat));
    lay.supports.forEach((s) => {
      if (base === 'cork') corners(s.x, BLOCK_H / 2, 0, BLOCK_W / 2, BLOCK_H / 2, BLOCK_D / 2);
      else corners(s.x, 0.25, -0.03, 0.02, 0.25, SEAT_D / 2);
    });
    return pts;
  }

  function placeCamera(az, el, R) {
    const ce = Math.cos(el);
    camera.position.set(target.x + R * Math.sin(az) * ce, target.y + R * Math.sin(el), target.z + R * Math.cos(az) * ce);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }

  function applyViewOffset() {
    camera.aspect = width / height;
    camera.setViewOffset(width, height, (0.5 - view.cx) * width, (0.5 - view.cy) * height, width, height);
    camera.updateProjectionMatrix();
  }

  function fitDistance(pts, az, el) {
    // find R so the bench is `fill` of the height and at most `maxW` of the width
    camera.aspect = width / height;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    let R = 4;
    for (let k = 0; k < 3; k++) {
      placeCamera(az, el, R);
      let x0 = 1, x1 = -1, y0 = 1, y1 = -1;
      pts.forEach((p) => {
        v2.copy(p).project(camera);
        x0 = Math.min(x0, v2.x); x1 = Math.max(x1, v2.x); y0 = Math.min(y0, v2.y); y1 = Math.max(y1, v2.y);
      });
      const h = (y1 - y0) / 2;
      const w = (x1 - x0) / 2;
      R *= Math.max(h / view.fill, w / view.maxW);
    }
    applyViewOffset();
    return R;
  }

  const HERO_AZ = [degToRad(-22), degToRad(-47)];
  const HERO_EL = [degToRad(13), degToRad(8.5)];
  const CFG_AZ = degToRad(-40);
  const CFG_EL = degToRad(13);
  let heroR = 4;

  function updateHeroCamera() {
    const e = ease(clamp(state.a / 0.92, 0, 1));
    const az = lerp(HERO_AZ[0], HERO_AZ[1], e);
    const el = lerp(HERO_EL[0], HERO_EL[1], e);
    target.y = lerp(0.6, 0.42, e);
    placeCamera(az, el, heroR * lerp(1.24, 1, e));
    away.copy(camera.position).sub(target).normalize().multiplyScalar(-1);
  }

  function updateConfigCamera() {
    target.y = 0.42;
    const R = lerp(state.camRFrom, state.camR, ease(state.tween));
    placeCamera(CFG_AZ, CFG_EL, R);
  }

  function refit() {
    target.y = 0.42;
    if (state.mode === 'hero') {
      heroR = fitDistance(benchPoints(hero, 'cork'), HERO_AZ[1], HERO_EL[1]);
    } else {
      const r = fitDistance(benchPoints(layout('2.4'), 'cork'), CFG_AZ, CFG_EL);
      state.camRBase = r;
      state.camR = r * camScale(state.cfg.len);
      state.camRFrom = state.camR;
    }
  }
  // barely re-frame: a 1.6 m bench must look shorter than a 2.4 m one
  const camScale = (len) => ({ '1.6': 0.93, '2.0': 0.965, '2.4': 1 }[len]);

  /* ---------- Hover callouts ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = [slats, blocks, brackets, frames, bolts, keyMesh];
  const kinds = new Map([[slats, 'slat'], [blocks, 'block'], [brackets, 'bracket'], [frames, 'frame'], [bolts, 'bolt'], [keyMesh, 'key']]);
  const tmpM = new THREE.Matrix4();
  const tmpInv = new THREE.Matrix4();

  function setHighlight(h, on) {
    if (!h || h.mesh === keyMesh) return;
    h.mesh.setColorAt(h.id, on ? glow : white);
    h.mesh.instanceColor.needsUpdate = true;
  }

  function pick(x, y) {
    ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    [slats, blocks, brackets, frames, bolts].forEach((m) => { m.boundingSphere = null; });
    const hits = ray.intersectObjects(pickables, false).filter((h) => h.object.visible);
    for (const h of hits) {
      if (h.instanceId !== undefined) {
        h.object.getMatrixAt(h.instanceId, tmpM);
        const sc = new THREE.Vector3();
        tmpM.decompose(new THREE.Vector3(), new THREE.Quaternion(), sc);
        if (sc.y < 0.05) continue;   // a part that is tweening out
        const local = h.point.clone().applyMatrix4(tmpInv.copy(tmpM).invert());
        return { mesh: h.object, id: h.instanceId, local, kind: kinds.get(h.object) };
      }
      return { mesh: h.object, id: 0, local: h.point.clone().applyMatrix4(tmpInv.copy(h.object.matrixWorld).invert()), kind: 'key' };
    }
    return null;
  }

  function hoverAt(x, y) {
    const h = x == null ? null : pick(x, y);
    const same = h && state.hover && h.mesh === state.hover.mesh && h.id === state.hover.id;
    if (!same) {
      setHighlight(state.hover, false);
      state.hover = h;
      setHighlight(h, true);
      state.dirty = true;
      kick();
    }
    return !!h;
  }

  function emitCallout() {
    if (!opts.onCallout) return;
    const h = state.hover;
    if (!h) { opts.onCallout(null); return; }
    if (h.mesh === keyMesh) tmpM.copy(keyMesh.matrixWorld);
    else h.mesh.getMatrixAt(h.id, tmpM);
    v2.copy(h.local).applyMatrix4(tmpM).project(camera);
    let n = h.id;
    if (h.kind === 'slat' && state.mode === 'config') n = h.id;
    opts.onCallout({ label: labelFor(h.kind, n, state.cfg), x: (v2.x * 0.5 + 0.5) * width, y: (-v2.y * 0.5 + 0.5) * height });
  }

  /* ---------- Loop ---------- */
  let raf = 0;
  let last = 0;
  let lastPlaced = -1;

  function needsContinuous() {
    if (state.mode === 'hero') {
      if (state.intro >= 0 && state.intro < 2.2) return true;
      return state.a < 0.995 && !opts.still;   // drift while any part is still loose
    }
    return state.tween < 1 || state.baseTween < 1;
  }

  function frame(now) {
    raf = 0;
    const real = last ? (now - last) / 1000 : 0.016;   // wall clock: the intro and tweens finish on time even at low frame rates
    const dt = Math.min(0.05, real);
    last = now;
    state.time += dt;
    if (state.intro >= 0 && state.intro < 3) state.intro = (performance.now() - state.introStart) / 1000;
    if (state.mode === 'config') {
      if (state.tween < 1) state.tween = Math.min(1, state.tween + real / 0.6);
      if (state.baseTween < 1) state.baseTween = Math.min(1, state.baseTween + real / 0.5);
    }
    render();
    if (state.active && needsContinuous()) kick();
    else last = 0;
  }

  function kick() {
    if (!raf && state.active) raf = requestAnimationFrame(frame);
  }

  function render() {
    if (state.mode === 'hero') {
      updateHeroCamera();
      const placed = placeHero();
      if (placed !== lastPlaced) {
        lastPlaced = placed;
        if (opts.onPlaced) opts.onPlaced(placed, 9);
      }
    } else {
      updateConfigCamera();
      placeConfig();
    }
    renderer.render(scene, camera);
    emitCallout();
    state.dirty = false;
  }

  function resize() {
    const el = canvas.parentElement;
    if (!el) return;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    refit();
    render();
  }
  const ro = new ResizeObserver(resize);

  /* ---------- Public API ---------- */
  const api = {
    canvas,
    mount(el, mode, framing) {
      if (canvas.parentElement !== el) el.appendChild(canvas);
      ro.disconnect();
      ro.observe(el);
      if (framing) Object.assign(view, framing);
      if (mode && mode !== state.mode) {
        setHighlight(state.hover, false);
        state.hover = null;
        state.mode = mode;
        if (mode === 'config') {
          cur = layout(state.cfg.len);
          cfgFrom = cfgTo = configTransforms(cur, state.cfg.base);
          state.tween = state.baseTween = 1;
          state.baseFrom = state.cfg.base;
          state.colorFrom.copy(state.cfg.base === 'clay' ? COLORS.clay : COLORS.graphite);
          frameMat.color.copy(state.colorFrom);
        }
      }
      width = height = 0;
      resize();
    },
    setView(framing) { Object.assign(view, framing); width = height = 0; resize(); },
    setProgress(a) {
      a = clamp(a, 0, 1);
      if (a === state.a) return;
      state.a = a;
      if (state.mode === 'hero') { state.dirty = true; kick(); }
    },
    playIntro() { state.intro = 0; state.introStart = performance.now(); kick(); },
    skipIntro() { state.intro = 1e9; state.dirty = true; kick(); },
    introDone: () => state.intro > 2,
    setConfig(cfg, animate = true) {
      const next = { ...state.cfg, ...cfg };
      if (next.base === state.cfg.base && next.len === state.cfg.len) return;
      const fromLayout = configTransformsNow();
      if (next.base !== state.cfg.base) {
        state.baseFrom = state.cfg.base;
        state.colorFrom.copy(frameMat.color);
        state.baseTween = animate ? 0 : 1;
        if (!animate) state.baseFrom = next.base;
      }
      if (next.len !== state.cfg.len) {
        prev = cur;
        cur = layout(next.len);
        cfgFrom = fromLayout;
        state.camRFrom = lerp(state.camRFrom, state.camR, ease(state.tween));
        state.camR = (state.camRBase || state.camR) * camScale(next.len);
        state.tween = animate ? 0 : 1;
      }
      state.cfg = next;
      cfgTo = configTransforms(cur, next.base);
      if (!animate) { cfgFrom = cfgTo; state.camRFrom = state.camR; }
      state.dirty = true;
      kick();
    },
    hover(x, y) { return hoverAt(x, y); },
    leave() { hoverAt(null); },
    setActive(on) {
      state.active = on;
      if (on) { state.dirty = true; kick(); }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; last = 0; }
    },
    renderNow() { render(); },
    /* Screen box (CSS px within the canvas) of the finished hero bench at the end camera. */
    heroBox() {
      const keep = state.a;
      state.a = 1;
      updateHeroCamera();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      benchPoints(hero, 'cork').forEach((p) => {
        v2.copy(p).project(camera);
        const x = (v2.x * 0.5 + 0.5) * width;
        const y = (-v2.y * 0.5 + 0.5) * height;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      });
      state.a = keep;
      updateHeroCamera();
      return { x0, x1, y0, y1 };
    },
    dispose() {
      ro.disconnect();
      api.setActive(false);
      renderer.dispose();
    },
  };

  // current on-screen transforms (for tween starts mid-tween)
  function configTransformsNow() {
    if (state.tween >= 1) return configTransforms(cur, state.cfg.base);
    const t = ease(state.tween);
    const out = { slats: [], blocks: [], frames: [], brackets: [], bolts: [], blobs: [] };
    for (const k of Object.keys(out)) {
      const n = Math.max(cfgFrom[k].length, cfgTo[k].length);
      for (let i = 0; i < n; i++) {
        const m = mix(cfgFrom[k], cfgTo[k], i, t);
        if (!m || (m.grow !== undefined && m.grow < 0.5)) continue;
        out[k][i] = { pos: m.pos.clone(), quat: m.quat, sx: m.sx, vis: m.vis };
      }
    }
    // keep arrays dense
    for (const k of Object.keys(out)) out[k] = out[k].filter(Boolean);
    return out;
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (opts.onLost) opts.onLost();
  });

  ro.observe(canvas.parentElement || document.body);
  resize();
  return api;
}
