/* Noct & Vale — smoke field.
   A small stable-fluids simulation: velocity on a ~128 px grid, dye on a ~512 px grid (quarter to half
   of the screen), incense emitters along the bottom, buoyancy, vorticity confinement, cursor stirring,
   palette blending and rare embers. Exposes window.NoctSmoke.create(canvas) → controller, or null when
   the browser can't render to half-float textures (the page keeps its CSS stand-in then). */
(() => {
  const VERT = `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv, vL, vR, vT, vB;
    uniform vec2 texelSize;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      vL = vUv - vec2(texelSize.x, 0.0);
      vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y);
      vB = vUv - vec2(0.0, texelSize.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`;

  const FRAG = {
    clear: `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D uTexture;
      uniform float value;
      void main() { gl_FragColor = value * texture2D(uTexture, vUv); }`,

    splat: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform float aspectRatio, radius;
      uniform vec3 color;
      uniform vec2 point;
      void main() {
        vec2 p = vUv - point;
        p.x *= aspectRatio;
        vec3 s = exp(-dot(p, p) / radius) * color;
        gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + s, 1.0);
      }`,

    // up to four soft splats in one pass (the incense sources + a breeze)
    emit: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 uPts[4];
      uniform vec3 uVals[4];
      void main() {
        vec3 base = texture2D(uTarget, vUv).xyz;
        for (int i = 0; i < 4; i++) {
          vec2 p = vUv - uPts[i].xy;
          p.x *= aspectRatio;
          base += exp(-dot(p, p) / max(uPts[i].z, 0.000001)) * uVals[i];
        }
        gl_FragColor = vec4(base, 1.0);
      }`,

    advection: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uVelocity, uSource;
      uniform vec2 texelSize;
      uniform float dt, dissipation;
      void main() {
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        gl_FragColor = texture2D(uSource, coord) / (1.0 + dissipation * dt);
      }`,

    divergence: `
      precision mediump float;
      varying vec2 vUv, vL, vR, vT, vB;
      uniform sampler2D uVelocity;
      void main() {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;
        vec2 C = texture2D(uVelocity, vUv).xy;
        if (vL.x < 0.0) L = -C.x;
        if (vR.x > 1.0) R = -C.x;
        if (vT.y > 1.0) T = C.y;   // open top: smoke leaves the frame
        if (vB.y < 0.0) B = -C.y;
        gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
      }`,

    curl: `
      precision mediump float;
      varying vec2 vUv, vL, vR, vT, vB;
      uniform sampler2D uVelocity;
      void main() {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
      }`,

    // vorticity confinement + buoyancy (warm smoke rises) in one pass
    vorticity: `
      precision highp float;
      varying vec2 vUv, vL, vR, vT, vB;
      uniform sampler2D uVelocity, uCurl, uDye;
      uniform float curl, curlLow, dt, buoyancy;
      void main() {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;
        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        // calm threads near the embers, curling higher up (like incense)
        force *= curl * C * mix(curlLow, 1.0, smoothstep(0.04, 0.5, vUv.y));
        force.y *= -1.0;
        vec2 vel = texture2D(uVelocity, vUv).xy;
        vec4 d = texture2D(uDye, vUv);
        vel += force * dt;
        vel.y += buoyancy * (d.r + d.g) * dt;
        gl_FragColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
      }`,

    pressure: `
      precision mediump float;
      varying vec2 vUv, vL, vR, vT, vB;
      uniform sampler2D uPressure, uDivergence;
      void main() {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float div = texture2D(uDivergence, vUv).x;
        gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
      }`,

    gradient: `
      precision mediump float;
      varying vec2 vUv, vL, vR, vT, vB;
      uniform sampler2D uPressure, uVelocity;
      void main() {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 vel = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
        gl_FragColor = vec4(vel, 0.0, 1.0);
      }`,

    // dye → lit smoke, premultiplied alpha, plus embers and grain
    display: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uDye;
      uniform vec2 dyeTexel, uRes;
      uniform vec3 uColA, uColB, uGlow;
      uniform float uOpacity, uSeed, uLitBase, uLitAmt, uSurge;
      uniform vec4 uEmbers[3];
      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      void main() {
        vec3 c = texture2D(uDye, vUv).rgb;
        float l = dot(texture2D(uDye, vUv - vec2(dyeTexel.x, 0.0)).rg, vec2(1.0));
        float r = dot(texture2D(uDye, vUv + vec2(dyeTexel.x, 0.0)).rg, vec2(1.0));
        float t = dot(texture2D(uDye, vUv + vec2(0.0, dyeTexel.y)).rg, vec2(1.0));
        float b = dot(texture2D(uDye, vUv - vec2(0.0, dyeTexel.y)).rg, vec2(1.0));
        vec3 n = normalize(vec3(l - r, b - t, 0.6));
        float lit = clamp(dot(n, normalize(vec3(-0.35, 0.55, 0.75))), 0.0, 1.0);

        float a = 1.0 - exp(-c.r * 1.5);
        float g = 1.0 - exp(-c.g * 1.5);
        float cov = a + g - a * g;
        vec3 col = (uColA * a + uColB * mix(1.0, 0.48, uSurge) * g) / max(a + g, 0.0001);
        col *= uLitBase + uLitAmt * lit;
        col += uGlow * pow(a, 3.0) * 0.22;
        // keep the upper sky airy so the smoke thins out as it climbs
        float alpha = cov * uOpacity * (1.0 - 0.65 * smoothstep(0.55, 1.0, vUv.y));

        vec3 em = vec3(0.0);
        for (int i = 0; i < 3; i++) {
          vec2 d = (vUv - uEmbers[i].xy) * uRes;
          float rr = max(uEmbers[i].w, 0.5);
          float k = exp(-dot(d, d) / (rr * rr)) * uEmbers[i].z;
          em += uGlow * k * 1.4 + vec3(1.0, 0.95, 0.85) * k * k * 0.6;
        }

        vec3 outc = col * alpha + em;
        outc += (hash(gl_FragCoord.xy + uSeed * 31.7) - 0.5) * 0.05 * alpha;
        outc += (hash(gl_FragCoord.xy * 1.37 + 3.0) - 0.5) / 255.0;
        outc = max(outc, 0.0);
        float outa = clamp(max(alpha, max(outc.r, max(outc.g, outc.b))), 0.0, mix(1.0, 0.85, uSurge));
        gl_FragColor = vec4(min(outc, vec3(outa)), outa);
      }`
  };

  function create(canvas, opts = {}) {
    const attrs = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'default' };
    let gl = canvas.getContext('webgl2', attrs);
    const isGL2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', attrs);
    if (!gl) return null;

    let type, fmtRGBA, fmtRG, fmtR;
    if (isGL2) {
      if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null;
      type = gl.HALF_FLOAT;
      fmtRGBA = { internal: gl.RGBA16F, format: gl.RGBA };
      fmtRG = { internal: gl.RG16F, format: gl.RG };
      fmtR = { internal: gl.R16F, format: gl.RED };
    } else {
      const hf = gl.getExtension('OES_texture_half_float');
      if (!hf || !gl.getExtension('OES_texture_half_float_linear')) return null;
      gl.getExtension('EXT_color_buffer_half_float');
      type = hf.HALF_FLOAT_OES;
      fmtRGBA = fmtRG = fmtR = { internal: gl.RGBA, format: gl.RGBA };
    }

    const canRender = (f) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(gl.TEXTURE_2D, 0, f.internal, 4, 4, 0, f.format, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.deleteFramebuffer(fbo); gl.deleteTexture(tex);
      return ok;
    };
    if (!canRender(fmtRGBA)) return null;
    if (!canRender(fmtRG)) fmtRG = fmtRGBA;
    if (!canRender(fmtR)) fmtR = fmtRG;

    // ---------- programs ----------
    const compile = (kind, src) => {
      const s = gl.createShader(kind);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    if (!vs) return null;
    const programs = {};
    for (const [name, src] of Object.entries(FRAG)) {
      const fs = compile(gl.FRAGMENT_SHADER, src);
      if (!fs) return null;
      const p = gl.createProgram();
      gl.attachShader(p, vs); gl.attachShader(p, fs);
      gl.bindAttribLocation(p, 0, 'aPosition');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
      const uniforms = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const raw = gl.getActiveUniform(p, i).name;
        uniforms[raw.replace('[0]', '')] = gl.getUniformLocation(p, raw);
      }
      programs[name] = { p, u: uniforms };
    }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    gl.disable(gl.BLEND);

    const use = (name) => { const pr = programs[name]; gl.useProgram(pr.p); return pr.u; };
    const blit = (target) => {
      if (target) { gl.viewport(0, 0, target.w, target.h); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); }
      else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // ---------- render targets ----------
    const makeFBO = (w, h, f, filter) => {
      gl.activeTexture(gl.TEXTURE0);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, f.internal, w, h, 0, f.format, type, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        tex, fbo, w, h, tx: 1 / w, ty: 1 / h,
        attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; },
        free() { gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); }
      };
    };
    const makeDouble = (w, h, f, filter) => {
      let a = makeFBO(w, h, f, filter), b = makeFBO(w, h, f, filter);
      return {
        w, h, tx: 1 / w, ty: 1 / h,
        get read() { return a; }, get write() { return b; },
        swap() { [a, b] = [b, a]; },
        free() { a.free(); b.free(); }
      };
    };
    const gridSize = (res) => {
      let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspect < 1) aspect = 1 / aspect;
      const lo = Math.round(res), hi = Math.round(res * aspect);
      return gl.drawingBufferWidth > gl.drawingBufferHeight ? [hi, lo] : [lo, hi];
    };

    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    const SIM_RES = small ? 96 : 128;
    const DYE_RES = small ? 320 : 512;
    let velocity, dye, divergence, curlFBO, pressure;
    const initTargets = () => {
      [velocity, dye, divergence, curlFBO, pressure].forEach((t) => t && t.free());
      const [sw, sh] = gridSize(SIM_RES);
      const [dw, dh] = gridSize(DYE_RES);
      velocity = makeDouble(sw, sh, fmtRG, gl.LINEAR);
      dye = makeDouble(dw, dh, fmtRGBA, gl.LINEAR);
      divergence = makeFBO(sw, sh, fmtR, gl.NEAREST);
      curlFBO = makeFBO(sw, sh, fmtR, gl.NEAREST);
      pressure = makeDouble(sw, sh, fmtR, gl.NEAREST);
    };

    // ---------- sizing (soft field: render at ≤1 device px per CSS px, ≤1.4 MP) ----------
    let aspectAtInit = 0;
    const sizeCanvas = () => {
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      let s = Math.min(window.devicePixelRatio || 1, 1);
      if (w * h * s * s > 1.4e6) s = Math.sqrt(1.4e6 / (w * h));
      canvas.width = Math.max(2, Math.round(w * s));
      canvas.height = Math.max(2, Math.round(h * s));
      return s;
    };
    let pxScale = sizeCanvas();
    initTargets();
    aspectAtInit = canvas.width / canvas.height;

    // ---------- state ----------
    const P = {
      curl: 24, curlLow: 0.08, buoyancy: 300, pressureIters: 18, pressureDecay: 0.8,
      velDissipation: 0.22, dyeDissipation: 0.26,
      emit: 1, opacity: 1,
      lift: 5, lean: 0.08, srcR: 0.00014, inkRate: 4.8, inkR: 0.00016, litBase: 0.62, litAmt: 0.6
    };
    const lerp = (a, b, t) => a + (b - a) * t;
    const pal = {
      from: { a: [0.85, 0.6, 0.34], b: [0.45, 0.26, 0.5], g: [1, 0.82, 0.55] },
      to: null, t0: 0, dur: 1, cur: null
    };
    pal.cur = JSON.parse(JSON.stringify(pal.from));
    const embers = [];
    let nextEmber = 4 + Math.random() * 3;
    let time = 0;
    let surgeAt = -Infinity;
    const queue = [];

    const splat = (target, x, y, r, g, b, radius) => {
      const u = use('splat');
      gl.uniform1i(u.uTarget, target.read.attach(0));
      gl.uniform1f(u.aspectRatio, canvas.width / canvas.height);
      gl.uniform2f(u.point, x, y);
      gl.uniform3f(u.color, r, g, b);
      gl.uniform1f(u.radius, radius);
      blit(target.write);
      target.swap();
    };
    const force = (x, y, vx, vy, radius = 0.0016) => splat(velocity, x, y, vx, vy, 0, radius);
    const ink = (x, y, a, b, radius = 0.0016) => splat(dye, x, y, a, b, 0, radius);

    // three incense threads; they sway slowly so the plumes never repeat
    const sources = [
      { x: 0.2, ch: 0, phase: 0.0, speed: 0.13 },
      { x: 0.55, ch: 1, phase: 2.1, speed: 0.11 },
      { x: 0.84, ch: 0, phase: 4.2, speed: 0.17 }
    ];
    const vPts = new Float32Array(12), vVals = new Float32Array(12), dPts = new Float32Array(12), dVals = new Float32Array(12);
    const multi = (target, pts, vals) => {
      const u = use('emit');
      gl.uniform1i(u.uTarget, target.read.attach(0));
      gl.uniform1f(u.aspectRatio, canvas.width / canvas.height);
      gl.uniform3fv(u.uPts, pts);
      gl.uniform3fv(u.uVals, vals);
      blit(target.write);
      target.swap();
    };
    let stirPending = null;
    const emit = (dt) => {
      vVals.fill(0); dVals.fill(0); vPts.fill(0); dPts.fill(0);
      const k = P.emit;
      // portrait screens: two threads and less ink, or the plumes merge into one mass
      const narrow = canvas.width / canvas.height < 0.8;
      if (k > 0) {
        sources.forEach((s, i) => {
          if (narrow && i === 1) return;
          const sway = Math.sin(time * s.speed + s.phase) * 0.04 + Math.sin(time * s.speed * 2.7 + s.phase * 1.3) * 0.015;
          const x = (narrow ? (i === 0 ? 0.16 : 0.86) : s.x) + sway;
          const lean = Math.sin(time * 0.37 + s.phase) * 14;
          vPts.set([x, 0.012, P.srcR], i * 3);
          vVals.set([lean * P.lean * dt * 60, P.lift * dt * 60 * k, 0], i * 3);
          const amt = P.inkRate * dt * k * (narrow ? 0.55 : 1);
          dPts.set([x, 0.015, P.inkR], i * 3);
          dVals.set([s.ch === 0 ? amt : amt * 0.25, s.ch === 1 ? amt : amt * 0.2, 0], i * 3);
        });
        // a slow breeze so the field drifts on its own (touch screens, idle mice)
        if (Math.random() < dt * 0.6) {
          vPts.set([Math.random(), 0.25 + Math.random() * 0.5, 0.02], 9);
          vVals.set([(Math.random() - 0.5) * 120, (Math.random() - 0.3) * 40, 0], 9);
        }
      }
      // the cursor: one coalesced stir per frame
      if (stirPending) {
        const st = stirPending; stirPending = null;
        vPts.set([st.x, st.y, 0.0018], 9);
        vVals.set([st.vx, st.vy, 0], 9);
        dPts.set([st.x, st.y, 0.0012], 9);
        dVals.set([0.022, 0.016, 0], 9);
      }
      if (k > 0 || vVals[9] || vVals[10]) {
        multi(velocity, vPts, vVals);
        multi(dye, dPts, dVals);
      }
    };

    const updateEmbers = (dt) => {
      nextEmber -= dt;
      if (nextEmber <= 0 && P.emit > 0) {
        nextEmber = 6 + Math.random() * 4;
        const s = sources[(Math.random() * sources.length) | 0];
        embers.push({ x: s.x + (Math.random() - 0.5) * 0.06, y: 0.04, vx: 0, life: 0, max: 4 + Math.random() * 2, seed: Math.random() * 10 });
      }
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        e.life += dt;
        e.y += dt * (0.075 + 0.02 * Math.sin(e.seed + e.life));
        e.x += dt * 0.025 * Math.sin(e.seed * 3 + e.life * 1.7);
        if (e.life > e.max) embers.splice(i, 1);
      }
    };

    const step = (dt) => {
      time += dt;
      emit(dt);
      while (queue.length) { const q = queue.shift(); q(); }

      let u = use('curl');
      gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
      gl.uniform1i(u.uVelocity, velocity.read.attach(0));
      blit(curlFBO);

      u = use('vorticity');
      gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
      gl.uniform1i(u.uVelocity, velocity.read.attach(0));
      gl.uniform1i(u.uCurl, curlFBO.attach(1));
      gl.uniform1i(u.uDye, dye.read.attach(2));
      gl.uniform1f(u.curl, P.curl);
      gl.uniform1f(u.curlLow, P.curlLow);
      gl.uniform1f(u.buoyancy, P.buoyancy);
      gl.uniform1f(u.dt, dt);
      blit(velocity.write);
      velocity.swap();

      u = use('divergence');
      gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
      gl.uniform1i(u.uVelocity, velocity.read.attach(0));
      blit(divergence);

      u = use('clear');
      gl.uniform1i(u.uTexture, pressure.read.attach(0));
      gl.uniform1f(u.value, P.pressureDecay);
      blit(pressure.write);
      pressure.swap();

      u = use('pressure');
      gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
      gl.uniform1i(u.uDivergence, divergence.attach(0));
      for (let i = 0; i < P.pressureIters; i++) {
        gl.uniform1i(u.uPressure, pressure.read.attach(1));
        blit(pressure.write);
        pressure.swap();
      }

      u = use('gradient');
      gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
      gl.uniform1i(u.uPressure, pressure.read.attach(0));
      gl.uniform1i(u.uVelocity, velocity.read.attach(1));
      blit(velocity.write);
      velocity.swap();

      u = use('advection');
      gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
      gl.uniform1i(u.uVelocity, velocity.read.attach(0));
      gl.uniform1i(u.uSource, velocity.read.attach(0));
      gl.uniform1f(u.dt, dt);
      gl.uniform1f(u.dissipation, P.velDissipation);
      blit(velocity.write);
      velocity.swap();

      gl.uniform1i(u.uVelocity, velocity.read.attach(0));
      gl.uniform1i(u.uSource, dye.read.attach(1));
      gl.uniform1f(u.dissipation, P.dyeDissipation);
      blit(dye.write);
      dye.swap();

      updateEmbers(dt);
    };

    const ease = (t) => t * t * (3 - 2 * t);
    const render = (now) => {
      if (pal.to) {
        const t = Math.min(1, (now - pal.t0) / pal.dur);
        const e = ease(t);
        for (const k of ['a', 'b', 'g']) for (let i = 0; i < 3; i++) pal.cur[k][i] = lerp(pal.from[k][i], pal.to[k][i], e);
        if (t >= 1) { pal.from = JSON.parse(JSON.stringify(pal.to)); pal.to = null; }
      }
      const u = use('display');
      gl.uniform1i(u.uDye, dye.read.attach(0));
      gl.uniform2f(u.dyeTexel, dye.tx, dye.ty);
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform3fv(u.uColA, pal.cur.a);
      gl.uniform3fv(u.uColB, pal.cur.b);
      gl.uniform3fv(u.uGlow, pal.cur.g);
      gl.uniform1f(u.uOpacity, P.opacity);
      gl.uniform1f(u.uLitBase, P.litBase);
      gl.uniform1f(u.uLitAmt, P.litAmt);
      gl.uniform1f(u.uSurge, Math.max(0, 1 - Math.max(0, now - surgeAt - 720) / 1500));
      gl.uniform1f(u.uSeed, Math.floor(now / 90) % 64);
      const em = new Float32Array(12);
      embers.slice(0, 3).forEach((e, i) => {
        const f = e.life / e.max;
        em.set([e.x, e.y, Math.pow(Math.sin(Math.PI * f), 1.5) * 0.9, 2.2 * pxScale], i * 4);
      });
      gl.uniform4fv(u.uEmbers, em);
      blit(null);
    };

    // ---------- loop ----------
    let running = false, last = 0, raf = 0;
    const frame = (now) => {
      if (!running) return;
      const dt = Math.min(Math.max((now - last) / 1000, 0.008), 1 / 30);
      last = now;
      step(dt);
      render(now);
      raf = requestAnimationFrame(frame);
    };

    const api = {
      start() {
        if (running) return;
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      },
      stop() { running = false; cancelAnimationFrame(raf); },
      get running() { return running; },
      // run the simulation ahead so the first frame already has formed plumes
      prewarm(steps = 90, dt = 1 / 30) {
        for (let i = 0; i < steps; i++) step(dt);
        render(performance.now());
      },
      renderOnce() { render(performance.now()); },
      setPalette(p, ms = 1200) {
        pal.from = JSON.parse(JSON.stringify(pal.cur));
        pal.to = { a: p.a, b: p.b, g: p.g };
        pal.t0 = performance.now();
        pal.dur = Math.max(1, ms);
        if (!running) { pal.from = JSON.parse(JSON.stringify(pal.to)); pal.cur = JSON.parse(JSON.stringify(pal.to)); pal.to = null; render(performance.now()); }
      },
      setEmit(k) { P.emit = k; },
      // stir: client-space position and movement in CSS px
      stir(cx, cy, dx, dy) {
        const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
        const x = cx / w, y = 1 - cy / h;
        const vx = (dx / w) * 5200, vy = (-dy / h) * 5200;
        if (stirPending) { stirPending.x = x; stirPending.y = y; stirPending.vx += vx; stirPending.vy += vy; }
        else stirPending = { x, y, vx, vy };
      },
      // curl the smoke around a point (the Enter button)
      swirl(cx, cy, radiusPx, strength = 260) {
        const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
        queue.push(() => {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + time;
            const px = (cx + Math.cos(a) * radiusPx) / w, py = 1 - (cy + Math.sin(a) * radiusPx) / h;
            force(px, py, -Math.sin(a) * strength, -Math.cos(a) * strength, 0.0009);
          }
          ink(cx / w, 1 - (cy + radiusPx * 0.9) / h, 0.06, 0.03, 0.0012);
        });
      },
      // a burst of smoke that fills the frame (Enter transition)
      surge() {
        surgeAt = performance.now();
        queue.push(() => {
          const narrow = canvas.width / canvas.height < 0.8;
          const count = narrow ? 3 : 9;
          for (let i = 0; i < count; i++) {
            const x = (i + 0.5) / count + (Math.random() - 0.5) * 0.05;
            force(x, 0.05, (Math.random() - 0.5) * 300, 900 + Math.random() * 300, narrow ? 0.003 : 0.006);
            // Separate the current palette's amber and plum channels into folds.
            const plum = i % 3 === 1;
            ink(x, 0.04 + (i % 3) * 0.025, plum ? 0.06 : 1.35, plum ? 1.2 : 0.06, narrow ? 0.0015 : 0.004);
          }
        });
      },
      resize() {
        pxScale = sizeCanvas();
        const aspect = canvas.width / canvas.height;
        if (Math.abs(aspect / aspectAtInit - 1) > 0.15) {
          aspectAtInit = aspect;
          initTargets();
          api.prewarm(60);
        } else if (!running) render(performance.now());
      },
    };
    return api;
  }

  window.NoctSmoke = { create };
})();
