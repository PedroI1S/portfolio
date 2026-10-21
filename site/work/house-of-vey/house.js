/* House of Vey: the house in three.js.
   Geometry and lighting were modelled and baked in Blender (_src/build_house.py): every surface carries
   its own colour plus a baked lightmap, so the scene renders unlit and stays smooth on any device.
   The gate opens into the front door, scroll walks a damped camera through the rooms (each room's light
   comes up as you arrive) and the bedroom window finally opens onto the collection. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const html = document.documentElement;
const house = document.getElementById('house');
const sticky = house.querySelector('.house__sticky');
const stage = house.querySelector('.stage');
const caps = [...house.querySelectorAll('[data-cap]')];
const countEl = house.querySelector('[data-count]');
const countName = house.querySelector('[data-count-name]');
const roomEls = [...document.querySelectorAll('.room')];
const collection = document.getElementById('collection');
const gate = document.getElementById('gate');
const NAMES = ['Outside', 'The Hall', 'The Salon', 'The Study', 'The Bedroom'];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const cinematic = (t) => { t = clamp(t); return t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2; };   // ≈ cubic-bezier(.77,0,.18,1)
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);

const FIELD = '#0f3327';
const FIELD_SRGB = new THREE.Vector3(15 / 255, 51 / 255, 39 / 255);
const ASSET_V = '5';        // bump when the bake changes
const BAG = 0.74;          // bag cut-out size in metres (larger than life, as on a stage)
const EYE = 1.45;
const STOP_PITCH = [0, 0.085, 0.015, -0.01, 0];   // look up into the double-height hall
const Q1 = 0.16, Q2 = 0.4, S0 = 0.5;            // exit: window casements part, then the arch grows

function fail(err) {
  console.warn('House of Vey: 3D house unavailable, showing the list instead.', err);
  house.classList.remove('house--3d', 'is-loading');
  window.dispatchEvent(new CustomEvent('vey:house', { detail: null }));
}

/* ---------- textures drawn in code ---------- */
function canvasTex(size, draw, repeatMetres, h = size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = h;
  draw(c.getContext('2d'), size, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeatMetres) t.repeat.set(1 / repeatMetres, 1 / repeatMetres);
  return t;
}
function rand(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

const FLOORS = [
  // hall: black-and-cream marble checker, 50 cm squares
  () => canvasTex(512, (g, s) => {
    const R = rand(3);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const dark = (i + j) % 2;
      g.fillStyle = dark ? '#22342b' : '#ece4d4';
      g.fillRect(i * s / 2, j * s / 2, s / 2, s / 2);
      for (let k = 0; k < 40; k++) {   // faint veining
        g.strokeStyle = dark ? `rgba(255,255,255,${0.03 + R() * 0.04})` : `rgba(90,80,60,${0.03 + R() * 0.05})`;
        g.lineWidth = 0.5 + R() * 1.2;
        g.beginPath();
        let x = i * s / 2 + R() * s / 2, y = j * s / 2 + R() * s / 2;
        g.moveTo(x, y);
        for (let q = 0; q < 4; q++) { x += (R() - 0.5) * 60; y += (R() - 0.3) * 50; g.lineTo(x, y); }
        g.stroke();
      }
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, s, s);
    g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke();
  }, 1.0),
  // salon: herringbone parquet (slanted planks in staggered columns)
  () => canvasTex(1024, (g, s) => {
    const R = rand(7);
    const cols = 8, cw = s / cols, p = s / 8;
    for (let c = 0; c < cols; c++) {
      const up = c % 2 === 0, x0 = c * cw, off = up ? 0 : p / 2;
      for (let k = -2; k < 10; k++) {
        const y0 = k * p + off;
        const tone = 0.82 + R() * 0.32;
        g.fillStyle = `rgb(${Math.round(134 * tone)},${Math.round(90 * tone)},${Math.round(57 * tone)})`;
        g.strokeStyle = 'rgba(32,16,6,0.6)';
        g.lineWidth = 2;
        g.beginPath();
        if (up) { g.moveTo(x0, y0 + cw); g.lineTo(x0 + cw, y0); g.lineTo(x0 + cw, y0 + p); g.lineTo(x0, y0 + cw + p); }
        else { g.moveTo(x0, y0); g.lineTo(x0 + cw, y0 + cw); g.lineTo(x0 + cw, y0 + cw + p); g.lineTo(x0, y0 + p); }
        g.closePath(); g.fill(); g.stroke();
      }
    }
  }, 1.6),
  // study: long walnut planks running into the room
  () => canvasTex(1024, (g, s) => {
    const R = rand(11);
    const n = 8, pw = s / n;
    for (let i = 0; i < n; i++) {
      let y = -R() * s;
      while (y < s) {
        const len = s * (0.45 + R() * 0.6);
        const tone = 0.8 + R() * 0.35;
        g.fillStyle = `rgb(${Math.round(84 * tone)},${Math.round(56 * tone)},${Math.round(34 * tone)})`;
        g.fillRect(i * pw, y, pw, len);
        for (let k = 0; k < 14; k++) {
          g.strokeStyle = `rgba(20,10,4,${0.05 + R() * 0.08})`;
          g.lineWidth = 1;
          const gx = i * pw + R() * pw;
          g.beginPath(); g.moveTo(gx, y); g.lineTo(gx + (R() - 0.5) * 6, y + len); g.stroke();
        }
        g.fillStyle = 'rgba(15,8,3,0.7)';
        g.fillRect(i * pw, y, pw, 2);
        y += len;
      }
      g.fillStyle = 'rgba(15,8,3,0.7)';
      g.fillRect(i * pw, 0, 2, s);
    }
  }, 1.2),
  // bedroom: soft rose carpet
  () => canvasTex(256, (g, s) => {
    const R = rand(5);
    g.fillStyle = '#8d5b70';
    g.fillRect(0, 0, s, s);
    for (let k = 0; k < 9000; k++) {
      g.fillStyle = R() > 0.5 ? 'rgba(255,220,235,0.05)' : 'rgba(40,10,25,0.06)';
      g.fillRect(R() * s, R() * s, 1.5, 1.5);
    }
  }, 0.6)
];

