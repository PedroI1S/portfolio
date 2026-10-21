/* Vectorhaus persistent field: one raw-WebGL fragment shader of twisting satin ribbons of light, layered by depth.
   Paused when off-screen or the tab is hidden; a single still frame with reduced motion.
   Five scroll states and a 0.84-second ignition share this single context.
   If WebGL is missing or fails, CSS light and static wake panels take over. */
(() => {
  const canvas = document.querySelector('.hero__canvas');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const VERT = 'attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }';

  const fragSource = (derivs) => `${derivs ? '#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n' : ''}
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uWake;
uniform float uMode;
uniform float uScroll;

// Palette in sRGB; lighting is done in linear space and tone-mapped at the end.
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
vec3 CYAN, VIOLET, ICE, DEEP, INDIGO;

const vec3 LD = vec3(-0.33, 0.56, 0.76);   // key light, normalised in main()
vec3 Ld, Hd;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

// A satin ribbon: a slightly curved strip that twists along its length, seen in projection.
// soft > 0 blurs it (depth of field); strands > 0 engraves fine fibres along it.
vec3 ribbon(vec2 p, float t, float seed, float width, float soft, float strands, vec3 front, vec3 back) {
  float x = p.x;
  float a1 = x * 1.7 + t * 0.50 + seed * 1.7;
  float a2 = x * 3.2 - t * 0.38 + seed * 3.9;
  float a3 = x * 5.9 + t * 0.62 + seed * 0.6;
  float c  = 0.15 * sin(a1) + 0.06 * sin(a2) + 0.022 * sin(a3);
  float dc = 0.255 * cos(a1) + 0.192 * cos(a2) + 0.13 * cos(a3);
  float k = inversesqrt(1.0 + dc * dc);           // measure across the curve, not vertically

  float theta = x * 3.1 - t * 0.55 + seed * 2.3 + 0.6 * sin(x * 1.1 + t * 0.2 + seed);
  float ct = cos(theta);
  float hw = width * (0.8 + 0.2 * sin(x * 1.3 + seed * 4.1 + t * 0.15));
  float proj = max(abs(ct) * hw, 0.0012);
  float dy = (p.y - c) * k;
  float s = dy / proj;

  // blur is absolute (depth of field), and a blurred sheet seen edge-on spreads its light thin
  float b = 1.2 / uRes.y + soft * width;
  float ady = abs(dy);
  float cover = 1.0 - smoothstep(proj - b, proj + b, ady);
  float energy = proj / max(proj, b);

  // the cross-section is curved, so the normal turns across the width: a satin sheen
  float u = clamp(s, -1.0, 1.0) * sign(ct);
  float th = theta + u * 0.6;
  vec3 n = vec3(0.0, -sin(th), cos(th));
  float diff = abs(dot(n, Ld));
  float sheen = 1.0 - smoothstep(0.1, 0.4, soft);  // blurred ribbons lose their highlights
  float spec = pow(abs(dot(n, Hd)), 42.0) * sheen;
  float rim = pow(1.0 - abs(n.z), 3.0) * sheen;
  vec3 tint = mix(back, front, smoothstep(-0.3, 0.3, cos(th)));

  float line = 1.0;
  if (strands > 0.0) {
    float q = (u * 0.5 + 0.5) * strands;
#ifdef HAS_DERIV
    float fw = fwidth(q);
#else
    float fw = strands * 0.5 / (proj * uRes.y);
#endif
    float d = abs(fract(q) - 0.5);
    float l = 1.0 - smoothstep(0.11, 0.11 + fw * 1.5, d);
    l = mix(l, 0.24, smoothstep(0.25, 0.75, fw));   // fibres average out where they crowd
    line = mix(0.3, 1.8, l);
  }

  float pinch = pow(1.0 - abs(ct), 6.0);            // edge-on: the sheet compresses into a line of light
  vec3 col = tint * (0.03 + 0.22 * mix(0.6, diff, sheen) + 0.4 * rim) * line;
  col += mix(tint, vec3(1.0), 0.5) * spec * 1.1 * line;
  col *= cover * energy * (1.0 + 2.0 * pinch);
  col += tint * (exp(-ady * 7.0) * 0.01 + exp(-ady * 26.0) * 0.014 + exp(-ady * 60.0) * 0.12 * pinch) * energy;
  return col;
}

// Sparse motes drifting up through the light; one per grid cell at most.
vec3 dust(vec2 uv, float t, float scale, float radius, float seed) {
  vec2 q = uv * scale + vec2(seed * 7.3, -t * 0.06 * scale);
  vec2 id = floor(q);
  vec2 f = fract(q) - 0.5;
  vec2 h = hash22(id + seed * 17.0);
  vec2 o = (h - 0.5) * (1.0 - 2.0 * radius) * 0.9;
  float d = length(f - o);
  float disc = 1.0 - smoothstep(radius * 0.45, radius, d);
  float twinkle = 0.55 + 0.45 * sin(t * (0.5 + h.y) + h.x * 40.0);
  return mix(CYAN, VIOLET, h.y) * disc * twinkle * step(0.68, h.x);
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  CYAN = lin(vec3(0.247, 0.910, 0.933));
  VIOLET = lin(vec3(0.561, 0.420, 1.000));
  ICE = lin(vec3(0.840, 0.975, 1.000));
  DEEP = lin(vec3(0.030, 0.040, 0.095));
  INDIGO = lin(vec3(0.170, 0.140, 0.460));
  Ld = normalize(LD);
  Hd = normalize(Ld + vec3(0.0, 0.0, 1.0));

  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 n = gl_FragCoord.xy / uRes;
  float t = uTime;
  float hero = 1.0 - smoothstep(0.0, 1.0, uMode);
  float platform = smoothstep(0.0, 1.0, uMode) * (1.0 - smoothstep(1.0, 2.0, uMode));
  float code = smoothstep(1.0, 2.0, uMode) * (1.0 - smoothstep(2.0, 3.0, uMode));
  float pricing = smoothstep(2.0, 3.0, uMode) * (1.0 - smoothstep(3.0, 4.0, uMode));
  float dawn = smoothstep(3.0, 4.0, uMode);
  VIOLET = mix(VIOLET, mix(CYAN, ICE, 0.6), dawn);

  // background: deep base, an indigo light source behind the ribbons, slow nebula, faint shafts
  vec2 src = vec2(0.06, 0.2) + uPointer * 0.01;
  vec2 ds = (uv - src) * vec2(0.9, 1.1);
  float r2 = dot(ds, ds);
  vec3 col = DEEP;
  col += INDIGO * 0.16 * exp(-r2 * 3.0);
  col += VIOLET * 0.02 * exp(-r2 * 7.0);
  col += CYAN * 0.02 * exp(-r2 * 20.0);
  col *= 0.75 + 0.5 * fbm(uv * 2.0 + vec2(t * 0.015, -t * 0.01));
  col += VIOLET * 0.012 * smoothstep(0.9, 0.0, length(uv - vec2(0.45, -0.38)));

  // fine dust, brighter inside the light
  col += dust(uv, t, 13.0, 0.08, 1.0) * 0.1 * (0.2 + exp(-r2 * 3.0));

  // Five light states share the original satin ribbon geometry.
  float a = 0.33;
  mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 p = R * (uv - vec2(0.0, 0.07));
  p.y += (noise(uv * 1.4 + vec2(t * 0.05, 0.0)) - 0.5) * 0.05;
  p = mix(p, vec2(uv.x, (uv.y + 0.10) * 6.0), dawn);
  float tt = t * 0.85;
  vec3 ribbons = ribbon(p + uPointer * 0.010 + vec2(0.0, -0.13), tt * 0.8, 3.0, 0.15, 0.45, 0.0, VIOLET * 0.8, INDIGO * 2.4) * 0.55;
  ribbons += ribbon(p + uPointer * 0.022, tt, 0.0, 0.095, 0.02, 22.0, mix(CYAN, ICE, 0.2), VIOLET);
  ribbons += ribbon(p + uPointer * 0.032 + vec2(0.31, 0.07), tt * 1.1, 1.4, 0.05, 0.0, 12.0, ICE, CYAN) * 0.7;
  float ignition = 1.0 - smoothstep(uWake * 1.25 - 0.15, uWake * 1.25 + 0.015, n.x);
  float luminance = dot(ribbons, vec3(0.21, 0.72, 0.07));
  vec3 dormant = vec3(0.28, 0.31, 0.48) * luminance * 0.06;
  vec3 lit = mix(dormant, ribbons, ignition);
  col *= hero * mix(0.35, 1.0, uWake) + 0.28;
  col += lit * (hero + dawn * 0.9);
  // Low pools tint the translucent product surfaces. A strand runs down the left.
  vec2 poolUV = n + vec2(0.0, sin(uScroll * 0.8) * 0.04);
  col += CYAN * platform * 0.13 * exp(-length((poolUV - vec2(0.12, 0.45)) * vec2(1.2, 1.0)) * 2.5);
  col += VIOLET * platform * 0.12 * exp(-length((poolUV - vec2(0.83, 0.65)) * vec2(1.2, 1.0)) * 2.5);
  float strandX = 0.045 + sin(n.y * 4.0 + t * 0.2) * 0.018;
  col += CYAN * platform * 0.045 * exp(-abs(n.x - strandX) * 500.0);
  col += VIOLET * pricing * 0.26 * exp(-length((poolUV - vec2(0.75, 0.45)) * vec2(1.05, 1.3)) * 2.3);
  col += CYAN * pricing * 0.025 * exp(-length(poolUV - vec2(0.1, 0.65)) * 3.0);
  col = mix(col, DEEP * 0.55, code * 0.86);
  // Dawn compresses every ribbon to one horizon, with warmth only at the bottom edge.
  float horizon = abs(n.y - 0.40);
  col += mix(CYAN, ICE, 0.72) * dawn * (0.026 * exp(-horizon * 9.0) + 0.45 * exp(-horizon * 130.0) + 1.8 * exp(-horizon * 1100.0));
  col += CYAN * dawn * 0.03 * exp(-horizon * 5.0);
  col += lin(vec3(1.0, 0.94, 0.88)) * dawn * 0.04 * exp(-n.y * 36.0);

  // vignette, deeper along the bottom where the headline sits
  col *= mix(mix(0.45, 1.0, smoothstep(0.0, 0.55, n.y)), 1.0, dawn);
  col *= 1.0 - 0.45 * pow(length((n - vec2(0.5, 0.58)) * vec2(0.95, 1.05)) * 1.25, 2.4);

  col = pow(aces(col * 1.3), vec3(1.0 / 2.2));
  col += (hash12(gl_FragCoord.xy + fract(t * 7.0) * 100.0) - 0.5) * (2.0 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}`;

  const root = document.documentElement;
  root.classList.toggle('reduced-motion', reduceMotion);
  const hero = document.querySelector('.hero');
  const wake = document.querySelector('.wake');
  const clock = document.querySelector('.wake__clock span');
  const clockWrap = document.querySelector('.wake__clock');
  const ticks = [...document.querySelectorAll('.wake__ticks li')];
  const introClock = document.querySelector('.intro-clock');
  const sections = ['platform', 'code', 'pricing', 'start'].map(id => document.getElementById(id));
  const state = { wake: 1, mode: 0, scroll: 0, progress: 0 };
  let gl = null, prog = null, buf = null, loc = {};
  let raf = 0, running = false, inView = true, contextLost = false;
  let time = 9.0, last = 0, slowFrames = 0, sampleFrames = 0;
  let scale = Math.min(window.devicePixelRatio || 1, 1.5);
  let resolutionFactor = 1;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let introStart = 0, introDone = reduceMotion || scrollY > 100;
  let introReady = introDone;
  let introTimer = 0;
  const startIntroClock = () => {
    if (introDone || !introReady || introTimer || document.hidden) return;
    introTimer = setInterval(() => {
      updateIntro(performance.now());
      draw();
      if (introDone) { clearInterval(introTimer); introTimer = 0; }
    }, 16);
  };
  const armIntro = () => { introStart = performance.now(); introReady = true; startIntroClock(); };
  // Fonts and deferred resources can finish after the shader has compiled. The
  // first visible arrival starts when the page is ready, rather than being spent
  // behind a browser loading frame.
  if (!introDone) {
    const ready = () => (document.fonts?.ready || Promise.resolve()).then(armIntro);
    if (document.readyState === 'complete') ready();
    else window.addEventListener('load', ready, { once: true });
  }
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  document.querySelectorAll('.hero__title .word > span').forEach((s, i) => s.style.setProperty('--i', i));

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh); gl.deleteShader(sh); throw new Error(log || 'shader compile failed');
    }
    return sh;
  }
  function init() {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    try {
      prog = gl.createProgram();
      const vert = compile(gl.VERTEX_SHADER, VERT), frag = compile(gl.FRAGMENT_SHADER, fragSource(!!gl.getExtension('OES_standard_derivatives')));
      gl.attachShader(prog, vert); gl.attachShader(prog, frag); gl.linkProgram(prog);
      gl.deleteShader(vert); gl.deleteShader(frag);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (err) { return false; }
    gl.useProgram(prog);
    buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uTime', 'uPointer', 'uWake', 'uMode', 'uScroll'].forEach(name => loc[name] = gl.getUniformLocation(prog, name));
    root.classList.add('has-webgl');
    return true;
  }
  function resize() {
    const factor = scale * resolutionFactor;
    const bw = Math.max(1, Math.floor(innerWidth * factor)), bh = Math.max(1, Math.floor(innerHeight * factor));
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    if (gl && !contextLost) gl.viewport(0, 0, bw, bh);
  }
  function draw() {
    if (!gl || contextLost) return;
    gl.uniform2f(loc.uRes, canvas.width, canvas.height);
    gl.uniform1f(loc.uTime, time);
    gl.uniform2f(loc.uPointer, pointer.x, pointer.y);
    gl.uniform1f(loc.uWake, state.wake);
    gl.uniform1f(loc.uMode, state.mode);
    gl.uniform1f(loc.uScroll, state.scroll);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add('is-live');
  }
  function updateScene() {
    const y = scrollY, h = innerHeight;
    const wr = wake.getBoundingClientRect();
    const progress = clamp(-wr.top / Math.max(1, wake.offsetHeight - h));
    state.progress = progress;
    state.scroll = y / h;
    const useWake = !reduceMotion && root.classList.contains('has-webgl');
    state.wake = useWake && wr.top < h * 0.7 && wr.bottom > 0 ? progress : 1;
    // Each scene dissolves over 600 px before its section reaches the top.
    // Only entered sections contribute; unentered scenes must not advance the mode.
    state.mode = 0;
    sections.forEach((section, i) => {
      const transition = clamp((h * 0.70 - section.getBoundingClientRect().top) / 600);
      if (transition > 0) state.mode = i + transition;
    });
    if (reduceMotion) { state.mode = 0; state.wake = 1; state.scroll = 0; }
    if (clock) clock.textContent = (progress * 0.84).toFixed(2);
    if (clockWrap) clockWrap.style.color = progress > 0.90 ? '#f5f7fc' : '#8991a7';
    const stage = progress < 0.31 / 0.84 ? 0 : progress < 0.94 ? 1 : 2;
    ticks.forEach((tick, i) => tick.classList.toggle('is-active', i === stage));
    const factor = hero.getBoundingClientRect().bottom <= 0 ? 0.5 : 1;
    if (resolutionFactor !== factor) { resolutionFactor = factor; resize(); }
    const visible = document.querySelector('main').getBoundingClientRect().bottom > h * .30;
    if (visible !== inView) { inView = visible; sync(); }
    if (!running) draw();
  }
  function updateIntro(now) {
    if (introDone) { root.classList.add('field-ready'); hero.classList.add('is-booted', 'is-in'); return; }
    if (!introReady) { introClock.textContent = '0.00'; state.wake = 0; return; }
    const elapsed = now - introStart;
    hero.classList.add('is-booting');
    if (elapsed >= 200) root.classList.add('field-ready');
    const progress = clamp((elapsed - 200) / 840);
    if (scrollY < 100) state.wake = progress;
    introClock.textContent = (progress * .84).toFixed(2);
    if (elapsed >= 1000) hero.classList.add('is-booted', 'is-in');
    if (elapsed >= 1500 || scrollY > 100) { introDone = true; introClock.textContent = '0.84'; hero.classList.add('is-booted', 'is-in'); }
  }
  function frame(now) {
    const dt = last ? (now - last) / 1000 : 0.016; last = now;
    if (dt > .008 && dt < .1 && gl) {
      sampleFrames++; if (dt > .021) slowFrames++;
      if (sampleFrames >= 50) {
        if (slowFrames > 30 && scale > .5) { scale = Math.max(.5, scale * .8); resize(); }
        sampleFrames = 0; slowFrames = 0;
      }
    }
    if (state.progress <= 0 || state.progress >= 1) time += Math.min(dt, .05);
    pointer.x += (pointer.tx - pointer.x) * .04; pointer.y += (pointer.ty - pointer.y) * .04;
    draw();
    if ((!gl && introDone) || reduceMotion) { running = false; return; }
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || reduceMotion || document.hidden || !inView || contextLost) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function sync() { if (inView && !document.hidden && !contextLost) start(); else stop(); }
  const hasGL = init();
  if (!hasGL) gl = null;
  resize(); updateScene();
  // Shader compilation can be slow on a cold driver. Start the 1.4 s clock only
  // after the first draw so the arrival is visible on that first visit too.
  if (!introDone) state.wake = 0;
  updateIntro(performance.now()); draw(); sync();
  window.vectorhausField = { updateScene };
  window.addEventListener('resize', () => { resize(); updateScene(); draw(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearInterval(introTimer); introTimer = 0; }
    else if (!introDone && introReady) { introStart = performance.now(); startIntroClock(); }
    sync();
  });

  if (finePointer && !reduceMotion) {
    document.addEventListener('pointermove', e => { pointer.tx = clamp(e.clientX / innerWidth * 2 - 1, -1, 1); pointer.ty = clamp(1 - e.clientY / innerHeight * 2, -1, 1); }, { passive: true });
    document.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; });
  }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); contextLost = true; stop(); root.classList.remove('has-webgl'); canvas.classList.remove('is-live'); });
  canvas.addEventListener('webglcontextrestored', () => { contextLost = false; if (init()) { resize(); updateScene(); draw(); sync(); } });
})();
