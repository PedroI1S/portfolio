/* 10,935 m — WebGL scene.
   The canvas is transparent: particles fade to alpha 0 with distance, so the CSS backdrop behind it acts as
   the fog colour. Colours are sRGB values written straight to the screen (no colour management), so they
   match the CSS exactly.

   During the plunge the frame is drawn twice: once from just above the sea (the word, its reflection and the
   water seen from above) and once from just below it (the water volume, the surface's underside, snow and
   bubbles), split along a wavy waterline in screen space, like a half-submerged lens. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

const rgb = (h) => { const n = parseInt(h.slice(1), 16); return new THREE.Vector3((n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function valueNoise2D(seed) {
  const rand = mulberry32(seed);
  const g = new Float32Array(256 * 256).map(() => rand());
  const at = (x, y) => g[((y & 255) << 8) | (x & 255)];
  const f = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = f(x - xi), yf = f(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

/* ---------- Shared GLSL ---------- */
// Screen position in CSS px, and the waterline clip used while the lens straddles the surface.
const CLIP = /* glsl */`
  uniform float uClip;   // 0: draw everywhere · 1: keep above the waterline · -1: keep below it
  uniform float uWL;     // waterline, CSS px from the top of the viewport
  uniform vec3 uView;    // viewport width and height in CSS px, pixel ratio
  uniform float uTime;
  float cssX() { return gl_FragCoord.x / uView.z; }
  float cssY() { return uView.y - gl_FragCoord.y / uView.z; }
  float waterline(float x) { return uWL + 5.0 * sin(x * 0.011 + uTime * 1.6) + 2.5 * sin(x * 0.027 - uTime * 2.3); }
  void clipWL() {
    if (uClip == 0.0) return;
    if (uClip * (cssY() - waterline(cssX())) > 0.0) discard;
  }
  // the water volume seen through the lower half of the lens: brighter near the surface, with light shafts
  uniform float uFillAmt;
  vec3 underFill(vec3 under) {
    float x = cssX();
    float d = max(cssY() - waterline(x), 0.0);
    vec3 col = under * (1.0 + 0.9 * exp(-d / (uView.y * 0.22)) * uFillAmt);
    float u = x / uView.x;
    float shafts = pow(max(0.0, 0.5 + 0.5 * sin(u * 34.0 + d * 0.004 + uTime * 0.25) * sin(u * 13.0 - uTime * 0.17)), 3.0);
    return col + vec3(0.10, 0.20, 0.22) * shafts * exp(-d / (uView.y * 0.4)) * uFillAmt;
  }`;

// The word, drawn into a canvas texture; per-letter rise offsets let the letters come up out of the sea.
const WORD = /* glsl */`
  uniform sampler2D uWordTex;
  uniform vec4 uWordRect;   // x, y, w, h in CSS px
  uniform vec4 uRise;       // per letter: 0 at rest, 1 a full height lower (hidden behind the sea)
  uniform vec3 uEdges;      // letter boundaries across the texture, 0..1
  uniform float uWordOn;
  vec4 wordAt(vec2 css) {
    if (uWordOn < 0.5) return vec4(0.0);
    vec2 uv = (css - uWordRect.xy) / uWordRect.zw;
    float r = uv.x < uEdges.x ? uRise.x : uv.x < uEdges.y ? uRise.y : uv.x < uEdges.z ? uRise.z : uRise.w;
    uv.y -= r * 1.1;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
    return texture2D(uWordTex, vec2(uv.x, 1.0 - uv.y));
  }`;

// The lamp hangs just below the viewer and points ahead and a little down.
const LAMP = /* glsl */`
  uniform vec3 uCam, uFwd;
  uniform float uLamp;
  float lampAt(vec3 rel) {
    vec3 beamDir = normalize(uFwd + vec3(0.0, -0.17, 0.0));
    vec3 fl3 = rel - vec3(0.0, -1.1, -0.6);
    float fl = length(fl3);
    float spot = smoothstep(0.9, 0.985, dot(fl3 / max(fl, 1e-3), beamDir));
    return spot * uLamp * 50.0 / (25.0 + fl * fl * 0.06);
  }`;

const SPRITE_FRAG = /* glsl */`
  precision highp float;
  ${CLIP}
  varying float vAlpha;
  varying vec3 vColor;
  varying float vStretch;
  void main() {
    clipWL();
    // round sprite, stretched into a streak when the descent is fast
    vec2 q = (gl_PointCoord - 0.5) * (1.0 + vStretch);
    q.y = max(abs(q.y) - vStretch * 0.5, 0.0);
    float a = smoothstep(0.5, 0.06, length(q)) * vAlpha / (1.0 + vStretch * 0.7);
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor, a);
  }`;

