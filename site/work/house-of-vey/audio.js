/* House of Vey: ambient sound, generated live with Web Audio.
   Off by default. A soft pad whose chord changes room by room, a small chime for the panel,
   the latch of the front door and a step as you arrive in each room. */
(() => {
  // one chord per stop: outside, hall, salon, study, bedroom (Hz)
  const CHORDS = [
    [110.0, 164.81, 220.0, 277.18],   // A, open fifth
    [146.83, 220.0, 293.66, 369.99],  // D major
    [130.81, 196.0, 261.63, 329.63],  // C major
    [110.0, 164.81, 261.63, 329.63],  // A minor
    [116.54, 174.61, 233.08, 293.66]  // B-flat major
  ];

  let ctx = null, master = null, voices = [], room = 0, on = false;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 900; filter.Q.value = 0.4;

    // slow breathing on the filter
    const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07; lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(filter.frequency); lfo.start();

    // a short feedback delay gives the pad some room
    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const wet = ctx.createGain(); wet.gain.value = 0.35;
    filter.connect(master);
    filter.connect(delay); delay.connect(fb).connect(delay); delay.connect(wet).connect(master);
    master.connect(ctx.destination);

    voices = CHORDS[room].map((f, i) => {
      const g = ctx.createGain(); g.gain.value = i === 0 ? 0.11 : 0.06;
      const a = ctx.createOscillator(); a.type = i === 0 ? 'sine' : 'triangle'; a.frequency.value = f;
      const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.value = f; b.detune.value = 7 + i * 2;
      a.connect(g); b.connect(g); g.connect(filter); a.start(); b.start();
      return { a, b };
    });
  }

  function setOn(next) {
    on = next;
    if (on && !ctx) build();
    if (!ctx) return;
    if (on && ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(on ? 0.5 : 0, t, on ? 0.9 : 0.25);
    if (!on) setTimeout(() => { if (!on && ctx.state === 'running') ctx.suspend(); }, 1600);
  }

  function setRoom(i) {
    if (i === room) return;
    room = i;
    if (!ctx) return;
    const t = ctx.currentTime;
    CHORDS[i].forEach((f, k) => {
      voices[k].a.frequency.setTargetAtTime(f, t, 0.6);
      voices[k].b.frequency.setTargetAtTime(f, t, 0.6);
    });
  }

  function chime() {
    if (!ctx || !on) return;
    const t = ctx.currentTime;
    [1318.5, 1975.5].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + i * 0.09);
      g.gain.linearRampToValueAtTime(0.05, t + i * 0.09 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 1.6);
      o.connect(g).connect(master); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 1.7);
    });
  }

  // one-shot sounds, only when sound is on: the door latch on Enter, a soft step on arriving in a room
  function noise(dur) {
    const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b;
    return s;
  }
  function latch() {
    if (!ctx || !on) return;
    const t = ctx.currentTime;
    [[0, 2600, 0.16], [0.07, 1700, 0.1]].forEach(([at, f, v]) => {   // two metal clicks
      const n = noise(0.05), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6;
      g.gain.setValueAtTime(v, t + at); g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.05);
      n.connect(bp).connect(g).connect(master); n.start(t + at);
    });
    const o = ctx.createOscillator(), g = ctx.createGain();   // and the door's low knock
    o.frequency.setValueAtTime(140, t + 0.07); o.frequency.exponentialRampToValueAtTime(70, t + 0.3);
    g.gain.setValueAtTime(0.12, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g).connect(master); o.start(t + 0.07); o.stop(t + 0.36);
  }
  function step() {
    if (!ctx || !on) return;
    const t = ctx.currentTime, n = noise(0.12), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    n.connect(lp).connect(g).connect(master); n.start(t);
  }

  // never keep playing in a background tab
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !on) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  window.VeyAudio = { setOn, setRoom, chime, latch, step, isOn: () => on };
})();
