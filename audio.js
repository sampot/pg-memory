/**
 * 對對碰 — Web Audio 合成復古音效（無第三方音檔）。
 */
export class MemoryAudio {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
  }

  async unlock() {
    this.ensure();
    if (this.ctx?.state === "suspended") await this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
  }

  tone(freq, dur, type = "square", gain = 0.08, when = 0) {
    if (!this.enabled) return;
    this.ensure();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * 0.6, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.05, dur));
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);
  }

  select() {
    this.tone(440, 0.06, "square", 0.07);
  }

  match() {
    this.tone(523, 0.07, "square", 0.09);
    this.tone(659, 0.07, "square", 0.09, 0.06);
    this.tone(784, 0.12, "square", 0.09, 0.12);
  }

  miss() {
    this.tone(220, 0.08, "sawtooth", 0.06);
  }

  win() {
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) => this.tone(f, 0.14, "square", 0.09, i * 0.11));
    this.tone(1319, 0.4, "square", 0.08, 0.46);
  }

  hint() {
    this.tone(700, 0.05, "triangle", 0.07);
    this.tone(900, 0.05, "triangle", 0.07, 0.05);
  }
}