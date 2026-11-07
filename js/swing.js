// アームの揺れ。台車が動き出したり止まったりすると、ぶら下がったアームが振り子のように揺れる
// ばねと同じ計算で、1 つの向き（左右や奥行き）ごとに 1 つ使う
function Swing() {
  this.reset(0);
}

Swing.prototype.reset = function (pos) {
  this.offset = 0;      // 台車の真下からのずれ
  this.vel = 0;         // ずれの変わる速さ
  this.prevPos = pos;   // 前のフレームの台車の位置
  this.prevSpeed = 0;   // 前のフレームの台車の速さ
};

// pos は台車の位置。台車の速さが変わった分だけ、アームが逆向きに振られる
Swing.prototype.update = function (dt, pos) {
  if (dt <= 0) return;
  const s = CONFIG.swing;
  const speed = (pos - this.prevPos) / dt;
  this.vel -= (speed - this.prevSpeed) * s.strength;
  this.prevPos = pos;
  this.prevSpeed = speed;

  this.vel += (-s.stiffness * this.offset - s.damping * this.vel) * dt;
  this.offset += this.vel * dt;
  this.offset = Math.max(-s.maxOffset, Math.min(s.maxOffset, this.offset));
};

// つかんだときなどに、ガクンと揺らす
Swing.prototype.kick = function (power) {
  this.vel += (Math.random() - 0.5) * 2 * power;
};

// 揺れが大きいときに、つかんだ景品が落ちるかどうか。1 フレームごとに呼ぶ
// grip が大きい景品ほど落ちにくい
Swing.shouldSlip = function (dt, swings, grip) {
  const s = CONFIG.swing;
  let amount = 0;
  for (const sw of swings) amount = Math.max(amount, Math.abs(sw.offset));
  if (amount <= s.slipStart) return false;
  const perSecond = s.slipRate * (amount - s.slipStart) / s.slipStart / grip;
  return Math.random() < perSecond * dt;
};
