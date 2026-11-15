// 景品の生成と、簡単な物理（重力・床・壁・景品どうしの衝突）
const Prizes = {
  list: [],

  // 景品を並べ直す。count を省くと CONFIG.prize.count 個
  // 上から落として床に積もらせたあとの並びを先に（画面に出さずに）計算し、アームが届かない景品があれば
  // 落とす位置から選び直す（景品どうしが押し合って壁ぎわに寄り、絶対に取れない並びで始まるのを防ぐため）。
  // 届くと確かめられたら落とす前の位置に戻し、画面では上から落ちてくる様子をそのまま見せる
  reset(count) {
    const check = CONFIG.layoutCheck;
    let start = [];
    for (let tries = 0; tries < check.maxTries; tries++) {
      this.drop(count);
      start = this.list.map((p) => Object.assign({}, p)); // 落とす前の位置を覚えておく
      this.settle();
      if (this.isReachable(count)) break;
    }
    this.list = start;
  },

  // 落ち着くまで物理を先に進める（画面には出さない）
  settle() {
    for (let i = 0; i < 240; i++) this.update(1 / 60);
  },

  // すべての景品が床（取り出し口の外）に残り、アームが真上近くまで届くか
  isReachable(count) {
    if (this.list.length < count) return false; // 取り出し口に落ちてしまった
    const c = Claw.cfg;
    const ratio = CONFIG.layoutCheck.reachRatio;
    return this.list.every((p) => {
      const nearest = Math.max(c.minX, Math.min(c.maxX, p.x));
      return Math.abs(p.x - nearest) <= p.r * ratio;
    });
  },

  // 景品を上から落とす位置に並べる
  drop(count) {
    const p = Object.assign({}, CONFIG.prize, count ? { count } : {});
    this.list = [];
    // 種類がかたよらないように、順番に割り当ててから混ぜる
    const normalTypes = [];
    PRIZE_SPRITES.forEach((s, i) => { if (!s.rare) normalTypes.push(i); });
    // 景品の種類が置く数より多いので、毎回ちがう組み合わせになるよう混ぜてから選ぶ
    normalTypes.sort(() => Math.random() - 0.5);
    const types = [];
    for (let i = 0; i < p.count; i++) types.push(normalTypes[i % normalTypes.length]);
    // レア景品は、出るときだけ 1 個と入れ替える
    if (Math.random() < p.rareChance) {
      types[0] = PRIZE_SPRITES.findIndex((s) => s.rare);
    }
    types.sort(() => Math.random() - 0.5);
    for (let i = 0; i < p.count; i++) {
      const r = p.minRadius + Math.random() * (p.maxRadius - p.minRadius);
      this.list.push({
        x: p.spawnMinX + Math.random() * (p.spawnMaxX - p.spawnMinX),
        y: 140 + i * 35,
        vx: 0,
        vy: 0,
        r: r,
        type: types[i], // PRIZE_SPRITES の番号
        angle: 0,       // 転がる景品の回転の角度
        held: false,
      });
    }
  },

  // 物理の更新。取り出し口に落ちた景品の一覧を返す
  update(dt) {
    const g = CONFIG.prize.gravity;
    const box = CONFIG.case;
    const floorY = CONFIG.floorY;
    const chute = CONFIG.chute;
    const chuteRight = chute.x + chute.w;
    const captured = [];

    // 重力と移動。転がる景品は、進んだ分だけ回転させる
    for (const p of this.list) {
      if (p.held) continue;
      p.vy += g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (PRIZE_SPRITES[p.type].round) p.angle += p.vx * dt / p.r;
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
      if (inChute) captured.push(p);
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
      // 床との摩擦。転がる景品はほとんど止まらない
      p.vx *= PRIZE_SPRITES[p.type].round ? 0.997 : 0.85;
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
