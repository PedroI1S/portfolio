/* Undersun: the hero wellhead.
   A chrome coil exchanger on a well casing, lit only by an environment built from the page's sky.
   It stands on the page's horizon rule: a clipping plane through the eye and that screen line hides
   everything below ground, so the wellhead can rise out of it. The page draws the pipes below the line. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

const D2R = Math.PI / 180;
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

/* (p, q) torus knot with its own tube radius: p turns around the ring, q windings around the tube */
class TorusCoil extends THREE.Curve {
  constructor(R, r, p, q) { super(); Object.assign(this, { R, r, p, q }); }
  getPoint(t, target = new THREE.Vector3()) {
    const u = t * Math.PI * 2 * this.p;
    const v = t * Math.PI * 2 * this.q;
    const rr = this.R + this.r * Math.cos(v);
    return target.set(rr * Math.cos(u), this.r * Math.sin(v), rr * Math.sin(u));
  }
}

/* Sky studio: the CSS sky as a sphere, a dark ground band for contrast, a few softboxes and a low sun */
function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  const lin = (hex) => new THREE.Color(hex); // Color() converts sRGB hex to linear
  const sky = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      zenith: { value: lin('#3F63AA') },
      mid: { value: lin('#7C9AD2') },
      haze: { value: lin('#C9CDE0') },
      horizon: { value: lin('#FFF1E4') },
      groundLine: { value: lin('#283041') },
      groundNear: { value: lin('#76819A') },
      groundFar: { value: lin('#E2CFBE') },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 zenith, mid, haze, horizon, groundLine, groundNear, groundFar;
      varying vec3 vDir;
      void main() {
        float y = normalize(vDir).y;
        vec3 col;
        if (y >= 0.0) {
          float t = pow(y, 0.55);
          col = mix(horizon, haze, smoothstep(0.0, 0.28, t));
          col = mix(col, mid, smoothstep(0.22, 0.6, t));
          col = mix(col, zenith, smoothstep(0.55, 1.0, t));
          col += vec3(1.0, 0.86, 0.72) * exp(-y * 22.0) * 0.9;
        } else {
          // a thin dark line under the horizon gives the chrome its edge; below it, a pale slate-to-peach floor
          col = mix(groundNear, groundFar, smoothstep(0.08, 0.85, -y));
          col = mix(col, groundLine, smoothstep(0.0, 0.025, -y) * (1.0 - smoothstep(0.05, 0.11, -y)));
          col = mix(col, horizon * 0.9, exp(y * 90.0) * 0.7);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 64, 32), sky));

  const box = (w, h, intensity, color, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.copy(pos);
    m.lookAt(look);
    env.add(m);
  };
  const o = new THREE.Vector3();
  box(14, 3, 2.6, '#FFFFFF', new THREE.Vector3(0, 14, 6), o);                 // overhead key
  box(1.6, 12, 3.2, '#F4F8FF', new THREE.Vector3(-15, 3, 4), o);              // tall strip, left
  box(1.2, 10, 2.4, '#FFF3E6', new THREE.Vector3(14, 2, -6), o);              // warm strip, right back
  box(5, 2, 1.6, '#DCE7FF', new THREE.Vector3(6, 5, 15), o);                  // fill from the camera side
  box(1.1, 16, 2.2, '#FFFFFF', new THREE.Vector3(-6.5, 0, 14), o);            // tall strips near the camera: vertical highlights on the casing
  box(0.7, 16, 1.3, '#FFF1E2', new THREE.Vector3(8, 0, 13), o);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE2C4').multiplyScalar(9) }));
  sun.position.set(13, 1.6, 9);
  env.add(sun);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  env.traverse((m) => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose(); } });
  return rt;
}

