// バンバンモード（台湾式のキャッチャー）：← → で左右に動かし、スペース（Enter）で下ろす（横から見た画面）
// 真ん中に取り出し口があり、その左右の高い床に景品がぎゅうぎゅうに積まれている。3 本爪のアームはケーブルで吊られていて、
// 下ろすとどの難しさでも大きく揺れながら下りる（左右に動かしたときの揺れは、むずかしいだけ）。爪は景品をつかむが、
// 持ち上げる途中で投げてしまうことが多く、揺れる爪が当たった景品は弾かれたり転がったりする。
// 床の内側のふちから押し出された景品は、取り出し口へ落ちて獲得になる
const BanbanMode = {
  key: 'banban',
  session: null,
  time: 0,
  // 景品 { x, y, vx, vy, r, type, angle, held, ground（床に着いている）, sleep（止まって落ち着いている）, still（止まっている時間） }
  prizes: [],

  // アーム。x は台車の位置、offset は揺れによる本体の横のずれ（vel はその速さ）
  arm: {
    state: 'idle', // idle / down / close / up / return / release / wait
    x: 0,
    y: 0,
    offset: 0,
    vel: 0,
    prevX: 0,
    prevSpeed: 0,
    openness: 1,     // 爪の開き具合（1 で全開、0 で全閉）
    stopOpenness: 0, // 景品をつかんでいるとき、それ以上閉じない開き具合
    timer: 0,
    held: null,      // つかんでいる景品
    throwAt: -1,     // 持ち上げ始めてから景品を投げるまでの時間（-1 なら投げずに運ぶ）
    cfg: null,       // 難しさを反映したアームの設定
  },

  start() {
    this.session = new GameSession('banban', { restartHint: 'R か「下ろす」で もういちど', showSwing: false });
    this.reset();
  },

  reset() {
    this.session.reset();
    this.session.help = '← → で移動、スペースで下ろす';
    Effects.reset();
    this.setUp();
  },

  // 景品を積み直し、アームを初めの位置に戻す。メニューの背景に出すときにも使う
  setUp() {
    const a = this.arm;
    a.cfg = Level.apply(CONFIG.banban.claw);
    a.state = 'idle';
    a.x = a.prevX = a.cfg.homeX;
    a.y = a.cfg.homeY;
    a.offset = 0;
    a.vel = 0;
    a.prevSpeed = 0;
    a.openness = 1;
    a.held = null;
    a.timer = 0;
    this.placePrizes();
  },

  levelSettings() {
    return CONFIG.banban.levels[Level.key] || CONFIG.banban.levels.normal;
  },

  // 景品を床の上に積む。上から落として落ち着かせ、取り出し口に落ちてしまったら並べ直す
  placePrizes() {
    const g = CONFIG.banban;
    for (let tries = 0; tries < 20; tries++) {
      // 同じ種類が何個あってもよい（ぎゅうぎゅうに詰めるため）。レア景品は、出るときだけ 1 個
      const normalTypes = [];
      PRIZE_SPRITES.forEach((s, i) => { if (!s.rare) normalTypes.push(i); });
      const types = [];
      for (let i = 0; i < g.prizeCount; i++) types.push(normalTypes[Math.floor(Math.random() * normalTypes.length)]);
      if (Math.random() < CONFIG.prize.rareChance) types[0] = PRIZE_SPRITES.findIndex((s) => s.rare);
      types.sort(() => Math.random() - 0.5);

      // 左右の床それぞれに、外側の壁から取り出し口の方へ並べ、段ごとに半分ずつずらして積む。
      // 上の面が平らになるので、山が斜面のように崩れにくい
      const d = g.maxR * 2;
      const box = CONFIG.case;
      const shelfW = g.chute.x - box.x;
      const perRow = Math.floor((shelfW - g.spawnMargin - d) / d) + 1;
      const slots = [];
      for (let row = 0; slots.length < types.length; row++) {
        const count = row % 2 ? perRow - 1 : perRow;
        for (let col = 0; col < count; col++) {
          const y = g.shelfY - g.maxR - row * g.maxR * Math.sqrt(3) - 1;
          const inset = g.maxR + col * d + row % 2 * g.maxR;
          slots.push({ x: box.x + inset, y });                 // 左の床（左の壁から右へ）
          slots.push({ x: box.x + box.w - inset, y });         // 右の床（右の壁から左へ）
        }
      }
      this.prizes = types.map((type, i) => ({
        x: slots[i].x, y: slots[i].y,
        vx: 0, vy: 0,
        r: g.minR + Math.random() * (g.maxR - g.minR),
        type,
        angle: 0,
        held: false,
      }));
      let fell = false;
      for (let i = 0; i < 300; i++) if (this.stepPrizes(1 / 60).length) fell = true;
      if (!fell) break;
    }
    for (const p of this.prizes) this.sleepPrize(p);
  },

  // 揺れを含めた、アーム本体の実際の x 座標
  headX() {
    return this.arm.x + this.arm.offset;
  },

  tipY() {
    return this.arm.y + this.arm.cfg.armLength;
  },

  // 外側の爪の先の、中心からの横の距離
  tipSpread() {
    const c = this.arm.cfg;
    return c.tipClosed + (c.tipOpen - c.tipClosed) * this.arm.openness;
  },

  update(dt) {
    this.time += dt;
    if (Input.wasPressed('KeyR')) this.reset();
    if (this.session.gameOver && Input.wasPressed('Space')) {
      this.reset();
      return;
    }
    this.updateArm(dt);
    const chute = CONFIG.banban.chute;
    for (const p of this.stepPrizes(dt)) this.session.onCaptured(p, chute.x + chute.w / 2 - 40, CONFIG.banban.shelfY + 40);
    Effects.update(dt);
    this.session.update(dt, this.arm.state === 'idle', this.prizes.length);
  },

  // ケーブルで吊られたアームの揺れ。振り子と同じく、ケーブルが長い（下りている）ほどゆっくり揺れる。
  // 下ろし始めにはどの難しさでも揺れ出す。台車を左右に動かしたときの揺れは、むずかしい（Level の swing）だけ
  updateSwing(dt) {
    const g = CONFIG.banban.swing;
    const a = this.arm;
    const speed = (a.x - a.prevX) / dt;
    if (Level.settings.swing) a.vel -= (speed - a.prevSpeed) * g.strength;
    a.prevX = a.x;
    a.prevSpeed = speed;
    const cable = Math.max(g.minCable, a.y - (CONFIG.case.y + 13));
    // かんたん・ふつうでは、上まで戻ったら揺れを早めに収める（左右に動かすときに揺れが残らないように）
    const calm = !Level.settings.swing && a.state !== 'down' && a.state !== 'close' && a.state !== 'up';
    const damping = calm ? g.calmDamping : g.damping;
    a.vel += (-g.gravity / cable * a.offset - damping * a.vel) * dt;
    a.offset += a.vel * dt;
    if (Math.abs(a.offset) > g.maxOffset) {
      a.offset = Math.sign(a.offset) * g.maxOffset;
      a.vel *= -0.3;
    }
    // ケースの壁より外へは振れない
    const box = CONFIG.case;
    const hx = a.x + a.offset;
    const margin = this.tipSpread() + 6;
    if (hx < box.x + margin) { a.offset = box.x + margin - a.x; a.vel = Math.abs(a.vel) * 0.4; }
    if (hx > box.x + box.w - margin) { a.offset = box.x + box.w - margin - a.x; a.vel = -Math.abs(a.vel) * 0.4; }
  },

  updateArm(dt) {
    const a = this.arm;
    const c = a.cfg;
    const g = CONFIG.banban;
    a.timer += dt;
    const prevHeadX = this.headX();
    const prevY = a.y;
    const prevSpread = this.tipSpread();

    switch (a.state) {
      case 'idle':
        if (Input.isDown('ArrowLeft')) a.x -= c.moveSpeed * dt;
        if (Input.isDown('ArrowRight')) a.x += c.moveSpeed * dt;
        a.x = Math.max(c.minX, Math.min(c.maxX, a.x));
        if (Input.wasPressed('Space') && this.session.canPlay()) {
          this.session.usePlay();
          Sound.drop();
          // 下ろし始めに、ガクンと大きく揺れ出す（真下にはまっすぐ下りない）
          const kick = g.swing.dropKickMin + Math.random() * (g.swing.dropKickMax - g.swing.dropKickMin);
          a.vel += (Math.random() < 0.5 ? -1 : 1) * kick;
          this.setArm('down');
        }
        break;

      case 'down': {
        a.y += c.downSpeed * dt;
        // 床に着くか、真下の景品の上に爪の先が乗ったら止める
        const hx = this.headX();
        const touchFloor = this.tipY() >= g.shelfY - 2;
        const touchPrize = this.prizes.some((p) => Math.abs(p.x - hx) < p.r * 0.8 && this.tipY() >= p.y - p.r * 0.2);
        if (touchFloor || touchPrize) this.setArm('close');
        break;
      }

      case 'close': {
        const target = this.findGripTarget();
        a.stopOpenness = target ? Math.max(0, (target.r * 0.7 - c.tipClosed) / (c.tipOpen - c.tipClosed)) : 0;
        a.openness = Math.max(a.stopOpenness, a.openness - dt / c.closeTime);
        if (a.timer >= c.closeTime) {
          this.tryGrab(target);
          // 引き上げ始めに、ガクンと揺れる
          a.vel += (Math.random() - 0.5) * 2 * g.swing.liftKick;
          this.setArm('up');
        }
        break;
      }

      case 'up':
        a.y -= c.upSpeed * dt;
        if (a.held && a.throwAt >= 0 && a.timer >= a.throwAt) this.throwHeld();
        if (a.y <= c.homeY) {
          a.y = c.homeY;
          this.setArm('return');
        }
        break;

      case 'return': {
        const dir = Math.sign(c.homeX - a.x);
        a.x += dir * c.returnSpeed * dt;
        if ((dir < 0 && a.x <= c.homeX) || (dir > 0 && a.x >= c.homeX) || dir === 0) {
          a.x = c.homeX;
          this.setArm('release');
        }
        break;
      }

      case 'release':
        a.openness = Math.min(1, a.openness + dt / c.openTime);
        if (a.held) {
          const p = a.held;
          this.dropHeld(0, 0);
          p.free = true;
        }
        if (a.openness >= 1) this.setArm('wait');
        break;

      case 'wait':
        if (a.timer >= 0.5) this.setArm('idle');
        break;
    }

    this.updateSwing(dt);
    if (a.held) {
      a.held.x = this.headX();
      a.held.y = this.tipY() - a.held.r * 0.4;
    }
    // 爪と本体の速さ（景品に当たったときに弾く強さに使う）
    const vx = (this.headX() - prevHeadX) / dt;
    const vy = (a.y - prevY) / dt;
    const spreadV = (this.tipSpread() - prevSpread) / dt;
    this.hitPrizes(vx, vy, spreadV);
  },

  setArm(next) {
    const a = this.arm;
    a.state = next;
    a.timer = 0;
    if (next === 'idle') {
      a.openness = 1;
      // 待つ位置に戻ったら、投げたり離したりした景品も、また爪と当たるようにする
      for (const p of this.prizes) p.free = false;
    }
  },

  // 爪の間にある景品のうち、中心にいちばん近いものを探す
  findGripTarget() {
    const hx = this.headX();
    const ty = this.tipY();
    let best = null;
    let bestDx = Infinity;
    for (const p of this.prizes) {
      const dx = Math.abs(p.x - hx);
      if (dx < this.arm.cfg.tipOpen && Math.abs(p.y - ty) < p.r + 8 && dx < bestDx) {
        best = p;
        bestDx = dx;
      }
    }
    return best;
  },

  // つかめるかどうかを決める。つかめたら、持ち上げる途中で投げるかどうかも決めておく
  tryGrab(target) {
    const a = this.arm;
    const lv = this.levelSettings();
    if (!target) {
      Sound.miss();
      this.session.showMessage('miss');
      return;
    }
    const power = a.cfg.gripPower || 1;
    const offset = Math.abs(target.x - this.headX()) / target.r / power;
    const grip = PRIZE_SPRITES[target.type].grip * Math.sqrt(power);
    const chance = Math.max(0.1, Math.min(0.95, lv.grab * (1.1 - offset * 0.6) * grip));
    if (Math.random() > chance) {
      // つかみそこねた景品は、爪に押されて転がる
      const dir = Math.sign(target.x - this.headX()) || (Math.random() < 0.5 ? -1 : 1);
      target.vx += dir * (60 + Math.random() * 100) * lv.pushPower;
      target.vy -= 60;
      Sound.miss();
      this.session.showMessage('miss');
      return;
    }
    a.held = target;
    target.held = true;
    this.wakePrize(target);
    target.vx = 0;
    target.vy = 0;
    a.throwAt = Math.random() < lv.throwChance ? 0.15 + Math.random() * 0.7 : -1;
    Sound.grab();
  },

  // 持ち上げる途中で、つかんだ景品を放り投げる。揺れの勢いの向きに飛んでいく
  throwHeld() {
    const a = this.arm;
    const g = CONFIG.banban;
    const toss = g.throwMin + Math.random() * (g.throwMax - g.throwMin);
    const toChute = Math.sign(g.chute.x + g.chute.w / 2 - this.headX()) || 1;
    // 横向きの勢いを大きめにして、爪の間から確実に飛び出すようにする
    const side = (Math.random() < this.levelSettings().throwToChute ? toChute : -toChute) * (g.throwSideMin + Math.random() * (g.throwSideMax - g.throwSideMin));
    const p = a.held;
    this.dropHeld(a.vel * 1.3 + side, -toss);
    p.free = true; // 投げた景品は、アームが待つ位置に戻るまで爪と当たらない（爪に載ったまま運ばれないように）
    a.openness = 1; // 爪をぱっと開いて放り出す
    Sound.slip();
    this.session.showMessage('bbThrow');
    Effects.popup('ぽーん！', this.headX(), this.tipY() - 20, '#6fd3ff');
  },

  // 景品を離す
  dropHeld(vx, vy) {
    const a = this.arm;
    a.held.held = false;
    a.held.vx = vx;
    a.held.vy = vy;
    a.held = null;
  },

  // 爪（3 本の先）と本体が景品に当たったら、押しのけて弾く。動いている爪ほど強く弾く
  hitPrizes(vx, vy, spreadV) {
    const g = CONFIG.banban;
    const a = this.arm;
    const lv = this.levelSettings();
    const hx = this.headX();
    const ty = this.tipY();
    const spread = this.tipSpread();
    const parts = [
      { x: hx, y: a.y, r: 14, vx, vy },                    // 本体
      { x: hx - spread, y: ty, r: 5, vx: vx - spreadV, vy }, // 左の爪の先
      { x: hx + spread, y: ty, r: 5, vx: vx + spreadV, vy }, // 右の爪の先
      { x: hx, y: ty + 2, r: 5, vx, vy },                   // 真ん中（手前）の爪の先
    ];
    // 引き上げてから戻るまでは、爪は景品を横へ押しのけるだけで、上へは押さない。
    // 上へも押すと、爪の先に載った景品がそのまま持ち上がって運ばれてしまう
    const lifting = a.state !== 'down' && a.state !== 'close' && a.state !== 'idle';
    for (const p of this.prizes) {
      if (p.held || p.free) continue;
      for (const part of parts) {
        const dx = p.x - part.x;
        const dy = p.y - part.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const overlap = p.r + part.r - d;
        if (overlap <= 0) continue;
        let nx = dx / d;
        let ny = dy / d;
        if (lifting) {
          nx = dx >= 0 ? 1 : -1;
          ny = 0;
        }
        this.wakePrize(p);
        p.x += nx * overlap;
        p.y += ny * overlap;
        // 爪がぶつかってくる速さの分だけ、景品に勢いを与える（強すぎないように上限を設ける）
        const push = Math.min(g.maxPush, (part.vx * nx + part.vy * ny) - (p.vx * nx + p.vy * ny));
        if (push > 0) {
          p.vx += nx * push * g.pushScale * lv.pushPower;
          p.vy += ny * push * g.pushScale * lv.pushPower;
        }
      }
    }
  },

  // 止まって落ち着いた景品は、眠らせて動かさない（積んだ山が、重なりを直す計算のくり返しで少しずつ崩れていかないように）。
  // 爪や動いている景品が触れると起きる
  sleepPrize(p) {
    p.sleep = true;
    p.vx = 0;
    p.vy = 0;
    p.still = 0;
  },

  wakePrize(p) {
    p.sleep = false;
    p.still = 0;
  },

  // 景品の物理（重力・床・壁・景品どうしの衝突）。取り出し口に落ちた景品の一覧を返す
  stepPrizes(dt) {
    const g = CONFIG.banban;
    const gravity = CONFIG.prize.gravity;
    // 動いている景品に触れている、眠っている景品を起こす（下の景品が動いたら、上に載っている景品も落ちるように）
    // （起きていても止まっている景品は、まわりを起こさない。山全体が一度に起きて崩れないように）
    for (const p of this.prizes) {
      if (p.sleep || (!p.held && Math.hypot(p.vx, p.vy) < g.sleepSpeed)) continue;
      for (const q of this.prizes) {
        if (q.sleep && q !== p && Math.hypot(q.x - p.x, q.y - p.y) < p.r + q.r + 3) this.wakePrize(q);
      }
    }
    for (const p of this.prizes) {
      if (p.held || p.sleep) continue;
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.vx * dt / p.r;
    }
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < this.prizes.length; i++) {
        for (let j = i + 1; j < this.prizes.length; j++) this.resolvePair(this.prizes[i], this.prizes[j]);
      }
      for (const p of this.prizes) if (!p.held) this.constrain(p);
    }
    // しばらくほとんど動かなかった景品を眠らせる
    for (const p of this.prizes) {
      if (p.held || p.sleep) continue;
      if (Math.hypot(p.vx, p.vy) < g.sleepSpeed) {
        p.still = (p.still || 0) + dt;
        if (p.still >= g.sleepTime) this.sleepPrize(p);
      } else {
        p.still = 0;
      }
    }
    const captured = [];
    this.prizes = this.prizes.filter((p) => {
      const inChute = !p.held && p.x > g.chute.x && p.x < g.chute.x + g.chute.w && p.y - p.r > g.shelfY + 70;
      if (inChute) captured.push(p);
      return !inChute;
    });
    return captured;
  },

  // 2 つの景品が重なっていたら押し離し、近づく向きの速度を打ち消す（prize.js と同じ考え方）。
  // 床に着いている景品は、床との摩擦で動きにくいものとして押し離す量を小さくする。
  // こうしないと、積んだ景品の重みで下の段が左右に押し広げられ、山が崩れて取り出し口へ流れ落ちてしまう
  resolvePair(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const overlap = a.r + b.r - dist;
    if (overlap <= 0) return;
    if (a.sleep && b.sleep) return; // 眠っている景品どうしは押し合わない
    let nx = dx / dist;
    let ny = dy / dist;
    // 持ち上げられている景品は、ほかの景品を横へ押しのけるだけで、上へは押さない
    // （上へも押すと、つかんだ景品の上に載った景品や、壁との間にはさまった景品まで一緒に持ち上がってしまう）
    if (a.held || b.held) {
      nx = dx >= 0 ? 1 : -1;
      ny = 0;
    }
    const heavy = CONFIG.banban.groundWeight;
    // 持ち上げられている景品は動かさない。眠っている景品は、床に着いた景品と同じく動きにくい
    let wa = a.held ? 0 : (a.ground || a.sleep ? heavy : 1);
    let wb = b.held ? 0 : (b.ground || b.sleep ? heavy : 1);
    // 持ち上げられている景品に押されたら起きる
    if (a.held && b.sleep) this.wakePrize(b);
    if (b.held && a.sleep) this.wakePrize(a);
    const sum = wa + wb;
    if (sum === 0) return;
    wa /= sum;
    wb /= sum;
    a.x -= nx * overlap * wa;
    a.y -= ny * overlap * wa;
    b.x += nx * overlap * wb;
    b.y += ny * overlap * wb;
    const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rel < 0) {
      if (!a.held) { a.vx += nx * rel * wa * 2; a.vy += ny * rel * wa * 2; }
      if (!b.held) { b.vx -= nx * rel * wb * 2; b.vy -= ny * rel * wb * 2; }
    }
    // 景品どうしの摩擦。こすれ合う向きの速さの差を小さくする（積んだ景品が、すべり落ちるように流れないように）
    const tx = -ny;
    const ty = nx;
    const slide = ((b.vx - a.vx) * tx + (b.vy - a.vy) * ty) * this.levelSettings().pairFriction;
    if (!a.held) { a.vx += tx * slide * wa; a.vy += ty * slide * wa; }
    if (!b.held) { b.vx -= tx * slide * wb; b.vy -= ty * slide * wb; }
  },

  // 左右の高い床・ケースの壁・床の内側のふち（取り出し口との境）からはみ出さないようにする
  constrain(p) {
    const g = CONFIG.banban;
    const box = CONFIG.case;
    const left = g.chute.x;              // 左の床の右のふち
    const right = g.chute.x + g.chute.w; // 右の床の左のふち
    p.ground = false;
    // 床（取り出し口の上には床がなく、そのまま落ちていく）。弾まずに止まり、床とこすれて少しずつ遅くなる
    if ((p.x <= left || p.x >= right) && p.y + p.r > g.shelfY) {
      p.y = g.shelfY - p.r;
      if (p.vy > 0) p.vy = 0;
      p.ground = true;
      p.vx *= PRIZE_SPRITES[p.type].round ? g.rollFriction : g.slideFriction;
    }
    if (p.x - p.r < box.x) { p.x = box.x + p.r; p.vx = Math.abs(p.vx) * 0.3; }
    if (p.x + p.r > box.x + box.w) { p.x = box.x + box.w - p.r; p.vx = -Math.abs(p.vx) * 0.3; }
    // 床の内側のふちの、低い丸いでっぱり。積んだ景品が自然に崩れ落ちないように支え、勢いのある景品は乗り越える
    const lipR = this.levelSettings().lipR;
    for (const bx of [left - lipR, right + lipR]) {
      const dx = p.x - bx;
      const dy = p.y - g.shelfY;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d < p.r + lipR && p.y < g.shelfY) {
        const nx = dx / d;
        const ny = dy / d;
        const over = p.r + lipR - d;
        p.x += nx * over;
        p.y += ny * over;
        const vn = p.vx * nx + p.vy * ny;
        if (vn < 0) {
          // ぶつかった勢いを打ち消し、でっぱりとこすれて遅くなる（ゆっくり転がってきた景品は、乗り越えられずに止まる）
          p.vx -= nx * vn;
          p.vy -= ny * vn;
          p.vx *= g.lipFriction;
          p.vy *= g.lipFriction;
        }
      }
    }
    // 床のふちより下では、床の側面を通り抜けられない（取り出し口の穴の中を落ちていく）
    if (p.y + p.r > g.shelfY + 4) {
      if (p.x > left && p.x - p.r < left) { p.x = left + p.r; if (p.vx < 0) p.vx = 0; }
      if (p.x < right && p.x + p.r > right) { p.x = right - p.r; if (p.vx > 0) p.vx = 0; }
    }
  },

  draw() {
    this.drawScene(this.time);
    this.drawClaw();
    Effects.draw(Render.ctx);
    this.session.drawHud();
  },

  // 筐体（枠・ガラス・高い床・取り出し口）と景品を描く。メニューの背景にも使う
  drawScene(time) {
    const ctx = Render.ctx;
    const g = CONFIG.banban;
    const c = CONFIG.colors;
    const box = CONFIG.case;
    ctx.fillStyle = c.background;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.fillStyle = c.frame;
    ctx.fillRect(box.x - 12, box.y - 12, box.w + 24, box.h + 24);
    // 電飾（ほかの筐体より速く点滅させて、にぎやかにする）
    const lightOn = Math.floor(time * 6) % 2;
    for (let x = box.x + 2, i = 0; x < box.x + box.w; x += 28, i++) {
      ctx.fillStyle = (i + lightOn) % 2 ? '#ffe066' : '#6fd3ff';
      ctx.fillRect(x, box.y - 9, 6, 6);
    }
    ctx.fillStyle = c.glass;
    ctx.fillRect(box.x, box.y, box.w, box.h);

    // 左右の高い床（台）。前の面にしま模様を入れる
    const bottom = box.y + box.h;
    const ch = g.chute;
    const lipR = this.levelSettings().lipR;
    for (const [x0, x1] of [[box.x, ch.x], [ch.x + ch.w, box.x + box.w]]) {
      ctx.fillStyle = c.floor;
      ctx.fillRect(x0, g.shelfY, x1 - x0, bottom - g.shelfY);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      for (let y = g.shelfY + 24; y < bottom; y += 24) ctx.fillRect(x0, y, x1 - x0, 10);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(x0, g.shelfY, x1 - x0, 3);
    }
    // 床の内側のふちの、低い丸いでっぱり
    ctx.fillStyle = '#ffe066';
    for (const bx of [ch.x - lipR, ch.x + ch.w + lipR]) {
      ctx.beginPath();
      ctx.arc(bx, g.shelfY, lipR, Math.PI, Math.PI * 2);
      ctx.fill();
    }

    // 取り出し口（真ん中の、深い穴）
    ctx.fillStyle = c.chute;
    ctx.fillRect(ch.x, g.shelfY, ch.w, bottom - g.shelfY);
    ctx.fillStyle = c.chuteEdge;
    ctx.fillRect(ch.x - 3, g.shelfY, 4, bottom - g.shelfY);
    ctx.fillRect(ch.x + ch.w - 1, g.shelfY, 4, bottom - g.shelfY);
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('とりだし口', ch.x + ch.w / 2, g.shelfY + 110);

    // アームのレール
    ctx.fillStyle = c.frame;
    ctx.fillRect(box.x, box.y + 10, box.w, 6);

    for (const p of this.prizes) {
      if (!p.held) Render.drawPrizeImage(p.type, p.x, p.y, Math.round(p.r * 2.2), PRIZE_SPRITES[p.type].round ? p.angle : 0);
    }
  },

  // 3 本爪のアーム。横から見ると、左右の爪と、手前に真ん中の爪が見える。つかんだ景品は爪の間に描く
  drawClaw() {
    const ctx = Render.ctx;
    const c = CONFIG.colors;
    const a = this.arm;
    const box = CONFIG.case;
    const railY = box.y + 13;
    const headTop = a.y - 10;
    const hx = this.headX();
    const spread = this.tipSpread();
    const tipY = this.tipY();
    const elbowY = a.y + a.cfg.armLength * 0.55;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, 0, box.w, CONFIG.height);
    ctx.clip();

    ctx.strokeStyle = c.cable;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, railY);
    ctx.lineTo(hx, headTop);
    ctx.stroke();
    ctx.fillStyle = c.clawDark;
    ctx.fillRect(Math.round(a.x) - 16, railY - 7, 32, 12);

    // 左右の爪（奥側）
    ctx.strokeStyle = c.clawDark;
    ctx.lineWidth = 5;
    ctx.lineCap = 'square';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + side * 8, a.y + 6);
      ctx.lineTo(hx + side * (spread + 8), elbowY);
      ctx.lineTo(hx + side * spread, tipY);
      ctx.lineTo(hx + side * (spread - 7), tipY - 2);
      ctx.stroke();
    }
    // つかんでいる景品は、爪の間に
    if (a.held) {
      const p = a.held;
      Render.drawPrizeImage(p.type, p.x, p.y, Math.round(p.r * 2.2), PRIZE_SPRITES[p.type].round ? p.angle : 0);
    }
    // 真ん中の爪（手前側）。開くと先が手前に出てくるので、短く見える
    ctx.strokeStyle = c.claw;
    ctx.lineWidth = 6;
    const midY = tipY - (spread - a.cfg.tipClosed) * 0.35;
    ctx.beginPath();
    ctx.moveTo(hx, a.y + 6);
    ctx.lineTo(hx, midY);
    ctx.lineTo(hx + 3, midY - 5);
    ctx.stroke();
    ctx.lineCap = 'butt';

    const img = Render.clawHeadImage;
    ctx.drawImage(img, Math.round(hx - img.width * 1.5), Math.round(headTop - 2), img.width * 3, img.height * 3);
    ctx.restore();
  },
};