const FULLSCREEN_VERT = /* glsl */`
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function fullscreenTriangle() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
}

/* ---------- Titanic, as a dotted elevation drawing (metres; stern at x = 0, keel at y = 0) ---------- */
// Proportions after the ship's published dimensions: 269 m long, 28 m beam, 53 m from keel to funnel tops.
function buildTitanic(step) {
  const pts = [], kind = [];
  const add = (x, y, z, k = 0) => { pts.push(x, y, z); kind.push(k); };
  const line = (ax, ay, bx, by, z, k = 0, s = step) => {
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / s));
    for (let i = 0; i <= n; i++) add(ax + (bx - ax) * (i / n), ay + (by - ay) * (i / n), z, k);
  };
  const poly = (p, z, k = 0) => { for (let i = 0; i < p.length - 1; i++) line(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], z, k); };
  const half = 14;
  const hull = [[0, 20.6], [1.5, 13], [6, 7], [14, 0], [252, 0], [262, 6], [266.5, 14], [269, 21.6]];
  const sheer = [[269, 21.6], [232, 20.6], [200, 19.9], [134, 19.5], [70, 19.8], [30, 20.3], [0, 20.6]];
  [half, -half].forEach((z, side) => {
    const k = side ? 2 : 0;   // far side drawn fainter
    poly(hull, z, k);
    poly(sheer, z, k);
    // superstructure: B deck, A deck and the boat deck, with the bridge house forward
    poly([[58, 19.8], [58, 29.5], [203, 29.5], [203, 19.9]], z * 0.82, k);
    line(58, 23.4, 203, 23.4, z * 0.82, k, step * 1.6);
    line(58, 26.5, 203, 26.5, z * 0.82, k, step * 1.6);
    poly([[172, 29.5], [172, 32], [203, 32], [203, 29.5]], z * 0.5, k);
  });
  // deck edges across the beam at bow and stern
  line(269, 21.6, 269, 21.6, 0);
  for (let z = -half; z <= half; z += step * 2) { add(269, 21.6, z, 2); add(0, 20.6, z, 2); }
  // portholes and windows on the near side
  for (const y of [7.5, 10.5, 13.5, 16.5]) for (let x = 22; x < 250; x += 2.3) add(x, y, half + 0.05, 1);
  for (const y of [21.6, 24.9]) for (let x = 61; x < 201; x += 1.9) add(x, y, half * 0.82 + 0.05, 1);
  // four funnels, raked aft, elliptical in plan
  for (const fx of [189, 156, 123, 90]) {
    for (let h = 0; h <= 23.8; h += step * 2) {
      const cx = fx - h * Math.tan(0.11);
      const ring = h > 22.5 ? 26 : 16;
      for (let i = 0; i < ring; i++) {
        const a = (i / ring) * Math.PI * 2;
        add(cx + Math.cos(a) * 3.65, 29.5 + h, Math.sin(a) * 2.9, Math.sin(a) > 0 ? 0 : 2);
      }
    }
  }
  // masts
  line(224, 21, 222, 62, 0, 0, step * 1.5);
  line(46, 20.5, 44, 60, 0, 0, step * 1.5);
  return { pos: new Float32Array(pts), kind: new Float32Array(kind) };
}

export function mountScene(canvas, { mobile = false, onFrame, onReady, onFail, onLabels } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    if (onFail) onFail(err);
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  let dprCap = mobile ? 1.5 : 1.75;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 3000);
  camera.rotation.order = 'YXZ';
  const fwd = new THREE.Vector3();
  const rand = mulberry32(1960);

  const shared = {
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uFwd: { value: new THREE.Vector3(0, 0, -1) },
    uScale: { value: 1 },
    uClip: { value: 0 },
    uWL: { value: 0 },
    uView: { value: new THREE.Vector3(1, 1, 1) },
    uLamp: { value: 0 },
    uFillAmt: { value: 1 },
  };
  const wordUniforms = {
    uWordTex: { value: null },
    uWordRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uRise: { value: new THREE.Vector4(1, 1, 1, 1) },
    uEdges: { value: new THREE.Vector3(0.25, 0.5, 0.75) },
    uWordOn: { value: 0 },
  };
  const all = [];   // every drawable, so the passes can switch them on and off
  const add = (obj, order) => { obj.frustumCulled = false; obj.renderOrder = order; scene.add(obj); all.push(obj); return obj; };

  /* ---------- Word (above the sea) ---------- */
  const wordMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { ...shared, ...wordUniforms, uIn: { value: 0 } },
    vertexShader: /* glsl */`
      uniform vec4 uWordRect;
      uniform vec3 uView;
      void main() {
        vec2 css = uWordRect.xy + (position.xy * 0.5 + 0.5) * vec2(1.0, -1.0) * uWordRect.zw + vec2(0.0, uWordRect.w);
        // at the far plane, so the opaque sea (drawn first) hides letters that are still below the horizon
        gl_Position = vec4(css.x / uView.x * 2.0 - 1.0, 1.0 - css.y / uView.y * 2.0, 0.9999, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      ${CLIP}
      ${WORD}
      uniform float uIn;
      void main() {
        clipWL();
        vec4 c = wordAt(vec2(cssX(), cssY()));
        if (c.a < 0.01) discard;
        gl_FragColor = vec4(c.rgb, c.a * uIn);
      }`,
  });
  const wordMesh = add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), wordMat), 0);

  /* ---------- Water surface ---------- */
  const RINGS = 8;
  const rings = Array.from({ length: RINGS }, () => new THREE.Vector4(0, 0, -100, 0));
  let ringNext = 0;
  const waterGeo = new THREE.PlaneGeometry(2400, 2400, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      ...shared, ...wordUniforms,
      uSkyTop: { value: rgb('#061015') },
      uGlow: { value: rgb('#1a2c33') },
      uDeep: { value: rgb('#03090c') },
      uUnder: { value: rgb('#0a4258') },
      uWindow: { value: rgb('#6fbccb') },
      uHorizon: { value: 500 },
      uReflLen: { value: 300 },
      uTan: { value: new THREE.Vector2(1, 1) },
      uIntro: { value: new THREE.Vector2(1, 1) },   // water fade-in, glitter
      uRings: { value: rings },
    },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      ${CLIP}
      ${WORD}
      uniform vec3 uCam, uSkyTop, uGlow, uDeep, uUnder, uWindow;
      uniform float uHorizon, uReflLen;
      uniform vec2 uTan, uIntro;
      uniform vec4 uRings[${RINGS}];
      varying vec3 vWorld;

      vec2 wave(vec2 p, vec2 d, float f, float a, float s) {
        return d * (f * a * cos(dot(p, d) * f + uTime * s));
      }
      vec3 surfNormal(vec2 p, float detail) {
        vec2 g = wave(p, vec2(0.287, 0.958), 0.55, 0.10, 0.9)
               + wave(p, vec2(-0.659, 0.753), 0.9, 0.06, 1.3)
               + (wave(p, vec2(0.981, 0.196), 1.7, 0.03, 1.9)
               +  wave(p, vec2(-0.196, 0.981), 3.1, 0.016, 2.6)
               +  wave(p, vec2(0.8, -0.6), 5.3, 0.008, 3.4)) * detail;
        // rings dropped by the pointer: expanding wave packets that fade as they spread
        for (int i = 0; i < ${RINGS}; i++) {
          vec4 R = uRings[i];
          float age = uTime - R.z;
          if (R.w <= 0.0 || age < 0.0 || age > 5.0) continue;
          vec2 d = p - R.xy;
          float r = length(d) + 1e-4;
          float x = r - (1.7 * age + 0.15);
          g += (d / r) * exp(-x * x * 1.4) * exp(-age * 0.75) * R.w * sin(x * 7.0) * 0.4;
        }
        return normalize(vec3(-g.x, 1.0, -g.y));
      }

      void main() {
        clipWL();
        vec3 toCam = uCam - vWorld;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        float detail = 1.0 - smoothstep(6.0, 70.0, dist);
        vec3 N = normalize(mix(vec3(0.0, 1.0, 0.0), surfNormal(vWorld.xz, detail), 0.3 + 0.7 * detail));
        vec3 col;
        if (gl_FrontFacing) {
          // from above: dark water, sky glow at grazing angles, a glitter path toward the low sun
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 R = reflect(-V, N);
          vec3 sky = mix(uGlow, uSkyTop, pow(clamp(R.y, 0.0, 1.0), 0.45));
          vec3 L = normalize(vec3(0.0, 0.06, -1.0));
          float rl = max(dot(R, L), 0.0);
          float spec = (pow(rl, 420.0) * 2.2 + pow(rl, 36.0) * 0.05) * mix(0.22, 1.0, smoothstep(28.0, 110.0, dist));
          col = mix(uDeep, sky, fres) * uIntro.x + vec3(1.0, 0.9, 0.78) * spec * uIntro.y;
          // the word's reflection: mirrored about the horizon, broken up by the same waves
          float below = cssY() - uHorizon;
          if (below > 0.0) {
            vec2 rp = vec2(cssX(), uHorizon - below) + vec2(N.x, N.z) * vec2(70.0, 160.0) * (0.35 + below / uView.y * 2.0);
            vec4 w = wordAt(rp);
            float fade = 1.0 - smoothstep(0.0, uReflLen, below);
            col = mix(col, w.rgb * 0.62 + col * 0.2, w.a * fade * mix(0.5, 0.85, fres) * uIntro.x);
          }
          col = mix(col, uGlow * uIntro.x, 1.0 - exp(-pow(dist * 0.0085, 2.0)));
        } else {
          // from below: Snell's window overhead, total internal reflection outside it
          float c = -toCam.y / dist;
          float win = smoothstep(0.6, 0.7, c);
          vec2 q = vWorld.xz * 0.8;
          float sh = abs(sin(q.x * 1.3 + uTime * 0.8 + sin(q.y * 0.7 + uTime * 0.5)))
                   * abs(sin(q.y * 1.1 - uTime * 0.6 + sin(q.x * 0.8 - uTime * 0.3)));
          sh = pow(1.0 - sh, 5.0);
          vec3 tir = uUnder * 1.3 + vec3(0.05, 0.11, 0.12) * sh * 0.6;
          vec3 sky = uWindow + vec3(0.25, 0.28, 0.26) * sh;
          // through the window you see the world above, squeezed and refracted: the word breaks into light
          vec3 T = refract(-V, -N, 1.33);
          if (dot(T, T) > 0.0 && T.y > 0.0) {
            float e = asin(clamp(T.y, 0.0, 1.0));
            float az = atan(T.x, -T.z);
            vec2 sp = vec2(uView.x * 0.5 * (1.0 + tan(az) / uTan.x), uHorizon - tan(e) / uTan.y * uView.y * 0.5);
            vec4 w = wordAt(sp);
            sky += w.rgb * w.a * 0.85;
          }
          col = mix(tir, sky, win);
          // while the lens straddles the surface, fade into the fill colour so the two meet without a seam
          vec3 fogTo = uClip < 0.0 ? underFill(uUnder) : uUnder;
          col = mix(col, fogTo, 1.0 - exp(-pow(dist * 0.036, 2.0)));
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const water = add(new THREE.Mesh(waterGeo, waterMat), 1);

  /* ---------- Below-the-line fill: the water volume while the lens straddles the surface ---------- */
  const fillMat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { ...shared, uUnder: { value: rgb('#0a4258') } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      precision highp float;
      ${CLIP}
      uniform vec3 uUnder;
      void main() {
        float d = cssY() - waterline(cssX());
        if (d < 0.0) discard;
        vec3 col = underFill(uUnder);
        // the meniscus: a bright refracted edge right under the line, then a dark lip
        col += vec3(0.75, 0.9, 0.95) * exp(-d * 0.55) * 0.85;
        col *= 1.0 - 0.35 * exp(-pow((d - 6.0) / 3.5, 2.0));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const fill = add(new THREE.Mesh(fullscreenTriangle(), fillMat), -1);
  const filmMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { ...shared },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      precision highp float;
      ${CLIP}
      void main() {
        // a film of water on the lens, just above the line
        float d = cssY() - waterline(cssX());
        if (d > 0.0 || d < -14.0) discard;
        gl_FragColor = vec4(0.82, 0.93, 0.96, 0.24 * exp(d * 0.32));
      }`,
  });
  const film = add(new THREE.Mesh(fullscreenTriangle(), filmMat), 9);

  /* ---------- Lamp beam: a soft wedge of scattered light from just below the viewer ---------- */
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...shared, uVP: { value: 0.66 }, uCol: { value: rgb('#ffe2b8') } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */`
      precision highp float;
      ${CLIP}
      uniform float uLamp, uVP;
      uniform vec3 uCol;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        clipWL();
        // screen space, in viewport heights; the lamp sits just below the bottom edge, the beam runs to uVP
        vec2 p = vec2(cssX() - uView.x * 0.5, cssY() - uView.y * uVP) / uView.y;
        float len = 1.0 - uVP + 0.18;
        float t = clamp(p.y / len, 0.0, 1.0);            // 0 at the far end, 1 at the lamp
        float hw = 0.03 + t * 0.48;                       // half-width of the cone at this height
        float edge = smoothstep(hw, hw * 0.55, abs(p.x)) * smoothstep(-0.02, 0.16, p.y);
        float core = smoothstep(hw * 0.45, 0.0, abs(p.x));
        float glowFar = smoothstep(0.26, 0.0, length(p * vec2(0.8, 1.4)));
        // scattered light thickens toward the lamp, and dust drifts through it
        float dust = 0.7 + 0.6 * vnoise(vec2(p.x / max(hw, 0.05) * 3.0, p.y * 6.0 - uTime * 0.4));
        float a = ((edge * (0.35 + 0.9 * t) + core * 0.35 * t) * dust + glowFar * 0.4) * uLamp * 0.2;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uCol, a);
      }`,
  });
  const beam = add(new THREE.Mesh(fullscreenTriangle(), beamMat), 2);

  /* ---------- Marine snow ---------- */
  const SNOW = mobile ? 4200 : 9000;
  const BOX = [46, 40, 46];
  const snowPos = new Float32Array(SNOW * 3);
  const snowSeed = new Float32Array(SNOW);
  for (let i = 0; i < SNOW; i++) {
    snowPos[i * 3] = rand() * BOX[0];
    snowPos[i * 3 + 1] = rand() * BOX[1];
    snowPos[i * 3 + 2] = rand() * BOX[2];
    snowSeed[i] = rand();
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  snowGeo.setAttribute('aSeed', new THREE.BufferAttribute(snowSeed, 1));
  const snowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      ...shared,
      uTravel: { value: 0 }, uDrift: { value: 0 }, uAmbient: { value: 1 },
      uFog: { value: 0.06 }, uStretch: { value: 0 }, uOpacity: { value: 1 },
      uColA: { value: rgb('#cfe3e8') }, uColLamp: { value: rgb('#ffe9cc') },
    },
    vertexShader: /* glsl */`
      uniform float uTime, uTravel, uDrift, uAmbient, uFog, uStretch, uOpacity, uScale;
      uniform vec3 uColA, uColLamp;
      ${LAMP}
      attribute float aSeed;
      varying float vAlpha;
      varying vec3 vColor;
      varying float vStretch;
      const vec3 BOX = vec3(${BOX[0]}.0, ${BOX[1]}.0, ${BOX[2]}.0);
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTravel + uDrift, BOX.y);
        p -= vec3(BOX.x * 0.5, BOX.y * 0.5, BOX.z - 6.0);
        p.x += sin(uTime * 0.21 + aSeed * 40.0) * 0.22;
        p.z += cos(uTime * 0.17 + aSeed * 25.0) * 0.22;
        vec3 world = uCam + p;
        vec4 mv = viewMatrix * vec4(world, 1.0);
        float dist = length(p);
        float fog = exp(-pow(dist * uFog, 2.0));
        float below = smoothstep(0.05, -0.5, world.y);          // none above the surface
        float lamp = lampAt(p) * 2.6;
        // in the deep the flakes only show inside the beam
        float light = (uAmbient * 1.25 + 0.015 * uLamp) * fog + lamp;
        float size = (0.6 + aSeed * 1.4) * uScale * (26.0 / max(-mv.z, 0.1));
        float tiny = clamp(size / 1.5, 0.0, 1.0);
        float bokeh = mix(0.3, 1.0, smoothstep(1.0, 5.0, -mv.z));
        vAlpha = clamp(light, 0.0, 1.0) * below * (0.35 + 0.65 * fract(aSeed * 7.13)) * uOpacity
               * tiny * bokeh * smoothstep(0.3, 1.2, -mv.z);
        vColor = mix(uColA, uColLamp, clamp(lamp * 2.0, 0.0, 1.0));
        vStretch = uStretch * clamp(size / 3.0, 0.0, 1.0);
        gl_PointSize = clamp(size, 1.5, 44.0) * (1.0 + vStretch);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: SPRITE_FRAG,
  });
  const snow = add(new THREE.Points(snowGeo, snowMat), 5);

  /* ---------- Bubbles: one burst as the lens goes under ---------- */
  const BUB = mobile ? 80 : 200;
  const bubPos = new Float32Array(BUB * 3);
  const bubSeed = new Float32Array(BUB);
  for (let i = 0; i < BUB; i++) {
    bubPos[i * 3] = (rand() - 0.5) * 7;
    bubPos[i * 3 + 1] = -0.6 - rand() * 3.2;
    bubPos[i * 3 + 2] = -1.2 - rand() * 6.5;
    bubSeed[i] = rand();
  }
  const bubGeo = new THREE.BufferGeometry();
  bubGeo.setAttribute('position', new THREE.BufferAttribute(bubPos, 3));
  bubGeo.setAttribute('aSeed', new THREE.BufferAttribute(bubSeed, 1));
  const bubMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...shared, uBurst: { value: -1 } },
    vertexShader: /* glsl */`
      uniform float uBurst, uScale, uTime;
      uniform vec3 uCam;
      attribute float aSeed;
      varying float vAlpha;
      void main() {
        float age = uBurst - aSeed * 0.3;
        vec3 p = position;
        float v = 2.2 + aSeed * 3.4;
        p.y += v * age + 1.4 * age * age;
        p.x += sin(age * 11.0 + aSeed * 30.0) * 0.07 * (1.0 + age);
        vec4 mv = viewMatrix * vec4(uCam + p, 1.0);
        float r = 0.012 + pow(aSeed, 3.0) * 0.07;
        vAlpha = (age < 0.0 || age > 1.5) ? 0.0 : smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.85, 1.4, age));
        gl_PointSize = clamp(r * uScale * 900.0 / max(-mv.z, 0.1), 2.0, 70.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      ${CLIP}
      varying float vAlpha;
      void main() {
        clipWL();
        vec2 q = gl_PointCoord - 0.5;
        float d = length(q);
        // a thin bright rim with a highlight, empty in the middle
        float rim = smoothstep(0.5, 0.42, d) * smoothstep(0.28, 0.42, d);
        float hi = smoothstep(0.12, 0.0, length(q - vec2(-0.16, -0.16)));
        float a = (rim * 0.75 + hi * 0.9 + 0.08 * smoothstep(0.5, 0.3, d)) * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(0.85, 0.96, 1.0, a);
      }`,
  });
  const bubbles = add(new THREE.Points(bubGeo, bubMat), 6);

  /* ---------- Bioluminescence ---------- */
  const BIO = mobile ? 320 : 640;
  const BBOX = [54, 46, 52];
  const bioPos = new Float32Array(BIO * 3);
  const bioSeed = new Float32Array(BIO);
  const bioCol = new Float32Array(BIO * 3);
  const bioPalette = [rgb('#6cf5e0'), rgb('#5fb4ff'), rgb('#7cf2ff'), rgb('#9dffb0')];
  for (let i = 0; i < BIO; i++) {
    bioPos[i * 3] = rand() * BBOX[0];
    bioPos[i * 3 + 1] = rand() * BBOX[1];
    bioPos[i * 3 + 2] = rand() * BBOX[2];
    bioSeed[i] = rand();
    const c = bioPalette[rand() < 0.08 ? 3 : Math.floor(rand() * 3)];
    bioCol.set([c.x, c.y, c.z], i * 3);
  }
  const bioGeo = new THREE.BufferGeometry();
  bioGeo.setAttribute('position', new THREE.BufferAttribute(bioPos, 3));
  bioGeo.setAttribute('aSeed', new THREE.BufferAttribute(bioSeed, 1));
  bioGeo.setAttribute('aColor', new THREE.BufferAttribute(bioCol, 3));
  const bioMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...shared, uTravel: { value: 0 }, uDrift: { value: 0 }, uBio: { value: 0 }, uFog: { value: 0.03 } },
    vertexShader: /* glsl */`
      uniform float uTime, uTravel, uDrift, uBio, uFog, uScale;
      uniform vec3 uCam;
      attribute float aSeed;
      attribute vec3 aColor;
      varying float vAlpha;
      varying vec3 vColor;
      varying float vStretch;
      const vec3 BOX = vec3(${BBOX[0]}.0, ${BBOX[1]}.0, ${BBOX[2]}.0);
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTravel * 0.9 + uDrift, BOX.y);
        p -= vec3(BOX.x * 0.5, BOX.y * 0.5, BOX.z - 4.0);
        p.x += sin(uTime * 0.3 + aSeed * 60.0) * 0.6;
        vec4 mv = viewMatrix * vec4(uCam + p, 1.0);
        float dist = length(p);
        float ph = uTime * (0.25 + aSeed * 0.7) + aSeed * 90.0;
        float flash = pow(max(sin(ph), 0.0), 24.0) + 0.6 * pow(max(sin(ph * 2.3 + 1.7), 0.0), 60.0);
        vAlpha = clamp(0.3 + flash * 1.4, 0.0, 1.0) * uBio * exp(-pow(dist * uFog, 2.0)) * smoothstep(0.5, 2.0, -mv.z);
        vColor = aColor;
        vStretch = 0.0;
        gl_PointSize = clamp((2.0 + flash * 4.0) * uScale * (64.0 / max(-mv.z, 0.1)), 3.0, 140.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      ${CLIP}
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        clipWL();
        vec2 q = gl_PointCoord - 0.5;
        float d2 = dot(q, q);
        float a = (exp(-d2 * 60.0) + 0.5 * exp(-d2 * 11.0)) * vAlpha;
        if (a < 0.004) discard;
        gl_FragColor = vec4(mix(vColor, vec3(1.0), exp(-d2 * 160.0) * 0.6), a);
      }`,
  });
  const bio = add(new THREE.Points(bioGeo, bioMat), 7);

  /* ---------- Things you pass ---------- */
  // The deep scattering layer: a sheet of fish, squid and jellies about 300–500 m down, flickering.
  const DSL = mobile ? 7000 : 16000;
  const dslPos = new Float32Array(DSL * 3);
  const dslSeed = new Float32Array(DSL);
  for (let i = 0; i < DSL; i++) {
    const g = (rand() + rand() + rand() + rand() - 2) / 2;   // roughly normal, thickest in the middle of the layer
    dslPos[i * 3] = (rand() - 0.5) * 170;
    dslPos[i * 3 + 1] = g * g * g * 14 + g * 3;
    dslPos[i * 3 + 2] = 6 - rand() * 120;
    dslSeed[i] = rand();
  }
  const dslGeo = new THREE.BufferGeometry();
  dslGeo.setAttribute('position', new THREE.BufferAttribute(dslPos, 3));
  dslGeo.setAttribute('aSeed', new THREE.BufferAttribute(dslSeed, 1));
  const dslMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...shared, uRelY: { value: -100 }, uOn: { value: 0 }, uAmbient: { value: 0.4 } },
    vertexShader: /* glsl */`
      uniform float uTime, uRelY, uOn, uScale, uAmbient;
      ${LAMP}
      attribute float aSeed;
      varying float vAlpha;
      varying vec3 vColor;
      varying float vStretch;
      void main() {
        vec3 p = position + vec3(sin(uTime * 0.4 + aSeed * 50.0) * 0.4, uRelY, 0.0);
        vec4 mv = viewMatrix * vec4(uCam + p, 1.0);
        float dist = length(p);
        float flick = pow(max(sin(uTime * (1.2 + aSeed * 3.0) + aSeed * 80.0), 0.0), 16.0);
        float light = (0.34 + uAmbient * 0.6) * exp(-pow(dist * 0.013, 2.0)) + lampAt(p) * 2.0 + flick * 1.2 * exp(-pow(dist * 0.01, 2.0));
        vAlpha = clamp(light, 0.0, 1.0) * uOn * smoothstep(0.5, 2.0, -mv.z);
        vColor = mix(vec3(0.62, 0.8, 0.9), vec3(0.8, 1.0, 1.0), flick);
        vStretch = 0.0;
        gl_PointSize = clamp((0.9 + aSeed * 1.2 + flick * 2.5) * uScale * (40.0 / max(-mv.z, 0.1)), 1.6, 22.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: SPRITE_FRAG,
  });
  const dsl = add(new THREE.Points(dslGeo, dslMat), 4);

  // RMS Titanic at true proportions (1 unit = 10 m), its wreck's depth marked by where it hangs.
  const tt = buildTitanic(mobile ? 0.9 : 0.55);
  const shipGeo = new THREE.BufferGeometry();
  {
    const p = tt.pos;
    for (let i = 0; i < p.length; i += 3) { p[i] = (p[i] - 134.5) / 10; p[i + 1] = (p[i + 1] - 26) / 10; p[i + 2] = p[i + 2] / 10; }
    shipGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    shipGeo.setAttribute('aKind', new THREE.BufferAttribute(tt.kind, 1));
  }
  const shipMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...shared, uOn: { value: 0 } },
    vertexShader: /* glsl */`
      uniform float uOn, uScale;
      ${LAMP}
      attribute float aKind;
      varying float vAlpha;
      varying vec3 vColor;
      varying float vStretch;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec3 rel = w.xyz - uCam;
        vec4 mv = viewMatrix * w;
        float lit = lampAt(rel) * 2.2;
        float base = aKind == 1.0 ? 0.5 : aKind == 2.0 ? 0.13 : 0.3;
        vAlpha = clamp(base + lit, 0.0, 1.0) * uOn;
        vColor = mix(vec3(0.72, 0.8, 0.84), vec3(1.0, 0.9, 0.76), clamp(lit * 1.5, 0.0, 1.0));
        vStretch = 0.0;
        gl_PointSize = clamp((aKind == 1.0 ? 1.5 : 1.15) * uScale * (30.0 / max(-mv.z, 0.1)), 1.2, 8.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: SPRITE_FRAG,
  });
  const ship = add(new THREE.Points(shipGeo, shipMat), 4);
  const shipAnchor = new THREE.Vector3((189 - 3 - 134.5) / 10, (53.3 - 26) / 10, 0);

  // Trench walls: two rock faces closing in through the hadal zone (desktop only).
  let walls = null;
  if (!mobile) {
    const WALL = 12000;
    const WBOX = [44, 100];   // height, depth of each face
    const wPos = new Float32Array(WALL * 3);
    const wSeed = new Float32Array(WALL);
    const n = valueNoise2D(6000);
    for (let i = 0; i < WALL; i++) {
      const side = i % 2 ? 1 : -1;
      const y = rand() * WBOX[0];
      const z = 6 - rand() * WBOX[1];
      wPos[i * 3] = side * (1 + (n(y * 0.18 + side * 40, z * 0.12) - 0.5) * 0.35);   // scaled by the half-width in the shader
      wPos[i * 3 + 1] = y;
      wPos[i * 3 + 2] = z;
      wSeed[i] = rand();
    }
    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
    wGeo.setAttribute('aSeed', new THREE.BufferAttribute(wSeed, 1));
    const wMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { ...shared, uTravel: { value: 0 }, uHalf: { value: 60 }, uOn: { value: 0 } },
      vertexShader: /* glsl */`
        uniform float uTravel, uHalf, uOn, uScale;
        ${LAMP}
        attribute float aSeed;
        varying float vAlpha;
        varying vec3 vColor;
        varying float vStretch;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTravel, ${WBOX[0]}.0) - ${WBOX[0] / 2}.0;
          // the faces lean in toward the floor, like a V
          p.x *= uHalf + p.y * 0.18;
          vec4 mv = viewMatrix * vec4(uCam + p, 1.0);
          float dist = length(p);
          float light = 0.42 * exp(-pow(dist * 0.016, 2.0)) + lampAt(p) * 3.0;
          vAlpha = clamp(light, 0.0, 1.0) * uOn * (0.5 + 0.5 * aSeed);
          vColor = mix(vec3(0.55, 0.6, 0.62), vec3(0.95, 0.85, 0.7), clamp(lampAt(p) * 4.0, 0.0, 1.0));
          vStretch = 0.0;
          gl_PointSize = clamp((1.0 + aSeed) * uScale * (42.0 / max(-mv.z, 0.1)), 1.5, 14.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: SPRITE_FRAG,
    });
    walls = add(new THREE.Points(wGeo, wMat), 4);
  }

  /* ---------- Seafloor: soft sediment, lit only by the lamp ---------- */
  const noise = valueNoise2D(10935);
  const floorH = (x, z) => {
    let h = noise(x * 0.05 + 10, z * 0.05 + 10) * 1.8 + noise(x * 0.16, z * 0.16) * 0.5 + noise(x * 0.6, z * 0.6) * 0.09;
    h += Math.max(0, noise(x * 0.025 + 40, z * 0.025) - 0.5) * 12;
    return h;
  };
  const FS = mobile ? 110 : 170;
  const floorGeo = new THREE.PlaneGeometry(120, 110, FS, FS);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(0, 0, -45);
  {
    const p = floorGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, floorH(p.getX(i), p.getZ(i)));
    floorGeo.computeVertexNormals();
  }
  const floorMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { ...shared, uFloorY: { value: -200 }, uFloor: { value: 0 }, uSed: { value: rgb('#bfb29c') }, uColLamp: { value: rgb('#ffe9cc') } },
    vertexShader: /* glsl */`
      uniform float uFloorY;
      varying vec3 vWorld;
      varying vec3 vN;
      void main() {
        vec3 p = position;
        p.y += uFloorY;
        vWorld = p;
        vN = normal;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      ${CLIP}
      uniform float uFloor, uLamp;
      uniform vec3 uCam, uFwd, uSed, uColLamp;
      varying vec3 vWorld;
      varying vec3 vN;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        clipWL();
        vec3 rel = vWorld - uCam;
        float dist = length(rel);
        vec3 dir = rel / dist;
        float spot = smoothstep(0.8, 0.985, dot(dir, normalize(uFwd + vec3(0.0, -0.34, 0.0))));
        float diff = max(dot(normalize(vN), -dir), 0.0);
        float att = 30.0 / (14.0 + dist * dist * 0.4);
        float light = (0.02 + spot * 1.1) * (0.3 + 0.7 * diff) * att * clamp(uLamp, 0.0, 1.0);
        float mottle = vnoise(vWorld.xz * 1.6) * 0.6 + vnoise(vWorld.xz * 5.0) * 0.4;
        float grain = hash(floor(vWorld.xz * 70.0));
        vec2 cell = floor(vWorld.xz * 5.0), f = fract(vWorld.xz * 5.0);
        vec2 at = vec2(hash(cell + 7.7), hash(cell + 1.3)) * 0.8 + 0.1;
        float speck = step(0.9, hash(cell + 3.1)) * smoothstep(0.08, 0.025, length(f - at));
        vec3 col = mix(uSed, uColLamp, 0.3 * spot) * light * (0.72 + 0.4 * mottle + 0.1 * grain)
                 + vec3(0.85, 0.82, 0.74) * speck * light * 0.5;
        gl_FragColor = vec4(col, uFloor * exp(-pow(dist * 0.024, 2.0)));
      }`,
  });
  const floor = add(new THREE.Mesh(floorGeo, floorMat), 3);

  /* ---------- Word texture ---------- */
  let wordTex = null;
  function setWord(L) {
    // L: { text-free layout from main.js } font, letters [{ ch, x }], baseline, capTop, left, width, size
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    const pad = Math.round(L.size * 0.06);
    const rect = { x: L.left - pad, y: L.capTop - pad, w: L.width + pad * 2, h: L.baseline - L.capTop + pad * 2 };
    const c = document.createElement('canvas');
    c.width = Math.ceil(rect.w * pr);
    c.height = Math.ceil(rect.h * pr);
    const ctx = c.getContext('2d');
    ctx.scale(pr, pr);
    ctx.font = L.font;
    ctx.textBaseline = 'alphabetic';
    const g = ctx.createLinearGradient(0, L.capTop - rect.y, 0, L.baseline - rect.y);
    g.addColorStop(0, '#f3f6f8');
    g.addColorStop(0.55, '#c3cfd5');
    g.addColorStop(1, '#8798a1');
    ctx.fillStyle = g;
    L.letters.forEach((l) => ctx.fillText(l.ch, l.x - rect.x, L.baseline - rect.y));
    if (wordTex) wordTex.dispose();
    wordTex = new THREE.CanvasTexture(c);
    wordTex.minFilter = THREE.LinearFilter;
    wordTex.generateMipmaps = false;
    wordUniforms.uWordTex.value = wordTex;
    wordUniforms.uWordRect.value.set(rect.x, rect.y, rect.w, rect.h);
    const u = (x) => (x - rect.x) / rect.w;
    const e = [];
    for (let i = 0; i < 3; i++) e.push(u((L.letters[i].right + L.letters[i + 1].x) / 2));
    wordUniforms.uEdges.value.set(e[0], e[1], e[2]);
    wordUniforms.uWordOn.value = 1;
  }

  /* ---------- Ripples from the pointer ---------- */
  const ray = new THREE.Raycaster();
  const sea = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  let rippleCam = 1;
  function ripple(clientX, clientY, strength = 1) {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, 1 - (clientY / window.innerHeight) * 2);
    camera.position.y = rippleCam;
    camera.updateMatrixWorld();
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(sea, hit)) return;
    if (hit.distanceTo(camera.position) > 140) return;
    rings[ringNext].set(hit.x, hit.z, shared.uTime.value, strength);
    ringNext = (ringNext + 1) % RINGS;
  }

  /* ---------- Sizing ---------- */
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    shared.uScale.value = (h / 900) * renderer.getPixelRatio();
    shared.uView.value.set(w, h, renderer.getPixelRatio());
  }
  resize();

  /* ---------- Loop ---------- */
  const clock = new THREE.Clock(false);
  let time = 0, drift = 0, ready = false, slow = 0, frames = 0, burstAt = -10;
  const ease = (t) => t * t * (3 - 2 * t);
  const tmp = new THREE.Vector3();
  const show = (list) => all.forEach((o) => { o.visible = list.includes(o) && o.userData.on !== false; });

  function project(v) {
    tmp.copy(v).project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * window.innerWidth, y: (0.5 - tmp.y * 0.5) * window.innerHeight, ok: tmp.z < 1 && Math.abs(tmp.x) < 0.92 && Math.abs(tmp.y) < 0.9 };
  }
  function place(y) {
    camera.position.set(0, y, 0);
    camera.updateMatrixWorld();
    shared.uCam.value.copy(camera.position);
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    const st = onFrame(dt);
    if (!st) return;
    time += dt;
    drift += dt * st.drift;
    if (st.burst) burstAt = time;

    if (camera.fov !== st.fov) { camera.fov = st.fov; camera.updateProjectionMatrix(); }
    camera.rotation.set(st.pitch, st.yaw, 0);
    camera.updateMatrixWorld();
    camera.getWorldDirection(fwd);
    rippleCam = st.hA;

    shared.uTime.value = time;
    shared.uFwd.value.copy(fwd);
    shared.uWL.value = st.wlY;
    shared.uLamp.value = st.lamp;

    const tanY = Math.tan((camera.fov * Math.PI) / 360);
    const wu = waterMat.uniforms;
    wu.uUnder.value.set(st.water[0] / 255, st.water[1] / 255, st.water[2] / 255);
    wu.uHorizon.value = st.horizon;
    wu.uReflLen.value = window.innerHeight * 0.35;
    wu.uTan.value.set(tanY * camera.aspect, tanY);
    wu.uIntro.value.set(st.intro.water, st.intro.glitter);
    wordUniforms.uRise.value.set(...st.intro.rise);
    wordMat.uniforms.uIn.value = st.intro.water > 0 ? 1 : 0;
    fillMat.uniforms.uUnder.value.copy(wu.uUnder.value);
    shared.uFillAmt.value = 1 - ease(Math.min(1, Math.max(0, (st.w - 0.8) / 0.2)));
    beamMat.uniforms.uVP.value = 0.5 + 0.5 * Math.tan(0.17) / tanY;

    const su = snowMat.uniforms;
    su.uTravel.value = st.travel;
    su.uDrift.value = drift;
    su.uAmbient.value = st.ambient;
    su.uFog.value = st.fog;
    su.uStretch.value = st.stretch;
    su.uOpacity.value = st.snow;
    bubMat.uniforms.uBurst.value = time - burstAt;
    bioMat.uniforms.uTravel.value = st.travel;
    bioMat.uniforms.uDrift.value = drift;
    bioMat.uniforms.uBio.value = st.bio;

    dslMat.uniforms.uRelY.value = st.obj.dsl;
    dslMat.uniforms.uOn.value = st.obj.dslOn;
    dslMat.uniforms.uAmbient.value = st.ambient;
    shipMat.uniforms.uOn.value = st.obj.shipOn;
    if (walls) {
      walls.material.uniforms.uTravel.value = st.travel;
      walls.material.uniforms.uHalf.value = st.obj.wallHalf;
      walls.material.uniforms.uOn.value = st.obj.wallOn;
    }
    floorMat.uniforms.uFloor.value = st.floor;
    floorMat.uniforms.uFloorY.value = st.camY - (95 - 92.2 * ease(st.floor));

    fill.userData.on = st.w > 0 && st.w < 1;
    film.userData.on = fill.userData.on;
    beam.userData.on = st.lamp > 0.002;
    snow.userData.on = st.w > 0;
    bubbles.userData.on = time - burstAt < 2;
    bio.userData.on = st.bio > 0.002;
    dsl.userData.on = st.obj.dslOn > 0.002;
    ship.userData.on = st.obj.shipOn > 0.002;
    if (walls) walls.userData.on = st.obj.wallOn > 0.002;
    floor.userData.on = st.floor > 0.002;
    wordMesh.userData.on = st.w < 1;
    water.userData.on = st.camY > -85 || st.w < 1;

    renderer.clear();
    const labels = {};
    if (st.w < 1) {
      // the world above: the word, its reflection and the sea, seen from just over the surface
      shared.uClip.value = st.w > 0 ? 1 : 0;
      place(st.hA);
      show([wordMesh, water]);
      renderer.render(scene, camera);
    }
    if (st.w > 0) {
      // the world below
      shared.uClip.value = st.w < 1 ? -1 : 0;
      place(st.w < 1 ? st.hB : st.camY);
      ship.position.set(st.obj.shipX, st.camY + st.obj.ship, -34);
      ship.rotation.set(0, -0.28, 0);
      ship.updateMatrixWorld();
      show([fill, water, beam, snow, bubbles, bio, dsl, ship, walls, floor, film].filter(Boolean));
      renderer.render(scene, camera);
      if (st.w >= 1) {
        labels.dsl = project(tmp.set(mobile ? -2 : -16, st.camY + st.obj.dsl + 5, -32).clone());
        labels.titanic = project(shipAnchor.clone().applyMatrix4(ship.matrixWorld));
        if (walls) labels.walls = project(tmp.set(st.obj.wallHalf * 0.85, st.camY + 2, -34).clone());
      }
    }
    if (onLabels) onLabels(labels);

    // a crude quality step: if the first couple of seconds run slow, drop to 1x pixels
    if (frames < 120) {
      frames++;
      if (dt > 1 / 40) slow++;
      if (frames === 120 && slow > 80 && dprCap > 1) { dprCap = 1; resize(); }
    }
    if (!ready) { ready = true; if (onReady) onReady(); }
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (onFail) onFail(); }, { once: true });

  return {
    start() { clock.start(); renderer.setAnimationLoop(frame); },
    stop() { renderer.setAnimationLoop(null); clock.stop(); },
    resize,
    setWord,
    ripple,
    dispose() {
      renderer.setAnimationLoop(null);
      all.forEach((o) => { o.geometry.dispose(); o.material.dispose(); });
      if (wordTex) wordTex.dispose();
      renderer.dispose();
    },
  };
}
