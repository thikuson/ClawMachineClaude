// アームの動き（状態ごとの処理）と、景品をつかむ判定
const Claw = {
  state: 'idle',  // idle / open / openWait / down / closeWait / close / liftWait / up / return / dropWait / release / wait / shut
  x: 0,
  y: 0,
  openness: 0,    // 爪の開き具合（1 で全開、0 で全閉）。待っている間は閉じている
  stopOpenness: 0, // 景品をつかんでいるとき、それ以上閉じない開き具合
  timer: 0,
  held: null,     // つかんでいる景品
  extras: [],     // いっしょにつかんでいるほかの景品 { p, offsetX（今のずれ）, targetX（並べる場所）, slipAt }（かんたんで、うまい位置のとき）
  holdTargetX: 0, // つかんだ景品を並べる場所（アーム中心からの横のずれ）
  holdOffsetBase: 0, // 1 つだけつかんでいるときの、横のずれ
  gripOpenness: 0, // つかんだ景品をはさむ爪の開き具合
  holdOffsetX: 0, // つかんだ景品の、アーム中心からの横のずれ
  slipAt: -1,     // 景品が滑り落ちるまでの時間（-1 なら落ちない）
  swing: new Swing(), // 左右の揺れ
  cfg: CONFIG.claw, // アームの設定。おまかせモードでは、爪の開きやつかむ力を変えた設定に差し替える
  autoMove: false,  // true なら、待機中に左右へ自動で往復する（おまかせモード）
  autoDir: 1,       // 自動で動く向き（1 で右、-1 で左）
  canDrop: () => true, // 下ろしてよいか（プレイ回数が残っているか。main.js で設定）
  onResult: null, // 出来事（drop / grab / miss / slip / hit）を伝える関数（main.js で設定）
  // つかむ代わりに「当たった」として扱うときの関数（ぬしの台。つかめないほど大きいので、当てて体力を減らす）。
  // offset は当たった位置の、景品の中心からのずれ（0 で真ん中、1 で端）。ほかの台では null
  onHit: null,

  reset() {
    const c = this.cfg;
    this.state = 'idle';
    this.x = c.homeX;
    this.y = c.homeY;
    this.openness = this.restOpenness();
    this.held = null;
    this.extras = [];
    this.swing.reset(this.x);
  },

  // 揺れを含めた、アーム本体の実際の x 座標
  headX() {
    return this.x + this.swing.offset;
  },

  // 爪の先の y 座標
  tipY() {
    return this.y + this.cfg.armLength;
  },

  // 待っている間の爪の開き具合。景品をつかんで運ぶときと同じくらいに、少しだけ開いておく
  restOpenness() {
    const c = this.cfg;
    return Math.max(0, Math.min(1, (CONFIG.clawPause.restSpread - c.tipClosed) / (c.tipOpen - c.tipClosed)));
  },

  // 爪の先の、中心からの横の距離
  tipSpread() {
    const c = this.cfg;
    return c.tipClosed + (c.tipOpen - c.tipClosed) * this.openness;
  },

  update(dt, prizes) {
    const c = this.cfg;
    this.timer += dt;
    this.swing.update(dt, this.x);

    switch (this.state) {
      case 'idle': {
        if (this.autoMove) {
          // 一定の速さで往復し、端に着いたら折り返す
          this.x += this.autoDir * c.autoSpeed * dt;
          if (this.x >= c.maxX) this.autoDir = -1;
          if (this.x <= c.minX) this.autoDir = 1;
        } else {
          if (Input.isDown('ArrowLeft')) this.x -= c.moveSpeed * dt;
          if (Input.isDown('ArrowRight')) this.x += c.moveSpeed * dt;
        }
        this.x = Math.max(c.minX, Math.min(c.maxX, this.x));
        if (Input.wasPressed('Space') && this.canDrop()) {
          this.setState('open');
          this.report('drop');
        }
        break;
      }

      case 'open': {
        // 下ろす前に、その場で爪を開く
        this.openness = Math.min(1, this.openness + dt / c.openTime);
        if (this.openness >= 1) this.setState('openWait');
        break;
      }

      case 'openWait': {
        // 開いたまま少し止まってから下り始める
        if (this.timer >= CONFIG.clawPause.open) this.setState('down');
        break;
      }

      case 'down': {
        this.y += c.downSpeed * dt;
        // 床に着くか、真下の景品の中ほどまで下りたら止める
        const touchFloor = this.tipY() >= CONFIG.floorY - 2;
        const touchPrize = prizes.some((p) =>
          Math.abs(p.x - this.headX()) < p.r && this.tipY() >= p.y);
        if (touchFloor || touchPrize) this.setState('closeWait');
        break;
      }

      case 'closeWait': {
        // 下りきったら、開いたまま少し止まってから閉じ始める
        if (this.timer >= CONFIG.clawPause.close) this.setState('close');
        break;
      }

      case 'close': {
        // ぬしの台では、爪の間に入らないほど大きいので、アームの真下にあれば当たったことにする
        const target = this.onHit
          ? prizes.find((p) => Math.abs(p.x - this.headX()) < p.r + 10 && this.tipY() >= p.y - p.r) || null
          : this.findGripTarget(prizes);
        // 景品があれば、その大きさに合わせて爪が止まる
        this.stopOpenness = target
          ? Math.max(0, (target.r * 0.75 - c.tipClosed) / (c.tipOpen - c.tipClosed))
          : 0;
        this.openness = Math.max(this.stopOpenness, this.openness - dt / c.closeTime);
        if (this.timer >= c.closeTime) {
          this.tryGrab(target, prizes);
          this.setState('liftWait');
        }
        break;
      }

      case 'liftWait': {
        // 爪を閉じたまま少し止まってから上がる
        this.carryHeld(dt);
        if (this.timer >= CONFIG.clawPause.lift) this.setState('up');
        break;
      }

      case 'up': {
        this.y -= c.upSpeed * dt;
        this.carryHeld(dt);
        this.checkSlip(dt);
        if (this.y <= c.homeY) {
          this.y = c.homeY;
          this.setState('return');
        }
        break;
      }

      case 'return': {
        const dir = Math.sign(c.homeX - this.x);
        this.x += dir * c.returnSpeed * dt;
        if ((dir < 0 && this.x <= c.homeX) || (dir > 0 && this.x >= c.homeX) || dir === 0) {
          this.x = c.homeX;
          this.setState('dropWait');
        }
        this.carryHeld(dt);
        this.checkSlip(dt);
        break;
      }

      case 'dropWait': {
        // 取り出し口の上で少し止まってから、爪を開いて景品を落とす
        this.carryHeld(dt);
        if (this.timer >= CONFIG.clawPause.drop) this.setState('release');
        break;
      }

      case 'release': {
        this.openness = Math.min(1, this.openness + dt / c.openTime);
        if (this.held) this.dropHeld();
        if (this.openness >= 1) this.setState('wait');
        break;
      }

      case 'wait': {
        // 景品が取り出し口に落ちるのを少し待ってから操作できるようにする
        if (this.timer >= 0.5) this.setState('shut');
        break;
      }

      case 'shut': {
        // 爪を閉じてから、また動かせるようにする
        const rest = this.restOpenness();
        this.openness = Math.max(rest, this.openness - dt / c.closeTime);
        if (this.openness <= rest) this.setState('idle');
        break;
      }
    }
  },

  setState(next) {
    this.state = next;
    this.timer = 0;
    if (next === 'idle') {
      this.openness = this.restOpenness();
      this.autoDir = 1; // 取り出し口から戻ってきたら、また右へ動き始める
    }
  },

  // 爪の間にある景品のうち、中心にいちばん近いものを探す
  findGripTarget(prizes) {
    let best = null;
    let bestDx = Infinity;
    for (const p of prizes) {
      const dx = Math.abs(p.x - this.headX());
      const dy = Math.abs(p.y - this.tipY());
      if (dx < this.cfg.tipOpen && dy < p.r + 6 && dx < bestDx) {
        best = p;
        bestDx = dx;
      }
    }
    return best;
  },

  // つかめるかどうかを決める。中心に近いほど成功しやすく、落ちにくい
  tryGrab(target, prizes) {
    if (this.onHit) {
      if (target) {
        this.onHit(target, Math.abs(target.x - this.headX()) / target.r);
        this.report('hit');
      } else {
        this.report('miss');
      }
      return;
    }
    if (!target) {
      this.report('miss');
      return;
    }
    // つかむ力が強いほど、真ん中からのずれが小さいのと同じ扱いになり、景品もつかみやすくなる
    const power = this.cfg.gripPower || 1;
    const offset = Math.abs(target.x - this.headX()) / target.r / power; // 0 なら真ん中
    const grip = PRIZE_SPRITES[target.type].grip * Math.sqrt(power);
    const grabChance = Math.max(0.1, Math.min(0.95, (1.05 - offset * 0.8) * grip));
    if (Math.random() > grabChance) {
      // 転がる景品は、爪に押されて逃げていく
      if (PRIZE_SPRITES[target.type].round) {
        const dir = Math.sign(target.x - this.headX()) || (Math.random() < 0.5 ? -1 : 1);
        target.vx = dir * (80 + Math.random() * 80);
      }
      this.report('miss');
      return;
    }
    this.held = target;
    target.held = true;
    this.report('grab');
    this.swing.kick(CONFIG.swing.grabKick);
    target.vx = 0;
    target.vy = 0;
    this.holdOffsetX = (target.x - this.headX()) * 0.4;
    this.holdOffsetBase = this.holdOffsetX;
    this.layoutGrip();

    // 持ち上げたあと滑り落ちるかどうかも、ここで決めておく
    const slipChance = Math.max(0.05, Math.min(0.8, (offset * 0.6 + 0.1) / grip));
    this.slipAt = Math.random() < slipChance ? 0.2 + Math.random() * 1.8 : -1;
    this.carryTime = 0;
    if (prizes) this.grabExtras(target, prizes);
  },

  // 開いた爪の間にあるほかの景品も、いっしょにつかむ（難しさの maxGrab が 2 以上のときだけ）。
  // 爪の真ん中に近い景品ほどつかみやすい。いっしょにつかんだ景品は、最初につかんだ景品と横 1 列に並べて、爪ではさんで運ぶ
  grabExtras(target, prizes) {
    const c = this.cfg;
    const room = (c.maxGrab || 1) - 1;
    if (room <= 0) return;
    const hx = this.headX();
    const tipY = this.tipY();
    const near = prizes
      .filter((p) => p !== target && !p.held && Math.abs(p.x - hx) < c.tipOpen && Math.abs(p.y - tipY) < p.r + 10)
      .sort((a, b) => Math.abs(a.x - hx) - Math.abs(b.x - hx));
    for (const p of near.slice(0, room)) {
      const inside = 1 - Math.abs(p.x - hx) / c.tipOpen; // 1 なら爪の真ん中
      const chance = CONFIG.multiGrab.chance * (0.4 + 0.6 * inside) * PRIZE_SPRITES[p.type].grip;
      if (Math.random() > chance) continue;
      p.held = true;
      p.vx = 0;
      p.vy = 0;
      // 今いる場所から、並べる場所へ少しずつ寄せる
      const slipAt = Math.random() < CONFIG.multiGrab.slip ? 0.3 + Math.random() * 1.5 : -1;
      this.extras.push({ p, offsetX: p.x - hx, targetX: 0, slipAt });
    }
    if (!this.extras.length) return;
    this.layoutGrip();
    this.openness = Math.max(this.openness, this.gripOpenness);
    this.report('multi');
  },

  // つかんでいる景品（最初の 1 つと、いっしょにつかんだ景品）を、今の並び順のまま横 1 列にすき間なく並べ、
  // 列の真ん中がアームの真ん中に来るようにする。爪は、列の両はしの景品をはさむところまで閉じる。
  // 途中で 1 つ落ちたときにも呼んで、残った景品をはさみ直す
  layoutGrip() {
    const c = this.cfg;
    if (!this.extras.length) {
      // 1 つだけなら、今までどおりの位置ではさむ
      this.holdTargetX = this.holdOffsetBase;
      this.gripOpenness = Math.max(0, (this.held.r * 0.75 - c.tipClosed) / (c.tipOpen - c.tipClosed));
      return;
    }
    const row = [{ p: this.held, x: this.holdOffsetX, main: true }, ...this.extras.map((e) => ({ p: e.p, x: e.offsetX, e }))]
      .sort((a, b) => a.x - b.x);
    // 隣どうしの間かくは、半径の和の 0.75 倍（少し重なって見えるくらい）
    let x = 0;
    row[0].t = 0;
    for (let i = 1; i < row.length; i++) {
      x += (row[i - 1].p.r + row[i].p.r) * 0.75;
      row[i].t = x;
    }
    const shift = (row[0].t - row[0].p.r * 0.75 + row[row.length - 1].t + row[row.length - 1].p.r * 0.75) / 2;
    for (const item of row) {
      item.t -= shift;
      if (item.main) this.holdTargetX = item.t;
      else item.e.targetX = item.t;
    }
    const half = Math.max(...row.map((item) => Math.abs(item.t) + item.p.r * 0.75));
    this.gripOpenness = Math.max(0, Math.min(1, (half - c.tipClosed) / (c.tipOpen - c.tipClosed)));
  },

  // つかんだ景品をアームと一緒に動かす。いっしょにつかんだ景品があるときは、並べる場所へ少しずつ寄せ、爪もそれに合わせる
  carryHeld(dt = 1 / 60) {
    if (!this.held) return;
    const k = Math.min(1, dt * 8);
    this.holdOffsetX += (this.holdTargetX - this.holdOffsetX) * k;
    this.held.x = this.headX() + this.holdOffsetX;
    this.held.y = this.tipY() - this.held.r * 0.35;
    for (const e of this.extras) {
      e.offsetX += (e.targetX - e.offsetX) * k;
      e.p.x = this.headX() + e.offsetX;
      e.p.y = this.tipY() - e.p.r * 0.35;
    }
    // 爪は、はさんでいる景品に合わせて閉じる（1 つ落ちたら、残りをはさみ直す）
    const step = dt / this.cfg.closeTime;
    if (this.openness > this.gripOpenness) this.openness = Math.max(this.gripOpenness, this.openness - step);
    else this.openness = Math.min(this.gripOpenness, this.openness + step);
  },

  // 決めておいた時間が来たか、揺れが大きすぎたら景品を落とす
  checkSlip(dt) {
    if (!this.held) return;
    this.carryTime += dt;
    const grip = PRIZE_SPRITES[this.held.type].grip * Math.sqrt(this.cfg.gripPower || 1);
    // いっしょにつかんだ景品は、決めておいた時間が来たら 1 つずつ落ちる
    for (const e of this.extras.slice()) {
      if (e.slipAt >= 0 && this.carryTime >= e.slipAt) {
        this.releasePrize(e.p);
        this.extras.splice(this.extras.indexOf(e), 1);
        this.holdOffsetBase = 0; // 残りが 1 つになったら、爪の真ん中でつかみ直す
        this.layoutGrip();
      }
    }
    const timeUp = this.slipAt >= 0 && this.carryTime >= this.slipAt;
    if (timeUp || Swing.shouldSlip(dt, [this.swing], grip)) {
      this.dropHeld();
      this.openness = Math.min(1, this.openness + 0.15);
      this.report('slip');
    }
  },

  // 景品を離す（いっしょにつかんでいた景品も全部）。揺れの勢いが残っていれば、その向きに飛んでいく
  dropHeld() {
    this.releasePrize(this.held);
    for (const e of this.extras) this.releasePrize(e.p);
    this.extras = [];
    this.held = null;
  },

  // 景品 1 つを爪から離す
  releasePrize(p) {
    p.held = false;
    p.vx = this.swing.vel + this.swing.prevSpeed;
    p.vy = 0;
  },

  report(kind) {
    if (this.onResult) this.onResult(kind);
  },
};
