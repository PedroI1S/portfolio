/* Thimble Planet: the planet scene (Three.js r170).
   Terrain, trees and buildings bake into one vertex-coloured mesh with static shadows (the sun never moves).
   Each place has its own hour of light, tweened during flights, and one playable value
   (lamp bearing, month, grind, tide, day). A desktop-only tilt-shift pass makes it read as a miniature.
   The camera is a custom damped orbit with flights between places. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

const R = 5;                                            // sea-level radius
const UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3();
const SUN = new THREE.Vector3(Math.cos(18 * Math.PI / 180) * Math.cos(10 * Math.PI / 180), Math.sin(18 * Math.PI / 180), Math.cos(18 * Math.PI / 180) * Math.sin(10 * Math.PI / 180));
const D2R = Math.PI / 180;
const { clamp, lerp, damp } = THREE.MathUtils;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const wrapPi = (a) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

/* ---------- Seeded noise ---------- */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createNoise(seed) {
  const rand = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y, z) => {
    const k = h & 15, u = k < 8 ? x : y, v = k < 4 ? y : (k === 12 || k === 14 ? x : z);
    return ((k & 1) === 0 ? u : -u) + ((k & 2) === 0 ? v : -v);
  };
  return (x, y, z) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
           lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
           lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  };
}

const noise = createNoise(1127);
function fbm(d, f = 1.15, oct = 4, off = 0) {
  let v = 0, amp = 0.6, fr = f;
  for (let k = 0; k < oct; k++) { v += amp * noise(d.x * fr + off, d.y * fr + k * 3.1, d.z * fr - off); amp *= 0.5; fr *= 2.07; }
  return v;
}

/* ---------- Geography ---------- */
function dirLL(lat, lon) {
  const a = lat * D2R, b = lon * D2R;
  return new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b));
}
const angleDeg = (a, b) => Math.acos(clamp(a.dot(b), -1, 1)) / D2R;

// Places sit on flattened plateaus. h = height above sea level, r0/r1 = flat radius and blend radius in degrees.
const SPECS = {
  cottage:    { lat: 20,  lon: 98,  h: 0.24, r0: 6,   r1: 12 },
  windmill:   { lat: 46,  lon: 48,  h: 0.30, r0: 6,   r1: 12 },
  dock:       { lat: -21, lon: 64,  h: 0.06, r0: 3.5, r1: 7.5 },
  lighthouse: { lat: -7,  lon: 146, h: 0.46, r0: 4,   r1: 8 },
  grove:      { lat: 15,  lon: 214, h: 0.20, r0: 7,   r1: 13 },
};
for (const s of Object.values(SPECS)) s.dir = dirLL(s.lat, s.lon);

const OCEANS = [
  { d: dirLL(-40, 36), r: 36, depth: 1.0 },
  { d: dirLL(-16, 172), r: 40, depth: 1.0 },
  { d: dirLL(-62, 262), r: 30, depth: 0.85 },
];
const PEAKS = [
  { d: dirLL(62, 150), r: 24, h: 0.9 },
  { d: dirLL(-60, 128), r: 18, h: 0.55 },
  { d: dirLL(66, -34), r: 16, h: 0.6 },
  { d: dirLL(34, 272), r: 15, h: 0.55 },
  { d: dirLL(-8, 300), r: 13, h: 0.4 },
];

function heightAt(d) {
  let h = 0.21 + 0.26 * fbm(d);
  for (const o of OCEANS) h -= o.depth * (1 - smoothstep(o.r * 0.35, o.r, angleDeg(d, o.d)));
  for (const p of PEAKS) {
    const t = 1 - smoothstep(0, p.r, angleDeg(d, p.d));
    if (t > 0) h += p.h * t * t * (0.75 + 0.5 * fbm(d, 3.1, 2, 9));
  }
  for (const s of Object.values(SPECS)) {
    const w = 1 - smoothstep(s.r0, s.r1, angleDeg(d, s.dir));
    if (w > 0) h += (s.h - h) * w;
  }
  return h;
}

const forestMask = (d) => fbm(d, 2.3, 2, 21);

/* ---------- Geometry helpers ---------- */
const col = (hex) => new THREE.Color(hex);
const _q = new THREE.Quaternion(), _qy = new THREE.Quaternion(), _v = new THREE.Vector3();

function tangentBasis(dir) {
  const t1 = new THREE.Vector3().crossVectors(Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : UP, dir).normalize();
  const t2 = new THREE.Vector3().crossVectors(dir, t1).normalize();
  return [t1, t2];
}

function offsetDir(dir, angleDegrees, bearing) {
  const [t1, t2] = tangentBasis(dir);
  const a = angleDegrees * D2R;
  return dir.clone().multiplyScalar(Math.cos(a))
    .add(t1.multiplyScalar(Math.cos(bearing) * Math.sin(a)))
    .add(t2.multiplyScalar(Math.sin(bearing) * Math.sin(a))).normalize();
}

// yaw (about the local up) that turns the local +Z of a surface frame towards a world direction
function yawToward(dir, target) {
  _q.setFromUnitVectors(UP, dir);
  const z = new THREE.Vector3(0, 0, 1).applyQuaternion(_q);
  const t = target.clone().sub(dir.clone().multiplyScalar(target.dot(dir))).normalize();
  let a = Math.acos(clamp(z.dot(t), -1, 1));
  if (new THREE.Vector3().crossVectors(z, t).dot(dir) < 0) a = -a;
  return a;
}

function surfaceFrame(dir, yaw = 0, lift = 0, scale = 1) {
  const h = R + heightAt(dir) + lift;
  _q.setFromUnitVectors(UP, dir); _qy.setFromAxisAngle(UP, yaw);
  return new THREE.Matrix4().compose(dir.clone().multiplyScalar(h), _q.clone().multiply(_qy), new THREE.Vector3(scale, scale, scale));
}

const L = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const mul = (a, b) => a.clone().multiply(b);

function prismGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  return g;
}

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl5: new THREE.CylinderGeometry(1, 1, 1, 5),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl10: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  ico: new THREE.IcosahedronGeometry(1, 0),
  dodec: new THREE.DodecahedronGeometry(1, 0),
  prism: prismGeometry(),
};
const taper = (top, bottom, seg) => new THREE.CylinderGeometry(top, bottom, 1, seg);

// Bake parts into one non-indexed geometry: flat normals, per-face colour with a little jitter.
function bake(parts, rand) {
  const prepared = [];
  let n = 0;
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    if (p.m) g.applyMatrix4(p.m);
    n += g.attributes.position.count;
    prepared.push([g, p]);
  }
  const pos = new Float32Array(n * 3), colr = new Float32Array(n * 3);
  // optional per-part growth data (the grove): every vertex knows its tree's base and start day
  const grows = parts.some((p) => p.base);
  const base = grows ? new Float32Array(n * 3) : null, start = grows ? new Float32Array(n) : null;
  let o = 0;
  for (const [g, p] of prepared) {
    const count = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (grows) for (let i = 0; i < count; i++) { base.set([p.base.x, p.base.y, p.base.z], (o + i) * 3); start[o + i] = p.grow; }
    if (p.colors) colr.set(p.colors, o * 3);
    else {
      for (let i = 0; i < count; i += 3) {
        const k = 1 + (rand() - 0.5) * (p.jitter ?? 0.08);
        for (let v = 0; v < 3; v++) {
          const j = (o + i + v) * 3;
          colr[j] = p.color.r * k; colr[j + 1] = p.color.g * k; colr[j + 2] = p.color.b * k;
        }
      }
    }
    o += count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  if (grows) { geo.setAttribute('aBase', new THREE.BufferAttribute(base, 3)); geo.setAttribute('aGrow', new THREE.BufferAttribute(start, 1)); }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/* ---------- Light: one hour per place ---------- */
// sky runs from the anti-sun side (night) to the sun's core; colours are sRGB
const LIGHT_DEFS = {
  dusk: {
    name: 'Dusk',
    sky: ['#15142A', '#2C2F58', '#5D5287', '#8A6FA0', '#C98E8C', '#F6C9A0', '#FFFFFD'],
    sun: '#FFC898', sunI: 3.1, hemiSky: '#8A84D6', hemiGround: '#D29A82', hemiI: 1.25,
    fog: '#5A4D7E', fogNear: -2.5, fogFar: 16, exposure: 1.05, stars: 1, starsAll: 0, glow: 1, beam: 0.42,
    haloWarm: '#F6C9A0', haloCool: '#8C7BC0', halo: 1, water: '#585A8E',
  },
  afternoon: {
    name: 'Afternoon',
    sky: ['#4A4670', '#7A6E98', '#B993A8', '#E6AE88', '#F7BC78', '#FFD597', '#FFFFF2'],
    sun: '#FFCF86', sunI: 4.1, hemiSky: '#ABA6DA', hemiGround: '#F2BC88', hemiI: 1.5,
    fog: '#C99A82', fogNear: 0, fogFar: 20, exposure: 1.1, stars: 0, starsAll: 0, glow: 0.45, beam: 0.12,
    haloWarm: '#FFD597', haloCool: '#B9A6D8', halo: 1.2, water: '#6E6C9C',
  },
  blue: {
    name: 'Blue hour',
    sky: ['#0A112E', '#16245A', '#2B427E', '#4961A0', '#7E86B8', '#C9A6B6', '#EEE6FF'],
    sun: '#93A9F0', sunI: 1.1, hemiSky: '#6F86D8', hemiGround: '#4A4F8A', hemiI: 1.5,
    fog: '#2C4076', fogNear: -1, fogFar: 15, exposure: 1.02, stars: 0.75, starsAll: 0.3, glow: 1.4, beam: 0.55,
    haloWarm: '#C9A6C8', haloCool: '#5A78D0', halo: 0.9, water: '#3A4F92',
  },
  night: {
    name: 'Night',
    sky: ['#03040B', '#070A1A', '#0E122A', '#161B38', '#1F2444', '#2A2E4E', '#7A82B4'],
    sun: '#5D6CB8', sunI: 0.35, hemiSky: '#3C4492', hemiGround: '#151732', hemiI: 0.95,
    fog: '#0A0E24', fogNear: 0.5, fogFar: 14, exposure: 1.0, stars: 1.7, starsAll: 1, glow: 1.75, beam: 0.9,
    haloWarm: '#3E4680', haloCool: '#283070', halo: 0.5, water: '#1D244E',
  },
  dawn: {
    name: 'Dawn mist',
    sky: ['#4E5B78', '#6D7B97', '#93A2B8', '#B8C2CE', '#D9D2CF', '#F2DFCF', '#FFF8EE'],
    sun: '#F1DCC8', sunI: 1.6, hemiSky: '#BCCADA', hemiGround: '#8D96A2', hemiI: 1.6,
    fog: '#A9B4C2', fogNear: 0.1, fogFar: 10, exposure: 1.05, stars: 0.12, starsAll: 0, glow: 0.85, beam: 0.2,
    haloWarm: '#F2DFCF', haloCool: '#AEB9C8', halo: 0.9, water: '#7F8BA8',
  },
};
const PLACE_LIGHT = { cottage: 'dusk', windmill: 'afternoon', dock: 'blue', lighthouse: 'night', grove: 'dawn' };
const SKY_KEYS = ['cNight', 'cIndigo', 'cViolet', 'cLav', 'cRose', 'cGlow', 'cCore'];
const LIGHT_COLORS = ['sun', 'hemiSky', 'hemiGround', 'fog', 'haloWarm', 'haloCool', 'water'];
const LIGHT_NUMS = ['sunI', 'hemiI', 'fogNear', 'fogFar', 'exposure', 'stars', 'starsAll', 'glow', 'beam', 'halo'];

function makeLight(def) {
  const l = { name: def.name, sky: def.sky.map((h) => new THREE.Color(h)) };
  for (const k of LIGHT_COLORS) l[k] = new THREE.Color(def[k]);
  for (const k of LIGHT_NUMS) l[k] = def[k];
  return l;
}
function copyLight(a, b) {
  a.name = b.name;
  b.sky.forEach((c, i) => a.sky[i].copy(c));
  for (const k of LIGHT_COLORS) a[k].copy(b[k]);
  for (const k of LIGHT_NUMS) a[k] = b[k];
  return a;
}
function lerpLight(a, b, t) {
  a.name = b.name;
  b.sky.forEach((c, i) => a.sky[i].lerp(c, t));
  for (const k of LIGHT_COLORS) a[k].lerp(b[k], t);
  for (const k of LIGHT_NUMS) a[k] += (b[k] - a[k]) * t;
}
const LIGHTS = Object.fromEntries(Object.entries(LIGHT_DEFS).map(([k, d]) => [k, makeLight(d)]));

// the cottage's twelve idents: winter is pale and low with bright windows, summer gold and high
const MONTH = {
  sunW: new THREE.Color('#BFD2FF'), sunS: new THREE.Color('#FFB86A'),
  roseW: new THREE.Color('#9C9DC2'), roseS: new THREE.Color('#DE9479'),
  glowW: new THREE.Color('#DCDDEE'), glowS: new THREE.Color('#FFC488'),
  groundW: new THREE.Color('#A3A9C8'), groundS: new THREE.Color('#E4A57C'),
  fogW: new THREE.Color('#5E6390'), fogS: new THREE.Color('#6E5078'),
};
const summerOf = (m) => (Math.cos(((m - 6) / 12) * Math.PI * 2) + 1) / 2;   // 1 in July, 0 in January
function applyMonth(l, m) {
  const s = summerOf(m);
  l.sun.lerpColors(MONTH.sunW, MONTH.sunS, s);
  l.sunI = lerp(1.6, 3.9, s);
  l.glow = lerp(1.8, 0.55, s);
  l.sky[4].lerpColors(MONTH.roseW, MONTH.roseS, s);
  l.sky[5].lerpColors(MONTH.glowW, MONTH.glowS, s);
  l.hemiGround.lerpColors(MONTH.groundW, MONTH.groundS, s);
  l.fog.lerpColors(MONTH.fogW, MONTH.fogS, s);
  l.exposure = lerp(1.0, 1.1, s);
}

/* ---------- Shaders ---------- */
const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }`;
const SKY_FRAG = /* glsl */`
  uniform vec3 uSun, cNight, cIndigo, cViolet, cLav, cRose, cGlow, cCore;
  uniform float uCoreK;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float s = dot(d, uSun);
    vec3 c = cNight;
    c = mix(c, cIndigo, smoothstep(-0.95, -0.15, s));
    c = mix(c, cViolet, smoothstep(-0.3, 0.45, s));
    c = mix(c, cLav, smoothstep(0.25, 0.75, s));
    c = mix(c, cRose, smoothstep(0.6, 0.92, s));
    c = mix(c, cGlow, smoothstep(0.86, 0.99, s));
    c += cCore * (pow(max(s, 1e-4), 900.0) * 3.0 + pow(max(s, 1e-4), 60.0) * 0.25) * uCoreK;
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const STAR_VERT = /* glsl */`
  attribute float aSize; attribute float aPhase;
  uniform vec3 uSun; uniform float uTime, uDpr, uStars, uStarsAll;
  varying float vA;
  void main() {
    vec3 d = normalize(position);
    float night = max(1.0 - smoothstep(-0.15, 0.55, dot(d, uSun)), uStarsAll);
    vA = min(night * uStars * (0.55 + 0.45 * sin(uTime * (0.8 + aPhase) + aPhase * 40.0)), 1.6);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
    gl_PointSize = aSize * uDpr;
  }`;