function buildWellhead() {
  const group = new THREE.Group();
  const chrome = new THREE.MeshStandardMaterial({ color: '#E9EEF6', metalness: 1, roughness: 0.08 });
  const satin = new THREE.MeshStandardMaterial({ color: '#C9D1DE', metalness: 1, roughness: 0.3 });
  const graphite = new THREE.MeshStandardMaterial({ color: '#5B6274', metalness: 0.9, roughness: 0.3 });
  const brass = new THREE.MeshStandardMaterial({ color: '#F2D2B0', metalness: 0.85, roughness: 0.26 });
  const add = (geo, mat, setup) => { const m = new THREE.Mesh(geo, mat); setup && setup(m); group.add(m); return m; };
  // small repeated parts share one draw call each
  const dummy = new THREE.Object3D();
  const instanced = (geo, mat, list) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((setup, i) => { dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); setup(dummy); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    group.add(im);
    return im;
  };
  const bolts = [];

  const R = 1.3;

  // the coil exchanger: a graphite core ring wound with a chrome double helix
  const coil = new THREE.Group();
  const core = new THREE.Mesh(new THREE.TorusGeometry(R, 0.2, 40, 220), graphite);
  core.rotation.x = Math.PI / 2;
  coil.add(core);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new TorusCoil(R, 0.255, 2, 59), 2400, 0.043, 10, true), chrome);
  coil.add(wire);
  group.add(coil);
  // two brass bands where the legs leave the ring (on the group, so they stay put while the coil turns)
  [20, 160].forEach((deg) => {
    const a = deg * D2R;
    add(new THREE.TorusGeometry(0.29, 0.045, 16, 48), brass, (m) => { m.position.set(R * Math.cos(a), 0, R * Math.sin(a)); m.rotation.y = -a; });
  });

  // casing, running down out of frame
  add(new THREE.CylinderGeometry(0.24, 0.24, 10, 64, 1, true), chrome, (m) => { m.position.y = 0.55 - 5; });

  // six spokes from casing to core
  const mid = 0.24 + (R - 0.2 - 0.24) / 2;
  instanced(new THREE.CylinderGeometry(0.028, 0.028, R - 0.2 - 0.24, 12), satin, Array.from({ length: 6 }, (_, i) => (m) => {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    m.position.set(Math.cos(a) * mid, 0, Math.sin(a) * mid);
    m.rotation.set(0, -a, Math.PI / 2);
  }));
  add(new THREE.CylinderGeometry(0.33, 0.33, 0.12, 48), satin, (m) => { m.position.y = 0; });

  // flanges with bolt rings
  const flange = (y, r, h) => {
    add(new THREE.CylinderGeometry(r, r, h, 64), brass, (m) => { m.position.y = y; });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      bolts.push((m) => m.position.set(Math.cos(a) * (r - 0.06), y + h / 2, Math.sin(a) * (r - 0.06)));
    }
  };
  flange(0.6, 0.42, 0.08);
  flange(-1.25, 0.38, 0.08);
  flange(-2.75, 0.38, 0.08);
  instanced(new THREE.SphereGeometry(0.03, 12, 8), chrome, bolts);

  // valve tree and handwheel
  add(new THREE.CylinderGeometry(0.16, 0.18, 0.5, 48), chrome, (m) => { m.position.y = 0.89; });
  add(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 48), brass, (m) => { m.position.y = 1.165; });
  add(new THREE.CylinderGeometry(0.11, 0.13, 0.14, 32), satin, (m) => { m.position.y = 1.26; });
  add(new THREE.CylinderGeometry(0.032, 0.032, 0.3, 16), chrome, (m) => { m.position.y = 1.45; });
  add(new THREE.TorusGeometry(0.36, 0.028, 16, 96), brass, (m) => { m.position.y = 1.52; m.rotation.x = Math.PI / 2; });
  instanced(new THREE.CylinderGeometry(0.014, 0.014, 0.72, 8), brass, Array.from({ length: 4 }, (_, i) => (m) => {
    m.position.y = 1.52;
    m.rotation.set(0, (i / 4) * Math.PI, Math.PI / 2);
  }));
  add(new THREE.SphereGeometry(0.05, 16, 12), chrome, (m) => { m.position.y = 1.6; });

  // supply and return legs: from the underside of the ring, curving in beside the casing
  [20, 160].forEach((deg) => {
    const a = deg * D2R, c = Math.cos(a), s = Math.sin(a);
    const pts = [
      [R, -0.05], [R - 0.04, -0.38], [R - 0.32, -0.92], [0.62, -1.45], [0.5, -1.8], [0.5, -2.4], [0.5, -9.5],
    ].map(([rad, y]) => new THREE.Vector3(c * rad, y, s * rad));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 220, 0.075, 20, false), chrome);
  });

  return { group, coil, materials: [chrome, satin, graphite, brass] };
}

/* model facts the page lines up with */
const GROUND = -2.04;          // model y where the casing enters the ground (the poster's bottom edge)
const TOP = 1.855;             // model y at the poster's top edge
const LEGS = [20, 160];        // leg angles, radius 0.5, tube 0.075
const RISE = TOP - GROUND + 0.1;