const plaster = () => canvasTex(256, (g, s) => {
  const R = rand(19);
  g.fillStyle = '#f4f4f4';
  g.fillRect(0, 0, s, s);
  for (let k = 0; k < 2600; k++) {
    g.fillStyle = R() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.018)';
    const r = 2 + R() * 5;
    g.beginPath(); g.arc(R() * s, R() * s, r, 0, Math.PI * 2); g.fill();
  }
}, 0.9);

// street paving: large wet stone flags, 90 × 60 cm, darker joints and the odd puddle-dark slab
const paving = () => canvasTex(512, (g, s) => {
  const R = rand(29);
  g.fillStyle = '#20231f';
  g.fillRect(0, 0, s, s);
  const rows = 6, rh = s / rows;
  for (let j = 0; j < rows; j++) {
    const off = (j % 2) * 0.5, cols = 4, cw = s / cols;
    for (let i = -1; i <= cols; i++) {
      const x = (i + off) * cw, tone = 0.78 + R() * 0.3, wet = R() < 0.18 ? 0.8 : 1;
      const v = Math.round(255 * tone * wet);
      g.fillStyle = `rgb(${v},${Math.round(v * 0.99)},${Math.round(v * 0.96)})`;
      g.fillRect(x + 3, j * rh + 3, cw - 6, rh - 6);
      for (let k = 0; k < 60; k++) {
        g.fillStyle = `rgba(0,0,0,${R() * 0.05})`;
        g.fillRect(x + R() * cw, j * rh + R() * rh, 2 + R() * 6, 1 + R() * 3);
      }
    }
  }
}, 3.6);

