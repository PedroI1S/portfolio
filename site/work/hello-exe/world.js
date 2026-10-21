/* hello.exe: chrome word scenes.
   An inflated chrome word (the hero's "hey", the contact "HELLO"), optionally with a glossy 3D OS cursor
   that stands in for the pointer. Lit only by a sky environment (see chrome.js). */
import { THREE, damp, clamp, makeRenderer, rasterText, inflate, materials } from './chrome.js?v=10';

/* ---------- The cursor: a classic arrow, extruded and bevelled ---------- */
function buildCursor() {
  const s = new THREE.Shape();
  const pts = [[0, 0], [0, -17], [4.1, -13.1], [7.0, -19.6], [9.8, -18.4], [7.0, -12.1], [12.4, -12.1]];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 2.4, bevelEnabled: true, bevelThickness: 1.3, bevelSize: 0.85, bevelSegments: 7, curveSegments: 4 });
  geo.translate(0, 0, -1.2);
  // caps in pearl white, the walls in OS blue
  const face = new THREE.MeshPhysicalMaterial({ color: '#F4F7FC', roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 });
  const wall = new THREE.MeshPhysicalMaterial({ color: '#2C7BDC', roughness: 0.16, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 });
  return new THREE.Mesh(geo, [face, wall]);
}

/**
 * text      – the word to inflate
 * cursor    – add the 3D OS cursor (hero only)
 * layout    – 'hero': poster-scale, a touch above centre; 'fill': fit the canvas box
 * inflated  – start puffed up; otherwise the word waits flat until inflate() is called
 */
