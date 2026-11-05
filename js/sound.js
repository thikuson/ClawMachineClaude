// 効果音。音声ファイルは使わず、Web Audio で簡単な音を作って鳴らす
const Sound = {
  ctx: null,
  enabled: true,

  // ブラウザの決まりで、最初の操作のあとでないと音を鳴らせないため、そのときに準備する
  unlock() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
  },

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  },

  // 1 つの音を鳴らす。from から to へ周波数を変える
  tone(from, to, duration, type, volume, delay) {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
    gain.gain.setValueAtTime(volume || 0.08, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  },

  drop()  { this.tone(660, 220, 0.6, 'triangle', 0.1); },
  grab()  { this.tone(180, 120, 0.08, 'square', 0.08); },
  miss()  { this.tone(300, 150, 0.35, 'sawtooth', 0.05); },
  slip()  { this.tone(500, 120, 0.5, 'triangle', 0.09); },
  get() {
    // ドミソド の短いファンファーレ
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.16, 'square', 0.07, i * 0.09));
  },
  clear() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.2, 'square', 0.07, i * 0.11));
  },
};