// lit window: drawn curtains behind the glass, folds running vertically (tiles every 30 cm)
const curtains = () => canvasTex(128, (g, s, h) => {
  for (let x = 0; x < s; x++) {
    const f = 0.5 + 0.5 * Math.cos((x / s) * Math.PI * 2 * 3);
    const v = 0.72 + 0.28 * f;
    g.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(236 * v)},${Math.round(205 * v)})`;
    g.fillRect(x, 0, 1, h);
  }
}, 0.3, 8);

const skyTex = () => {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#0b1030'); gr.addColorStop(0.6, '#1f2c5c'); gr.addColorStop(1, '#3a4a7c');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  const R = rand(23);
  for (let k = 0; k < 140; k++) { g.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.6})`; g.fillRect(R() * 512, R() * 300, 1.2, 1.2); }
  const mg = g.createRadialGradient(300, 170, 0, 300, 170, 90);
  mg.addColorStop(0, 'rgba(230,236,255,0.55)'); mg.addColorStop(1, 'rgba(230,236,255,0)');
  g.fillStyle = mg; g.fillRect(150, 40, 300, 300);
  g.fillStyle = '#f3f1e6'; g.beginPath(); g.arc(300, 170, 26, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

const radial = (stops) => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// a reflection on wet stone: brightest where it leaves the wall, stretched toward the viewer
const streakTex = () => {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(64, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
    const u = (x - 31.5) / 32, v = y / 255;          // v = 0 at the wall end (top of the image)
    const a = Math.exp(-u * u * 5) * Math.pow(1 - v, 1.6) * (0.75 + 0.25 * Math.sin(v * 40 + x * 0.3));
    const i = (y * 64 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(255 * clamp(a));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/* Exterior materials start as the gate's flat field and come up with the lights. */
function revealable(m, u) {
  m.userData.reveal = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uReveal = u;
    sh.uniforms.uField = { value: FIELD_SRGB };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform float uReveal;\nuniform vec3 uField;\nvoid main() {')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n\tgl_FragColor.rgb = mix( uField, gl_FragColor.rgb, uReveal );');
  };
  return m;
}

/* ---------- build ---------- */
async function build() {
  if (!house.classList.contains('house--3d')) return null;   // main.js found no WebGL: the rooms stay a list
  const meta = await fetch(`model/house.json?v=${ASSET_V}`).then((r) => { if (!r.ok) throw new Error('house.json'); return r.json(); });
  const { D, T, DW, DSPR, WW, WSILL, WSPR } = meta;
  const ROOMS = meta.rooms, FAC = meta.facade;
  const FT = -FAC.F0, FZ = FT;                 // facade thickness; its street face sits at z = FT
  const GROUND = meta.ground ?? -0.3;
  const winZ = -(ROOMS[3].y1 - T / 2);          // the bedroom window, room side

  const canvas = document.createElement('canvas');
  canvas.className = 'stage__gl';
  stage.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = meta.exposure ?? 1.0;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FIELD);
  scene.fog = new THREE.Fog('#160f0c', D * 1.6, D * 4.2);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 80);
  camera.rotation.order = 'YXZ';

  const texLoader = new THREE.TextureLoader();
  const loadTex = (url) => new Promise((res, rej) => texLoader.load(url, res, undefined, rej));
  const tags = ROOMS.flatMap((_, r) => [String(r), `d${r}`]);
  if (meta.lightScale?.x) tags.push('x', 'xd');
  const [gltf, ...maps] = await Promise.all([
    new GLTFLoader().loadAsync(`model/house.glb?v=${ASSET_V}`),
    ...tags.map((t) => loadTex(`model/lm_${t}.jpg?v=${ASSET_V}`))
  ]);
  const LM = {};
  tags.forEach((t, i) => { const m = maps[i]; m.flipY = false; m.colorSpace = THREE.SRGBColorSpace; m.channel = 1; LM[t] = m; });

  const floorTex = FLOORS.map((f) => f());
  floorTex.forEach((t) => { t.anisotropy = maxAniso; });
  const plasterTex = plaster();
  const pavingTex = paving();
  pavingTex.anisotropy = maxAniso;
  const curtainTex = curtains();

  const uReveal = { value: 0 }, uLamp = { value: 0 }, uWin = { value: 0 };
  const roomMats = ROOMS.map(() => []), bulbs = ROOMS.map(() => []);
  const BULB = new THREE.Color(1, 0.93, 0.8);

  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    let node = o, tag = null, r = -1, m;
    while (node && !tag) {
      const n = node.name || '';
      if ((m = /^room_(\d)/.exec(n))) { r = Number(m[1]); tag = m[1]; }
      else if ((m = /^detail_(\d)/.exec(n))) { r = Number(m[1]); tag = `d${m[1]}`; }
      else if (/^ext_shell/.test(n)) tag = 'x';
      else if (/^ext_detail/.test(n)) tag = 'xd';
      node = node.parent;
    }
    const ext = tag === 'x' || tag === 'xd';
    const src = o.material, name = src.name || '';
    const lm = LM[tag], base = Math.PI * (meta.lightScale?.[tag] ?? 1);
    let mat;
    if (name === 'bulb') {
      mat = new THREE.MeshBasicMaterial({ color: BULB.clone().multiplyScalar(4) });
      if (r >= 0) bulbs[r].push(mat);
    } else if (name === 'lamp') {
      mat = revealable(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.88, 0.66).multiplyScalar(1.5), toneMapped: false }), uLamp);
    } else if (name === 'glow' || name === 'glow_dim') {
      const c = name === 'glow' ? new THREE.Color(1, 0.8, 0.52) : new THREE.Color(0.55, 0.4, 0.26);
      mat = revealable(new THREE.MeshBasicMaterial({ map: curtainTex, color: c, toneMapped: false }), uWin);
    } else if (name === 'ext_ground') {
      mat = new THREE.MeshBasicMaterial({ map: pavingTex, color: src.color, lightMap: lm, lightMapIntensity: base });
    } else if (name.startsWith('floor_')) {
      mat = new THREE.MeshBasicMaterial({ map: floorTex[r], lightMap: lm, lightMapIntensity: base });
    } else if (name.startsWith('wall_') || name.startsWith('ceil_')) {
      mat = new THREE.MeshBasicMaterial({ color: src.color, map: plasterTex, lightMap: lm, lightMapIntensity: base });
    } else {
      mat = new THREE.MeshBasicMaterial({ color: src.color, lightMap: lm, lightMapIntensity: base });
    }
    mat.name = name;
    if (ext) {
      mat.fog = false;
      if (!mat.userData.reveal) revealable(mat, uReveal);
    } else if (name !== 'bulb' && r >= 0) roomMats[r].push({ m: mat, base });
    o.material = mat;
    src.dispose();
  });
  scene.add(gltf.scene);

  // wet paving: warm reflections under the door, the lantern and the lit windows
  const streak = streakTex();
  const streaks = [];
  const addStreak = (x, w, len, strength) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({
      map: streak, color: new THREE.Color(1, 0.78, 0.5).multiplyScalar(strength), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, GROUND + 0.004, FZ + 0.5 + len / 2);
    scene.add(m);
    streaks.push(m);
  };
  if (FAC) {
    addStreak(0, 1.5, 3.4, 0.42);
    addStreak(FAC.lantern[0], 0.34, 3.0, 0.5);
    FAC.windows.forEach(([x]) => addStreak(x, 1.1, 2.6, 0.26));
  }

  // night sky behind the bedroom window
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), new THREE.MeshBasicMaterial({ map: skyTex(), fog: false }));
  sky.position.set(0, 2.6, -(meta.length ?? ROOMS[3].y1) - 2.5);
  scene.add(sky);

  // soft contact shadows on the plinth tops, a pool of lamplight and a cone of light per room
  const shadowTex = radial([[0, 'rgba(0,0,0,0.55)'], [0.55, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]);
  const poolTex = radial([[0, 'rgba(255,226,180,0.9)'], [0.45, 'rgba(255,226,180,0.3)'], [1, 'rgba(255,226,180,0)']]);
  const coneMat = () => new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOpacity; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() { float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float a = f * mix(0.25, 1.0, vUv.y) * uOpacity;
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * a * 0.16, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
  });
  const lights = ROOMS.map((R) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.34), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    s.rotation.x = -Math.PI / 2;
    s.position.set(R.bagX, R.plinthTop + 0.002, -R.bagY);
    scene.add(s);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(R.bagX, R.plinthTop + 0.003, -R.bagY);
    scene.add(pool);
    const top = meta.lampZ - 0.1, ch = top - R.plinthTop;
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.5, ch, 40, 1, true), coneMat());
    cone.position.set(R.bagX, R.plinthTop + ch / 2, -R.bagY);
    cone.renderOrder = 3;
    scene.add(cone);
    return { pool, cone, level: -1 };
  });

  // the bags: cut-outs standing on their plinths, turned to face the camera; colourways cross-fade
  const bagU = [];
  const bags = ROOMS.map((R, r) => {
    const img = roomEls[r].querySelector('[data-bag]');
    const t = texLoader.load(img.getAttribute('src'), () => { shoulder(r); kick(); });
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    const U = { uPrev: { value: t }, uMix: { value: 1 }, uDim: { value: 1 }, uSweep: { value: -1 } };
    bagU.push(U);
    const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.fragmentShader = sh.fragmentShader
        .replace('void main() {', 'uniform sampler2D uPrev;\nuniform float uMix;\nuniform float uDim;\nuniform float uSweep;\nvoid main() {')
        .replace('#include <map_fragment>', `
          vec4 texC = mix( texture2D( uPrev, vMapUv ), texture2D( map, vMapUv ), uMix );
          diffuseColor *= texC;
          diffuseColor.rgb *= uDim;
          float sw = vMapUv.x * 0.65 + ( 1.0 - vMapUv.y ) * 0.55 - uSweep;
          diffuseColor.rgb += exp( -sw * sw * 120.0 ) * 0.5 * smoothstep( 0.4, 0.9, texC.a );`);
    };
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BAG, BAG), m);
    mesh.position.set(R.bagX, R.plinthTop + BAG / 2 - 0.004, -R.bagY);
    mesh.renderOrder = 2;
    mesh.userData = { room: r, y: mesh.position.y };
    scene.add(mesh);
    return mesh;
  });
  const bagState = ROOMS.map(() => ({ here: false, t0: -1e9, mix0: -1e9 }));
  const texCache = new Map();

  // a "+" on each bag's shoulder (mouse affordance; the caption button is the keyboard route)
  const spots = ROOMS.map((R, r) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spot';
    b.tabIndex = -1;
    b.setAttribute('aria-hidden', 'true');
    b.innerHTML = '<span>+</span>';
    b.addEventListener('click', () => window.dispatchEvent(new CustomEvent('vey:open', { detail: r })));
    sticky.appendChild(b);
    return { el: b, u: 0.72, v: 0.36, on: false };
  });
  function shoulder(r) {
    const img = bags[r].material.map.image;
    if (!img || spots[r].done) return;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, 128, 128);
    const a = g.getImageData(0, 0, 128, 128).data;
    const rows = [];
    let widest = 0;
    for (let y = 0; y < 128; y++) {
      let l = -1, rt = -1;
      for (let x = 0; x < 128; x++) if (a[(y * 128 + x) * 4 + 3] > 128) { if (l < 0) l = x; rt = x; }
      rows.push(l < 0 ? null : { l, r: rt, w: rt - l });
      if (l >= 0) widest = Math.max(widest, rt - l);
    }
    const y0 = rows.findIndex((row) => row && row.w > widest * 0.72);   // where the body begins under the handle
    const y = Math.min(127, y0 + 5), row = rows[y];
    if (!row) return;
    // the side facing the room's centre, so the marker never sits over the wall panel
    const side = ROOMS[r].bagX > 0 ? row.l - 3 : row.r + 3;
    spots[r].u = side / 128; spots[r].v = y / 128; spots[r].done = true;
  }
  const sp = new THREE.Vector3();

  /* ---------- camera path ---------- */
  const N = ROOMS.length + 1;
  let curve, view = { w: 1, h: 1, mobile: false, f: 1 }, seg = 1;
  let outside = null, exitPose = null;
  const offX = [], offY = [];
  const portalMode = !reduceMotion && !!collection;

  function layout() {
    sticky.scrollTop = 0;     // an anchor to a caption must never scroll the stage itself
    const w = sticky.clientWidth, h = sticky.clientHeight;
    if (!w || !h) return;     // a hidden or zero-size stage: wait for the next resize
    const mobile = w < 768;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 66 : 55;
    camera.updateProjectionMatrix();
    const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const th = tv * camera.aspect, f = (h / 2) / tv;
    view = { w, h, mobile, f };

    // outside: square to the facade with the door at 55–56% of the height; a lens shift (not a turn)
    // moves it right of the headline on desktop, and low on phones so the cornice shows above it
    const dOut = 2.8 * f / ((mobile ? 0.55 : 0.56) * h);
    outside = { x: 0, y: EYE, z: FZ + dOut };
    offX.length = offY.length = 0;
    offX.push(mobile ? 0 : -0.16 * w);
    offY.push(h / 2 + EYE * f / dOut - (mobile ? 0.915 : 0.82) * h);
    const pts = [new THREE.Vector3(outside.x, outside.y, outside.z)];
    ROOMS.forEach((R, r) => {
      const dist = Math.max(2.15, BAG / (0.56 * 2 * th));
      pts.push(new THREE.Vector3(0, EYE, -R.y0 + 0.4 + (r === 0 ? FT : 0)));     // through the doorway, square to it
      pts.push(new THREE.Vector3(R.bagX, EYE, -(R.bagY - dist)));
      offX.push(0);
      offY.push(mobile ? 0.03 * h : 0);
    });
    curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');

    // the exit: face the bedroom window, the bag slipping out of frame on the left
    const B = ROOMS[3], ex = { x: 1.15, y: 1.55, z: -B.bagY + 1.6 };
    const dW = ex.z - winZ, winMid = (WSILL + WSPR + WW / 2) / 2;
    exitPose = { ...ex, ox: -(ex.x * f / dW), oy: (ex.y - winMid) * f / dW + 0.04 * h };

    if (portalMode) collection.style.marginTop = `${-h}px`;
    seg = Math.max(1, (house.offsetHeight - h * 2.3) / (N - 1));
    render(true);
  }

  const cam = { x: 0, y: EYE, z: 0, yaw: 0, pitch: 0, ox: 0, oy: 0, p: 0, px: 0 };
  const KEYS = Object.keys(cam);
  const pointer = { x: 0, y: 0 };
  let panelRoom = -1, arrived = !html.classList.contains('is-gated');
  let inView = true, raf = 0, last = 0, lastCap = -2, lastRoom = -1, arrival = null, portalState = -1;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  if (arrived) uReveal.value = uLamp.value = uWin.value = 1;

  function portalQ() {
    return portalMode ? clamp(1 - (collection.offsetTop - window.scrollY) / view.h) : 0;
  }

  function target() {
    let t = clamp((window.scrollY - house.offsetTop) / seg, 0, N - 1);
    if (reduceMotion) t = Math.round(t);
    const i = Math.min(Math.floor(t), N - 2);
    const f = ease(clamp((t - i - 0.15) / 0.7));
    const u = (i + f) / (N - 1);
    curve.getPoint(u, tmp);
    curve.getPoint(Math.min(1, u + 0.01), tmp2);
    const q = portalQ();
    const out = { x: tmp.x, y: tmp.y, z: tmp.z, t, q, p: i + f };
    // a slight turn into the curve while walking
    out.yaw = reduceMotion ? 0 : clamp(Math.atan2(-(tmp2.x - tmp.x), -(tmp2.z - tmp.z)) * 0.35, -0.12, 0.12);
    out.pitch = reduceMotion ? 0 : lerp(STOP_PITCH[i], STOP_PITCH[i + 1], f);
    out.ox = lerp(offX[i], offX[i + 1], f);
    out.oy = lerp(offY[i], offY[i + 1], f);
    out.px = 0;
    const room = Math.round(t) - 1;
    if (finePointer && !reduceMotion) {
      out.yaw += -pointer.x * 0.035;
      out.pitch += -pointer.y * 0.022;
      if (room >= 0 && Math.abs(t - room - 1) < 0.3) out.px = pointer.x;
    }
    if (panelRoom >= 0 && !view.mobile && Math.abs(t - (panelRoom + 1)) < 0.5) out.ox += Math.min(480, view.w) / 2;
    if (q > 0) {   // walk up to the bedroom window
      const k = ease(clamp(q / 0.5));
      for (const key of ['x', 'y', 'z', 'ox', 'oy']) out[key] = lerp(out[key], exitPose[key], k);
      out.yaw *= 1 - k; out.pitch *= 1 - k; out.px *= 1 - k;
    }
    return out;
  }

  // screen rectangle of an arch (centre x, springing height, half-width) standing in the plane z
  const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pD = new THREE.Vector3();
  function projectArch(x, sill, spring, a, z) {
    const toScreen = (v) => { v.project(camera); v.x = (v.x * 0.5 + 0.5) * view.w; v.y = (-v.y * 0.5 + 0.5) * view.h; return v; };
    toScreen(pA.set(x - a, spring, z)); toScreen(pB.set(x + a, spring, z));
    toScreen(pC.set(x, spring + a, z)); toScreen(pD.set(x, sill, z));
    const r = (pB.x - pA.x) / 2;
    return { cx: (pA.x + pB.x) / 2, spring: (pA.y + pB.y) / 2, a: r, top: pC.y, bottom: pD.y };
  }

  function render(snap) {
    if (!curve || !view.h) return false;
    const tg = target();
    const now = performance.now();
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    let moving = false;

    // the gate opens into the front door: same arch, same green, the camera dollies to the first frame
    if (arrival) {
      const e = now - arrival.start, k = cinematic((e - 900) / 1500);
      for (const key of KEYS) tg[key] = lerp(arrival.from[key], tg[key], k);
      tg.p = 0;
      uReveal.value = smooth((e - 1150) / 1300);
      uLamp.value = smooth((e - 1250) / 140);
      uWin.value = smooth((e - 1550) / 220);
      if (e > 420 && !arrival.opened) { arrival.opened = true; gate && gate.classList.add('is-open'); window.VeyAudio && window.VeyAudio.latch(); }
      if (e > 1900 && !arrival.lit) { arrival.lit = true; gate && gate.classList.add('is-lit'); }
      snap = true;
      moving = true;
    }

    const k = snap || reduceMotion ? 1 : 1 - Math.exp(-dt * 4.2);
    for (const key of KEYS) {
      cam[key] += (tg[key] - cam[key]) * k;
      const eps = key === 'ox' || key === 'oy' ? 0.3 : (key === 'yaw' || key === 'pitch' || key === 'px' ? 0.0004 : 0.0015);
      if (Math.abs(tg[key] - cam[key]) > eps) moving = true;
    }
    camera.position.set(cam.x, cam.y, cam.z);
    camera.rotation.set(cam.pitch, cam.yaw, 0);
    camera.setViewOffset(view.w, view.h, cam.ox, cam.oy, view.w, view.h);
    camera.updateMatrixWorld();

    // each room's light comes up as you reach it; the room ahead waits, dimmer, through the arch
    ROOMS.forEach((R, r) => {
      const kr = smooth(1 - Math.abs(cam.p - (r + 1)) / 0.6);
      const level = lerp(r === 0 ? 0.42 : 0.35, 1, kr);
      const L = lights[r];
      if (Math.abs(level - L.level) > 1e-4) {
        L.level = level;
        roomMats[r].forEach(({ m, base }) => { m.lightMapIntensity = base * level; });
        bulbs[r].forEach((m) => m.color.copy(BULB).multiplyScalar(4 * lerp(0.12, 1, kr)));
        L.cone.material.uniforms.uOpacity.value = kr;
        L.pool.material.opacity = 0.4 * kr;
        bagU[r].uDim.value = lerp(0.5, 1, kr);
      }
      // arrival in a room: the bag lifts 3 cm and settles while a highlight runs across it
      const S = bagState[r], d = Math.abs(cam.p - (r + 1));
      if (d < 0.06 && !S.here && arrived) {
        S.here = true;
        if (!reduceMotion) { S.t0 = now; window.VeyAudio && window.VeyAudio.step(); }
      } else if (d > 0.5) S.here = false;
      const e = (now - S.t0) / 1000;
      const lift = e < 0.22 ? 0.03 * easeOut(e / 0.22) : e < 0.57 ? 0.03 * (1 - ease((e - 0.22) / 0.35)) : 0;
      bags[r].position.y = bags[r].userData.y + lift;
      bagU[r].uSweep.value = e < 0.75 ? lerp(-0.35, 1.35, e / 0.75) : -1;
      const m = clamp((now - S.mix0) / 250);
      bagU[r].uMix.value = m;
      if (e < 0.75 || m < 1) moving = true;
    });
    streaks.forEach((s) => { s.material.opacity = uReveal.value; });
    bags.forEach((b, r) => {
      const yaw = Math.atan2(cam.x - b.position.x, cam.z - b.position.z);
      const active = Math.abs(cam.p - (r + 1)) < 0.4;
      b.rotation.y = yaw + (active ? cam.px * THREE.MathUtils.degToRad(8) : 0);
    });
    renderer.render(scene, camera);

    if (arrival) trackDoor(now - arrival.start);
    portal(tg.q);

    // captions and counter follow the scroll position, not the eased camera
    const t = tg.t, near = Math.round(t);
    const cap = tg.q > 0.02 ? -1 : reduceMotion || Math.abs(t - near) < 0.3 ? near : -1;
    spots.forEach((s, r) => {
      const on = cap === r + 1 && arrived && panelRoom < 0;
      if (on) {
        const b = bags[r], du = (s.u - 0.5) * BAG, dv = (0.5 - s.v) * BAG;
        sp.set(b.position.x + du * Math.cos(b.rotation.y), b.position.y + dv, b.position.z - du * Math.sin(b.rotation.y)).project(camera);
        s.el.style.transform = `translate(${(sp.x * 0.5 + 0.5) * view.w}px, ${(-sp.y * 0.5 + 0.5) * view.h}px)`;
      }
      if (on !== s.on) { s.on = on; s.el.classList.toggle('is-on', on); }
    });
    if (cap !== lastCap && arrived) {
      lastCap = cap;
      caps.forEach((c) => c.classList.toggle('is-active', Number(c.dataset.cap) === cap));
    }
    if (near !== lastRoom) {
      lastRoom = near;
      countEl.textContent = String(near).padStart(2, '0');
      countName.textContent = NAMES[near];
      window.VeyAudio && window.VeyAudio.setRoom(near);
      if (near >= 3 && collection) collection.querySelectorAll('img[loading="lazy"]').forEach((im) => { im.loading = 'eager'; });
    }
    house.classList.toggle('is-leaving', tg.q > 0.02);
    house.classList.toggle('at-outside', near === 0);
    return moving;
  }

  /* ---------- gate → door ---------- */
  function trackDoor(e) {
    const P = projectArch(0, 0, DSPR, DW / 2, FZ);
    const r0 = arrival.rect, c = canvas.getBoundingClientRect();
    const left = c.left + P.cx - P.a, top = c.top + P.top, s = (2 * P.a) / r0.width;
    arrival.el.style.transform = `translate(${left - r0.left}px, ${top - r0.top}px) scale(${s})`;
    if (e > 2450) {
      const done = arrival.done;
      arrival = null;
      arrived = true;
      lastCap = -2;
      uReveal.value = uLamp.value = uWin.value = 1;
      done && done();
      kick();
    }
  }

  /* ---------- bedroom window → collection ---------- */
  function portal(q) {
    if (!portalMode) return;
    const st = collection.style, nt = collection.offsetTop - window.scrollY;
    if (q <= Q1) {
      if (portalState !== 0) { portalState = 0; st.visibility = 'hidden'; st.clipPath = st.transform = ''; cream(false); }
      return;
    }
    if (q >= 1 || nt <= 0) {
      if (portalState !== 2) { portalState = 2; st.visibility = st.clipPath = st.transform = ''; cream(true); }
      return;
    }
    if (portalState !== 1) {
      portalState = 1;
      st.visibility = '';
      st.transformOrigin = '0 0';
      collection.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
    }
    const { w, h } = view;
    const Wn = projectArch(0, WSILL, WSPR, WW / 2, winZ);
    let cx = Wn.cx, sy = Wn.spring, yb = Wn.bottom, a = Wn.a, hw;
    const kc = q < Q2 ? 0 : ease((q - Q2) / (1 - Q2));
    if (q < Q2) hw = a * ease((q - Q1) / (Q2 - Q1));          // two casements part from the middle
    else {                                                     // then the arch grows past the screen
      const sF = 0.62 * h, aF = 1.08 * Math.hypot(w / 2, sF);
      cx = lerp(Wn.cx, w / 2, kc); sy = lerp(Wn.spring, sF, kc); yb = lerp(Wn.bottom, h + 2, kc);
      a = Wn.a * Math.pow(aF / Wn.a, kc);
      hw = a;
    }
    // the collection seen through the window, growing into its own place
    const s = lerp(S0, 1, kc), Ax = w / 2, Ay = 0.45 * h;
    const Px = lerp(Wn.cx, Ax, kc), Py = lerp((Wn.top + Wn.bottom) / 2, Ay, kc);
    const tx = Px - s * Ax, ty = Py - nt - s * Ay;
    st.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(4)})`;
    const X = (x) => ((x - tx) / s).toFixed(1), Y = (y) => ((y - nt - ty) / s).toFixed(1);
    const half = Math.min(hw, a * 0.9999), rise = Math.sqrt(a * a - half * half), ra = (a / s).toFixed(1);
    st.clipPath = `path('M${X(cx - half)} ${Y(yb)} L${X(cx - half)} ${Y(sy - rise)} A${ra} ${ra} 0 0 1 ${X(cx + half)} ${Y(sy - rise)} L${X(cx + half)} ${Y(yb)} Z')`;
    cream(sy - a < 0 && cx - a < 0 && cx + a > w);
  }
  // tell the header when cream is behind it
  function cream(on) {
    if (html.classList.contains('portal-cream') === on) return;
    html.classList.toggle('portal-cream', on);
    window.dispatchEvent(new Event('vey:layout'));
  }

  const loop = () => {
    raf = 0;
    if (!inView && !arrival) return;   // rAF itself pauses in background tabs
    if (render()) raf = requestAnimationFrame(loop);
  };
  function kick() {
    if (!raf && (inView || arrival)) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }

  // click a bag to open its panel; the cursor says so
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function bagAt(e) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // only the bag in the room you are standing in: the ray ignores walls, so far bags must not catch clicks
    const hit = ray.intersectObjects(bags, false).find((h) => {
      if (h.distance > 6) return false;
      const uv = h.uv, img = h.object.material.map?.image;
      return uv && img ? alphaAt(img, uv) > 0.3 : true;
    });
    return hit ? hit.object.userData.room : -1;
  }
  const alphaCache = new Map();
  function alphaAt(img, uv) {
    let c = alphaCache.get(img);
    if (!c) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const g = cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, 128, 128);
      c = g.getImageData(0, 0, 128, 128).data;
      alphaCache.set(img, c);
    }
    const x = Math.min(127, Math.floor(uv.x * 128)), y = Math.min(127, Math.floor((1 - uv.y) * 128));
    return c[(y * 128 + x) * 4 + 3] / 255;
  }
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
    const r = bagAt(e);
    if (r >= 0) window.dispatchEvent(new CustomEvent('vey:open', { detail: r }));
  });
  if (finePointer) {
    let hoverRaf = 0, lastE = null;
    sticky.addEventListener('pointermove', (e) => {
      if (!reduceMotion) {
        pointer.x = (e.clientX / view.w) * 2 - 1;
        pointer.y = (e.clientY / view.h) * 2 - 1;
        kick();
      }
      lastE = e;
      if (!hoverRaf) hoverRaf = requestAnimationFrame(() => { hoverRaf = 0; canvas.style.cursor = bagAt(lastE) >= 0 ? 'pointer' : ''; });
    });
    sticky.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; kick(); });
  }

  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('hashchange', () => { sticky.scrollTop = 0; });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; kick(); }).observe(house);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); window.dispatchEvent(new Event('vey:layout')); }, 120); });

  layout();
  // first frame drawn: reveal the canvas
  requestAnimationFrame(() => { house.classList.remove('is-loading'); house.classList.add('is-ready'); });

  return {
    kick,
    // from the gate: instantly (reduced motion, deep links), or opening the gate's arch into the door
    arrive({ instant = false, onDone } = {}) {
      const arch = gate && gate.querySelector('[data-gate-arch]');
      if (instant || reduceMotion || !arch) {
        arrived = true; lastCap = -2;
        uReveal.value = uLamp.value = uWin.value = 1;
        render(true);
        onDone && onDone();
        return;
      }
      arch.style.transform = '';
      const r = arch.getBoundingClientRect(), c = canvas.getBoundingClientRect();
      const d = DW * view.f / r.width;
      const from = { x: -((r.left + r.width / 2 - c.left) - view.w / 2) * d / view.f, y: (r.bottom - c.top - view.h / 2) * d / view.f, z: FZ + d, yaw: 0, pitch: 0, ox: 0, oy: 0, p: 0, px: 0 };
      uReveal.value = uLamp.value = uWin.value = 0;
      arrival = { start: performance.now(), from, el: arch, rect: r, done: onDone };
      arch.style.transformOrigin = '0 0';
      render(true);
      kick();
    },
    setPanel(r) { panelRoom = r; kick(); },
    stopTop(s) { return house.offsetTop + s * seg; },
    // a recoloured cut-out from bags.js replaces the billboard's texture, cross-fading over 250 ms
    setColour(r, key, source) {
      let tex = texCache.get(key);
      if (!tex) {
        tex = new THREE.CanvasTexture(source);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = maxAniso;
        texCache.set(key, tex);
      }
      const m = bags[r].material;
      if (m.map === tex) return;
      bagU[r].uPrev.value = m.map;
      m.map = tex;
      bagState[r].mix0 = reduceMotion ? -1e9 : performance.now();
      kick();
    }
  };
}

build()
  .then((api) => { window.VeyHouse = api; if (api) window.dispatchEvent(new CustomEvent('vey:house', { detail: api })); })
  .catch(fail);
