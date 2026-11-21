// 床を斜め前から見たクレーンゲーム（2 ボタンモードと 3 本爪モード）の共通部分
// アームの上げ下げ・つかむ判定・揺れ・景品の落下と転がりは共通で、
// アームを動かして狙うところ（操作）と、アームの形・景品の大きさなどをモードごとに変える
//
// options:
//   key          ハイスコアを分けるためのモードの名前
//   restartHint  終了画面に出す、もう一度遊ぶ方法の案内
//   layout       床・取り出し口・アームの動く範囲などの設定（CONFIG.ufo など）
//   arm          爪の数・長さ・開き具合・つかむ力などの設定
//   prizeCount   置く景品の数
//   prizeScale   景品の大きさの倍率
//   pointScale   点数の倍率
//   control      アームを動かして狙う操作（状態の一覧、更新処理、もう一度遊ぶボタンなど）
function createFloorMode(options) {
  return {
    key: options.key,
    layout: options.layout,
    arm: options.arm,
    control: options.control,
    session: null,
    time: 0,
    prizes: [],

    // アームの状態
    claw: {
      state: '',
      x: 0, z: 0, h: 0,
      openness: 1,
      timer: 0,
      held: null,
      holdOffsetX: 0,
      holdOffsetZ: 0,
      slipAt: -1,
      carryTime: 0,
      swingX: new Swing(), // 左右の揺れ
      swingZ: new Swing(), // 奥行きの揺れ
    },

    start() {
      FloorRender.layout = this.layout;
      // 難しさに合わせて、爪の開きとつかむ力を決める
      this.arm = Level.apply(options.arm);
      this.session = new GameSession(this.key, { restartHint: options.restartHint });
      this.reset();
    },

    reset() {
      const u = this.layout;
      this.session.reset();
      Effects.reset();
      this.resetPrizes();
      const c = this.claw;
      c.x = u.home.x;
      c.z = u.home.z;
      c.h = u.topH;
      c.openness = 1;
      c.held = null;
      c.swingX.reset(c.x);
      c.swingZ.reset(c.z);
      this.setState(this.control.firstState);
    },

    // 景品を床に重ならないように置く。重なったり、アームが届かない場所に置いたりした並びは、並べ直す
    // （絶対に取れない並びで始まらないようにするため）
    resetPrizes() {
      for (let tries = 0; tries < CONFIG.layoutCheck.maxTries; tries++) {
        this.placePrizes();
        if (this.isGoodLayout()) return;
      }
    },

    // アームが動ける範囲。2 ボタンモードは開始位置から右と奥へしか動けないので、開始位置が手前左の端になる
    reachArea() {
      const u = this.layout;
      return {
        minX: u.minX !== undefined ? u.minX : u.home.x,
        maxX: u.maxX,
        minZ: u.minZ !== undefined ? u.minZ : u.home.z,
        maxZ: u.maxZ,
      };
    },

    isGoodLayout() {
      const area = this.reachArea();
      const ratio = CONFIG.layoutCheck.reachRatio;
      return this.prizes.every((p, i) => {
        const nx = Math.max(area.minX, Math.min(area.maxX, p.x));
        const nz = Math.max(area.minZ, Math.min(area.maxZ, p.z));
        const reachable = Math.hypot(p.x - nx, p.z - nz) <= p.r * ratio;
        const overlaps = this.prizes.some((q, j) => j !== i && Math.hypot(q.x - p.x, q.z - p.z) < q.r + p.r);
        return reachable && !overlaps;
      });
    },

    placePrizes() {
      const u = this.layout;
      const p = CONFIG.prize;
      const normalTypes = [];
      PRIZE_SPRITES.forEach((s, i) => { if (!s.rare && !s.secret) normalTypes.push(i); });
      normalTypes.sort(() => Math.random() - 0.5);
      const types = [];
      for (let i = 0; i < options.prizeCount; i++) types.push(normalTypes[i % normalTypes.length]);
      if (Math.random() < p.rareChance) types[0] = PRIZE_SPRITES.findIndex((s) => s.rare);
      types.sort(() => Math.random() - 0.5);

      this.prizes = [];
      for (const type of types) {
        const r = (p.minRadius + Math.random() * (p.maxRadius - p.minRadius)) * options.prizeScale;
        // 空いている場所が見つかるまで何度か試す
        for (let tries = 0; tries < 80; tries++) {
          const x = u.spawnMinX + Math.random() * (u.spawnMaxX - u.spawnMinX);
          const z = u.spawnMinZ + Math.random() * (u.spawnMaxZ - u.spawnMinZ);
          const overlaps = this.prizes.some((q) => Math.hypot(q.x - x, q.z - z) < q.r + r + 4);
          if (!overlaps || tries === 79) {
            this.prizes.push({
              x, z, h: 0, vx: 0, vz: 0, vh: 0, r, type, angle: 0, held: false,
              pointScale: options.pointScale,
            });
            break;
          }
        }
      }
    },

    setState(next) {
      this.claw.state = next;
      this.claw.timer = 0;
      // 状態に合わせて操作説明を変える
      this.session.help = this.control.help[next] || '';
    },

    tipH() {
      return this.claw.h - this.arm.armLength;
    },

    // 揺れを含めた、アーム本体の実際の位置
    headX() {
      return this.claw.x + this.claw.swingX.offset;
    },

    headZ() {
      return this.claw.z + this.claw.swingZ.offset;
    },

    tipSpread() {
      const a = this.arm;
      return a.tipClosed + (a.tipOpen - a.tipClosed) * this.claw.openness;
    },

    update(dt) {
      FloorRender.layout = this.layout;
      this.time += dt;
      if (Input.wasPressed('KeyR')) this.reset();
      // もう一度遊ぶボタンの押下は毎回読み捨てる（遊んでいる間の押下が、終了後に残らないようにするため）
      const restart = this.control.restartPressed(this);
      // ランダムでは、今の景品のまま続けて遊ぶ
      if (this.session.gameOver && restart) {
        this.session.continueOr(() => this.reset());
        this.claw.timer = 0; // 3 本爪の制限時間を、続けて遊ぶときも最初から数え直す
        return;
      }
      this.updateClaw(dt);
      this.updatePrizes(dt);
      Effects.update(dt);
      const idle = this.claw.state === this.control.firstState;
      this.session.update(dt, idle, this.prizes.length);
    },

    updateClaw(dt) {
      const u = this.layout;
      const cc = this.arm;
      const c = this.claw;
      c.timer += dt;
      c.swingX.update(dt, c.x);
      c.swingZ.update(dt, c.z);

      // アームを動かして狙うところは、モードごとの操作（control）に任せる
      if (this.control.states.includes(c.state)) {
        this.control.update(this, dt);
        return;
      }

      switch (c.state) {
        case 'down': {
          c.h -= u.downSpeed * dt;
          // 床に着くか、真下の景品の中ほどまで下りたら止める
          const touchFloor = this.tipH() <= 2;
          const touchPrize = this.prizes.some((p) =>
            Math.hypot(p.x - this.headX(), p.z - this.headZ()) < p.r && this.tipH() <= p.h + p.r);
          if (touchFloor || touchPrize) this.setState('close');
          break;
        }

        case 'close': {
          const target = this.findGripTarget();
          // 景品があれば、その大きさに合わせて爪が止まる
          const stop = target
            ? Math.max(0, (target.r * cc.hugRatio - cc.tipClosed) / (cc.tipOpen - cc.tipClosed))
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
            this.setState(this.control.firstState);
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
        const dist = Math.hypot(p.x - this.headX(), p.z - this.headZ());
        const dy = Math.abs(p.h + p.r - this.tipH());
        if (dist < this.arm.tipOpen && dy < p.r + 6 && dist < bestDist) {
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
      // つかむ力が強いほど、真ん中からのずれが小さいのと同じ扱いになり、景品もつかみやすくなる（クラシックと同じ考え方）
      const power = this.arm.gripPower || 1;
      const offset = Math.hypot(target.x - this.headX(), target.z - this.headZ()) / target.r / power;
      const grip = PRIZE_SPRITES[target.type].grip * this.arm.gripFactor * Math.sqrt(power);
      const grabChance = Math.max(0.1, Math.min(0.95, (1.05 - offset * 0.8) * grip));
      if (Math.random() > grabChance) {
        // 転がる景品は、爪に押されて逃げていく
        if (PRIZE_SPRITES[target.type].round) {
          let dx = target.x - this.headX();
          let dz = target.z - this.headZ();
          const len = Math.hypot(dx, dz);
          if (len < 0.01) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; }
          const speed = 80 + Math.random() * 80;
          const n = Math.hypot(dx, dz);
          target.vx = dx / n * speed;
          target.vz = dz / n * speed;
        }
        this.report('miss');
        return;
      }
      c.held = target;
      target.held = true;
      target.vh = 0;
      c.holdOffsetX = (target.x - this.headX()) * 0.4;
      c.holdOffsetZ = (target.z - this.headZ()) * 0.4;
      c.swingX.kick(CONFIG.swing.grabKick);
      c.swingZ.kick(CONFIG.swing.grabKick);
      this.report('grab');

      const slipChance = Math.max(0.05, Math.min(0.8, (offset * 0.6 + 0.1) / grip));
      c.slipAt = Math.random() < slipChance ? 0.2 + Math.random() * 1.8 : -1;
      c.carryTime = 0;
    },

    // つかんだ景品をアームと一緒に動かし、決めておいた時間が来たら落とす
    carryHeld(dt) {
      const c = this.claw;
      if (!c.held) return;
      c.held.x = this.headX() + c.holdOffsetX;
      c.held.z = this.headZ() + c.holdOffsetZ;
      c.held.h = this.tipH() - c.held.r * 0.65;
      c.carryTime += dt;
      const grip = PRIZE_SPRITES[c.held.type].grip * this.arm.gripFactor * Math.sqrt(this.arm.gripPower || 1);
      const timeUp = c.slipAt >= 0 && c.carryTime >= c.slipAt;
      if (timeUp || Swing.shouldSlip(dt, [c.swingX, c.swingZ], grip)) {
        this.dropHeld();
        c.openness = Math.min(1, c.openness + 0.15);
        this.report('slip');
      }
    },

    // 景品を離す。揺れの勢いが残っていれば、その向きに飛んでいく
    dropHeld() {
      const c = this.claw;
      c.held.held = false;
      c.held.vh = 0;
      c.held.vx = c.swingX.vel + c.swingX.prevSpeed;
      c.held.vz = c.swingZ.vel + c.swingZ.prevSpeed;
      c.held = null;
    },

    report(kind) {
      const pos = FloorRender.project(this.claw.x, this.claw.z, this.claw.h);
      this.session.onClawEvent(kind, pos.x, pos.y + 20);
    },

    // 景品の落下と、床の上で重ならないように押し合う処理
    updatePrizes(dt) {
      const u = this.layout;
      const g = CONFIG.prize.gravity;
      const overChute = (p) => p.x < u.chute.w && p.z < u.chute.d;

      for (const p of this.prizes) {
        if (p.held) continue;
        // 横の動き。床の上では摩擦で止まるが、転がる景品はなかなか止まらない
        const round = PRIZE_SPRITES[p.type].round;
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        if (p.h <= 0) {
          const friction = Math.pow(round ? 0.6 : 0.002, dt); // 1 秒あたりに残る速さの割合
          p.vx *= friction;
          p.vz *= friction;
        }
        if (round) p.angle += p.vx * dt / p.r;

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
            // ぶつかったら、近づく向きの速さを分け合う（転がる景品が他の景品を押す）
            const nx = dx / dist;
            const nz = dz / dist;
            const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
            if (rel < 0) {
              a.vx += nx * rel * 0.5;
              a.vz += nz * rel * 0.5;
              b.vx -= nx * rel * 0.5;
              b.vz -= nz * rel * 0.5;
            }
          }
        }
        // 壁に当たったら跳ね返る
        for (const p of onFloor) {
          if (p.x < p.r || p.x > u.worldW - p.r) p.vx = -p.vx * 0.5;
          if (p.z < p.r || p.z > u.worldD - p.r) p.vz = -p.vz * 0.5;
          p.x = Math.max(p.r, Math.min(u.worldW - p.r, p.x));
          p.z = Math.max(p.r, Math.min(u.worldD - p.r, p.z));
        }
      }

      // 取り出し口に十分落ちた景品を獲得にする
      this.prizes = this.prizes.filter((p) => {
        const captured = !p.held && overChute(p) && p.h < -p.r * 2;
        if (captured) {
          const pos = FloorRender.project(u.chute.w / 2, u.chute.d / 2, 0);
          this.session.onCaptured(p, pos.x, pos.y - 60);
        }
        return !captured;
      });
    },

    draw() {
      FloorRender.layout = this.layout;
      FloorRender.drawScene(this.time, this.claw, this.prizes, this);
      Effects.draw(Render.ctx);
      this.session.drawHud();
    },
  };
}
