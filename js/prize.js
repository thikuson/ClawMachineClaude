// 景品の生成と、簡単な物理（重力・床・壁・景品どうしの衝突）
const Prizes = {
  list: [],

  // 景品を並べ直す。上から落として床に積もらせる
  reset() {
    const p = CONFIG.prize;
    this.list = [];
    for (let i = 0; i < p.count; i++) {
      const r = p.minRadius + Math.random() * (p.maxRadius - p.minRadius);
      this.list.push({
        x: p.spawnMinX + Math.random() * (p.spawnMaxX - p.spawnMinX),
        y: 140 + i * 35,
        vx: 0,
        vy: 0,
        r: r,
        color: p.colors[i % p.colors.length],
        held: false,
      });
    }
  },

  // 物理の更新。取り出し口に落ちた景品の数を返す
  update(dt) {
    const g = CONFIG.prize.gravity;
    const box = CONFIG.case;
    const floorY = CONFIG.floorY;
    const chute = CONFIG.chute;
    const chuteRight = chute.x + chute.w;
    let captured = 0;

    // 重力と移動
    for (const p of this.list) {
      if (p.held) continue;
      p.vy += g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    // 景品どうしの重なりを数回に分けて解消する
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < this.list.length; i++) {
        for (let j = i + 1; j < this.list.length; j++) {
          this.resolvePair(this.list[i], this.list[j]);
        }
      }
      for (const p of this.list) {
        if (!p.held) this.constrain(p, box, floorY, chute, chuteRight);
      }
    }

    // 取り出し口に入った景品を取り除く
    this.list = this.list.filter((p) => {
      const inChute = !p.held && p.x < chuteRight && p.y - p.r > chute.y;
      if (inChute) captured++;
      return !inChute;
    });
    return captured;
  },

  // 2 つの景品が重なっていたら押し離し、近づく向きの速度を打ち消す
  resolvePair(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const overlap = a.r + b.r - dist;
    if (overlap <= 0) return;

    const nx = dx / dist;
    const ny = dy / dist;
    // 持ち上げられている景品は動かさず、もう一方だけを押す
    const wa = a.held ? 0 : (b.held ? 1 : 0.5);
    const wb = b.held ? 0 : (a.held ? 1 : 0.5);
    a.x -= nx * overlap * wa;
    a.y -= ny * overlap * wa;
    b.x += nx * overlap * wb;
    b.y += ny * overlap * wb;

    const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rel < 0) {
      if (!a.held) { a.vx += nx * rel * wa * 2; a.vy += ny * rel * wa * 2; }
      if (!b.held) { b.vx -= nx * rel * wb * 2; b.vy -= ny * rel * wb * 2; }
    }
  },

  // 床・ケースの壁・取り出し口の仕切りからはみ出さないようにする
  constrain(p, box, floorY, chute, chuteRight) {
    // 床（取り出し口の中は床がなく、そのまま落ちていく）
    const overChute = p.x < chuteRight;
    if (!overChute && p.y + p.r > floorY) {
      p.y = floorY - p.r;
      if (p.vy > 0) p.vy = 0;
      p.vx *= 0.85; // 床との摩擦
    }
    // ケースの左右の壁
    if (p.x - p.r < box.x) { p.x = box.x + p.r; p.vx = Math.abs(p.vx) * 0.3; }
    if (p.x + p.r > box.x + box.w) { p.x = box.x + box.w - p.r; p.vx = -Math.abs(p.vx) * 0.3; }

    // 取り出し口の右の仕切り。仕切りより下では左右に通り抜けられない
    if (p.y + p.r > chute.y) {
      if (p.x >= chuteRight && p.x - p.r < chuteRight) {
        p.x = chuteRight + p.r;
        if (p.vx < 0) p.vx = 0;
      } else if (p.x < chuteRight && p.x + p.r > chuteRight && p.y > chute.y) {
        p.x = chuteRight - p.r;
        if (p.vx > 0) p.vx = 0;
      }
    }
  },
};
