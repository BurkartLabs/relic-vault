/**
 * Synthesized audio. No samples shipped: every sound is built from oscillators + noise at runtime,
 * so the PWA stays tiny and offline. Rarity is sold through pitch: merge chimes climb with tier.
 */
export type SfxName =
  | 'tick' | 'forge' | 'error' | 'coin' | 'gem' | 'whoosh' | 'chest' | 'purchase' | 'adDone' | 'rank' | 'card'
  | 'sell' | 'land' | 'wheelTick' | 'smash' | 'page' | 'stamp';

export class Sfx {
  ac: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  music = true;
  private droneStarted = false;
  private lastPlay: Record<string, number> = {};
  /** AB#4712: suspended because the game went out of sight (systems/Power.ts), to be resumed when it is back. */
  private backgrounded = false;

  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended' && !this.backgrounded) this.ac.resume(); return; }
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = this.ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ac.destination);
    this.musicGain = this.ac.createGain();
    this.musicGain.gain.value = this.music ? 1 : 0;
    this.musicGain.connect(this.master);
    const len = this.ac.sampleRate * 1.5;
    this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startDrone();
  }

  /** AB#4712: the screen went off or the app was minimised: the drone and every sound stop until it is back. */
  suspendForBackground() {
    if (this.backgrounded) return;
    this.backgrounded = true;
    if (this.ac && this.ac.state === 'running') void this.ac.suspend();
  }

  resumeFromBackground() {
    if (!this.backgrounded) return;
    this.backgrounded = false;
    if (this.ac && this.ac.state === 'suspended') void this.ac.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ac) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ac.currentTime, 0.05);
  }
  setMusic(on: boolean) {
    this.music = on;
    if (this.musicGain && this.ac) this.musicGain.gain.setTargetAtTime(on ? 1 : 0, this.ac.currentTime, 0.3);
  }

  private startDrone() {
    if (!this.ac || this.droneStarted) return;
    this.droneStarted = true;
    const ac = this.ac, out = ac.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(0.11, ac.currentTime + 4);
    out.connect(this.musicGain!);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 3;
    lp.connect(out);
    // slow filter breathing
    const lfo = ac.createOscillator(), lfoG = ac.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 160;
    lfo.connect(lfoG).connect(lp.frequency); lfo.start();
    // D minor-ish drone: D2, A2, D3 slightly detuned saws
    for (const [f, det, g] of [[73.4, -6, 0.5], [73.4, 7, 0.5], [110, 3, 0.3], [146.8, -4, 0.18], [174.6, 5, 0.08]]) {
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; og.gain.value = g;
      o.connect(og).connect(lp); o.start();
    }
    // air: filtered noise, like wind in the vault
    const n = ac.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.7;
    const ng = ac.createGain(); ng.gain.value = 0.05;
    n.connect(bp).connect(ng).connect(out); n.start();
    // occasional distant bell
    const bell = () => {
      // a suspended context's clock stands still: bells scheduled then would all ring at once when it resumed
      if (this.ac && this.ac.state === 'running') this.tone(this.ac.currentTime, [293.7, 440, 587.3][Math.floor(Math.random() * 3)] / 2, 3.5, 0.035, 'sine', this.musicGain!, 2.76);
      setTimeout(bell, 9000 + Math.random() * 12000);
    };
    setTimeout(bell, 6000);
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  /** Bell-ish tone: carrier + optional inharmonic partial. */
  private tone(t: number, f: number, d: number, vol: number, type: OscillatorType = 'sine', dest?: AudioNode, partial = 0) {
    const ac = this.ac!;
    const g = ac.createGain();
    g.connect(dest ?? this.master!);
    this.env(g, t, 0.005, vol, d);
    const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + d + 0.1);
    if (partial) {
      const g2 = ac.createGain(); g2.connect(dest ?? this.master!);
      this.env(g2, t, 0.003, vol * 0.4, d * 0.5);
      const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * partial; o2.connect(g2); o2.start(t); o2.stop(t + d);
    }
  }

  private noise(t: number, d: number, vol: number, type: BiquadFilterType, freq: number, q = 1, sweepTo?: number) {
    const ac = this.ac!;
    const s = ac.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + d);
    const g = ac.createGain(); this.env(g, t, 0.004, vol, d);
    s.connect(f).connect(g).connect(this.master!);
    s.start(t, Math.random()); s.stop(t + d + 0.05);
  }

  /** Two-tone merge chime that rises with tier. */
  chime(tier: number) {
    if (!this.ac || this.muted || this.backgrounded) return;
    const t = this.ac.currentTime;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const base = 392 * Math.pow(2, scale[Math.min(tier, 10)] / 12) / 2;
    this.tone(t, base, 0.6 + tier * 0.08, 0.22, 'triangle', undefined, 2.0);
    this.tone(t + 0.075, base * 1.5, 0.8 + tier * 0.1, 0.18, 'sine', undefined, 3.01);
    if (tier >= 4) this.tone(t + 0.15, base * 2, 1.2, 0.12, 'sine', undefined, 2.76);
    if (tier >= 6) {
      for (let i = 0; i < 6; i++) this.tone(t + 0.2 + i * 0.05, base * 2 * Math.pow(2, scale[i + 2] / 12), 0.5, 0.05, 'sine');
      this.noise(t, 0.6, 0.05, 'highpass', 6000, 0.5);
    }
    this.noise(t, 0.08, 0.12, 'bandpass', 2400, 2);
  }

  play(name: SfxName, opt = 0) {
    if (!this.ac || this.muted || this.backgrounded) return;
    const now = performance.now();
    if (this.lastPlay[name] && now - this.lastPlay[name] < 28) return; // de-dupe bursts
    this.lastPlay[name] = now;
    const t = this.ac.currentTime;
    switch (name) {
      case 'tick':
        this.tone(t, 1800, 0.05, 0.08, 'square'); this.noise(t, 0.02, 0.08, 'highpass', 4000); break;
      case 'forge':
        // anvil tap: inharmonic partials + click
        for (const [f, v] of [[820, 0.16], [1312, 0.1], [2090, 0.07], [3170, 0.04]]) this.tone(t, f * (0.98 + Math.random() * 0.04), 0.5, v, 'sine');
        this.noise(t, 0.05, 0.3, 'bandpass', 3000, 1);
        this.tone(t, 90, 0.18, 0.2, 'sine');
        break;
      case 'error':
        this.tone(t, 110, 0.25, 0.3, 'sine'); this.tone(t, 82, 0.3, 0.2, 'triangle'); this.noise(t, 0.12, 0.12, 'lowpass', 400); break;
      case 'coin':
        this.tone(t, 1975 + opt * 40, 0.12, 0.06, 'square'); this.tone(t + 0.05, 2637 + opt * 40, 0.2, 0.05, 'sine'); break;
      case 'gem':
        this.tone(t, 2349, 0.3, 0.07, 'sine', undefined, 2.5); this.tone(t + 0.06, 3136, 0.35, 0.05, 'sine'); break;
      case 'whoosh':
        this.noise(t, 0.3, 0.14, 'bandpass', 400, 1.5, 2400); break;
      case 'land':
        this.tone(t, 160, 0.12, 0.2, 'sine'); this.noise(t, 0.06, 0.12, 'lowpass', 900); break;
      case 'chest':
        // creak + shimmer
        this.noise(t, 0.55, 0.22, 'bandpass', 300, 12, 900);
        this.tone(t, 180, 0.4, 0.06, 'sawtooth');
        for (let i = 0; i < 8; i++) this.tone(t + 0.45 + i * 0.045, 1046 * Math.pow(2, [0, 4, 7, 12, 16, 19, 24, 28][i] / 12), 0.6, 0.05, 'sine');
        this.noise(t + 0.4, 0.8, 0.06, 'highpass', 7000);
        break;
      case 'purchase':
      case 'adDone': {
        const notes = name === 'purchase' ? [0, 4, 7, 12, 16] : [0, 7, 12];
        notes.forEach((n, i) => this.tone(t + i * 0.07, 523 * Math.pow(2, n / 12), 0.7, 0.14, 'triangle', undefined, 2));
        this.noise(t + 0.2, 0.9, 0.07, 'highpass', 6000);
        this.tone(t, 130, 0.5, 0.2, 'sine');
        break;
      }
      case 'rank':
        [0, 4, 7, 11, 12].forEach((n, i) => this.tone(t + i * 0.09, 392 * Math.pow(2, n / 12), 0.9, 0.12, 'triangle', undefined, 3)); break;
      case 'card':
        this.noise(t, 0.2, 0.1, 'bandpass', 3000, 2, 800); this.tone(t + 0.1, 1567, 0.5, 0.08, 'sine', undefined, 2.4); break;
      case 'sell':
        this.noise(t, 0.2, 0.2, 'highpass', 3000); [2637, 2349, 1975].forEach((f, i) => this.tone(t + i * 0.05, f, 0.15, 0.06, 'square')); break;
      case 'wheelTick':
        this.tone(t, 2400, 0.03, 0.06, 'square'); break;
      case 'smash':
        this.noise(t, 0.4, 0.4, 'lowpass', 2000); this.tone(t, 70, 0.4, 0.4, 'sine');
        for (let i = 0; i < 12; i++) this.tone(t + 0.05 + i * 0.03, 1800 + Math.random() * 1600, 0.12, 0.04, 'square');
        break;
      case 'page':
        this.noise(t, 0.18, 0.12, 'bandpass', 1500, 0.8, 4000); break;
      case 'stamp':
        this.tone(t, 60, 0.3, 0.45, 'sine'); this.noise(t, 0.1, 0.35, 'lowpass', 1200); break;
    }
  }

  vibrate(pattern: number | number[], enabled: boolean) {
    if (!enabled) return;
    try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
  }
}