export function createWellhead(canvas, { reduced = false, onFrame = null, getBox } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true;
  const maxDpr = 2;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const envRT = buildEnvironment(renderer);
  scene.environment = envRT.texture;

  const { group, coil, materials } = buildWellhead();
  const ground = new THREE.Plane();
  materials.forEach((m) => { m.clippingPlanes = [ground]; });
  const rig = new THREE.Group(); // pointer tilt
  rig.add(group);
  scene.add(rig);
  group.rotation.y = 0.35;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const target = new THREE.Vector3();
  const anchor = new THREE.Vector3(0, 1.52, 0);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), right = new THREE.Vector3();
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const rest = new THREE.Matrix4(), rotY = new THREE.Matrix4();

  let w = 1, h = 1, dist = 9, hzY = 0;
  const ELEV = 13 * D2R;
  const tanV = Math.tan((camera.fov * D2R) / 2);

  // frame the model to the page's object box: its height sets the scale, its bottom-centre the ground point
  function resize() {
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.clearViewOffset();
    const box = getBox ? getBox() : { cx: w * 0.6, bottom: h * 0.72, h: h * 0.5 };
    hzY = box.bottom;
    const k = box.h / (TOP - GROUND);                 // px per model unit
    dist = h / (2 * k * tanV);
    camera.position.set(0, Math.sin(ELEV) * dist, Math.cos(ELEV) * dist);
    target.set(0, 0, 0);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    // shift the image so the ground point lands on the box's bottom centre
    toPx(tmp.set(0, GROUND, 0), tmp2);
    camera.setViewOffset(w, h, -(box.cx - tmp2.x), -(box.bottom - tmp2.y), w, h);
    camera.updateProjectionMatrix();
  }

  function toPx(v, out) {
    out.copy(v).project(camera);
    return out.set((out.x * 0.5 + 0.5) * w, (-out.y * 0.5 + 0.5) * h, 0);
  }

  // the ground: a plane through the eye and the horizon line on screen
  function clipToHorizon() {
    camera.updateMatrixWorld();
    const ny = 1 - (hzY / h) * 2;
    va.set(-1, ny, 0.5).unproject(camera);
    vb.set(1, ny, 0.5).unproject(camera);
    ground.setFromCoplanarPoints(camera.position, va, vb);
    vc.set(0, ny + 0.3, 0.5).unproject(camera);
    if (ground.distanceToPoint(vc) < 0) ground.negate();
  }

  let t = 0, last = performance.now(), running = false, active = true;
  let scroll = 0, sScroll = 0, px = 0, py = 0, sx = 0, sy = 0;
  let introT0 = reduced ? -1e9 : null, rise = reduced ? 1 : 0;
  let frames = 0, slowAcc = 0;

  function place(dt, now = performance.now()) {
    sScroll = reduced ? scroll : damp(sScroll, scroll, 6, dt);
    sx = reduced ? 0 : damp(sx, px, 2.4, dt);
    sy = reduced ? 0 : damp(sy, py, 2.4, dt);
    if (introT0 !== null) rise = Math.min(1, Math.max(0, (now - introT0 - 120) / 1000));
    const e = 1 - Math.pow(1 - rise, 3);

    group.position.y = -RISE * (1 - e);
    coil.rotation.y = -t * 0.05 - sScroll * 0.6;
    rig.rotation.x = sy * 0.03 + sScroll * 0.05;

    camera.position.set(sx * 0.12, Math.sin(ELEV) * dist, Math.cos(ELEV) * dist);
    camera.lookAt(target);
    clipToHorizon();
  }

  // where the page should draw the pipes below the line (the model at rest, not mid-rise)
  function groundPipes() {
    rest.copy(rig.matrixWorld).multiply(rotY.makeRotationY(group.rotation.y));
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const at = (x, z, r) => {
      tmp.set(x, GROUND, z).applyMatrix4(rest);
      const c = toPx(tmp, tmp2).x;
      const a = toPx(va.copy(tmp).addScaledVector(right, -r), vb).x;
      const b = toPx(vc.copy(tmp).addScaledVector(right, r), vb).x;
      return [c, Math.abs(b - a)];
    };
    const [cx, cw] = at(0, 0, 0.24);
    const legs = LEGS.map((deg) => at(0.5 * Math.cos(deg * D2R), 0.5 * Math.sin(deg * D2R), 0.075)).sort((p, q) => p[0] - q[0]);
    return { cx, cw, l1: legs[0][0], l2: legs[1][0], lw: (legs[0][1] + legs[1][1]) / 2 };
  }

  function project() {
    if (!onFrame) return;
    toPx(tmp.copy(anchor).applyMatrix4(group.matrixWorld), tmp2);
    onFrame({ x: tmp2.x, y: tmp2.y, w, h, risen: rise >= 1, ground: groundPipes() });
  }

  function render() {
    scene.updateMatrixWorld();
    renderer.render(scene, camera);
    project();
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    t += dt;
    place(dt, now);
    render();
    // drop to 1x if the first seconds run slowly
    if (frames < 150) {
      frames++;
      if (frames > 30) slowAcc += dt;
      if (frames === 150 && slowAcc / 120 > 1 / 40 && dpr > 1) { dpr = 1; renderer.setPixelRatio(1); resize(); }
    }
  }

  const loopOn = () => { if (!running) { running = true; last = performance.now(); renderer.setAnimationLoop(frame); } };
  const loopOff = () => { if (running) { running = false; renderer.setAnimationLoop(null); } };
  const sync = () => { (!reduced && active && !document.hidden) ? loopOn() : loopOff(); };
  document.addEventListener('visibilitychange', sync);

  resize();
  place(0);
  render();

  return {
    start() { active = true; sync(); },
    stop() { active = false; sync(); },
    resize() { resize(); place(0); render(); },
    setScroll(p) { scroll = p; if (reduced) { place(0); render(); } },
    setPointer(x, y) { px = x; py = y; },
    // rise out of the ground; `done` skips straight to the end (late arrival or reduced motion)
    startIntro(done = false) { introT0 = done ? -1e9 : performance.now(); if (done || reduced) { place(0); render(); } },
    renderOnce() { place(0); render(); },
    info: () => ({ dpr: renderer.getPixelRatio(), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, running, rise }),
  };
}