const STAR_FRAG = /* glsl */`
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.1, d) * vA;
    gl_FragColor = vec4(vec3(1.0, 0.97, 0.93) * a, a);
  }`;

const GLOW_VERT = /* glsl */`
  attribute float aSize; attribute float aPhase; attribute float aDrift; attribute vec3 aColor;
  uniform float uTime, uScale, uGlow;
  varying vec3 vColor; varying float vA;
  void main() {
    vec3 p = position;
    if (aDrift > 0.0) {
      p += vec3(sin(uTime * 0.7 + aPhase * 6.3), sin(uTime * 0.9 + aPhase * 4.1) * 0.6, cos(uTime * 0.6 + aPhase * 5.2)) * aDrift;
      vA = 0.35 + 0.65 * smoothstep(-0.3, 1.0, sin(uTime * 1.7 + aPhase * 31.0));
    } else {
      vA = 0.86 + 0.14 * sin(uTime * (2.5 + aPhase * 5.0) + aPhase * 20.0);
    }
    vA *= uGlow;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / -mv.z;
    vColor = aColor;
  }`;
const GLOW_FRAG = /* glsl */`
  varying vec3 vColor; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(clamp(1.0 - d, 1e-4, 1.0), 2.2) * vA;
    gl_FragColor = vec4(vColor * a, a);
  }`;

// where the lamp's beam touches the sea at a logbook anchor
const SPARK_VERT = /* glsl */`
  attribute float aLit; attribute float aFound;
  uniform float uScale, uShow;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.22 + aLit * 0.85) * uScale / -mv.z;
    vA = (aLit * 1.2 + aFound * 0.22) * uShow;
  }`;
const SPARK_FRAG = /* glsl */`
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(clamp(1.0 - d, 1e-4, 1.0), 2.0) * vA;
    gl_FragColor = vec4(vec3(1.0, 0.85, 0.58) * a, a);
  }`;

const SNOW_VERT = /* glsl */`
  attribute float aPhase;
  uniform float uTime, uScale, uSnow;
  varying float vA;
  void main() {
    vec3 p = position;
    float h = 1.5;
    p.y = mod(p.y - uTime * (0.1 + aPhase * 0.08), h);
    p.x += sin(uTime * 0.8 + aPhase * 20.0) * 0.04;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (0.02 + aPhase * 0.016) * uScale / -mv.z;
    vA = uSnow * smoothstep(0.0, 0.12, p.y) * smoothstep(h, h - 0.3, p.y);
  }`;
const SNOW_FRAG = /* glsl */`
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    gl_FragColor = vec4(vec3(0.97, 0.97, 1.0), smoothstep(1.0, 0.35, d) * vA);
  }`;

const BEAM_VERT = /* glsl */`
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const BEAM_FRAG = /* glsl */`
  uniform vec3 uColor; uniform float uStrength;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main() {
    // pow() of an exact 0 can give NaN on some GPUs, which a half-float target keeps (black rings)
    float along = pow(max(vUv.y, 1e-4), 1.6);
    float edge = pow(max(abs(dot(normalize(vN), normalize(vV))), 1e-4), 1.4);
    float a = along * edge * uStrength;
    gl_FragColor = vec4(uColor * a, a);
  }`;

const HALO_VERT = /* glsl */`
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const HALO_FRAG = /* glsl */`
  uniform float uRs, uBack, uHalo; uniform vec2 uSun2; uniform vec3 cWarm, cCool;
  varying vec2 vP;
  void main() {
    float r = length(vP);
    float x = max(r - uRs, 0.0);
    float a = exp(-x * 1.35) * smoothstep(uRs * 0.93, uRs, r);
    float side = clamp(dot(normalize(vP), uSun2) * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = mix(cCool, cWarm, smoothstep(0.35, 1.0, side) * (0.4 + 0.6 * length(uSun2)) + uBack * 0.5);
    float k = a * (0.28 + 0.5 * side * length(uSun2) + uBack * 0.6) * uHalo;
    gl_FragColor = vec4(c * k, k);
  }`;

// tilt-shift: a sharp horizontal band, blur growing above and below it (separable, 5 taps per pass)
const POST_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BLUR_AT = /* glsl */`
  uniform float uCenter, uHalf, uSoft, uAmt;
  float blurAt(float y) { return uAmt * smoothstep(uHalf, uHalf + uSoft, abs(y - uCenter)); }`;
const POST_H = /* glsl */`
  uniform sampler2D tScene; uniform vec2 uTexel; uniform float uReach;
  varying vec2 vUv;
  ${BLUR_AT}
  void main() {
    vec2 st = vec2(uTexel.x * uReach * blurAt(vUv.y), 0.0);
    vec3 c = texture2D(tScene, vUv).rgb * 0.2270270;
    c += (texture2D(tScene, vUv + st * 1.3846154).rgb + texture2D(tScene, vUv - st * 1.3846154).rgb) * 0.3162162;
    c += (texture2D(tScene, vUv + st * 3.2307692).rgb + texture2D(tScene, vUv - st * 3.2307692).rgb) * 0.0702703;
    gl_FragColor = vec4(c, 1.0);
  }`;
const POST_V = /* glsl */`
  uniform sampler2D tScene, tBlur; uniform vec2 uTexel, uRes; uniform float uReach, uAspect, uTime, uVignette, uGrain;
  varying vec2 vUv;
  ${BLUR_AT}
  void main() {
    float b = blurAt(vUv.y);
    vec2 st = vec2(0.0, uTexel.y * uReach * b);
    vec3 bl = texture2D(tBlur, vUv).rgb * 0.2270270;
    bl += (texture2D(tBlur, vUv + st * 1.3846154).rgb + texture2D(tBlur, vUv - st * 1.3846154).rgb) * 0.3162162;
    bl += (texture2D(tBlur, vUv + st * 3.2307692).rgb + texture2D(tBlur, vUv - st * 3.2307692).rgb) * 0.0702703;
    vec3 c = mix(texture2D(tScene, vUv).rgb, bl, smoothstep(0.0, 0.2, b));
    vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
    c *= mix(1.0, smoothstep(1.25, 0.35, length(q)), uVignette);
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    float n = fract(sin(dot(floor(vUv * uRes) + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
    gl_FragColor.rgb += (n - 0.5) * uGrain;
  }`;

