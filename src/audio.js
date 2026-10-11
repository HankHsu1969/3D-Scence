// Procedural WebAudio: detailed synthesized rain (droplet plinks, surface ticks, soft wash),
// umbrella patter, eave drips, store hum, SFX, and a relaxing Japanese city-pop BGM.
const rnd = (a, b) => a + Math.random() * (b - a);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioFX {
  constructor() { this.ctx = null; this.enabled = true; this._dripT = 0; }

  start() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 1.0; this.master.connect(ctx.destination);
    // shared reverb (small wet alley / room)
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this._impulse(2.2, 2.6);
    this.revOut = ctx.createGain(); this.revOut.gain.value = 0.9;
    this.reverb.connect(this.revOut); this.revOut.connect(this.master);
    this.white = this._noise(1, 'white');
    this._buildRain();
    this._buildAmbience();
    this._buildMusic();
  }

  _impulse(sec, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.35; d[i] = lp * Math.pow(1 - i / n, decay); }
    }
    return b;
  }
  _noise(sec, kind = 'pink') {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let b0 = 0, b1 = 0, b2 = 0, br = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w;
        else if (kind === 'brown') { br = (br + 0.02 * w) / 1.02; d[i] = br * 3.5; }
        else { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12; }
      }
    }
    return b;
  }
  _loop(buf, dest, offset = 0) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(dest); s.start(0, offset); return s; }

  // ---------------------------------------------------------------------------
  // Rain: granular impact texture (thousands of tiny filtered noise grains per second)
  // + a few close drops with spray, a soft wash and distant rumble. No tonal "plinks".
  // ---------------------------------------------------------------------------
  _grains(sec, rate, { amp = 0.2, tau = [0.6, 3], bright = [0.2, 0.9], skew = 2.6, spray = 0, stereo = 'independent' } = {}) {
    const ctx = this.ctx, sr = ctx.sampleRate, n = Math.floor(sec * sr);
    const buf = ctx.createBuffer(2, n, sr), L = buf.getChannelData(0), R = buf.getChannelData(1);
    const one = (out, gain, k0) => {
      const a = amp * Math.pow(Math.random(), skew) * gain;   // mostly tiny, a few strong
      const tc = rnd(tau[0], tau[1]) * 0.001 * sr, len = Math.floor(tc * 5);
      const c = rnd(bright[0], bright[1]);                   // one-pole lowpass: distance / surface
      let lp = 0, prev = 0;
      for (let i = 0; i < len; i++) {
        lp += ((Math.random() * 2 - 1) - lp) * c;
        const hp = lp - prev * 0.6; prev = lp;
        out(k0 + i, hp * a * Math.exp(-i / tc));
      }
      if (spray && a > amp * 0.25) {                         // fine spray after a bigger hit
        const st = rnd(12, 30) * 0.001 * sr, sl = Math.floor(st * 4);
        let p2 = 0;
        for (let i = 0; i < sl; i++) { const w = Math.random() * 2 - 1, h = w - p2; p2 = w; out(k0 + len + i, h * a * spray * Math.exp(-i / st)); }
      }
    };
    const count = Math.floor(sec * rate);
    if (stereo === 'independent') {
      for (const D of [L, R]) for (let k = 0; k < count / 2; k++) one((j, v) => { D[j % n] += v; }, 1, Math.floor(Math.random() * n));
    } else {
      for (let k = 0; k < count; k++) {
        const pan = rnd(-stereo, stereo), gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
        one((j, v) => { L[j % n] += v * gl; R[j % n] += v * gr; }, 1, Math.floor(Math.random() * n));
      }
    }
    return buf;
  }
  _chain(src, nodes) { let cur = src; for (const nd of nodes) { cur.connect(nd); cur = nd; } return cur; }
  _filter(type, f, q = 0.7, gain = 0) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; }
  _gain(v) { const g = this.ctx.createGain(); g.gain.value = v; return g; }

  _buildRain() {
    const ctx = this.ctx;
    this.rainBus = ctx.createGain(); this.rainBus.gain.value = 0.0;
    this.rainLP = ctx.createBiquadFilter(); this.rainLP.type = 'lowpass'; this.rainLP.frequency.value = 12000;
    // common rain colour: cut mud, gentle presence lift, soften the top
    const tone = this._chain(this.rainBus, [this._filter('highpass', 280, 0.5), this._filter('peaking', 3000, 0.6, 3), this._filter('lowpass', 9500, 0.5)]);
    tone.connect(this.rainLP); this.rainLP.connect(this.master);
    // far: very dense, darker grains (the body of the downpour)
    const far = this._gain(0.9); far.connect(this.rainBus);
    this._loop(this._grains(9.3, 3200, { amp: 0.16, tau: [0.8, 3.2], bright: [0.12, 0.55] }), far);
    // mid: brighter grains on the street around you
    const mid = this._gain(0.7); mid.connect(this.rainBus);
    this._loop(this._grains(7.7, 1100, { amp: 0.24, tau: [0.5, 2.2], bright: [0.35, 0.95] }), mid, 1.9);
    // near: a few distinct drops with a little spray, spread across the stereo field
    const near = this._gain(0.55); near.connect(this.rainBus);
    this._loop(this._grains(6.1, 22, { amp: 0.6, tau: [0.8, 2.5], bright: [0.3, 0.8], skew: 1.4, spray: 0.12, stereo: 0.9 }), near, 0.7);
    // soft wash fills the gaps between grains
    const washBP = this._filter('bandpass', 2200, 0.3);
    this._loop(this._noise(6), washBP); this._chain(washBP, [this._gain(0.07), this.rainBus]);
    // distant rumble of rain on roofs
    const rumLP = this._filter('lowpass', 200, 0.5);
    this._loop(this._noise(5, 'brown'), rumLP); this._chain(rumLP, [this._gain(0.1), this.rainBus]);
    // very slow intensity drift so the rain breathes
    const lfo = ctx.createOscillator(), lfoG = this._gain(0.1); lfo.frequency.value = 0.06;
    lfo.connect(lfoG); lfoG.connect(far.gain); lfo.start();

    // umbrella: soft taps on taut vinyl overhead + occasional heavier rib drips
    this.patterGain = ctx.createGain(); this.patterGain.gain.value = 0;
    const pIn = this._gain(1);
    this._loop(this._grains(6.7, 70, { amp: 0.32, tau: [1.2, 3.5], bright: [0.45, 0.85], skew: 1.8, stereo: 0.35 }), pIn);
    this._loop(this._grains(5.3, 7, { amp: 0.45, tau: [5, 9], bright: [0.08, 0.18], skew: 1.2, stereo: 0.3 }), pIn, 1.1);
    this._chain(pIn, [this._filter('highpass', 200, 0.6), this._filter('peaking', 1500, 0.8, 5), this._filter('lowpass', 6500, 0.6), this.patterGain]);
    this.patterGain.connect(this.master);
    const pSend = this._gain(0.1); this.patterGain.connect(pSend); pSend.connect(this.reverb);

    // eave drips bus
    this.dripBus = ctx.createGain(); this.dripBus.gain.value = 0;
    this.dripBus.connect(this.master);
    const dSend = this._gain(0.3); this.dripBus.connect(dSend); dSend.connect(this.reverb);
  }
  // a single drip landing in a puddle: noisy transient through a short water resonance
  _plop(t) {
    const ctx = this.ctx, s = ctx.createBufferSource(), bp = this._filter('bandpass', rnd(700, 1400), rnd(2.5, 4)), g = ctx.createGain(), p = ctx.createStereoPanner();
    s.buffer = this.white; s.playbackRate.value = rnd(0.8, 1.2);
    const peak = rnd(0.05, 0.14), len = rnd(0.03, 0.06);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    p.pan.value = rnd(-0.6, 0.6);
    s.connect(bp); bp.connect(g); g.connect(p); p.connect(this.dripBus);
    s.start(t, Math.random() * 0.8); s.stop(t + len + 0.02);
  }

  _buildAmbience() {
    const ctx = this.ctx;
    // store hum + fridge buzz
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
    for (const [f, g] of [[100, 0.04], [200, 0.015], [120, 0.025]]) {
      const o = ctx.createOscillator(); o.frequency.value = f; const og = ctx.createGain(); og.gain.value = g; o.connect(og); og.connect(this.humGain); o.start();
    }
    const air = ctx.createBiquadFilter(); air.type = 'bandpass'; air.frequency.value = 900; air.Q.value = 0.5;
    const ag = ctx.createGain(); ag.gain.value = 0.08; this._loop(this._noise(3), air); air.connect(ag); ag.connect(this.humGain);
    this.humGain.connect(this.master);
    // tyre hiss on wet road
    this.carLP = ctx.createBiquadFilter(); this.carLP.type = 'lowpass'; this.carLP.frequency.value = 1200;
    this.carGain = ctx.createGain(); this.carGain.gain.value = 0;
    this._loop(this._noise(3), this.carLP); this.carLP.connect(this.carGain); this.carGain.connect(this.master);
    this.white = this._noise(1, 'white');
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 1.0 : 0, this.ctx.currentTime, 0.1);
  }

  update({ inside, umbrellaOpen, carProximity, storeDist = 0, eaveDist = 99 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, dt = Math.min(0.1, t - (this._lastT || t)); this._lastT = t;
    this.rainBus.gain.setTargetAtTime(inside ? 0.6 : 1.5, t, 0.3);
    this.rainLP.frequency.setTargetAtTime(inside ? 650 : 12000, t, 0.3);
    this.patterGain.gain.setTargetAtTime(!inside && umbrellaOpen ? 1.7 : 0, t, 0.15);
    this.humGain.gain.setTargetAtTime(inside ? 0.5 : 0.0, t, 0.3);
    this.carGain.gain.setTargetAtTime(Math.min(0.35, carProximity * 0.7), t, 0.1);
    this.carLP.frequency.setTargetAtTime(600 + carProximity * 2400, t, 0.1);
    // drips from the eave when close to the storefront
    const near = Math.max(0, 1 - eaveDist / 6);
    this.dripBus.gain.setTargetAtTime(inside ? near * 0.2 : near * 0.7, t, 0.2);
    this._dripT += dt * near * 2.5;
    while (this._dripT > 1) { this._dripT -= Math.random() * 1.6 + 0.2; this._plop(t + Math.random() * 0.1); }
    if (this.musicGain) {
      this.musicLP.frequency.setTargetAtTime(inside ? 15000 : 7500, t, 0.5);
      this.musicGain.gain.setTargetAtTime(inside ? 0.9 : 0.8, t, 0.6);
    }
  }

  // ---------------------------------------------------------------------------
  // One-shot SFX
  // ---------------------------------------------------------------------------
  tone(freq, start, dur, vol = 0.2, type = 'sine', dest = this.master) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(vol, start + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    o.connect(g); g.connect(dest); o.start(start); o.stop(start + dur + 0.05);
  }
  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(659.3, t, 1.1, 0.1); this.tone(1318.5, t, 0.6, 0.025);
    this.tone(523.3, t + 0.38, 1.4, 0.1); this.tone(1046.5, t + 0.38, 0.7, 0.025);
  }
  bell() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const dt of [0, 0.16]) { this.tone(2350, t + dt, 0.5, 0.05, 'triangle'); this.tone(3480, t + dt, 0.35, 0.025); }
  }
  register() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(1760, t, 0.12, 0.05, 'square'); this.tone(1760, t + 0.16, 0.12, 0.05, 'square');
  }
  step(run = 0, inside = false) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, len = 0.14;
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (inside ? 0.01 : 0.028)));
    const s = ctx.createBufferSource(); s.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = inside ? 'highpass' : 'bandpass'; f.frequency.value = inside ? 1800 : rnd(900, 1500); f.Q.value = inside ? 0.7 : 0.9;
    const g = ctx.createGain(); g.gain.value = (inside ? 0.06 : 0.12) * (0.6 + run * 0.6);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
    if (!inside) { for (let i = 0; i < 2 + run * 2; i++) this.tone(rnd(900, 2200), t + rnd(0.01, 0.06), rnd(0.03, 0.06), 0.02 * (0.5 + run), 'sine'); }
  }

  // ---------------------------------------------------------------------------
  // BGM: relaxing Japanese city pop — 92 BPM, IV–V–iii–vi "royal road" in F major
  // ---------------------------------------------------------------------------
  _buildMusic() {
    const ctx = this.ctx;
    this.musicLP = ctx.createBiquadFilter(); this.musicLP.type = 'lowpass'; this.musicLP.frequency.value = 9000;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0;
    this.mBus = ctx.createGain(); this.mBus.gain.value = 0.9;
    this.mBus.connect(comp); comp.connect(this.musicLP); this.musicLP.connect(this.musicGain); this.musicGain.connect(this.master);
    this.mRev = ctx.createGain(); this.mRev.gain.value = 1; this.mRev.connect(this.reverb);
    // dotted-eighth echo for the lead
    this.echo = ctx.createDelay(1.5); this.echo.delayTime.value = (60 / 92) * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.28; const wet = ctx.createGain(); wet.gain.value = 0.22;
    const ehp = ctx.createBiquadFilter(); ehp.type = 'highpass'; ehp.frequency.value = 500;
    this.echo.connect(ehp); ehp.connect(fb); fb.connect(this.echo); ehp.connect(wet); wet.connect(this.mBus);
    // chord chart (bass root, EP voicing); bar 2 starts sus4, bar 8 turns to C7 halfway
    this.chart = [
      { r: 46, v: [62, 65, 69, 72] },                                  // B♭maj9
      { r: 36, v: [58, 62, 64, 67], sus: [58, 60, 65, 67] },           // C9sus4 → C9
      { r: 45, v: [55, 60, 64, 67] },                                  // Am7
      { r: 38, v: [60, 65, 69, 72] },                                  // Dm9 (no root)
      { r: 43, v: [58, 62, 65, 69] },                                  // Gm9
      { r: 36, v: [58, 64, 69, 70] },                                  // C13
      { r: 41, v: [64, 67, 69, 72] },                                  // Fmaj9
      { r: 43, v: [58, 62, 65, 69], turn: { r: 36, v: [58, 64, 67, 70] } }, // Gm7 → C7
    ];
    // lead melody in eighth-note units: [start, midi, length]
    this.melody = [
      [[2, 69, 1], [3, 72, 1], [4, 74, 2], [6, 72, 1], [7, 69, 1]],
      [[0, 67, 3], [4, 65, 1], [5, 67, 1], [6, 69, 2]],
      [[0, 72, 2], [2, 76, 2], [4, 74, 1], [5, 72, 1], [6, 69, 2]],
      [[0, 72, 4], [5, 69, 1], [6, 72, 1], [7, 74, 1]],
      [[0, 74, 2], [2, 77, 1], [3, 76, 1], [4, 74, 2], [6, 72, 2]],
      [[0, 70, 2], [2, 69, 1], [3, 67, 1], [4, 69, 4]],
      [[0, 72, 1], [1, 69, 1], [2, 67, 1], [3, 65, 1], [4, 67, 2], [6, 69, 2]],
      [[0, 70, 3], [3, 69, 1], [4, 67, 4]],
    ];
    this.s16 = 60 / 92 / 4;
    this.tick = 0; this.nextTime = ctx.currentTime + 0.3;
    this.musicTimer = setInterval(() => this._schedule(), 25);
  }
  _schedule() {
    const ctx = this.ctx;
    while (this.nextTime < ctx.currentTime + 0.2) {
      const swing = this.tick % 2 ? this.s16 * 0.12 : 0;
      this._play16(this.tick, this.nextTime + swing);
      this.nextTime += this.s16; this.tick++;
    }
  }
  _play16(tick, t) {
    const step = tick % 16, bar16 = Math.floor(tick / 16) % 16, bar = bar16 % 8;
    const c = this.chart[bar], half = step >= 8 && c.turn ? c.turn : c;
    const voicing = c.sus && step < 8 ? c.sus : half.v;
    const nextRoot = this.chart[(bar + 1) % 8].r;
    const intro = Math.floor(tick / 16) < 4; // first bars: keys + pad only
    // pad (whole bar)
    if (step === 0) this._pad(c.v.map((m) => m - 12), t, this.s16 * 16);
    if (step === 8 && c.turn) this._pad(c.turn.v.map((m) => m - 12), t, this.s16 * 8);
    // electric piano comping — syncopated city-pop rhythm
    const comp = { 0: [0.8, 5], 6: [0.55, 2], 10: [0.7, 4], 14: [0.5, 2] }[step];
    if (comp) voicing.forEach((m, i) => this._ep(mtof(m), t + i * 0.008, comp[0], comp[1] * this.s16 + 0.25));
    if (intro) return;
    // bass
    const r = half.r;
    const bassLine = { 0: [r, 3], 3: [r + 12, 1], 6: [r, 2], 8: [r + 7, 2], 11: [r + 12, 1], 14: [nextRoot - 1, 2] };
    if (bassLine[step]) this._bass(mtof(bassLine[step][0]), t, bassLine[step][1] * this.s16);
    // muted guitar chops on 2 and 4 (+ ghost)
    if (step === 4 || step === 12 || (step === 15 && Math.random() < 0.4)) this._guitar(voicing.map((m) => m + 12), t, step === 15 ? 0.4 : 0.8);
    // drums
    if (step === 0 || step === 8 || (step === 7 && Math.random() < 0.35)) this._kick(t, step === 7 ? 0.5 : 1);
    if (step === 4 || step === 12) this._snare(t);
    if (step % 2 === 0) this._hat(t, step % 4 === 2 ? 0.75 : 0.5, false);
    else if (Math.random() < 0.6) this._hat(t, 0.22, false);
    if (step === 14 && bar % 2 === 1) this._hat(t, 0.5, true);
    // lead melody on the second half of each 16-bar cycle
    if (bar16 >= 8 && step % 2 === 0) {
      for (const [st, m, len] of this.melody[bar]) if (st * 2 === step) this._lead(mtof(m), t, len * 2 * this.s16);
    }
  }
  _env(g, t, peak, a, d, sus, dur, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * sus), t + a + d);
    g.gain.setValueAtTime(Math.max(0.0002, peak * sus), t + Math.max(dur, a + d));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + d) + rel);
  }
  _ep(f, t, vel, dur) {
    // FM Rhodes: carrier + 1:1 modulator with a decaying index, plus a faint tine
    const ctx = this.ctx, car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), p = ctx.createStereoPanner();
    car.frequency.value = f; mod.frequency.value = f;
    mg.gain.setValueAtTime(f * 1.8, t); mg.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    const tine = ctx.createOscillator(), tg = ctx.createGain(); tine.frequency.value = f * 7.02;
    tg.gain.setValueAtTime(0.012 * vel, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    this._env(g, t, 0.05 * vel, 0.006, 0.9, 0.35, dur, 0.35);
    p.pan.value = Math.sin(t * 2.2) * 0.35; // gentle auto-pan
    car.connect(g); tine.connect(tg); tg.connect(g); g.connect(p); p.connect(this.mBus);
    const send = ctx.createGain(); send.gain.value = 0.18; p.connect(send); send.connect(this.mRev);
    const end = t + dur + 0.45;
    car.start(t); mod.start(t); tine.start(t); car.stop(end); mod.stop(end); tine.stop(end);
  }
  _pad(notes, t, dur) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.3;
    this._env(g, t, 0.016, 0.45, 0.4, 0.85, dur, 0.9);
    for (const m of notes) for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      const p = ctx.createStereoPanner(); p.pan.value = det > 0 ? 0.6 : -0.6;
      o.connect(p); p.connect(lp); o.start(t); o.stop(t + dur + 1.0);
    }
    lp.connect(g); g.connect(this.mBus);
    const send = ctx.createGain(); send.gain.value = 0.3; g.connect(send); send.connect(this.mRev);
  }
  _bass(f, t, dur) {
    const ctx = this.ctx, o = ctx.createOscillator(), sub = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; sub.type = 'sine'; sub.frequency.value = f;
    lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.12);
    const sg = ctx.createGain(); sg.gain.value = 0.9;
    this._env(g, t, 0.12, 0.006, 0.15, 0.6, dur * 0.92, 0.06);
    o.connect(lp); sub.connect(sg); sg.connect(lp); lp.connect(g); g.connect(this.mBus);
    o.start(t); sub.start(t); o.stop(t + dur + 0.1); sub.stop(t + dur + 0.1);
  }
  _guitar(notes, t, vel) {
    // muted funk chop: bright plucks through a bandpass, very short
    const ctx = this.ctx, bp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.1;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    p.pan.value = 0.45;
    notes.forEach((m, i) => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(m); o.connect(bp); o.start(t + i * 0.006); o.stop(t + 0.15); });
    bp.connect(g); g.connect(p); p.connect(this.mBus);
    const send = ctx.createGain(); send.gain.value = 0.2; p.connect(send); send.connect(this.mRev);
  }
  _lead(f, t, dur) {
    const ctx = this.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2;
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.2;
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.35, dur));
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    lp.type = 'lowpass'; lp.frequency.value = 2600;
    const o2g = ctx.createGain(); o2g.gain.value = 0.18;
    this._env(g, t, 0.06, 0.03, 0.2, 0.75, dur * 0.95, 0.25);
    o.connect(lp); o2.connect(o2g); o2g.connect(lp); lp.connect(g); g.connect(this.mBus); g.connect(this.echo);
    const send = ctx.createGain(); send.gain.value = 0.35; g.connect(send); send.connect(this.mRev);
    const end = t + dur + 0.4;
    o.start(t); o2.start(t); vib.start(t); o.stop(end); o2.stop(end); vib.stop(end);
  }
  _kick(t, vel = 1) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); g.connect(this.mBus); o.start(t); o.stop(t + 0.36);
  }
  _noiseHit(t, type, freq, q, peak, len, rev = 0) {
    const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.white; s.playbackRate.value = rnd(0.9, 1.1);
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f); f.connect(g); g.connect(this.mBus);
    if (rev) { const send = this.ctx.createGain(); send.gain.value = rev; g.connect(send); send.connect(this.mRev); }
    s.start(t, Math.random() * 0.5); s.stop(t + len + 0.05);
  }
  _snare(t) {
    this._noiseHit(t, 'bandpass', 2200, 0.6, 0.1, 0.17, 0.25);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(this.mBus); o.start(t); o.stop(t + 0.1);
  }
  _hat(t, vel, open) { this._noiseHit(t, 'highpass', 8000, 0.6, 0.03 * vel, open ? 0.22 : 0.035); }
}
