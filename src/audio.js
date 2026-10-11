// Procedural WebAudio ambience: rain, umbrella patter, store hum, door chime, footsteps, bell, tyres
export class AudioFX {
  constructor() { this.ctx = null; this.enabled = true; }

  start() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(ctx.destination);
    const noiseBuf = (sec, color = 'pink') => {
      const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        let b0 = 0, b1 = 0, b2 = 0, last = 0;
        for (let i = 0; i < n; i++) {
          const w = Math.random() * 2 - 1;
          if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
          else { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12; }
        }
      }
      return b;
    };
    const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };

    // rain bed
    this.rainLP = ctx.createBiquadFilter(); this.rainLP.type = 'lowpass'; this.rainLP.frequency.value = 8000;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0.55;
    loop(noiseBuf(5)).connect(hp); hp.connect(this.rainLP); this.rainLP.connect(this.rainGain); this.rainGain.connect(this.master);
    const rumble = ctx.createBiquadFilter(); rumble.type = 'lowpass'; rumble.frequency.value = 250;
    const rg = ctx.createGain(); rg.gain.value = 0.25;
    loop(noiseBuf(4, 'brown')).connect(rumble); rumble.connect(rg); rg.connect(this.rainLP);

    // umbrella patter: dense random taps on taut vinyl
    const n = ctx.sampleRate * 3, pb = ctx.createBuffer(1, n, ctx.sampleRate), pd = pb.getChannelData(0);
    for (let k = 0; k < 900; k++) {
      const at = Math.floor(Math.random() * (n - 800)), amp = 0.2 + Math.random() * 0.8;
      for (let i = 0; i < 600; i++) pd[at + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / 60);
    }
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.8;
    this.patterGain = ctx.createGain(); this.patterGain.gain.value = 0;
    loop(pb).connect(bp); bp.connect(this.patterGain); this.patterGain.connect(this.master);

    // store hum + fridge buzz
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
    for (const [f, g] of [[100, 0.05], [200, 0.02], [120, 0.03]]) {
      const o = ctx.createOscillator(); o.frequency.value = f; const og = ctx.createGain(); og.gain.value = g; o.connect(og); og.connect(this.humGain); o.start();
    }
    const air = ctx.createBiquadFilter(); air.type = 'bandpass'; air.frequency.value = 900; air.Q.value = 0.5;
    const ag = ctx.createGain(); ag.gain.value = 0.12; loop(noiseBuf(3)).connect(air); air.connect(ag); ag.connect(this.humGain);
    this.humGain.connect(this.master);

    // tyre hiss on wet road
    this.carLP = ctx.createBiquadFilter(); this.carLP.type = 'lowpass'; this.carLP.frequency.value = 1200;
    this.carGain = ctx.createGain(); this.carGain.gain.value = 0;
    loop(noiseBuf(3)).connect(this.carLP); this.carLP.connect(this.carGain); this.carGain.connect(this.master);
    this.startMusic(noiseBuf);
  }

  // ---------------------------------------------------------------------------
  // Synthesised lo-fi BGM (electric piano, bass, brushed drums, music-box melody)
  // ---------------------------------------------------------------------------
  startMusic(noiseBuf) {
    const ctx = this.ctx;
    this.musicLP = ctx.createBiquadFilter(); this.musicLP.type = 'lowpass'; this.musicLP.frequency.value = 900; this.musicLP.Q.value = 0.5;
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0;
    this.musicLP.connect(this.musicGain); this.musicGain.connect(this.master);
    // electric piano bus with gentle tremolo
    this.epBus = ctx.createGain(); this.epBus.gain.value = 0.85;
    const trem = ctx.createGain(); trem.gain.value = 0.85;
    const lfo = ctx.createOscillator(), lfoAmt = ctx.createGain(); lfo.frequency.value = 4.2; lfoAmt.gain.value = 0.15;
    lfo.connect(lfoAmt); lfoAmt.connect(trem.gain); lfo.start();
    const epTone = ctx.createBiquadFilter(); epTone.type = 'lowpass'; epTone.frequency.value = 2400;
    this.epBus.connect(epTone); epTone.connect(trem); trem.connect(this.musicLP);
    // echo for the melody
    this.echo = ctx.createDelay(1); this.echo.delayTime.value = 0.405;
    const fb = ctx.createGain(); fb.gain.value = 0.3; const wet = ctx.createGain(); wet.gain.value = 0.35;
    this.echo.connect(fb); fb.connect(this.echo); this.echo.connect(wet); wet.connect(this.musicLP);
    this.white = noiseBuf(1, 'white');
    { const d = this.white.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    // vinyl crackle
    const n = ctx.sampleRate * 4, cb = ctx.createBuffer(1, n, ctx.sampleRate), cd = cb.getChannelData(0);
    for (let k = 0; k < 260; k++) { const at = Math.floor(Math.random() * (n - 50)); const a = Math.random() * 0.8; for (let i = 0; i < 30; i++) cd[at + i] += (Math.random() * 2 - 1) * a * Math.exp(-i / 6); }
    const cs = ctx.createBufferSource(); cs.buffer = cb; cs.loop = true;
    const chp = ctx.createBiquadFilter(); chp.type = 'highpass'; chp.frequency.value = 1200;
    const cg = ctx.createGain(); cg.gain.value = 0.05; cs.connect(chp); chp.connect(cg); cg.connect(this.musicLP); cs.start();

    const m = (n) => n; // midi helper for readability
    this.prog = [
      { notes: [53, 57, 60, 64, 67], bass: 41 }, // Fmaj9
      { notes: [52, 55, 59, 62], bass: 40 },     // Em7
      { notes: [50, 53, 57, 60, 64], bass: 38 }, // Dm9
      { notes: [55, 59, 62, 65], bass: 43 },     // G7
      { notes: [53, 57, 60, 64], bass: 41 },     // Fmaj7
      { notes: [52, 55, 59, 62, 66], bass: 40 }, // Em7(add11-ish)
      { notes: [57, 60, 64, 67], bass: 45 },     // Am7
      { notes: [50, 53, 57, 60], bass: 38, turn: [55, 59, 62, 65] }, // Dm7 -> G7
    ].map((c) => ({ ...c, notes: c.notes.map(m) }));
    this.penta = [72, 74, 76, 79, 81, 84];
    this.eighth = 60 / 74 / 2;
    this.beat = 0; this.nextTime = ctx.currentTime + 0.2;
    this.musicTimer = setInterval(() => this._schedule(), 25);
  }
  _schedule() {
    const ctx = this.ctx;
    while (this.nextTime < ctx.currentTime + 0.15) {
      const swing = this.beat % 2 ? this.eighth * 0.2 : 0;
      this._playStep(this.beat, this.nextTime + swing);
      this.nextTime += this.eighth; this.beat++;
    }
  }
  _playStep(step, t) {
    const bar = Math.floor(step / 8) % this.prog.length, pos = step % 8, ch = this.prog[bar];
    const f = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
    const notes = pos >= 4 && ch.turn ? ch.turn : ch.notes;
    if (pos === 0) { notes.forEach((n, i) => this._ep(f(n), t + i * 0.012, 0.9, 2.6)); this._bass(f(ch.bass), t, 0.9); this._kick(t); }
    if (pos === 3) notes.forEach((n, i) => this._ep(f(n), t + i * 0.01, 0.5, 1.2));
    if (pos === 4 && ch.turn) { ch.turn.forEach((n, i) => this._ep(f(n), t + i * 0.012, 0.75, 1.6)); }
    if (pos === 4) this._bass(f(ch.turn ? 43 : ch.bass + 7), t, 0.7);
    if (pos === 5) this._kick(t, 0.7);
    if (pos === 7 && Math.random() < 0.5) this._bass(f(ch.bass + 12), t, 0.4);
    if (pos === 2 || pos === 6) this._snare(t);
    this._hat(t, pos % 2 ? 0.55 : 0.32 + Math.random() * 0.15);
    if (bar % 2 === 1 && Math.random() < 0.38) this._bell(f(this.penta[Math.floor(Math.random() * this.penta.length)]), t);
  }
  _env(g, t, peak, decay, tail) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, t + decay); g.gain.exponentialRampToValueAtTime(0.0001, t + tail);
  }
  _ep(freq, t, vel, dur) {
    const ctx = this.ctx, g = ctx.createGain(), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o1.type = 'sine'; o1.frequency.value = freq; o2.type = 'sine'; o2.frequency.value = freq * 2.003;
    g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    this._env(g, t, 0.07 * vel, 0.9, dur);
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.epBus);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  _bass(freq, t, vel) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = freq; lp.type = 'lowpass'; lp.frequency.value = 420;
    this._env(g, t, 0.22 * vel, 0.35, 0.9);
    o.connect(lp); lp.connect(g); g.connect(this.musicLP); o.start(t); o.stop(t + 1);
  }
  _kick(t, vel = 1) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.42 * vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g); g.connect(this.musicLP); o.start(t); o.stop(t + 0.4);
  }
  _noiseHit(t, type, freq, q, peak, len) {
    const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.white; s.playbackRate.value = 0.9 + Math.random() * 0.2;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f); f.connect(g); g.connect(this.musicLP); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.05);
  }
  _snare(t) { this._noiseHit(t, 'bandpass', 2000, 0.7, 0.11, 0.2); }
  _hat(t, vel) { this._noiseHit(t, 'highpass', 7500, 0.5, 0.035 * vel, 0.05); }
  _bell(freq, t) {
    const ctx = this.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; o2.frequency.value = freq * 3.01;
    const g2 = ctx.createGain(); g2.gain.value = 0.12;
    this._env(g, t, 0.045, 0.25, 1.4);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.musicLP); g.connect(this.echo);
    o.start(t); o2.start(t); o.stop(t + 1.5); o2.stop(t + 1.5);
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.1);
  }

  update({ inside, umbrellaOpen, carProximity, storeDist = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rainLP.frequency.setTargetAtTime(inside ? 650 : 6500, t, 0.25);
    this.rainGain.gain.setTargetAtTime(inside ? 0.1 : 0.24, t, 0.25);
    this.patterGain.gain.setTargetAtTime(!inside && umbrellaOpen ? 0.2 : 0, t, 0.15);
    if (this.musicGain) {
      // store BGM: clear inside, muffled through the glass and fading with distance outside
      const out = Math.max(0, 1 - storeDist / 32);
      this.musicLP.frequency.setTargetAtTime(inside ? 7000 : 520 + 500 * out, t, 0.4);
      this.musicGain.gain.setTargetAtTime(inside ? 0.42 : 0.1 + 0.16 * out, t, 0.5);
    }
    this.humGain.gain.setTargetAtTime(inside ? 0.6 : 0.0, t, 0.3);
    this.carGain.gain.setTargetAtTime(Math.min(0.5, carProximity), t, 0.1);
    this.carLP.frequency.setTargetAtTime(600 + carProximity * 2400, t, 0.1);
  }

  tone(freq, start, dur, vol = 0.2, type = 'sine') {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(vol, start + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    o.connect(g); g.connect(this.master); o.start(start); o.stop(start + dur + 0.05);
  }
  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(659.3, t, 1.1, 0.12); this.tone(1318.5, t, 0.6, 0.03);
    this.tone(523.3, t + 0.38, 1.4, 0.12); this.tone(1046.5, t + 0.38, 0.7, 0.03);
  }
  bell() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const dt of [0, 0.16]) { this.tone(2350, t + dt, 0.5, 0.06, 'triangle'); this.tone(3480, t + dt, 0.35, 0.03); }
  }
  register() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(1760, t, 0.12, 0.06, 'square'); this.tone(1760, t + 0.16, 0.12, 0.06, 'square');
  }
  step(run = 0, inside = false) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, len = 0.12;
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (inside ? 0.012 : 0.03)));
    const s = ctx.createBufferSource(); s.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = inside ? 'highpass' : 'lowpass'; f.frequency.value = inside ? 1800 : 1400 + Math.random() * 600;
    const g = ctx.createGain(); g.gain.value = (inside ? 0.08 : 0.18) * (0.6 + run * 0.6);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  }
}