/* ---------- World ---------- */
export async function createWorld(canvas, opts = {}) {
  const { onProgress = () => {}, still = false, mobile = false } = opts;
  const rand = mulberry32(42);
  const motion = { still };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const maxDpr = mobile ? 1.5 : 1.75;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;   // the sun never moves, so shadows render once

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(col('#5A4D7E'), 12, 30);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  scene.add(cam);   // the camera carries the gate title, which sits behind the planet

  onProgress(0.05, 'Raising the hills');
  await yieldFrame();

  /* --- terrain --- */
  const terrain = new THREE.IcosahedronGeometry(1, mobile ? 14 : 18);
  const tp = terrain.attributes.position;
  const cache = new Map();
  for (let i = 0; i < tp.count; i++) {
    _v.fromBufferAttribute(tp, i).normalize();
    const key = `${_v.x.toFixed(5)},${_v.y.toFixed(5)},${_v.z.toFixed(5)}`;
    let h = cache.get(key);
    if (h === undefined) { h = heightAt(_v); cache.set(key, h); }
    _v.multiplyScalar(R + h);
    tp.setXYZ(i, _v.x, _v.y, _v.z);
  }
  const tColors = new Float32Array(tp.count * 3);
  {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cen = new THREE.Vector3(), nrm = new THREE.Vector3();
    const C = {
      deep: col('#2C2F5A'), bed: col('#4A4570'), sand: col('#DDB79E'), sandWet: col('#B99A93'),
      grass: col('#7E9A5E'), grass2: col('#647F51'), meadow: col('#A3B36E'), moss: col('#4E6B4B'), floor: col('#566F48'),
      rock: col('#8E7F9C'), rockHi: col('#B8A2B4'), peak: col('#E8D3CB'),
      field: col('#D2AA6E'), field2: col('#B38A5A'), garden: col('#86A066'), clearing: col('#4F6148'),
    };
    const tmp = new THREE.Color();
    const windT = tangentBasis(SPECS.windmill.dir)[0];
    for (let i = 0; i < tp.count; i += 3) {
      a.fromBufferAttribute(tp, i); b.fromBufferAttribute(tp, i + 1); c.fromBufferAttribute(tp, i + 2);
      cen.copy(a).add(b).add(c).divideScalar(3);
      const h = cen.length() - R;
      const d = cen.clone().normalize();
      nrm.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
      const slope = 1 - Math.abs(nrm.dot(d));
      const n = fbm(d, 6, 2, 4);
      if (h < -0.35) tmp.copy(C.deep);
      else if (h < -0.04) tmp.copy(C.bed).lerp(C.sandWet, smoothstep(-0.3, -0.04, h));
      else if (h < 0.05) tmp.copy(C.sand);
      else if (slope > 0.42 || h > 0.62) tmp.copy(h > 0.82 ? C.peak : (h > 0.5 ? C.rockHi : C.rock));
      else {
        tmp.copy(C.grass).lerp(C.grass2, clamp(n + 0.5, 0, 1));
        if (fbm(d, 3.2, 2, 33) > 0.22) tmp.copy(C.meadow);
        if (forestMask(d) > 0.08) tmp.copy(C.floor);
        tmp.lerp(C.moss, smoothstep(0.34, 0.58, h));
        const aw = angleDeg(d, SPECS.windmill.dir);
        if (aw > 5.5 && aw < 15) tmp.copy(Math.floor(d.dot(windT) * 11 + 20) % 2 ? C.field : C.field2);
        if (angleDeg(d, SPECS.cottage.dir) < 7.5) tmp.copy(C.garden);
        if (angleDeg(d, SPECS.grove.dir) < 6.5) tmp.copy(C.clearing);
      }
      const k = 1 + (rand() - 0.5) * 0.1;
      for (let v = 0; v < 3; v++) { const j = (i + v) * 3; tColors[j] = tmp.r * k; tColors[j + 1] = tmp.g * k; tColors[j + 2] = tmp.b * k; }
    }
  }
  terrain.deleteAttribute('uv'); terrain.deleteAttribute('normal');

  const parts = [{ geo: terrain, colors: tColors }];
  const glowParts = [];
  const groveParts = [];
  const add = (geo, color, m, jitter) => parts.push({ geo, color: col(color), m, jitter });
  const glow = (geo, color, m) => glowParts.push({ geo, color: col(color), m, jitter: 0 });
  const glowPoints = [];   // [x, y, z, size, r, g, b, drift]
  const pushGlow = (p, size, color, drift = 0) => { const c = col(color); glowPoints.push([p.x, p.y, p.z, size, c.r, c.g, c.b, drift]); };
  const local = (M, x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(M);

  onProgress(0.2, 'Planting trees');
  await yieldFrame();

  /* --- trees and rocks --- */
  const FOLIAGE = ['#2F5C46', '#3B6B4E', '#28503D', '#4C7954', '#36604B', '#5A557A'];
  const ROUND = ['#6F8F57', '#7E9A5C', '#A5677D'];
  function addTree(dir, s, sink = add) {
    const M = surfaceFrame(dir, rand() * Math.PI * 2, -0.02, s);
    sink(G.cyl5, '#5A3A44', mul(M, L(0, 0.07, 0, 0, 0, 0, 0.026, 0.16, 0.026)));
    if (rand() < 0.22) {
      sink(G.ico, ROUND[Math.floor(rand() * ROUND.length)], mul(M, L(0, 0.25, 0, rand(), rand(), 0, 0.13, 0.15, 0.13)), 0.12);
    } else {
      const c = FOLIAGE[Math.floor(rand() * FOLIAGE.length)];
      sink(G.cone6, c, mul(M, L(0, 0.24, 0, 0, rand(), 0, 0.15, 0.3, 0.15)), 0.12);
      sink(G.cone6, c, mul(M, L(0, 0.4, 0, 0, rand(), 0, 0.105, 0.24, 0.105)), 0.12);
    }
    return M;
  }
  const randomDir = () => {
    const u = rand() * 2 - 1, t = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    return new THREE.Vector3(s * Math.cos(t), u, s * Math.sin(t));
  };
  const steep = (d) => {
    const [t1, t2] = tangentBasis(d);
    const e = 0.012, h0 = heightAt(d);
    const h1 = heightAt(d.clone().addScaledVector(t1, e).normalize()), h2 = heightAt(d.clone().addScaledVector(t2, e).normalize());
    return Math.max(Math.abs(h1 - h0), Math.abs(h2 - h0)) / (e * R) > 0.55;
  };
  let planted = 0;
  for (let tries = 0; planted < (mobile ? 150 : 200) && tries < 6000; tries++) {
    const d = randomDir();
    const h = heightAt(d);
    if (h < 0.09 || h > 0.6 || steep(d)) continue;
    if (forestMask(d) < 0.02 && rand() > 0.12) continue;   // trees gather into woods
    let clear = true;
    for (const [id, s] of Object.entries(SPECS)) {
      const a = angleDeg(d, s.dir);
      if (a < (id === 'windmill' ? 16 : s.r1 + 0.5)) { clear = false; break; }
    }
    if (!clear) continue;
    addTree(d, 0.95 + rand() * 0.6);
    planted++;
  }
  // the grove: thirty trees round a clearing, one per day of the project; they grow in a spiral
  {
    const ring = [];
    for (let tries = 0; ring.length < 30 && tries < 400; tries++) {
      const bearing = rand() * Math.PI * 2, a = 6.6 + rand() * 7.5;
      const d = offsetDir(SPECS.grove.dir, a, bearing);
      if (heightAt(d) < 0.09) continue;
      ring.push({ d, bearing: bearing + (a - 6.6) * 0.05 });
    }
    ring.sort((p, q) => p.bearing - q.bearing);
    ring.forEach(({ d }, k) => {
      const base = d.clone().multiplyScalar(R + heightAt(d) - 0.02);
      addTree(d, 1.05 + rand() * 0.6, (geo, color, m, jitter) => groveParts.push({ geo, color: col(color), m, jitter, base, grow: k }));
    });
  }
  for (let i = 0, placed = 0; placed < 36 && i < 900; i++) {
    const d = randomDir();
    const h = heightAt(d);
    if (h < -0.02 || h > 0.9) continue;
    if (Object.values(SPECS).some((s) => angleDeg(d, s.dir) < s.r1)) continue;
    const s = 0.05 + rand() * 0.09;
    add(G.dodec, rand() < 0.5 ? '#8C7F98' : '#7A6E88', mul(surfaceFrame(d, rand() * 6, -s * 0.3), L(0, 0, 0, rand(), rand(), rand(), s, s * 0.7, s)), 0.1);
    placed++;
  }

  onProgress(0.4, 'Building the cottage');
  await yieldFrame();

  /* --- places --- */
  const camDefault = dirLL(24, 120);
  const P = {};
  const placeFrame = (id, yaw) => {
    const s = SPECS[id];
    const M = surfaceFrame(s.dir, yaw);
    P[id] = { id, dir: s.dir.clone(), M, yaw };
    return M;
  };

  // Cottage
  {
    const M = placeFrame('cottage', yawToward(SPECS.cottage.dir, camDefault) + 0.35);
    add(G.box, '#8F8494', mul(M, L(0, 0.03, 0, 0, 0, 0, 0.72, 0.08, 0.58)));
    add(G.box, '#E3B4A5', mul(M, L(0, 0.25, 0, 0, 0, 0, 0.62, 0.36, 0.46)), 0.04);
    add(G.prism, '#884D6D', mul(M, L(0, 0.43, 0, 0, Math.PI / 2, 0, 0.58, 0.3, 0.74)), 0.04);
    add(G.box, '#7D5E6E', mul(M, L(0.17, 0.6, -0.12, 0, 0, 0, 0.08, 0.3, 0.08)));
    add(G.box, '#572145', mul(M, L(0, 0.15, 0.232, 0, 0, 0, 0.11, 0.2, 0.02)));
    for (const x of [-0.19, 0.19]) glow(G.box, '#F2A65A', mul(M, L(x, 0.28, 0.233, 0, 0, 0, 0.1, 0.09, 0.014)));
    glow(G.box, '#F2A65A', mul(M, L(0.312, 0.28, 0, 0, 0, 0, 0.014, 0.09, 0.1)));
    glow(G.box, '#F2A65A', mul(M, L(-0.312, 0.28, 0.06, 0, 0, 0, 0.014, 0.09, 0.1)));
    for (const x of [-0.19, 0.19]) pushGlow(local(M, x, 0.28, 0.27), 0.5, '#F2A65A');
    pushGlow(local(M, 0.34, 0.28, 0), 0.4, '#F2A65A');
    // garden: bushes, fence with a gate gap, a path, a lamp
    add(G.ico, '#5C8152', mul(M, L(-0.39, 0.06, 0.2, 0, 0.4, 0, 0.09)), 0.12);
    add(G.ico, '#6C9158', mul(M, L(0.38, 0.05, 0.25, 0.3, 0, 0, 0.07)), 0.12);
    add(G.ico, '#A5677D', mul(M, L(-0.42, 0.05, -0.18, 0, 0, 0.5, 0.07)), 0.12);
    for (let x = -0.36; x <= 0.37; x += 0.09) if (Math.abs(x) > 0.08) add(G.box, '#D9C2B8', mul(M, L(x, 0.05, 0.42, 0, 0, 0, 0.022, 0.1, 0.022)));
    add(G.box, '#D9C2B8', mul(M, L(-0.23, 0.07, 0.42, 0, 0, 0, 0.28, 0.016, 0.014)));
    add(G.box, '#D9C2B8', mul(M, L(0.23, 0.07, 0.42, 0, 0, 0, 0.28, 0.016, 0.014)));
    [[0, 0.3], [0.03, 0.4], [-0.02, 0.5], [0.02, 0.6]].forEach(([x, z]) => add(G.cyl8, '#B6A3AE', mul(M, L(x, 0.005, z, 0, 0, 0, 0.045, 0.02, 0.045))));
    add(G.cyl6, '#3A2A3D', mul(M, L(0.27, 0.14, 0.36, 0, 0, 0, 0.012, 0.28, 0.012)));
    glow(G.box, '#FFD8A0', mul(M, L(0.27, 0.3, 0.36, 0, 0, 0, 0.045, 0.05, 0.045)));
    pushGlow(local(M, 0.27, 0.3, 0.36), 0.55, '#FFC680');
    P.cottage.chimney = local(M, 0.17, 0.76, -0.12);
    P.cottage.anchor = local(M, 0, 0.98, 0);
    P.cottage.view = { yaw: 0.15, el: 27, dist: 4.1, lift: 0.3 };
    P.cottage.pick = { y: 0.35, r: 0.55 };
  }

  onProgress(0.5, 'Turning the windmill');
  await yieldFrame();

  // Windmill, with a flour chute and a sack by the door
  const bladeParts = [];
  {
    const M = placeFrame('windmill', yawToward(SPECS.windmill.dir, camDefault) - 0.25);
    add(G.cyl8, '#8F8494', mul(M, L(0, 0.04, 0, 0, 0, 0, 0.3, 0.08, 0.3)));
    add(taper(0.62, 1, 8), '#EBDCCF', mul(M, L(0, 0.48, 0, 0, 0, 0, 0.22, 0.8, 0.22)), 0.05);
    add(G.cone8, '#884D6D', mul(M, L(0, 0.98, 0, 0, 0, 0, 0.2, 0.22, 0.2)), 0.05);
    add(G.box, '#572145', mul(M, L(0, 0.17, 0.205, 0, 0, 0, 0.09, 0.16, 0.02)));
    add(G.box, '#8E6B62', mul(M, L(0.12, 0.29, 0.25, 0.55, 0, 0, 0.05, 0.025, 0.15)));
    glow(G.box, '#F2A65A', mul(M, L(0, 0.56, 0.17, -0.1, 0, 0, 0.05, 0.06, 0.012)));
    pushGlow(local(M, 0, 0.56, 0.2), 0.35, '#F2A65A');
    // hay bales on the stubble field
    [[0.55, 0.32, 0.3], [-0.5, 0.45, 1.1], [0.3, -0.62, 2.0], [-0.7, -0.2, 0.6]].forEach(([x, z, r]) =>
      add(G.cyl8, '#E0B26C', mul(surfaceFrame(SPECS.windmill.dir, 0), L(x, 0.06, z, Math.PI / 2, r, 0, 0.07, 0.13, 0.07)), 0.06));
    // blades, local to the hub
    bladeParts.push({ geo: G.cyl8, color: col('#572145'), m: L(0, 0, 0, Math.PI / 2, 0, 0, 0.05, 0.07, 0.05) });
    for (let k = 0; k < 4; k++) {
      const r = L(0, 0, 0, 0, 0, k * Math.PI / 2 + Math.PI / 4);
      bladeParts.push({ geo: G.box, color: col('#6B4A55'), m: mul(r, L(0, 0.3, 0, 0, 0, 0, 0.026, 0.6, 0.02)) });
      bladeParts.push({ geo: G.box, color: col('#F3E8DD'), m: mul(r, L(0.068, 0.36, -0.006, 0, 0, 0, 0.11, 0.46, 0.008)), jitter: 0.03 });
    }
    P.windmill.hub = L(0, 0.9, 0.215);
    P.windmill.anchor = local(M, 0, 1.6, 0);
    P.windmill.view = { yaw: -0.25, el: 24, dist: 4.4, lift: 0.55 };
    P.windmill.pick = { y: 0.6, r: 0.7 };
  }

  onProgress(0.6, 'Mooring the boat');
  await yieldFrame();

  // Dock: faces the southern sea
  let boatInfo;
  {
    const M = placeFrame('dock', yawToward(SPECS.dock.dir, OCEANS[0].d));
    for (let i = 0; i < 9; i++) add(G.box, i % 2 ? '#A27E70' : '#8E6B62', mul(M, L(0, 0.07, 0.1 + i * 0.15, 0, 0, 0, 0.4, 0.026, 0.13)), 0.05);
    for (const z of [0.12, 0.55, 0.95, 1.3]) for (const x of [-0.2, 0.2]) add(G.cyl6, '#5A3A44', mul(M, L(x, -0.14, z, 0, 0, 0, 0.026, 0.46, 0.026)));
    add(G.box, '#B68A6A', mul(M, L(0.1, 0.13, 0.32, 0, 0.3, 0, 0.1, 0.1, 0.1)));
    add(G.box, '#9C7560', mul(M, L(0.12, 0.21, 0.31, 0, 0.1, 0, 0.07, 0.06, 0.07)));
    add(G.cyl8, '#7D5E6E', mul(M, L(-0.12, 0.13, 0.48, 0, 0, 0, 0.05, 0.1, 0.05)));
    add(G.cyl6, '#3A2A3D', mul(M, L(0.17, 0.28, 1.3, 0, 0, 0, 0.014, 0.42, 0.014)));
    glow(G.box, '#FFD8A0', mul(M, L(0.17, 0.5, 1.3, 0, 0, 0, 0.05, 0.06, 0.05)));
    pushGlow(local(M, 0.17, 0.5, 1.3), 0.7, '#FFC680');
    add(G.dodec, '#7A6E88', mul(M, L(-0.36, -0.02, -0.02, 0.3, 0.2, 0, 0.13, 0.09, 0.13)), 0.1);
    add(G.dodec, '#8C7F98', mul(M, L(0.33, -0.03, 0.06, 0, 0.6, 0.2, 0.1, 0.07, 0.1)), 0.1);
    // tide marks on the far post: the race only runs below the lowest
    for (let i = 0; i < 3; i++) add(G.box, i === 0 ? '#E3B4A5' : '#F0E6DC', mul(M, L(-0.2, -0.06 + i * 0.05, 1.3, 0, 0, 0, 0.034, 0.012, 0.034)));
    // boat floats beside the end of the jetty
    const zAxis = new THREE.Vector3(0, 0, 1).transformDirection(M), xAxis = new THREE.Vector3(1, 0, 0).transformDirection(M);
    const pos0 = new THREE.Vector3().setFromMatrixPosition(M);
    const bd = pos0.clone().addScaledVector(zAxis, 1.0).addScaledVector(xAxis, 0.46).normalize();
    boatInfo = { dir: bd, yaw: yawToward(bd, zAxis.clone().add(bd)) + 0.15 };
    P.dock.anchor = local(M, 0, 0.62, 0.7);
    P.dock.view = { yaw: 1.05, el: 26, dist: 4.2, lift: 0.1, at: [0, 0, 0.75] };
    P.dock.pick = { y: 0.1, r: 0.6, at: [0, 0, 0.6] };
  }

  onProgress(0.68, 'Lighting the lighthouse');
  await yieldFrame();

  // Lighthouse on its headland; the camera stands behind it, looking out to sea
  {
    const M = placeFrame('lighthouse', yawToward(SPECS.lighthouse.dir, OCEANS[1].d));
    add(G.dodec, '#7C6F86', mul(M, L(0, -0.05, 0, 0.2, 0.3, 0, 0.46, 0.26, 0.46)), 0.12);
    add(G.dodec, '#6A5E78', mul(M, L(0.28, -0.08, 0.3, 0, 0.8, 0.2, 0.26, 0.18, 0.26)), 0.12);
    for (let b = 0; b < 4; b++) {
      const y0 = 0.08 + b * 0.25, r0 = lerp(0.2, 0.13, b / 4), r1 = lerp(0.2, 0.13, (b + 1) / 4);
      add(new THREE.CylinderGeometry(r1, r0, 0.25, 10), b % 2 ? '#B44C5E' : '#F0E6DC', mul(M, L(0, y0 + 0.125, 0)), 0.03);
    }
    add(G.cyl10, '#3A2A3D', mul(M, L(0, 1.1, 0, 0, 0, 0, 0.2, 0.04, 0.2)));
    glow(G.cyl8, '#FFF1D0', mul(M, L(0, 1.2, 0, 0, 0, 0, 0.1, 0.16, 0.1)));
    add(G.cone8, '#572145', mul(M, L(0, 1.36, 0, 0, 0, 0, 0.15, 0.16, 0.15)));
    add(G.ico, '#F2A65A', mul(M, L(0, 1.46, 0, 0, 0, 0, 0.025)));
    add(G.box, '#3A2A3D', mul(M, L(0, 0.17, 0.195, 0, 0, 0, 0.07, 0.14, 0.02)));
    // keeper's hut on the landward side
    add(G.box, '#F0E6DC', mul(M, L(-0.02, 0.11, -0.4, 0, 0.2, 0, 0.3, 0.2, 0.22)), 0.04);
    add(G.prism, '#884D6D', mul(M, L(-0.02, 0.21, -0.4, 0, 0.2 + Math.PI / 2, 0, 0.27, 0.13, 0.34)), 0.04);
    glow(G.box, '#F2A65A', mul(M, L(0.0, 0.12, -0.285, 0, 0.2, 0, 0.07, 0.06, 0.012)));
    pushGlow(local(M, 0.0, 0.12, -0.26), 0.35, '#F2A65A');
    pushGlow(local(M, 0, 1.2, 0), 1.6, '#FFE6B8');
    P.lighthouse.lamp = L(0, 1.2, 0);
    P.lighthouse.anchor = local(M, 0, 1.75, 0);
    P.lighthouse.view = { yaw: Math.PI + 0.28, el: 30, dist: 6.6, lift: 0.75, at: [0, 0, 2.1] };
    P.lighthouse.pick = { y: 0.7, r: 0.75 };
  }

  // eight logbook anchors hang in the beam's path over the sea, spread across the seaward arc
  const LAMP_SPAN = 150;   // the lamp turns ±150° from seaward; the landward arc is shuttered
  const logs = [];
  {
    const M = P.lighthouse.M;
    for (let k = 0; k < 8; k++) {
      const u = -64 + k * (128 / 7) + (rand() - 0.5) * 7;     // degrees from seaward, + to the right
      const phi = -Math.PI / 2 - u * D2R;                     // beam A points along (cos φ, 0, -sin φ)
      const dist = 2.0 + ((k * 0.618) % 1) * 1.2;
      logs.push({ u, phi, pos: local(M, Math.cos(phi) * dist, 1.18 - dist * 0.06, -Math.sin(phi) * dist), lit: 0, found: false });
    }
  }

  onProgress(0.76, 'Lighting the campfire');
  await yieldFrame();

  // Grove: a clearing with a campfire, benches and a tent
  const flameParts = [];
  {
    const M = placeFrame('grove', yawToward(SPECS.grove.dir, UP) + 0.4);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      add(G.dodec, '#8F8494', mul(M, L(Math.cos(a) * 0.13, 0.015, Math.sin(a) * 0.13, a, a, 0, 0.035)), 0.12);
    }
    add(G.cyl6, '#5A3A44', mul(M, L(0, 0.03, 0, 0, 0.5, Math.PI / 2, 0.022, 0.2, 0.022)));
    add(G.cyl6, '#4A2E38', mul(M, L(0, 0.035, 0, 0, -0.8, Math.PI / 2, 0.022, 0.2, 0.022)));
    add(G.cyl8, '#6E4A50', mul(M, L(0.36, 0.05, 0.12, 0, 0.3, Math.PI / 2, 0.045, 0.36, 0.045)));
    add(G.cyl8, '#6E4A50', mul(M, L(-0.16, 0.05, 0.38, 0, -1.1, Math.PI / 2, 0.045, 0.34, 0.045)));
    add(G.prism, '#E9D9C6', mul(M, L(-0.34, 0, -0.3, 0, 0.6, 0, 0.38, 0.3, 0.44)), 0.04);
    add(G.prism, '#3A2A3D', mul(M, L(-0.34 + Math.sin(0.6) * 0.222, 0, -0.3 + Math.cos(0.6) * 0.222, 0, 0.6, 0, 0.15, 0.17, 0.008)));
    add(G.cyl6, '#3A2A3D', mul(M, L(0.1, 0.12, -0.42, 0, 0, 0, 0.01, 0.24, 0.01)));
    glow(G.box, '#FFD8A0', mul(M, L(0.1, 0.25, -0.42, 0, 0, 0, 0.04, 0.05, 0.04)));
    pushGlow(local(M, 0.1, 0.25, -0.42), 0.45, '#FFC680');
    flameParts.push({ geo: G.cone6, color: col('#F2A65A'), m: L(0, 0.09, 0, 0, 0, 0, 0.075, 0.18, 0.075) });
    flameParts.push({ geo: G.cone6, color: col('#FFE2A8'), m: L(0, 0.08, 0, 0, 0.5, 0, 0.042, 0.13, 0.042) });
    pushGlow(local(M, 0, 0.14, 0), 1.5, '#F59A4E');
    for (let i = 0; i < (mobile ? 18 : 30); i++) {
      const a = rand() * Math.PI * 2, r = 0.25 + rand() * 0.75;
      pushGlow(local(M, Math.cos(a) * r, 0.12 + rand() * 0.45, Math.sin(a) * r), 0.12 + rand() * 0.08, '#E8D27A', 0.08 + rand() * 0.08);
    }
    P.grove.fire = local(M, 0, 0.22, 0);
    P.grove.anchor = local(M, 0, 0.85, 0);
    P.grove.view = { yaw: 0.9, el: 40, dist: 4.2, lift: 0.15 };
    P.grove.pick = { y: 0.2, r: 0.6 };
  }

  onProgress(0.84, 'Mixing the paint');
  await yieldFrame();

  /* --- meshes --- */
  const matWorld = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const world = new THREE.Mesh(bake(parts, rand), matWorld);
  world.castShadow = true; world.receiveShadow = true;
  scene.add(world);

  const matGlow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });
  scene.add(new THREE.Mesh(bake(glowParts, rand), matGlow));

  // grove trees scale up from their roots as the day count passes their index
  const uDay = { value: 30 };
  const groveMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  groveMat.onBeforeCompile = (sh) => {
    sh.uniforms.uDay = uDay;
    sh.vertexShader = 'attribute vec3 aBase;\nattribute float aGrow;\nuniform float uDay;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float g = clamp(uDay - aGrow, 0.0, 1.0);
      g = g * g * (3.0 - 2.0 * g);
      g += sin(g * 3.14159) * 0.14;
      transformed = aBase + (transformed - aBase) * g;`);
  };
  groveMat.customProgramCacheKey = () => 'grove';
  const grove = new THREE.Mesh(bake(groveParts, rand), groveMat);
  grove.receiveShadow = true;
  grove.frustumCulled = false;
  scene.add(grove);

  const uTime = { value: 0 };
  const water = new THREE.Mesh(
    new THREE.IcosahedronGeometry(R, mobile ? 14 : 20),
    new THREE.MeshPhongMaterial({ color: col('#585A8E'), specular: col('#FFD3AE'), shininess: 38, flatShading: true, transparent: true, opacity: 0.9 })
  );
  water.material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float w = sin(dot(position, vec3(2.3, 1.7, -1.9)) + uTime * 0.9) * 0.5 + sin(dot(position, vec3(-1.4, 2.6, 1.2)) * 1.3 - uTime * 0.7) * 0.5;
      transformed += normalize(position) * w * 0.03;`);
  };
  water.receiveShadow = true;
  scene.add(water);

  // windmill blades turn about the hub; grains run down the chute into a sack
  const windHolder = new THREE.Object3D();
  P.windmill.M.decompose(windHolder.position, windHolder.quaternion, windHolder.scale);
  const blades = new THREE.Mesh(bake(bladeParts, rand), matWorld);
  P.windmill.hub.decompose(blades.position, blades.quaternion, blades.scale);
  windHolder.add(blades);
  const sack = new THREE.Mesh(bake([
    { geo: G.ico, color: col('#E3D2B4'), m: L(0, 0.07, 0, 0, 0.3, 0, 0.075, 0.09, 0.07), jitter: 0.06 },
    { geo: G.cyl6, color: col('#8E6B62'), m: L(0, 0.15, 0, 0, 0, 0, 0.03, 0.03, 0.03) },
  ], rand), matWorld);
  sack.position.set(0.14, 0, 0.42);
  windHolder.add(sack);
  const GRAINS = 36;
  const grains = new THREE.InstancedMesh(G.ico, new THREE.MeshLambertMaterial({ color: col('#F4E3BF'), emissive: col('#4A3A2A'), flatShading: true }), GRAINS);
  grains.frustumCulled = false;
  windHolder.add(grains);
  const grain = Array.from({ length: GRAINS }, () => ({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 0.016 }));
  const gM = new THREE.Matrix4(), gQ = new THREE.Quaternion(), gS = new THREE.Vector3();
  scene.add(windHolder);

  // lighthouse beam: two additive cones that sweep about the tower
  const lhHolder = new THREE.Object3D();
  P.lighthouse.M.decompose(lhHolder.position, lhHolder.quaternion, lhHolder.scale);
  const beam = new THREE.Group();
  beam.position.set(0, 1.2, 0);
  const beamMat = new THREE.ShaderMaterial({
    vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
    uniforms: { uColor: { value: col('#FFE9C2') }, uStrength: { value: 0.42 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const coneGeo = new THREE.ConeGeometry(0.55, 4.2, 20, 1, true);
  coneGeo.translate(0, -2.1, 0); coneGeo.rotateZ(Math.PI / 2); coneGeo.rotateX(0.06);
  const beamA = new THREE.Mesh(coneGeo, beamMat);
  const beamB = new THREE.Mesh(coneGeo, beamMat); beamB.rotation.y = Math.PI;
  beam.add(beamA, beamB);
  lhHolder.add(beam);
  const lampLight = new THREE.PointLight(col('#FFD9A0'), 2.2, 2.6, 2);
  lampLight.position.set(0, 1.25, 0);
  lhHolder.add(lampLight);
  scene.add(lhHolder);

  // sparkles where the beam crosses a logbook anchor
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(logs.flatMap((l) => [l.pos.x, l.pos.y, l.pos.z]), 3));
  sparkGeo.setAttribute('aLit', new THREE.Float32BufferAttribute(new Float32Array(logs.length), 1));
  sparkGeo.setAttribute('aFound', new THREE.Float32BufferAttribute(new Float32Array(logs.length), 1));
  const sparkMat = new THREE.ShaderMaterial({
    vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG,
    uniforms: { uScale: { value: 500 }, uShow: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false; sparks.renderOrder = 2;
  scene.add(sparks);

  // campfire flames + light
  const fireHolder = new THREE.Object3D();
  P.grove.M.decompose(fireHolder.position, fireHolder.quaternion, fireHolder.scale);
  const flames = new THREE.Mesh(bake(flameParts, rand), matGlow);
  fireHolder.add(flames);
  const fireLight = new THREE.PointLight(col('#FF9A4A'), 3, 2.4, 2);
  fireLight.position.set(0, 0.22, 0);
  fireHolder.add(fireLight);
  scene.add(fireHolder);

  const cottageLight = new THREE.PointLight(col('#FFB870'), 0.45, 1.2, 2);
  cottageLight.position.copy(local(P.cottage.M, 0.1, 0.32, 0.62));
  scene.add(cottageLight);

  // boat
  const boatParts = [
    { geo: taper(1, 0.55, 6), color: col('#6A2A52'), m: L(0, 0, 0, Math.PI / 2, 0, 0, 0.13, 0.46, 0.07) },
    { geo: G.box, color: col('#E3B4A5'), m: L(0, 0.035, 0, 0, 0, 0, 0.17, 0.012, 0.3) },
    { geo: G.cyl6, color: col('#3A2A3D'), m: L(0, 0.27, 0.02, 0, 0, 0, 0.012, 0.48, 0.012) },
    { geo: G.prism, color: col('#F3E8DD'), m: L(0, 0.08, 0.05, 0, Math.PI / 2, 0, 0.26, 0.4, 0.01), jitter: 0.02 },
  ];
  const boat = new THREE.Mesh(bake(boatParts, rand), matWorld);
  boat.castShadow = false;
  const boatQ = new THREE.Quaternion(), boatP = new THREE.Vector3(), boatS = new THREE.Vector3();
  new THREE.Matrix4().compose(boatInfo.dir.clone().multiplyScalar(R + 0.035), (_q.setFromUnitVectors(UP, boatInfo.dir), _q.clone().multiply(_qy.setFromAxisAngle(UP, boatInfo.yaw))), new THREE.Vector3(1, 1, 1))
    .decompose(boatP, boatQ, boatS);
  boat.position.copy(boatP); boat.quaternion.copy(boatQ);
  scene.add(boat);

  // chimney smoke
  const SMOKE = 14;
  const smoke = new THREE.InstancedMesh(G.ico, new THREE.MeshLambertMaterial({ color: col('#F2E8EC'), emissive: col('#6A5C72'), flatShading: true, transparent: true, opacity: 0.85 }), SMOKE);
  smoke.frustumCulled = false;
  scene.add(smoke);
  const smokeUp = P.cottage.dir.clone();
  const [smokeT1, smokeT2] = tangentBasis(smokeUp);
  const smokeDrift = new THREE.Vector3();
  const smokeM = new THREE.Matrix4(), smokeQ = new THREE.Quaternion(), smokeS = new THREE.Vector3(), smokeP = new THREE.Vector3();

  // winter snow round the cottage
  const snowGeo = new THREE.BufferGeometry();
  {
    const sp = [], ph = [];
    for (let i = 0; i < 90; i++) { sp.push((rand() - 0.5) * 1.9, rand() * 1.5, (rand() - 0.5) * 1.9); ph.push(rand()); }
    snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    snowGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1));
  }
  const snowMat = new THREE.ShaderMaterial({
    vertexShader: SNOW_VERT, fragmentShader: SNOW_FRAG,
    uniforms: { uTime, uScale: { value: 500 }, uSnow: { value: 0 } },
    transparent: true, depthWrite: false,
  });
  const snow = new THREE.Points(snowGeo, snowMat);
  snow.frustumCulled = false; snow.renderOrder = 2;
  P.cottage.M.decompose(snow.position, snow.quaternion, snow.scale);
  scene.add(snow);

  // glow sprites (lamps, windows, fire, fireflies)
  const gp = new THREE.BufferGeometry();
  const gpPos = [], gpSize = [], gpCol = [], gpPhase = [], gpDrift = [];
  for (const g of glowPoints) { gpPos.push(g[0], g[1], g[2]); gpSize.push(g[3]); gpCol.push(g[4], g[5], g[6]); gpDrift.push(g[7]); gpPhase.push(rand()); }
  gp.setAttribute('position', new THREE.Float32BufferAttribute(gpPos, 3));
  gp.setAttribute('aSize', new THREE.Float32BufferAttribute(gpSize, 1));
  gp.setAttribute('aColor', new THREE.Float32BufferAttribute(gpCol, 3));
  gp.setAttribute('aPhase', new THREE.Float32BufferAttribute(gpPhase, 1));
  gp.setAttribute('aDrift', new THREE.Float32BufferAttribute(gpDrift, 1));
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
    uniforms: { uTime, uScale: { value: 500 }, uGlow: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const glows = new THREE.Points(gp, glowMat);
  glows.frustumCulled = false;
  glows.renderOrder = 2;
  scene.add(glows);

  // sky dome and stars follow the camera
  const skyUniforms = { uSun: { value: SUN }, uCoreK: { value: 1 } };
  SKY_KEYS.forEach((k, i) => { skyUniforms[k] = { value: LIGHTS.dusk.sky[i].clone() }; });
  const skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, uniforms: skyUniforms });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), skyMat);
  sky.renderOrder = -2; sky.frustumCulled = false;
  scene.add(sky);

  const starGeo = new THREE.BufferGeometry();
  const sp = [], ss = [], sph = [];
  for (let i = 0; i < 900; i++) { const d = randomDir().multiplyScalar(140); sp.push(d.x, d.y, d.z); ss.push(1 + rand() * rand() * 2.6); sph.push(rand()); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  starGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(ss, 1));
  starGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(sph, 1));
  const starMat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
    uniforms: { uSun: { value: SUN }, uTime, uDpr: { value: dpr }, uStars: { value: 1 }, uStarsAll: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -1; stars.frustumCulled = false;
  scene.add(stars);

  // atmosphere: a camera-facing disc behind the planet, brightest on the sun side
  const haloMat = new THREE.ShaderMaterial({
    vertexShader: HALO_VERT, fragmentShader: HALO_FRAG,
    uniforms: { uRs: { value: 5.2 }, uBack: { value: 0 }, uHalo: { value: 0 }, uSun2: { value: new THREE.Vector2() }, cWarm: { value: col('#F6C9A0') }, cCool: { value: col('#8C7BC0') } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), haloMat);
  halo.renderOrder = 1; halo.frustumCulled = false;
  scene.add(halo);

  /* --- lights --- */
  // cool sky fill from the night side, warm bounce from the day side
  const hemi = new THREE.HemisphereLight(col('#8A84D6'), col('#D29A82'), 1.25);
  hemi.position.copy(SUN).negate();
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(col('#FFC898'), 3.1);
  sun.position.copy(SUN).multiplyScalar(20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 8, far: 32 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);

  /* --- places: anchors, viewpoints, pick spheres --- */
  for (const p of Object.values(P)) {
    const v = p.view;
    const at = v.at || [0, 0, 0];
    const e = v.el * D2R;
    // portrait screens see a narrow slice, so their shot stands further back
    const shotAt = (dist) => {
      const camLocal = new THREE.Vector3(at[0] + Math.sin(v.yaw) * Math.cos(e) * dist, at[1] + v.lift + Math.sin(e) * dist, at[2] + Math.cos(v.yaw) * Math.cos(e) * dist);
      const camWorld = camLocal.applyMatrix4(p.M);
      return { dir: camWorld.clone().normalize(), radius: camWorld.length(), target: local(p.M, at[0], at[1] + v.lift, at[2]), up: p.dir.clone(), fov: 1 };
    };
    p.shot = shotAt(v.dist);
    p.shotTall = shotAt(v.dist * 1.32);
    const pa = p.pick.at || [0, 0, 0];
    p.sphere = new THREE.Sphere(local(p.M, pa[0], p.pick.y, pa[2]), p.pick.r);
  }

  /* --- post: tilt-shift, vignette, grain (desktop only) --- */
  const post = { avail: !mobile, on: false, center: 0.5, half: 0.6, amt: 0 };
  let rtScene = null, rtBlur = null, postScene = null, postCam = null, quad = null, matH = null, matV = null;
  const postU = { uCenter: { value: 0.5 }, uHalf: { value: 0.6 }, uSoft: { value: 0.22 }, uAmt: { value: 0 }, uReach: { value: 4.4 }, uTexel: { value: new THREE.Vector2(1, 1) } };
  if (post.avail) {
    rtScene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    rtBlur = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    matH = new THREE.ShaderMaterial({ vertexShader: POST_VERT, fragmentShader: POST_H, uniforms: { tScene: { value: rtScene.texture }, ...postU }, depthTest: false, depthWrite: false, toneMapped: false });
    matV = new THREE.ShaderMaterial({
      vertexShader: POST_VERT, fragmentShader: POST_V, depthTest: false, depthWrite: false,
      uniforms: { tScene: { value: rtScene.texture }, tBlur: { value: rtBlur.texture }, ...postU, uRes: { value: new THREE.Vector2(1, 1) }, uAspect: { value: 1 }, uTime: { value: 0 }, uVignette: { value: 0.35 }, uGrain: { value: 0.04 } },
    });
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matH);
    quad.frustumCulled = false;
    postScene = new THREE.Scene(); postScene.add(quad);
    postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    post.on = true;
  }
  const _size = new THREE.Vector2();
  function resizePost() {
    if (!post.avail) return;
    renderer.getDrawingBufferSize(_size);
    rtScene.setSize(_size.x, _size.y);
    rtBlur.setSize(Math.ceil(_size.x / 2), Math.ceil(_size.y / 2));
    postU.uTexel.value.set(1 / _size.x, 1 / _size.y);
    matV.uniforms.uRes.value.copy(_size);
    matV.uniforms.uAspect.value = _size.x / _size.y;
  }
  function render() {
    if (post.on) {
      renderer.setRenderTarget(rtScene); renderer.render(scene, cam);
      quad.material = matH; renderer.setRenderTarget(rtBlur); renderer.render(postScene, postCam);
      quad.material = matV; renderer.setRenderTarget(null); renderer.render(postScene, postCam);
    } else {
      renderer.setRenderTarget(null); renderer.render(scene, cam);
    }
  }

  onProgress(0.92, 'Warming up the lamps');
  await yieldFrame();

  /* ---------- Camera ---------- */
  const S = { dir: camDefault.clone(), radius: 20, target: new THREE.Vector3(), up: UP.clone(), fov: 1 };
  const orbit = { theta: 0, phi: 0, dist: 20, tTheta: 0, tPhi: 0, tDist: 20, vTheta: 0, vPhi: 0 };
  let mode = 'free';           // free | flight | focus
  let flight = null;
  let focusId = null;
  let baseFov = 40;
  let fitDist = 20;
  let idle = 0;
  const view = { w: 1, h: 1, ox: 0, oy: 0, tox: 0, toy: 0 };
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  const PHI_MIN = 0.32, PHI_MAX = Math.PI - 0.32;

  function syncOrbitFromS() {
    const sph = new THREE.Spherical().setFromVector3(S.dir);
    orbit.theta = orbit.tTheta = sph.theta;
    orbit.phi = orbit.tPhi = clamp(sph.phi, PHI_MIN, PHI_MAX);
    orbit.dist = S.radius;
    orbit.vTheta = orbit.vPhi = 0;
  }
  function setOrbit(dir, dist, instant) {
    const sph = new THREE.Spherical().setFromVector3(dir);
    // take the short way round
    let th = sph.theta;
    while (th - orbit.theta > Math.PI) th -= Math.PI * 2;
    while (th - orbit.theta < -Math.PI) th += Math.PI * 2;
    orbit.tTheta = th; orbit.tPhi = clamp(sph.phi, PHI_MIN, PHI_MAX); orbit.tDist = dist;
    if (instant) { orbit.theta = orbit.tTheta; orbit.phi = orbit.tPhi; orbit.dist = dist; }
  }
  const snapshot = () => ({ dir: S.dir.clone(), radius: S.radius, target: S.target.clone(), up: S.up.clone(), fov: S.fov });
  const freeShot = (dir, dist) => ({ dir: dir.clone().normalize(), radius: dist, target: ORIGIN.clone(), up: UP.clone(), fov: 1 });

  function slerpDir(a, b, t, out) {
    const d = clamp(a.dot(b), -1, 1);
    const om = Math.acos(d);
    if (om < 1e-4) return out.copy(a);
    let bb = b;
    if (Math.PI - om < 1e-3) bb = tangentBasis(a)[0];   // opposite: go round via a perpendicular
    const s = Math.sin(om);
    return out.copy(a).multiplyScalar(Math.sin((1 - t) * om) / s).addScaledVector(bb, Math.sin(t * om) / s).normalize();
  }

  function fly(to, { duration = 2.2, lift = 0, endMode = 'focus', onDone } = {}) {
    if (motion.still || duration <= 0) {
      Object.assign(S, { dir: to.dir.clone(), radius: to.radius, target: to.target.clone(), up: to.up.clone(), fov: to.fov });
      flight = null;
      mode = endMode;
      if (mode === 'free') syncOrbitFromS();
      onDone && onDone();
      return;
    }
    flight = { from: snapshot(), to, t: 0, duration, lift, endMode, onDone };
    mode = 'flight';
  }

  function computeFit() {
    const vf = cam.fov * D2R;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
    const half = Math.min(vf, hf) / 2;
    const fill = cam.aspect < 0.7 ? 0.94 : cam.aspect < 1 ? 0.84 : 0.64;
    fitDist = (R + 0.6) / Math.sin(half * fill);
  }

  /* ---------- Gate: framing, title behind the planet, sun-up ---------- */
  const gateState = { on: true, cx: 0, cy: 0, r: 0 };
  let titleMesh = null, titleRect = null, titleT0 = -1, titleOut = -1;
  let riseT0 = -1, rise = motion.still ? 1 : 0;
  const focalPx = () => (view.h / 2) / Math.tan((cam.fov * D2R) / 2);

  function frameGate() {
    if (!gateState.r) return;
    // distance so the planet's radius fills r px; offsets so its centre lands at (cx, cy)
    const ang = Math.atan(gateState.r / focalPx());
    orbit.dist = orbit.tDist = (R + 0.55) / Math.sin(ang);
    view.ox = view.tox = view.w / 2 - gateState.cx;
    view.oy = view.toy = view.h / 2 - gateState.cy;
  }

  function updateTitle(now) {
    if (!titleMesh || !titleMesh.visible) return;
    let a = 1, lift = 0;
    if (!motion.still) {
      const e = titleT0 < 0 ? 0 : easeOut((now - titleT0) / 1400);
      a = e; lift = (1 - e) * 40;            // settles up into place
    }
    if (titleOut >= 0) {
      const o = clamp((now - titleOut) / 700, 0, 1);
      a *= 1 - o; lift -= easeOut(o) * 30;
      if (o >= 1) titleMesh.visible = false;
    }
    const z = S.radius + 7;                  // well behind the globe, so the planet occludes its foot
    const k = z / focalPx();
    const r = titleRect;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2 + lift;
    titleMesh.position.set((cx - view.w / 2 + view.ox) * k, (view.h / 2 - view.oy - cy) * k, -z);
    titleMesh.scale.set(r.w * k, r.h * k, 1);
    titleMesh.material.opacity = a;
  }

  /* ---------- Play state ---------- */
  const play = {
    lampManual: false, lampTarget: 0, lampAngle: 0,
    month: new Date().getMonth(), snow: 0,
    day: 30, dayCur: 30,
    tide: 0, tideCur: 0,
    grind: false, speed: 1, bladeAngle: 0, sack: 0, spawn: 0,
  };
  const lampU = (phi) => {                      // beam angle → degrees from seaward, wrapped to ±180
    let u = -(phi + Math.PI / 2) / D2R;
    return u - 360 * Math.round(u / 360);
  };

  /* ---------- Light ---------- */
  const lightCur = makeLight(LIGHT_DEFS.dusk), lightTgt = makeLight(LIGHT_DEFS.dusk);
  function retarget() {
    copyLight(lightTgt, LIGHTS[focusId ? PLACE_LIGHT[focusId] : 'dusk']);
    if (focusId === 'cottage') applyMonth(lightTgt, play.month);
    if (motion.still) copyLight(lightCur, lightTgt);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    view.w = w; view.h = h;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    baseFov = cam.aspect < 1 ? 50 : 40;
    cam.fov = baseFov * S.fov;
    cam.updateProjectionMatrix();
    const prevFit = fitDist;
    computeFit();
    if (mode === 'free' && !gateState.on) orbit.tDist = clamp(orbit.tDist * (fitDist / prevFit), fitDist * 0.6, fitDist * 1.35);
    const scale = (h * renderer.getPixelRatio()) / (2 * Math.tan((cam.fov * D2R) / 2));
    glowMat.uniforms.uScale.value = scale;
    sparkMat.uniforms.uScale.value = scale;
    snowMat.uniforms.uScale.value = scale;
    resizePost();
  }

  /* ---------- Input ---------- */
  const listeners = { pick: () => {}, hover: () => {}, userMove: () => {}, log: () => {}, quality: () => {} };
  let interactive = false;
  const pointers = new Map();
  let drag = null, pinch = null, hoverId = null, hoverDirty = false, lastPointer = null;

  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const planetSphere = new THREE.Sphere(ORIGIN, R + 0.12);
  const hitP = new THREE.Vector3();
  function pickAt(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, cam);
    const ray = raycaster.ray;
    const planetHit = ray.intersectSphere(planetSphere, hitP) ? hitP.distanceTo(ray.origin) : Infinity;
    let best = null, bestD = Infinity;
    for (const p of Object.values(P)) {
      if (!ray.intersectSphere(p.sphere, hitP)) continue;
      const d = hitP.distanceTo(ray.origin);
      if (d < bestD && d < planetHit + p.sphere.radius * 0.6) { best = p.id; bestD = d; }
    }
    return best;
  }

  function userMoved() {
    idle = 0;
    if (mode !== 'free') {
      // leaving a place: keep the current view, then ease back out to the planet
      flight = null;
      mode = 'free';
      syncOrbitFromS();
      orbit.tDist = fitDist;
      focusId = null;
      play.lampManual = false;
      retarget();
      view.tox = view.toy = 0;
      listeners.userMove();
    }
  }

  const onPointerDown = (e) => {
    if (!interactive) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already-released pointer */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, t: performance.now() };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: orbit.tDist };
      drag = null;
    }
  };
  const onPointerMove = (e) => {
    lastPointer = e;
    if (e.pointerType === 'mouse') {
      parallax.tx = (e.clientX / view.w) * 2 - 1;
      parallax.ty = (e.clientY / view.h) * 2 - 1;
    }
    if (!interactive) return;
    if (!pointers.has(e.pointerId)) { if (e.pointerType === 'mouse') hoverDirty = true; return; }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      userMoved();
      orbit.tDist = clamp(pinch.dist * (pinch.d / Math.max(d, 1)), fitDist * 0.6, fitDist * 1.35);
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) { drag.moved = true; userMoved(); }
    if (drag.moved) {
      const k = (Math.PI * 1.1) / Math.max(view.h, 400) * (orbit.dist / fitDist);
      orbit.tTheta -= dx * k;
      orbit.tPhi = clamp(orbit.tPhi - dy * k, PHI_MIN, PHI_MAX);
      const now = performance.now(), dt = Math.max((now - drag.t) / 1000, 1 / 120);
      orbit.vTheta = lerp(orbit.vTheta, (-dx * k) / dt, 0.4);
      orbit.vPhi = lerp(orbit.vPhi, (-dy * k) / dt, 0.4);
      drag.t = now;
    }
    drag.x = e.clientX; drag.y = e.clientY;
  };
  const onPointerUp = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && !drag.moved && e.type === 'pointerup') {
      const id = pickAt(e.clientX, e.clientY);
      if (id) listeners.pick(id);
    }
    if (drag && performance.now() - drag.t > 80) { orbit.vTheta = 0; orbit.vPhi = 0; }
    drag = null;
  };
  const onWheel = (e) => {
    if (!interactive) return;
    e.preventDefault();
    userMoved();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    orbit.tDist = clamp(orbit.tDist * Math.exp(dy * 0.0012), fitDist * 0.6, fitDist * 1.35);
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  /* ---------- Loop ---------- */
  let running = false, last = 0, ambientT = 0, frames = 0, frameAcc = 0;
  const frameCbs = [];
  const camRight = new THREE.Vector3(), camUpV = new THREE.Vector3(), tmp = new THREE.Vector3();
  const haloX = new THREE.Vector3(), haloY = new THREE.Vector3();
  const sparkLit = sparkGeo.attributes.aLit, sparkFound = sparkGeo.attributes.aFound;

  function applyLight(L) {
    const r = easeOut(rise);
    SKY_KEYS.forEach((k, i) => skyUniforms[k].value.copy(L.sky[i]));
    skyUniforms.uCoreK.value = lerp(0.2, 1, r);
    sun.color.copy(L.sun); sun.intensity = L.sunI * lerp(0.45, 1, r);
    hemi.color.copy(L.hemiSky); hemi.groundColor.copy(L.hemiGround); hemi.intensity = L.hemiI;
    scene.fog.color.copy(L.fog);
    const dT = cam.position.distanceTo(S.target);
    scene.fog.near = Math.max(0.1, dT + L.fogNear);
    scene.fog.far = dT + L.fogFar;
    renderer.toneMappingExposure = L.exposure * lerp(0.62, 1, r);
    starMat.uniforms.uStars.value = L.stars; starMat.uniforms.uStarsAll.value = L.starsAll;
    glowMat.uniforms.uGlow.value = L.glow * r;
    matGlow.color.setScalar(0.55 + 0.45 * L.glow);
    lampLight.intensity = 1.4 * L.glow; cottageLight.intensity = 0.4 * L.glow;
    beamMat.uniforms.uStrength.value = play.lampManual ? Math.max(L.beam, 0.62) : L.beam;
    haloMat.uniforms.cWarm.value.copy(L.haloWarm); haloMat.uniforms.cCool.value.copy(L.haloCool);
    haloMat.uniforms.uHalo.value = L.halo * r;
    water.material.color.copy(L.water);
  }

  function update(dt, now) {
    idle += dt;
    if (riseT0 >= 0 && rise < 1) rise = clamp((now - riseT0) / 1200, 0, 1);
    // camera
    if (mode === 'flight' && flight) {
      flight.t = Math.min(1, flight.t + dt / flight.duration);
      const k = easeInOut(flight.t);
      slerpDir(flight.from.dir, flight.to.dir, k, S.dir);
      S.radius = lerp(flight.from.radius, flight.to.radius, k) + Math.sin(Math.PI * k) * flight.lift;
      S.target.lerpVectors(flight.from.target, flight.to.target, k);
      slerpDir(flight.from.up, flight.to.up, k, S.up);
      S.fov = lerp(flight.from.fov, flight.to.fov, k);
      if (flight.t >= 1) {
        const done = flight.onDone;
        mode = flight.endMode;
        flight = null;
        if (mode === 'free') syncOrbitFromS();
        done && done();
      }
    } else if (mode === 'free') {
      if (!drag) {
        orbit.tTheta += orbit.vTheta * dt; orbit.tPhi = clamp(orbit.tPhi + orbit.vPhi * dt, PHI_MIN, PHI_MAX);
        const decay = Math.exp(-3.5 * dt);
        orbit.vTheta *= decay; orbit.vPhi *= decay;
      }
      if (!motion.still && (gateState.on || idle > 4) && !drag) orbit.tTheta += 0.045 * dt;   // idle spin
      orbit.theta = damp(orbit.theta, orbit.tTheta, 6, dt);
      orbit.phi = damp(orbit.phi, orbit.tPhi, 6, dt);
      orbit.dist = damp(orbit.dist, orbit.tDist, 4, dt);
      S.dir.setFromSphericalCoords(1, orbit.phi, orbit.theta);
      S.radius = orbit.dist;
      S.target.lerp(ORIGIN, 1 - Math.exp(-4 * dt));
      S.up.lerp(UP, 1 - Math.exp(-4 * dt)).normalize();
      S.fov = damp(S.fov, 1, 4, dt);
    }
    // panel offset (shifts the projection centre so the subject clears the panel)
    view.ox = damp(view.ox, view.tox, 4, dt);
    view.oy = damp(view.oy, view.toy, 4, dt);
    cam.fov = baseFov * S.fov;
    if (Math.abs(view.ox) > 0.5 || Math.abs(view.oy) > 0.5) cam.setViewOffset(view.w, view.h, view.ox, view.oy, view.w, view.h);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();

    parallax.x = damp(parallax.x, motion.still ? 0 : parallax.tx, 3, dt);
    parallax.y = damp(parallax.y, motion.still ? 0 : parallax.ty, 3, dt);
    cam.position.copy(S.dir).multiplyScalar(S.radius);
    cam.up.copy(S.up);
    cam.lookAt(S.target);
    const pk = mode === 'free' ? 0.28 : 0.1;
    camRight.setFromMatrixColumn(cam.matrix, 0); camUpV.setFromMatrixColumn(cam.matrix, 1);
    cam.position.addScaledVector(camRight, parallax.x * pk).addScaledVector(camUpV, -parallax.y * pk * 0.6);
    cam.lookAt(S.target);
    cam.updateMatrixWorld();
    updateTitle(now);

    // light: ease towards this place's hour
    lerpLight(lightCur, lightTgt, motion.still ? 1 : 1 - Math.exp(-2.4 * dt));
    applyLight(lightCur);

    // ambient motion
    if (!motion.still) ambientT += dt;
    const t = ambientT;
    uTime.value = t;
    const flick = 1 + 0.13 * Math.sin(t * 13.1) + 0.08 * Math.sin(t * 21.7 + 1.3);
    flames.scale.set(1, flick, 1);
    fireLight.intensity = (2.6 + flick * 0.9) * lightCur.glow;

    // lamp: turns by itself until someone takes the handle
    if (play.lampManual) play.lampAngle = motion.still ? play.lampTarget : damp(play.lampAngle, play.lampTarget, 5, dt);
    else if (!motion.still) play.lampAngle += 0.85 * dt;
    beam.rotation.y = play.lampAngle;
    beamB.visible = !play.lampManual;
    for (let k = 0; k < logs.length; k++) {
      const lg = logs[k];
      lg.lit = play.lampManual ? smoothstep(0.24, 0.035, Math.abs(wrapPi(play.lampAngle - lg.phi))) : 0;
      if (lg.lit > 0.55 && !lg.found) { lg.found = true; sparkFound.setX(k, 1); sparkFound.needsUpdate = true; listeners.log(k); }
      sparkLit.setX(k, lg.lit);
    }
    sparkLit.needsUpdate = true;
    sparkMat.uniforms.uShow.value = damp(sparkMat.uniforms.uShow.value, focusId === 'lighthouse' ? 1 : 0, 3, dt);

    // windmill: hold to grind spins the sails up to 4×, then they coast down
    play.speed = damp(play.speed, play.grind ? 4 : 1, play.grind ? 1.1 : 0.55, dt);
    play.bladeAngle -= 0.9 * dt * (motion.still ? Math.max(0, play.speed - 1) * 1.33 : play.speed);
    blades.rotation.z = play.bladeAngle;
    const milling = play.speed > 1.8;
    if (milling) { play.spawn += dt * (play.speed - 1.8) * 16; play.sack = Math.min(1, play.sack + dt * 0.04); }
    sack.scale.set(1 + play.sack * 0.25, 0.8 + play.sack * 0.55, 1 + play.sack * 0.25);
    for (let i = 0; i < GRAINS; i++) {
      const g = grain[i];
      if (!g.alive && milling && play.spawn >= 1) {
        play.spawn -= 1;
        g.alive = true; g.s = 0.017 + Math.random() * 0.01;
        g.p.set(0.12 + (Math.random() - 0.5) * 0.03, 0.27, 0.33);
        g.v.set((Math.random() - 0.5) * 0.12, 0.05 + Math.random() * 0.08, 0.1 + Math.random() * 0.12);
      }
      if (g.alive) {
        g.v.y -= 1.7 * dt;
        g.p.addScaledVector(g.v, dt);
        if (g.p.y < 0.12 + play.sack * 0.06) g.alive = false;
      }
      gM.compose(g.p, gQ, gS.setScalar(g.alive ? g.s : 0));
      grains.setMatrixAt(i, gM);
    }
    grains.instanceMatrix.needsUpdate = true;
    play.spawn = Math.min(play.spawn, 3);

    // tide raises the whole sea and the boat with it
    play.tideCur = motion.still ? play.tide : damp(play.tideCur, play.tide, 2.5, dt);
    water.scale.setScalar(1 + play.tideCur / R);
    boat.position.copy(boatP).addScaledVector(boatInfo.dir, play.tideCur + Math.sin(t * 1.3) * 0.012);
    boat.quaternion.copy(boatQ).multiply(_qy.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(t * 1.1) * 0.06));

    // grove: trees appear one per day, in a spiral round the fire
    const dd = play.day - play.dayCur;
    play.dayCur = motion.still ? play.day : play.dayCur + clamp(dd, -14 * dt, 14 * dt);
    uDay.value = play.dayCur;

    // cottage smoke: heavy in winter, thin in summer, the wind turning with the months
    const summer = summerOf(play.month);
    const smokeK = lerp(1.35, 0.45, summer);
    const wa = play.month * 0.52;
    smokeDrift.copy(smokeT1).multiplyScalar(Math.cos(wa)).addScaledVector(smokeT2, Math.sin(wa));
    for (let i = 0; i < SMOKE; i++) {
      const k = (t * 0.14 + i / SMOKE) % 1;
      const wob = Math.sin(i * 2.4 + t * 0.7) * 0.03 * k;
      smokeP.copy(P.cottage.chimney).addScaledVector(smokeUp, k * 0.72).addScaledVector(smokeDrift, k * k * 0.34).addScaledVector(smokeT2, wob);
      const s = (0.016 + k * 0.04) * smokeK * (1 - smoothstep(0.7, 1, k));
      smokeQ.setFromAxisAngle(smokeUp, i * 1.7 + k);
      smokeM.compose(smokeP, smokeQ, smokeS.set(s, s, s));
      smoke.setMatrixAt(i, smokeM);
    }
    smoke.instanceMatrix.needsUpdate = true;
    const winter = smoothstep(0.3, 0.05, summer);
    play.snow = damp(play.snow, focusId === 'cottage' ? winter : 0, 2, dt);
    snowMat.uniforms.uSnow.value = play.snow;
    snow.visible = play.snow > 0.01;

    // sky, stars and halo track the camera
    sky.position.copy(cam.position);
    stars.position.copy(cam.position);
    // the disc faces the camera position (not its view direction) so its ring matches the planet's silhouette
    halo.lookAt(cam.position);
    halo.updateMatrix();
    haloX.setFromMatrixColumn(halo.matrix, 0); haloY.setFromMatrixColumn(halo.matrix, 1);
    const D = cam.position.length();
    const rp = R + 0.15;
    haloMat.uniforms.uRs.value = (rp * D) / Math.sqrt(Math.max(D * D - rp * rp, 0.01));
    tmp.copy(cam.position).normalize();
    haloMat.uniforms.uSun2.value.set(SUN.dot(haloX), SUN.dot(haloY));
    haloMat.uniforms.uBack.value = smoothstep(0.2, -0.9, SUN.dot(tmp));

    // tilt-shift band: off on the gate, wide in orbit, narrow on a place
    if (post.on) {
      const focused = mode !== 'free';
      const bandHalf = gateState.on ? 0.6 : focused ? 0.1 : 0.12;
      const amt = gateState.on ? 0 : 1;
      tmp.copy(S.target).project(cam);
      const k = motion.still ? 1 : 1 - Math.exp(-3 * dt);
      postU.uCenter.value += (clamp(tmp.y * 0.5 + 0.5, 0.2, 0.8) - postU.uCenter.value) * k;
      postU.uHalf.value += (bandHalf - postU.uHalf.value) * k;
      postU.uAmt.value += (amt - postU.uAmt.value) * k;
      matV.uniforms.uTime.value = now / 1000;
    }
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
    last = now;
    update(dt, now);
    if (hoverDirty && lastPointer && interactive && !drag) {
      hoverDirty = false;
      const id = pickAt(lastPointer.clientX, lastPointer.clientY);
      if (id !== hoverId) { hoverId = id; canvas.style.cursor = id ? 'pointer' : ''; listeners.hover(id); }
    }
    render();
    for (const cb of frameCbs) cb();
    // adaptive quality: if the first seconds run slow, drop the post pass, then the pixel ratio
    if (frames < 150) {
      frames++;
      if (frames > 30) frameAcc += dt;
      if (frames === 150 && frameAcc / 120 > 1 / 40) {
        if (post.on) { post.on = false; listeners.quality({ post: false }); frames = 0; frameAcc = 0; }
        else if (dpr > 1) { dpr = 1; renderer.setPixelRatio(1); resize(); starMat.uniforms.uDpr.value = 1; }
      }
    }
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    renderer.setAnimationLoop(frame);
  }
  function stop() {
    running = false;
    renderer.setAnimationLoop(null);
  }
  const onVisibility = () => { if (document.hidden) renderer.setAnimationLoop(null); else if (running) { last = performance.now(); renderer.setAnimationLoop(frame); } };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', resize);

  /* ---------- First frame ---------- */
  resize();
  setOrbit(dirLL(16, 78), fitDist * 1.1, true);
  orbit.dist = orbit.tDist;
  S.dir.setFromSphericalCoords(1, orbit.phi, orbit.theta); S.radius = orbit.dist;
  update(0, performance.now());
  renderer.shadowMap.needsUpdate = true;
  if (renderer.compileAsync) {
    renderer.setRenderTarget(post.on ? rtScene : null);
    await renderer.compileAsync(scene, cam);
    renderer.setRenderTarget(null);
  }
  render();
  onProgress(1, 'Ready');

  /* ---------- API ---------- */
  const projV = new THREE.Vector3(), anchorDir = new THREE.Vector3();
  const toScreen = (v) => { projV.copy(v).project(cam); return { x: (projV.x + 1) * 0.5 * view.w, y: (1 - projV.y) * 0.5 * view.h, behind: projV.z > 1 }; };
  return {
    ids: Object.keys(P),
    start, stop,
    get running() { return running; },
    get postOn() { return post.on; },
    setInteractive(v) { interactive = v; if (!v) { pointers.clear(); drag = null; } },
    setStill(v) { motion.still = v; },
    on(name, fn) { listeners[name] = fn; },
    onFrame(fn) { frameCbs.push(fn); },

    // gate
    setGateFrame(cx, cy, r) { Object.assign(gateState, { cx, cy, r }); if (gateState.on) frameGate(); },
    setTitle(source, rect) {
      if (!titleMesh) {
        const tex = new THREE.CanvasTexture(source);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
        titleMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false, opacity: 0 }));
        titleMesh.frustumCulled = false;
        cam.add(titleMesh);
      } else {
        titleMesh.material.map.image = source;
        titleMesh.material.map.needsUpdate = true;
      }
      titleRect = rect;
      titleMesh.visible = gateState.on;
      if (motion.still) titleT0 = 0;
    },
    hideTitle() { if (titleMesh) titleMesh.visible = false; },
    rise() {
      const now = performance.now();
      if (motion.still) { rise = 1; titleT0 = 0; return; }
      if (riseT0 < 0) { riseT0 = now; titleT0 = now + 250; }
    },
    enter() {
      idle = 0;
      gateState.on = false;
      rise = 1;
      titleOut = performance.now();
      if (motion.still && titleMesh) titleMesh.visible = false;
      view.tox = view.toy = 0;
      fly(freeShot(camDefault, fitDist), { duration: 3.6, lift: 1.5, endMode: 'free' });
    },

    // camera
    focus(id) {
      const p = P[id];
      if (!p) return 0;
      idle = 0;
      const fromFocus = mode !== 'free';
      const shot = cam.aspect < 0.8 ? p.shotTall : p.shot;
      const dist = S.dir.angleTo(shot.dir);
      const duration = clamp(1.5 + dist * 0.5, 1.6, 2.4);
      if (focusId === 'lighthouse' && id !== 'lighthouse') play.lampManual = false;
      focusId = id;
      retarget();
      fly(shot, { duration, lift: fromFocus ? 2.2 : 0.6, endMode: 'focus' });
      return motion.still ? 0 : duration;
    },
    unfocus() {
      if (mode === 'free' && !focusId) return;
      focusId = null;
      play.lampManual = false;
      retarget();
      idle = 0;
      view.tox = view.toy = 0;
      const back = S.target.clone().normalize();
      const outDir = slerpDir(S.dir.clone(), back.lengthSq() ? back : S.dir.clone(), 0.5, new THREE.Vector3());
      fly(freeShot(outDir, fitDist), { duration: 1.6, lift: 0, endMode: 'free' });
    },
    reset() {
      focusId = null;
      play.lampManual = false;
      retarget();
      idle = 0;
      view.tox = view.toy = 0;
      fly(freeShot(camDefault, fitDist), { duration: 2, lift: 0.8, endMode: 'free' });
    },
    face(id) {
      // in free mode, turn the planet so a place faces the camera (used when its label gets keyboard focus)
      const p = P[id];
      if (!p || mode !== 'free') return;
      idle = 0;
      setOrbit(p.dir, orbit.tDist, motion.still);
    },
    orbitBy(dTheta, dPhi) {
      userMoved();
      orbit.tTheta += dTheta; orbit.tPhi = clamp(orbit.tPhi + dPhi, PHI_MIN, PHI_MAX);
      if (motion.still) { orbit.theta = orbit.tTheta; orbit.phi = orbit.tPhi; }
    },
    zoomBy(f) {
      userMoved();
      orbit.tDist = clamp(orbit.tDist * f, fitDist * 0.6, fitDist * 1.35);
      if (motion.still) orbit.dist = orbit.tDist;
    },
    setInset(x, y, instant) { view.tox = x; view.toy = y; if (instant || motion.still) { view.ox = x; view.oy = y; } },
    project(id) {
      const p = P[id];
      const s = toScreen(p.anchor);
      anchorDir.copy(p.anchor).normalize();
      tmp.copy(cam.position).sub(p.anchor).normalize();
      return { ...s, facing: anchorDir.dot(tmp) };
    },
    subPoint() {
      const d = cam.position.clone().normalize();
      return { lat: Math.asin(d.y) / D2R, lon: Math.atan2(d.z, d.x) / D2R };
    },
    lightName() { return lightTgt.name; },

    // play: lighthouse lamp
    lamp: {
      span: LAMP_SPAN,
      anchors: logs.map((l) => l.u),
      take() {
        // hand the lamp to the visitor without a jump: continue from where the beam points now
        const u = lampU(play.lampAngle);
        const uc = clamp(u, -LAMP_SPAN, LAMP_SPAN);
        play.lampAngle = -Math.PI / 2 - u * D2R;
        play.lampTarget = -Math.PI / 2 - uc * D2R;
        play.lampManual = true;
        return Math.round(uc);
      },
      set(u) { play.lampTarget = -Math.PI / 2 - clamp(u, -LAMP_SPAN, LAMP_SPAN) * D2R; play.lampManual = true; },
      release() { play.lampManual = false; },
      bearing() { return lampU(play.lampAngle); },
      count() { return logs.filter((l) => l.found).length; },
      project(k) {
        const lg = logs[k];
        const s = toScreen(lg.pos);
        anchorDir.copy(lg.pos).normalize();
        tmp.copy(cam.position).sub(lg.pos).normalize();
        return { ...s, lit: lg.lit, found: lg.found, facing: anchorDir.dot(tmp) };
      },
    },
    // play: the other places
    setMonth(m) { play.month = clamp(Math.round(m), 0, 11); if (focusId === 'cottage') retarget(); },
    get month() { return play.month; },
    setDay(d) { play.day = clamp(d, 1, 30); },
    setTide(t) { play.tide = clamp(t, -1, 1) * 0.08; },
    setGrind(on) { play.grind = !!on; },
    millSpeed() { return play.speed; },

    get focusId() { return focusId; },
    get mode() { return mode; },
    dispose() {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      renderer.dispose();
    },
  };
}