export async function createChromeWord(canvas, { text = 'hey', cursor: withCursor = true, layout = 'hero', inflated = true, reduced = false, theme = 'a', fine = true } = {}) {
  const { renderer, scene, setEnv } = makeRenderer(canvas, theme);
  let dpr = renderer.getPixelRatio();

  try { await document.fonts.load('900 100px "Unbounded"', text); } catch (e) { /* falls back to a system heavy face */ }
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const fontPx = small ? 240 : 300;
  const word = inflate(rasterText(text, { fontPx }), {
    round: fontPx * 0.016, smooth: fontPx * 0.022, step: small ? 3 : 2.5, puff: 0.92, scale: 2.4 / fontPx, center: true,
  });

  const wordMesh = new THREE.Mesh(word.geo, materials.chrome());
  const wordRig = new THREE.Group();      // pointer tilt + idle sway
  const wordPop = new THREE.Group();      // inflate + squash springs
  wordPop.add(wordMesh);
  wordRig.add(wordPop);
  scene.add(wordRig);

  const cursor = buildCursor();
  const cursorRig = new THREE.Group();
  cursorRig.add(cursor);
  if (withCursor) scene.add(cursorRig);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const tanV = Math.tan((camera.fov * Math.PI) / 360);
  const Z_CURSOR = 1.1;
  let w = 1, h = 1, D = 10, wordY = 0, pxWorld = 0.01;

  function resize() {
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    if (layout === 'fill') {
      // the canvas is the word's box plus a margin for the puff and the tilt
      D = Math.max(word.width / (2 * 0.86 * tanV * aspect), word.height / (2 * 0.74 * tanV));
    } else {
      // word width as a share of the screen: poster-scale on desktop, near full width on phones
      const frac = aspect < 0.8 ? 0.9 : aspect < 1.2 ? 0.74 : 0.6;
      D = word.width / (2 * frac * tanV * aspect);
      D = Math.max(D, word.height / (2 * 0.42 * tanV)); // never taller than 42% of the screen
    }
    camera.position.set(0, 0, D);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const visH = 2 * D * tanV;
    // a touch above centre leaves room for the statement below it
    wordY = layout === 'fill' ? 0 : (aspect < 0.8 ? 0.06 : 0.05) * visH;
    pxWorld = (2 * (D - Z_CURSOR) * tanV) / h;
  }

  // pointer state in canvas pixels; `inside` means the pointer is over the hero
  let ptX = 0, ptY = 0, inside = false, hoverUI = false;
  let cX = 0, cY = 0, vX = 0, vY = 0, cScale = 0;
  let tilt = 0, tiltX = 0, sx = 0, sy = 0;
  let t = 0, last = performance.now(), running = false, active = true;
  // springs: inflate (z scale), squash after a poke, press dip on the cursor
  let infTarget = inflated ? 1 : 0.03;
  let inf = reduced ? infTarget : 0.03, infV = 0, sq = 0, sqV = 0, press = 0, pressV = 0, pressing = false;
  let introCursor = reduced ? 1 : 0;

  const toWorld = (x, y) => {
    const ndcX = (x / w) * 2 - 1, ndcY = -(y / h) * 2 + 1;
    return [ndcX * (D - Z_CURSOR) * tanV * camera.aspect, ndcY * (D - Z_CURSOR) * tanV];
  };
  const restPoint = () => {
    // resting just off the lower right of the word, pointing back at it
    const visW = 2 * (D - Z_CURSOR) * tanV * camera.aspect;
    const x = Math.min(word.width * 0.36, visW * 0.4);
    return [x, wordY - word.height * 0.5];
  };

  function step(dt) {
    t += dt;
    // springs (semi-implicit Euler, two substeps keep them stable at low frame rates)
    for (let i = 0; i < 2; i++) {
      const h2 = dt / 2;
      infV += (-(inf - infTarget) * 70 - infV * 7) * h2; inf += infV * h2;
      sqV += (-sq * 160 - sqV * 9) * h2; sq += sqV * h2;
      pressV += (-(press - (pressing ? 1 : 0)) * 420 - pressV * 26) * h2; press += pressV * h2;
    }
    introCursor = Math.min(1, introCursor + dt / 1.2);

    // the word leans toward the pointer and sways a few degrees on its own
    const nx = inside ? (ptX / w) * 2 - 1 : 0, ny = inside ? (ptY / h) * 2 - 1 : 0;
    sx = damp(sx, nx, 3, dt); sy = damp(sy, ny, 3, dt);
    wordRig.position.y = wordY + Math.sin(t * 0.8) * 0.02;
    const sway = layout === 'fill' ? 0.6 : 1;
    wordRig.rotation.y = (Math.sin(t * 0.35) * 0.1 + sx * 0.22) * sway;
    wordRig.rotation.x = (Math.sin(t * 0.5 + 1) * 0.035 + sy * 0.14) * sway;
    wordPop.scale.set(1 + sq * 0.07, 1 - sq * 0.07, Math.max(0.02, inf) * (1 + sq * 0.3 + Math.sin(t * 1.3) * 0.015));

    // cursor: exact on fine pointers, gliding back to rest otherwise
    const [rx, ry] = restPoint();
    let tx = rx, ty = ry + Math.sin(t * 1.4) * 0.04;
    if (inside && fine) [tx, ty] = toWorld(ptX, ptY);
    const px0 = cX, py0 = cY;
    const lambda = inside && fine ? 55 : 5;
    cX = damp(cX, tx, lambda, dt); cY = damp(cY, ty, lambda, dt);
    if (introCursor < 1) {
      const e = 1 - Math.pow(1 - introCursor, 3);
      cX = rx + (1 - e) * 1.8; cY = ry - (1 - e) * 1.2;
    }
    vX = damp(vX, (cX - px0) / Math.max(dt, 1e-3), 10, dt);
    vY = damp(vY, (cY - py0) / Math.max(dt, 1e-3), 10, dt);
    tilt = damp(tilt, clamp(-vX * 0.05, -0.6, 0.6), 8, dt);
    tiltX = damp(tiltX, clamp(vY * 0.04, -0.5, 0.5), 8, dt);
    cScale = damp(cScale, hoverUI ? 0 : 1, 14, dt);
    const sz = (58 * pxWorld) / 19.6; // about 58 css px tall
    cursorRig.position.set(cX, cY, Z_CURSOR);
    cursor.scale.setScalar(sz * cScale * (1 - press * 0.12));
    cursor.rotation.set(-0.28 + tiltX + press * 0.35, -0.42 + tilt * 0.6, tilt * 0.5 + Math.sin(t * 1.1) * (inside ? 0 : 0.05));
    cursor.visible = cScale > 0.02;
  }

  function render() { if (!document.hidden) renderer.render(scene, camera); }

  let frames = 0, slowAcc = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt);
    render();
    // drop resolution if the first seconds run slowly
    if (frames < 160) {
      frames++;
      if (frames > 40) slowAcc += dt;
      if (frames === 160 && slowAcc / 120 > 1 / 45 && dpr > 1) { dpr = Math.max(1, dpr * 0.7); renderer.setPixelRatio(dpr); resize(); }
    }
  }
  const loopOn = () => { if (!running) { running = true; last = performance.now(); renderer.setAnimationLoop(frame); } };
  const loopOff = () => { if (running) { running = false; renderer.setAnimationLoop(null); } };
  const sync = () => (!reduced && active ? loopOn() : loopOff());

  resize();
  [cX, cY] = restPoint();
  step(0.016);
  render();

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  return {
    start() { active = true; sync(); if (reduced) { step(0); render(); } },
    stop() { active = false; sync(); },
    resize() { resize(); step(0); render(); },
    setPointer(x, y) { ptX = x; ptY = y; inside = true; },
    leave() { inside = false; pressing = false; },
    setHoverUI(on) { hoverUI = on; },
    setPressed(on) { pressing = on; },
    /** returns true when the point hits the word; gives it a squash */
    poke(x, y) {
      ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      scene.updateMatrixWorld();
      const hit = raycaster.intersectObject(wordMesh, false).length > 0;
      if (hit) { sqV += 9; if (reduced) { step(0); render(); } }
      return hit;
    },
    setTheme(t) { setEnv(t); if (!running) { step(0); render(); } },
    /** puff the word up (from flat if it hasn't been yet) */
    inflate() {
      if (infTarget === 1) return;
      infTarget = 1;
      if (reduced) { inf = 1; step(0); render(); }
    },
    info: () => ({ dpr: renderer.getPixelRatio(), tris: renderer.info.render.triangles, calls: renderer.info.render.calls, running }),
  };
}
