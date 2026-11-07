// 2 ボタンモード：① を押している間は右へ、② を押している間は奥へ動き、② を離すと下りる
// 本物のクレーンゲームと同じく、① → ② の順に 1 回ずつしか押せない
const ButtonMode = {
  key: 'button',
  session: null,
  time: 0,
  prizes: [],

  // アームの状態
  claw: {
    state: 'ready1', // ready1 / move1 / ready2 / move2 / down / close / up / return / release / wait
    x: 0, z: 0, h: 0,
    openness: 1,
    timer: 0,
    held: null,
    holdOffsetX: 0,
    holdOffsetZ: 0,
    slipAt: -1,
    carryTime: 0,
  },

  start() {
    this.session = new GameSession('button', { restartHint: 'R か ① で もういちど' });
    this.reset();
  },

  reset() {
    const u = CONFIG.ufo;
    this.session.reset();
    Effects.reset();
    this.resetPrizes();
    const c = this.claw;
    c.x = u.home.x;
    c.z = u.home.z;
    c.h = u.topH;
    c.openness = 1;
    c.held = null;
    this.setState('ready1');
  },

  // 景品を床に重ならないように置く
  resetPrizes() {
    const u = CONFIG.ufo;
    const p = CONFIG.prize;
    const normalTypes = [];
    PRIZE_SPRITES.forEach((s, i) => { if (!s.rare) normalTypes.push(i); });
    const types = [];
    for (let i = 0; i < p.count; i++) types.push(normalTypes[i % normalTypes.length]);
    if (Math.random() < p.rareChance) types[0] = PRIZE_SPRITES.findIndex((s) => s.rare);
    types.sort(() => Math.random() - 0.5);

    this.prizes = [];
    for (const type of types) {
      const r = p.minRadius + Math.random() * (p.maxRadius - p.minRadius);
      // 空いている場所が見つかるまで何度か試す
      for (let tries = 0; tries < 50; tries++) {
        const x = u.spawnMinX + Math.random() * (u.spawnMaxX - u.spawnMinX);
        const z = u.spawnMinZ + Math.random() * (u.spawnMaxZ - u.spawnMinZ);
        const overlaps = this.prizes.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + r + 4);
        if (!overlaps || tries === 49) {
          this.prizes.push({ x, z, h: 0, vh: 0, r, type, held: false });
          break;
        }
      }
    }
  },

  setState(next) {
    this.claw.state = next;
    this.claw.timer = 0;
    // 状態に合わせて操作説明を変える
    const helps = {
      ready1: '① を おしているあいだ 右へ',
      move1: 'はなすと とまるよ',
      ready2: '② を おしているあいだ 奥へ',
      move2: 'はなすと アームが おりるよ',
    };
    this.session.help = helps[next] || '';
  },

  // ① と ② のボタン。キーボードでは → と ↑（または 1 と 2）
  button1() { return Input.isDown('ArrowRight') || Input.isDown('Digit1'); },
  button2() { return Input.isDown('ArrowUp') || Input.isDown('Digit2'); },
  pressed1() {
    const a = Input.wasPressed('ArrowRight');
    const b = Input.wasPressed('Digit1');
    return a || b;
  },

  tipH() {
    return this.claw.h - CONFIG.claw.armLength;
  },

  tipSpread() {
    const c = CONFIG.claw;
    return c.tipClosed + (c.tipOpen - c.tipClosed) * this.claw.openness;
  },

  update(dt) {
    this.time += dt;
    if (Input.wasPressed('KeyR')) this.reset();
    // ① が押された瞬間は毎回読み捨てる（遊んでいる間の押下が、終了後に残らないようにするため）
    const pressed1 = this.pressed1();
    if (this.session.gameOver && pressed1) {
      this.reset();
      return;
    }
    this.updateClaw(dt);
    this.updatePrizes(dt);
    Effects.update(dt);
    const idle = this.claw.state === 'ready1';
    this.session.update(dt, idle, this.prizes.length);
  },

  updateClaw(dt) {
    const u = CONFIG.ufo;
    const cc = CONFIG.claw;
    const c = this.claw;
    c.timer += dt;

    switch (c.state) {
      case 'ready1':
        // ① を押したら 1 回分を使って動き始める
        if (this.button1() && this.session.canPlay()) {
          this.session.usePlay();
          this.setState('move1');
        }
        break;

      case 'move1':
        c.x = Math.min(u.maxX, c.x + u.moveSpeed * dt);
        if (!this.button1() || c.x >= u.maxX) this.setState('ready2');
        break;

      case 'ready2':
        if (this.button2()) this.setState('move2');
        break;

      case 'move2':
        c.z = Math.min(u.maxZ, c.z + u.moveSpeed * dt);
        if (!this.button2() || c.z >= u.maxZ) {
          this.setState('down');
          this.report('drop');
        }
        break;

      case 'down': {
        c.h -= u.downSpeed * dt;
        // 床に着くか、真下の景品の中ほどまで下りたら止める
        const touchFloor = this.tipH() <= 2;
        const touchPrize = this.prizes.some((p) =>
          Math.hypot(p.x - c.x, p.z - c.z) < p.r && this.tipH() <= p.h + p.r);
        if (touchFloor || touchPrize) this.setState('close');
        break;
      }

      case 'close': {
        const target = this.findGripTarget();
        const stop = target
          ? Math.max(0, (target.r * 0.75 - cc.tipClosed) / (cc.tipOpen - cc.tipClosed))
          : 0;
        c.openness = Math.max(stop, c.openness - dt / cc.closeTime);
        if (c.timer >= cc.closeTime) {
          this.tryGrab(target);
          this.setState('up');
        }
        break;
      }

      case 'up':
        c.h = Math.min(u.topH, c.h + u.upSpeed * dt);
        this.carryHeld(dt);
        if (c.h >= u.topH) this.setState('return');
        break;

      case 'return': {
        // 取り出し口の真上へ、斜めにまっすぐ戻る
        const dx = u.home.x - c.x;
        const dz = u.home.z - c.z;
        const dist = Math.hypot(dx, dz);
        const step = u.returnSpeed * dt;
        if (dist <= step) {
          c.x = u.home.x;
          c.z = u.home.z;
          this.setState('release');
        } else {
          c.x += dx / dist * step;
          c.z += dz / dist * step;
        }
        this.carryHeld(dt);
        break;
      }

      case 'release':
        c.openness = Math.min(1, c.openness + dt / cc.openTime);
        if (c.held) this.dropHeld();
        if (c.openness >= 1) this.setState('wait');
        break;

      case 'wait':
        if (c.timer >= 0.5) {
          c.openness = 1;
          this.setState('ready1');
        }
        break;
    }
  },

  // 爪の間にある景品のうち、中心にいちばん近いものを探す
  findGripTarget() {
    const c = this.claw;
    let best = null;
    let bestDist = Infinity;
    for (const p of this.prizes) {
      const dist = Math.hypot(p.x - c.x, p.z - c.z);
      const dy = Math.abs(p.h + p.r - this.tipH());
      if (dist < CONFIG.claw.tipOpen && dy < p.r + 6 && dist < bestDist) {
        best = p;
        bestDist = dist;
      }
    }
    return best;
  },

  // つかめるかどうか。考え方はクラシックモードと同じで、奥行きのずれも含めた距離で判定する
  tryGrab(target) {
    const c = this.claw;
    if (!target) {
      this.report('miss');
      return;
    }
    const offset = Math.hypot(target.x - c.x, target.z - c.z) / target.r;
    const grip = PRIZE_SPRITES[target.type].grip;
    const grabChance = Math.max(0.1, Math.min(0.95, (1.05 - offset * 0.8) * grip));
    if (Math.random() > grabChance) {
      this.report('miss');
      return;
    }
    c.held = target;
    target.held = true;
    target.vh = 0;
    c.holdOffsetX = (target.x - c.x) * 0.4;
    c.holdOffsetZ = (target.z - c.z) * 0.4;
    this.report('grab');

    const slipChance = Math.max(0.05, Math.min(0.8, (offset * 0.6 + 0.1) / grip));
    c.slipAt = Math.random() < slipChance ? 0.2 + Math.random() * 1.8 : -1;
    c.carryTime = 0;
  },

  // つかんだ景品をアームと一緒に動かし、決めておいた時間が来たら落とす
  carryHeld(dt) {
    const c = this.claw;
    if (!c.held) return;
    c.held.x = c.x + c.holdOffsetX;
    c.held.z = c.z + c.holdOffsetZ;
    c.held.h = this.tipH() - c.held.r * 0.65;
    if (c.slipAt < 0) return;
    c.carryTime += dt;
    if (c.carryTime >= c.slipAt) {
      this.dropHeld();
      c.openness = Math.min(1, c.openness + 0.15);
      this.report('slip');
    }
  },

  dropHeld() {
    const c = this.claw;
    c.held.held = false;
    c.held.vh = 0;
    c.held = null;
  },

  report(kind) {
    const pos = ButtonRender.project(this.claw.x, this.claw.z, this.claw.h);
    this.session.onClawEvent(kind, pos.x, pos.y + 20);
  },

  // 景品の落下と、床の上で重ならないように押し合う処理
  updatePrizes(dt) {
    const u = CONFIG.ufo;
    const g = CONFIG.prize.gravity;
    const overChute = (p) => p.x < u.chute.w && p.z < u.chute.d;

    for (const p of this.prizes) {
      if (p.held) continue;
      if (p.h > 0 || overChute(p)) {
        p.vh -= g * dt;
        p.h += p.vh * dt;
      }
      if (!overChute(p) && p.h < 0) {
        p.h = 0;
        p.vh = 0;
      }
    }

    // 床にある景品どうしの重なりを解消する
    const onFloor = this.prizes.filter((p) => !p.held && p.h < 1);
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < onFloor.length; i++) {
        for (let j = i + 1; j < onFloor.length; j++) {
          const a = onFloor[i];
          const b = onFloor[j];
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const dist = Math.hypot(dx, dz) || 0.001;
          const overlap = a.r + b.r - dist;
          if (overlap <= 0) continue;
          a.x -= dx / dist * overlap / 2;
          a.z -= dz / dist * overlap / 2;
          b.x += dx / dist * overlap / 2;
          b.z += dz / dist * overlap / 2;
        }
      }
      for (const p of onFloor) {
        p.x = Math.max(p.r, Math.min(u.worldW - p.r, p.x));
        p.z = Math.max(p.r, Math.min(u.worldD - p.r, p.z));
      }
    }

    // 取り出し口に十分落ちた景品を獲得にする
    this.prizes = this.prizes.filter((p) => {
      const captured = !p.held && overChute(p) && p.h < -p.r * 2;
      if (captured) {
        const pos = ButtonRender.project(u.chute.w / 2, u.chute.d / 2, 0);
        this.session.onCaptured(p, pos.x, pos.y - 60);
      }
      return !captured;
    });
  },

  draw() {
    ButtonRender.drawScene(this.time, this.claw, this.prizes, this);
    Effects.draw(Render.ctx);
    this.session.drawHud();
  },
};
