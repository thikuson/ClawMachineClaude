// アームの動き（状態ごとの処理）と、景品をつかむ判定
const Claw = {
  state: 'idle',  // idle / down / close / up / return / release / wait
  x: 0,
  y: 0,
  openness: 1,    // 爪の開き具合（1 で全開、0 で全閉）
  stopOpenness: 0, // 景品をつかんでいるとき、それ以上閉じない開き具合
  timer: 0,
  held: null,     // つかんでいる景品
  holdOffsetX: 0, // つかんだ景品の、アーム中心からの横のずれ
  slipAt: -1,     // 景品が滑り落ちるまでの時間（-1 なら落ちない）
  swing: new Swing(), // 左右の揺れ
  canDrop: () => true, // 下ろしてよいか（プレイ回数が残っているか。main.js で設定）
  onResult: null, // 出来事（drop / grab / miss / slip）を伝える関数（main.js で設定）

  reset() {
    const c = CONFIG.claw;
    this.state = 'idle';
    this.x = c.homeX;
    this.y = c.homeY;
    this.openness = 1;
    this.held = null;
    this.swing.reset(this.x);
  },

  // 揺れを含めた、アーム本体の実際の x 座標
  headX() {
    return this.x + this.swing.offset;
  },

  // 爪の先の y 座標
  tipY() {
    return this.y + CONFIG.claw.armLength;
  },

  // 爪の先の、中心からの横の距離
  tipSpread() {
    const c = CONFIG.claw;
    return c.tipClosed + (c.tipOpen - c.tipClosed) * this.openness;
  },

  update(dt, prizes) {
    const c = CONFIG.claw;
    this.timer += dt;
    this.swing.update(dt, this.x);

    switch (this.state) {
      case 'idle': {
        if (Input.isDown('ArrowLeft')) this.x -= c.moveSpeed * dt;
        if (Input.isDown('ArrowRight')) this.x += c.moveSpeed * dt;
        this.x = Math.max(c.minX, Math.min(c.maxX, this.x));
        if (Input.wasPressed('Space') && this.canDrop()) {
          this.setState('down');
          this.report('drop');
        }
        break;
      }

      case 'down': {
        this.y += c.downSpeed * dt;
        // 床に着くか、真下の景品の中ほどまで下りたら止める
        const touchFloor = this.tipY() >= CONFIG.floorY - 2;
        const touchPrize = prizes.some((p) =>
          Math.abs(p.x - this.headX()) < p.r && this.tipY() >= p.y);
        if (touchFloor || touchPrize) this.setState('close');
        break;
      }

      case 'close': {
        const target = this.findGripTarget(prizes);
        // 景品があれば、その大きさに合わせて爪が止まる
        this.stopOpenness = target
          ? Math.max(0, (target.r * 0.75 - c.tipClosed) / (c.tipOpen - c.tipClosed))
          : 0;
        this.openness = Math.max(this.stopOpenness, this.openness - dt / c.closeTime);
        if (this.timer >= c.closeTime) {
          this.tryGrab(target);
          this.setState('up');
        }
        break;
      }

      case 'up': {
        this.y -= c.upSpeed * dt;
        this.carryHeld();
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
          this.setState('release');
        }
        this.carryHeld();
        this.checkSlip(dt);
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
        if (this.timer >= 0.5) this.setState('idle');
        break;
      }
    }
  },

  setState(next) {
    this.state = next;
    this.timer = 0;
    if (next === 'idle') this.openness = 1;
  },

  // 爪の間にある景品のうち、中心にいちばん近いものを探す
  findGripTarget(prizes) {
    let best = null;
    let bestDx = Infinity;
    for (const p of prizes) {
      const dx = Math.abs(p.x - this.headX());
      const dy = Math.abs(p.y - this.tipY());
      if (dx < CONFIG.claw.tipOpen && dy < p.r + 6 && dx < bestDx) {
        best = p;
        bestDx = dx;
      }
    }
    return best;
  },

  // つかめるかどうかを決める。中心に近いほど成功しやすく、落ちにくい
  tryGrab(target) {
    if (!target) {
      this.report('miss');
      return;
    }
    const offset = Math.abs(target.x - this.headX()) / target.r; // 0 なら真ん中
    const grip = PRIZE_SPRITES[target.type].grip;
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

    // 持ち上げたあと滑り落ちるかどうかも、ここで決めておく
    const slipChance = Math.max(0.05, Math.min(0.8, (offset * 0.6 + 0.1) / grip));
    this.slipAt = Math.random() < slipChance ? 0.2 + Math.random() * 1.8 : -1;
    this.carryTime = 0;
  },

  // つかんだ景品をアームと一緒に動かす
  carryHeld() {
    if (!this.held) return;
    this.held.x = this.headX() + this.holdOffsetX;
    this.held.y = this.tipY() - this.held.r * 0.35;
  },

  // 決めておいた時間が来たか、揺れが大きすぎたら景品を落とす
  checkSlip(dt) {
    if (!this.held) return;
    this.carryTime += dt;
    const grip = PRIZE_SPRITES[this.held.type].grip;
    const timeUp = this.slipAt >= 0 && this.carryTime >= this.slipAt;
    if (timeUp || Swing.shouldSlip(dt, [this.swing], grip)) {
      this.dropHeld();
      this.openness = Math.min(1, this.openness + 0.15);
      this.report('slip');
    }
  },

  // 景品を離す。揺れの勢いが残っていれば、その向きに飛んでいく
  dropHeld() {
    this.held.held = false;
    this.held.vx = this.swing.vel + this.swing.prevSpeed;
    this.held.vy = 0;
    this.held = null;
  },

  report(kind) {
    if (this.onResult) this.onResult(kind);
  },
};
