// ショベルモード：斜め上から見た画面（ショベルは横から見た形で描く）。ボタンは「下ろす」だけ
// 動きの計算は真上から見た位置で行い、描くときだけ proj() で斜めから見た形にする
// 丸いドームの中で、景品を載せたテーブルが反時計回りに回っている。ショベルはテーブルの中心の少し左手前の上で止まって待っている。
// スペース（Enter）を押すと、「⊃」の形に（持ち上げたまま右へ伸ばし、右へふくらみながら下りて）毎回同じ場所に下り、
// 地面の砂をすくうように左（軸の方）へ引きながら景品をすくう。持ち上げて手前の真ん中の取り出し口まで運び、傾けると、
// 景品がすべり出て取り出し口の穴へ落ちていく。かんたんではショベルが大きく、一度に何個もすくえることがある
const ShovelMode = {
  key: 'shovel',
  session: null,
  time: 0,

  // アーム。angle は軸から見たショベルの向き、length は軸からショベルの中心までの長さ
  // height はショベルの高さ（0 が床まで下りた状態、1 が持ち上げた状態）。描く大きさと影に使う
  arm: {
    state: 'wait',  // wait / reach / lower / dig / lift / carry / dump / back
    angle: 0,
    length: 0,
    height: 1,
    timer: 0,
    load: [],       // すくった景品 { type, r, u, v（ショベルの中での位置）, angle, spillAt }
    tilt: 0,        // ショベルの傾き（1 で取り出し口に向けて入り口を下に、マイナスはすくった後に入り口を少し上に向ける）
  },

  tableAngle: 0, // テーブルの回った角度（模様と景品の向きに使う）
  prizes: [],    // テーブルの上の景品 { type, r, dist（中心からの距離）, ang（中心から見た角度）, angle（絵の向き） }
  falling: [],   // こぼれてテーブルへ落ちていく景品の演出 { type, r, x, y, t }
  drops: [],     // 取り出し口でショベルからすべり出た景品 { type, r, x, y, h（高さ）, vx, vy, vh, angle }

  start() {
    this.session = new GameSession('shovel', { restartHint: 'R か「下ろす」で もういちど' });
    this.reset();
  },

  reset() {
    this.session.reset();
    this.session.help = 'けいひんが まわってきたら スペースで下ろす';
    Effects.reset();
    this.setUp();
  },

  // 景品を並べ直し、アームを初めの位置に戻す。メニューの背景に出すときにも使う
  setUp() {
    const g = this.cfg();
    const a = this.arm;
    a.state = 'wait';
    a.angle = g.aimAngle;
    a.length = g.waitLength;
    a.height = 1;
    a.timer = 0;
    a.load = [];
    a.tilt = 0;
    this.tableAngle = 0;
    this.falling = [];
    this.drops = [];
    this.placePrizes();
  },

  // このゲームの設定。スウィート（sweet.js）は、この仕組みを使って自分の設定を返す
  spillPopup: true, // こぼれたときに「おしい！」を景品の上に出す

  cfg() {
    return CONFIG.shovel;
  },

  levelSettings() {
    return this.cfg().levels[Level.key] || this.cfg().levels.normal;
  },

  // テーブルの上に、重ならないように景品を置く
  placePrizes() {
    const g = this.cfg();
    const p = CONFIG.prize;
    const normalTypes = [];
    PRIZE_SPRITES.forEach((s, i) => { if (!s.rare && !s.secret) normalTypes.push(i); });
    normalTypes.sort(() => Math.random() - 0.5);
    const types = [];
    for (let i = 0; i < g.prizeCount; i++) types.push(normalTypes[i % normalTypes.length]);
    if (Math.random() < p.rareChance) types[0] = PRIZE_SPRITES.findIndex((s) => s.rare);

    this.prizes = [];
    for (const type of types) {
      const r = 17 + Math.random() * 3;
      for (let tries = 0; tries < 200; tries++) {
        // 面積が均等になるように、中心からの距離は平方根でばらつかせる
        const dist = g.hubR + Math.random() * (Math.min(g.ringOut, g.tableR - r - 6) - g.hubR);
        const ang = Math.random() * Math.PI * 2;
        const x = Math.cos(ang) * dist;
        const y = Math.sin(ang) * dist;
        const ok = this.prizes.every((q) => {
          const qx = Math.cos(q.ang) * q.dist;
          const qy = Math.sin(q.ang) * q.dist;
          return Math.hypot(x - qx, y - qy) > r + q.r + 4;
        });
        if (ok || tries === 199) {
          this.prizes.push({ type, r, dist, ang, angle: Math.random() * Math.PI * 2 });
          break;
        }
      }
    }
  },

  // テーブルの上の景品の、画面上の位置
  prizePos(p) {
    const g = this.cfg();
    return { x: g.tableX + Math.cos(p.ang) * p.dist, y: g.tableY + Math.sin(p.ang) * p.dist };
  },

  // 画面上の位置を、テーブルの上の位置（中心からの距離と角度）にして景品に入れる
  setPrizePos(p, x, y) {
    const g = this.cfg();
    const dx = x - g.tableX;
    const dy = y - g.tableY;
    // 景品が回る輪（hubR〜ringOut）の外へは出ない
    p.dist = Math.max(g.hubR, Math.min(Math.hypot(dx, dy), g.ringOut, g.tableR - p.r - 2));
    p.ang = Math.atan2(dy, dx);
  },

  // ショベルの中心の画面上の位置と、アームの向き（軸から外向き：ux, uy、横向き：vx, vy）
  bucketFrame() {
    const g = this.cfg();
    const a = this.arm;
    const ux = Math.cos(a.angle);
    const uy = Math.sin(a.angle);
    return { x: g.pivotX + ux * a.length, y: g.pivotY + uy * a.length, ux, uy, vx: -uy, vy: ux };
  },

  // 今押せるキー（ショベルが待っているときだけ「下ろす」）
  usableKeys() {
    return Input.usable(this.arm.state === 'wait' && this.session.canPlay(), !!this.session.gameOver);
  },

  update(dt) {
    this.time += dt;
    if (Input.wasPressed('KeyR')) this.reset();
    // 終わったあとは「下ろす」で、もう一度遊べる（ランダムでは、今の景品のまま続けて遊ぶ）
    if (this.session.gameOver && Input.wasPressed('Space')) {
      this.session.continueOr(() => this.reset());
      return;
    }
    // テーブルは止まらずに反時計回りに回り続ける（画面は y が下向きなので、角度を減らす向き）
    const spin = this.cfg().spin * dt;
    this.tableAngle -= spin;
    for (const p of this.prizes) {
      p.ang -= spin;
      p.angle -= spin;
    }
    this.updateArm(dt);
    this.updateFalling(dt);
    this.updateDrops(dt);
    Effects.update(dt);
    const left = this.prizes.length + this.arm.load.length + this.falling.length + this.drops.length;
    this.session.update(dt, this.arm.state === 'wait' && !this.drops.length, left);
  },

  updateArm(dt) {
    const g = this.cfg();
    const a = this.arm;
    a.timer += dt;
    switch (a.state) {
      case 'wait':
        // 止まって待つ。テーブルが回って、景品がショベルの通り道に来たところで押す
        if (Input.wasPressed('Space') && this.session.canPlay()) {
          this.session.usePlay();
          Sound.drop();
          this.setArm('reach');
        }
        break;

      case 'reach':
        // 「⊃」の上の線：持ち上げたまま、右へまっすぐ伸ばす
        a.length = Math.min(g.landLength, a.length + g.reachSpeed * dt);
        if (a.length === g.landLength) this.setArm('lower');
        break;

      case 'lower': {
        // 「⊃」の丸み：右へふくらみながら下りて、毎回同じ場所（landLength）の床に着く
        const t = Math.min(1, a.timer / g.curveTime);
        const th = t * Math.PI;
        a.length = g.landLength + g.curveR * Math.sin(th);
        a.height = (1 + Math.cos(th)) / 2;
        if (t >= 1) this.setArm('dig');
        break;
      }

      case 'dig': {
        // 床をこするように左（軸の方）へ引きながら、ショベルに入った景品をすくう
        a.length = Math.max(g.digTo, a.length - g.digSpeed * dt);
        this.scoop();
        if (a.length === g.digTo) {
          if (a.load.length) Sound.grab();
          this.setArm('lift');
        }
        break;
      }

      case 'lift':
        // 持ち上げながら、こぼれないように入り口を少し上に向ける
        a.height = Math.min(1, a.timer / 0.4);
        a.tilt = -0.2 * a.height;
        this.checkSpill(dt);
        if (a.height === 1) {
          if (!a.load.length) {
            Sound.miss();
            this.session.showMessage('scoopMiss');
          }
          this.setArm(a.load.length ? 'carry' : 'back');
        }
        break;

      case 'carry': {
        // 取り出し口の上まで運ぶ。アームも取り出し口に届く長さまで伸ばす
        const done = this.turnToward(g.chuteAngle, dt);
        const lenDone = this.stretchToward(g.chuteLength, dt);
        this.checkSpill(dt);
        if (done && lenDone) this.setArm('dump');
        break;
      }

      case 'dump':
        // ショベルを傾けると、景品が入り口からすべり出て、取り出し口へ落ちていく
        a.tilt = Math.min(1, -0.2 + 1.2 * a.timer / 0.4);
        if (a.tilt > 0.6 && a.load.length) this.releaseLoad();
        if (a.timer >= 0.8) this.setArm('back');
        break;

      case 'back': {
        // 待つ位置へ戻る
        a.tilt = a.tilt > 0 ? Math.max(0, a.tilt - dt * 3) : Math.min(0, a.tilt + dt * 3);
        a.height = 1;
        const lenDone = this.stretchToward(g.waitLength, dt);
        if (this.turnToward(g.aimAngle, dt) && lenDone && a.tilt === 0) this.setArm('wait');
        break;
      }
    }
  },

  setArm(next) {
    this.arm.state = next;
    this.arm.timer = 0;
  },

  // アームを target の角度へ回す。着いたら true
  turnToward(target, dt) {
    const a = this.arm;
    const step = this.cfg().carrySpeed * dt;
    const diff = target - a.angle;
    if (Math.abs(diff) <= step) {
      a.angle = target;
      return true;
    }
    a.angle += Math.sign(diff) * step;
    return false;
  },

  // アームの長さを target へ近づける。着いたら true
  stretchToward(target, dt) {
    const a = this.arm;
    const step = 160 * dt;
    if (Math.abs(target - a.length) <= step) {
      a.length = target;
      return true;
    }
    a.length += Math.sign(target - a.length) * step;
    return false;
  },

  // ショベルの中の景品を、入り口の向き（軸の側）へすべり出させる
  releaseLoad() {
    const a = this.arm;
    const f = this.bucketFrame();
    const h = this.bucketHeight();
    // ショベルは取り出し口の真上にあるので、入り口から少し前へすべり出して、ほぼ真下の穴へ落ちる
    a.load.forEach((p, i) => {
      const spread = (i - (a.load.length - 1) / 2) * 18;
      this.drops.push({
        type: p.type, r: p.r, angle: p.angle,
        x: f.x + f.vx * spread, y: f.y + f.vy * spread, h,
        vx: -f.ux * (20 + Math.random() * 15),
        vy: -f.uy * (20 + Math.random() * 15),
        vh: 10,
      });
    });
    a.load = [];
    Sound.slip();
  },

  // 取り出し口へ落ちていく景品。床（高さ 0）より下は取り出し口の穴の中だけで、十分落ちたら獲得。
  // 穴の外の床に落ちたときは、穴のまわりのくぼみで穴の方へ転がる
  updateDrops(dt) {
    const g = this.cfg();
    const c = g.chute;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    for (const d of this.drops.slice()) {
      d.vh -= CONFIG.prize.gravity * dt;
      d.h += d.vh * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (PRIZE_SPRITES[d.type].round) d.angle += Math.hypot(d.vx, d.vy) * dt / d.r;
      const inHole = d.x > c.x + 4 && d.x < c.x + c.w - 4 && d.y > c.y + 4 && d.y < c.y + c.h - 4;
      if (d.h <= 0 && !inHole && !d.under) {
        // 穴の外の床に着いた。少しはねて、穴の方へ転がる
        d.h = 0;
        d.vh = Math.abs(d.vh) * 0.3;
        const dx = cx - d.x;
        const dy = cy - d.y;
        const len = Math.hypot(dx, dy) || 1;
        d.vx = dx / len * 90;
        d.vy = dy / len * 90;
      }
      if (d.h < 0 && inHole) d.under = true; // 穴に入った（ここから先は穴の壁の内側を落ちていく）
      if (d.under) {
        d.x = Math.max(c.x + 4, Math.min(c.x + c.w - 4, d.x));
        d.y = Math.max(c.y + 4, Math.min(c.y + c.h - 4, d.y));
      }
      if (d.h < -70) {
        this.drops.splice(this.drops.indexOf(d), 1);
        const at = this.proj(cx, cy, 0);
        this.session.onCaptured(d, at.x, at.y);
      }
    }
  },

  // ショベルに入った景品をすくう。ショベルの入り口（軸の側）から中心が入った景品がすくわれ、
  // 入りきらない景品や、ふちにかかっただけの景品は横へ押しのけられる
  scoop() {
    const g = this.cfg();
    const lv = this.levelSettings();
    const a = this.arm;
    const f = this.bucketFrame();
    const halfW = lv.bucketWidth / 2;
    const halfD = g.bucketDepth / 2;
    for (const p of this.prizes.slice()) {
      const pos = this.prizePos(p);
      const dx = pos.x - f.x;
      const dy = pos.y - f.y;
      const u = dx * f.ux + dy * f.uy; // アームの向き（外向きが +）
      const v = dx * f.vx + dy * f.vy; // 横向き
      if (Math.abs(u) > halfD + p.r || Math.abs(v) > halfW + p.r) continue; // 触れていない
      const inside = Math.abs(u) <= halfD && Math.abs(v) <= halfW - p.r * 0.35;
      if (inside && a.load.length < lv.capacity) {
        // すくった。ショベルの真ん中に近いほど、持ち上げるときにこぼれにくい
        const edge = Math.abs(v) / halfW;
        const grip = PRIZE_SPRITES[p.type].grip * Math.sqrt(Level.settings.gripPower);
        const chance = Math.min(0.9, lv.spill * (0.3 + edge) / grip);
        p.u = u;
        p.v = v;
        p.spillAt = Math.random() < chance ? 0.1 + Math.random() * 0.5 : -1;
        p.carry = 0;
        a.load.push(p);
        this.prizes.splice(this.prizes.indexOf(p), 1);
        continue;
      }
      // ショベルのふちに押されて、横へよける（入りきらないときは、軸の方へ押される）
      const side = v >= 0 ? 1 : -1;
      const pushV = side * (halfW + p.r + 1) - v;
      if (Math.abs(pushV) < p.r * 1.4 || a.load.length >= lv.capacity) {
        this.setPrizePos(p, pos.x + f.vx * pushV, pos.y + f.vy * pushV);
      }
    }
    this.separatePrizes();
  },

  // 押しのけられて重なった景品を、少しずつ離す
  separatePrizes() {
    const list = this.prizes;
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = this.prizePos(list[i]);
          const b = this.prizePos(list[j]);
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.01;
          const overlap = list[i].r + list[j].r + 2 - d;
          if (overlap <= 0) continue;
          const nx = dx / d * overlap / 2;
          const ny = dy / d * overlap / 2;
          this.setPrizePos(list[i], a.x - nx, a.y - ny);
          this.setPrizePos(list[j], b.x + nx, b.y + ny);
        }
      }
    }
  },

  // 持ち上げる途中や運ぶ途中に、ふちの方に載った景品がこぼれる。むずかしいでは運ぶときにショベルが揺れて、さらにこぼれやすい
  checkSpill(dt) {
    const a = this.arm;
    for (const p of a.load.slice()) {
      p.carry += dt;
      if (p.spillAt < 0 || p.carry < p.spillAt) continue;
      a.load.splice(a.load.indexOf(p), 1);
      const pos = this.loadPos(p);
      const h = this.bucketHeight();
      this.falling.push({ type: p.type, r: p.r, angle: p.angle, x: pos.x, y: pos.y, h, t: 0 });
      Sound.slip();
      this.session.showMessage('scoopSpill');
      if (this.spillPopup) {
        const at = this.proj(pos.x, pos.y, h);
        Effects.popup('おしい！', at.x, at.y - 30, '#6fd3ff');
      }
    }
  },

  // ショベルの中の景品の、画面上の位置
  loadPos(p) {
    const f = this.bucketFrame();
    const sway = this.wobble();
    return {
      x: f.x + f.ux * p.u + f.vx * (p.v + sway),
      y: f.y + f.uy * p.u + f.vy * (p.v + sway),
    };
  },

  // むずかしいで、運ぶときにショベルが横に揺れる量（px）
  wobble() {
    const a = this.arm;
    if (!this.levelSettings().wobble || (a.state !== 'carry' && a.state !== 'lift')) return 0;
    return Math.sin(this.time * 14) * 4;
  },

  // こぼれた景品が落ちる演出。テーブルの上なら、テーブルに戻って一緒に回る。取り出し口の上なら獲得
  updateFalling(dt) {
    const g = this.cfg();
    for (const f of this.falling.slice()) {
      f.t += dt;
      if (f.t < 0.35) continue;
      this.falling.splice(this.falling.indexOf(f), 1);
      const c = g.chute;
      if (f.x > c.x && f.x < c.x + c.w && f.y > c.y && f.y < c.y + c.h) {
        const at = this.proj(c.x + c.w / 2, c.y + c.h / 2, 0);
        this.session.onCaptured(f, at.x, at.y);
        continue;
      }
      const p = { type: f.type, r: f.r, dist: 0, ang: 0, angle: f.angle };
      this.setPrizePos(p, f.x, f.y);
      this.prizes.push(p);
      this.separatePrizes();
    }
  },

  draw() {
    this.drawScene(this.time);
    Effects.draw(Render.ctx);
    this.session.drawHud();
  },

  // 斜め上から見た画面にするための変換。動きの計算は真上から見た位置（x：左右、y：奥行き）で行い、
  // 描くときだけ、奥行きを縦につぶして上にずらし、高さ h の分だけさらに上に描く。奥にあるものほど少し小さくする
  proj(x, y, h) {
    const v = this.cfg().view;
    const g = this.cfg();
    const t = (y - (g.tableY - g.tableR)) / (g.tableR * 2); // 0 がテーブルのいちばん奥、1 がいちばん手前
    const k = v.backScale + (1 - v.backScale) * Math.max(0, Math.min(1.4, t));
    return { x: v.centerX + (x - v.centerX) * k, y: v.originY + (y - g.tableY) * v.squash - h * k, k };
  },

  // ショベルの底の、テーブルからの高さ（px）
  bucketHeight() {
    const v = this.cfg().view;
    return v.bucketLow + (v.bucketHigh - v.bucketLow) * this.arm.height;
  },

  // 筐体・テーブル・景品・アームを描く。メニューの背景にも使う
  drawScene(time) {
    const ctx = Render.ctx;
    const g = this.cfg();
    const c = CONFIG.colors;
    const box = CONFIG.case;

    ctx.fillStyle = c.background;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    // 外枠と電飾（ほかの筐体と同じ見た目）
    ctx.fillStyle = c.frame;
    ctx.fillRect(box.x - 12, box.y - 12, box.w + 24, box.h + 24);
    const lightOn = Math.floor(time * 3) % 2;
    for (let x = box.x + 2, i = 0; x < box.x + box.w; x += 28, i++) {
      ctx.fillStyle = (i + lightOn) % 2 ? '#ffe066' : '#ffffff';
      ctx.fillRect(x, box.y - 9, 6, 6);
    }
    // 奥の壁と床（奥ほど暗く）
    ctx.fillStyle = c.wall;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    const floorTop = this.proj(0, g.tableY - g.tableR - 40, 0).y;
    ctx.fillStyle = c.shovelFloor;
    ctx.fillRect(box.x, floorTop, box.w, box.y + box.h - floorTop);

    this.drawChute(ctx);
    this.drawTable(ctx);

    // 影は床とテーブルの上なので、物より先に描く
    for (const p of this.prizes) {
      const pos = this.prizePos(p);
      const s = this.proj(pos.x, pos.y, 0);
      this.drawShadow(ctx, s.x, s.y, p.r * s.k);
    }
    const f = this.bucketFrame();
    const bs = this.proj(f.x, f.y, 0);
    const lv = this.levelSettings();
    this.drawShadow(ctx, bs.x, bs.y, lv.bucketWidth * 0.5 * bs.k, 1 - this.arm.height * 0.5);

    // 奥にあるものから順に描くと、手前のものが前に重なる
    const items = [{ y: g.tableY, draw: () => this.drawHub(ctx) }];
    for (const p of this.prizes) {
      const pos = this.prizePos(p);
      items.push({ y: pos.y, draw: () => this.drawPrizeAt(ctx, p, pos.x, pos.y, 0) });
    }
    for (const fl of this.falling) {
      const h = fl.h * (1 - Math.min(1, fl.t / 0.35));
      items.push({ y: fl.y, draw: () => this.drawPrizeAt(ctx, fl, fl.x, fl.y, h) });
    }
    for (const d of this.drops) {
      if (d.h > 0) {
        const sh = this.proj(d.x, d.y, 0);
        this.drawShadow(ctx, sh.x, sh.y, d.r * sh.k, 0.8);
      }
      items.push({ y: d.y, draw: () => this.drawDrop(ctx, d) });
    }
    // ショベルは幅があるので、手前の板の位置で前後を決める
    items.push({ y: f.y + lv.bucketWidth / 2, draw: () => this.drawBucket(ctx) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    this.drawDomeFront(ctx);
    this.drawBoom(ctx);
  },

  drawPrizeAt(ctx, p, x, y, h) {
    const s = this.proj(x, y, h);
    const size = Math.round(p.r * 2.2 * s.k);
    // 景品は立てて置いてあるように、足もとをその位置に合わせて描く
    const angle = PRIZE_SPRITES[p.type].round ? p.angle : 0;
    Render.drawPrizeImage(p.type, s.x, s.y - size * 0.4, size, angle);
  },

  // 取り出し口へ落ちていく景品。穴に入ったら、穴の形の中だけに描き、深く落ちるほど暗くして見えなくする
  drawDrop(ctx, d) {
    if (d.h >= 0) {
      this.drawPrizeAt(ctx, d, d.x, d.y, d.h);
      return;
    }
    ctx.save();
    this.chutePath(ctx);
    ctx.clip();
    ctx.globalAlpha = Math.max(0, 1 + d.h / 70);
    this.drawPrizeAt(ctx, d, d.x, d.y, d.h);
    ctx.restore();
  },

  // 取り出し口の穴の形の道
  chutePath(ctx) {
    const ch = this.cfg().chute;
    const a = this.proj(ch.x, ch.y, 0);
    const b = this.proj(ch.x + ch.w, ch.y, 0);
    const d = this.proj(ch.x + ch.w, ch.y + ch.h, 0);
    const e = this.proj(ch.x, ch.y + ch.h, 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(d.x, d.y);
    ctx.lineTo(e.x, e.y);
    ctx.closePath();
  },

  // 取り出し口（床に開いた穴）
  drawChute(ctx) {
    const ch = this.cfg().chute;
    const c = CONFIG.colors;
    const a = this.proj(ch.x, ch.y, 0);
    const b = this.proj(ch.x + ch.w, ch.y, 0);
    const d = this.proj(ch.x + ch.w, ch.y + ch.h, 0);
    const e = this.proj(ch.x, ch.y + ch.h, 0);
    ctx.fillStyle = c.chute;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(d.x, d.y);
    ctx.lineTo(e.x, e.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c.chuteEdge;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = c.chuteEdge;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('とりだし口', (e.x + d.x) / 2, e.y + 18);
  },

  // テーブルのふち（円）を、斜めから見た形の道にする
  tablePath(ctx, r, h) {
    const g = this.cfg();
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * Math.PI * 2;
      const s = this.proj(g.tableX + Math.cos(a) * r, g.tableY + Math.sin(a) * r, h);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
  },

  // 回るテーブル。側面と、回っているのがわかる放射状の模様を描く
  drawTable(ctx) {
    const g = this.cfg();
    const v = g.view;
    // 側面（テーブルの厚み）
    this.tablePath(ctx, g.tableR, -v.tableThick);
    ctx.fillStyle = CONFIG.colors.tableSide;
    ctx.fill();
    this.tablePath(ctx, g.tableR, 0);
    ctx.fillStyle = CONFIG.colors.tableTop;
    ctx.fill();
    ctx.fillStyle = CONFIG.colors.tableStripe;
    for (let i = 0; i < 8; i++) {
      const a0 = this.tableAngle + i * Math.PI / 4;
      ctx.beginPath();
      const o = this.proj(g.tableX, g.tableY, 0);
      ctx.moveTo(o.x, o.y);
      for (let j = 0; j <= 6; j++) {
        const a = a0 + j / 6 * Math.PI / 8;
        const s = this.proj(g.tableX + Math.cos(a) * g.tableR, g.tableY + Math.sin(a) * g.tableR, 0);
        ctx.lineTo(s.x, s.y);
      }
      ctx.closePath();
      ctx.fill();
    }
    // ドームの奥側のふち
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.45)';
    ctx.lineWidth = 3;
    this.tablePath(ctx, g.tableR + 4, v.wallHeight);
    ctx.stroke();
  },

  // テーブルの真ん中の台（低い円柱）。景品はこの台のまわりの輪の上を回る
  drawHub(ctx) {
    const g = this.cfg();
    const r = g.hubR - 20;
    const hh = 16;
    const left = this.proj(g.tableX - r, g.tableY, 0);
    const leftTop = this.proj(g.tableX - r, g.tableY, hh);
    const right = this.proj(g.tableX + r, g.tableY, 0);
    ctx.fillStyle = '#b8862a';
    this.tablePath(ctx, r, 0);
    ctx.fill();
    ctx.fillRect(left.x, leftTop.y, right.x - left.x, left.y - leftTop.y);
    this.tablePath(ctx, r, hh);
    ctx.fillStyle = '#f2c94c';
    ctx.fill();
    // 回っているのがわかるように、上に星の模様
    ctx.fillStyle = '#fff1a8';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = this.tableAngle + i * Math.PI / 5;
      const rr = i % 2 ? r * 0.25 : r * 0.6;
      const q = this.proj(g.tableX + Math.cos(a) * rr, g.tableY + Math.sin(a) * rr, hh);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    }
    ctx.closePath();
    ctx.fill();
  },

  // ドームの手前側の透明な壁（景品の前に重なる）
  drawDomeFront(ctx) {
    const g = this.cfg();
    const v = g.view;
    ctx.fillStyle = 'rgba(190, 210, 255, 0.12)';
    ctx.strokeStyle = 'rgba(210, 225, 255, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const a = i / steps * Math.PI; // 手前の半分（0 が右、π が左）
      const s = this.proj(g.tableX + Math.cos(a) * (g.tableR + 4), g.tableY + Math.sin(a) * (g.tableR + 4), v.wallHeight);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    for (let i = steps; i >= 0; i--) {
      const a = i / steps * Math.PI;
      const s = this.proj(g.tableX + Math.cos(a) * (g.tableR + 4), g.tableY + Math.sin(a) * (g.tableR + 4), 0);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = i / steps * Math.PI;
      const s = this.proj(g.tableX + Math.cos(a) * (g.tableR + 4), g.tableY + Math.sin(a) * (g.tableR + 4), v.wallHeight);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();
  },

  drawShadow(ctx, x, y, r, alpha) {
    ctx.fillStyle = 'rgba(0, 0, 0, ' + (0.28 * (alpha === undefined ? 1 : alpha)) + ')';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * this.cfg().view.squash, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // テーブルの左の柱から高いところを通る腕（吊り棒はショベルと一緒に描く）
  drawBoom(ctx) {
    const g = this.cfg();
    const v = g.view;
    const c = CONFIG.colors;
    const f = this.bucketFrame();
    const base = this.proj(g.pivotX, g.pivotY, 0);
    const top = this.proj(g.pivotX, g.pivotY, v.boomHeight);
    const end = this.proj(f.x, f.y, v.boomHeight);
    end.x = this.bucketShape().hingeX; // 腕の先は、吊り棒の真上
    // 柱
    ctx.fillStyle = c.clawDark;
    ctx.fillRect(base.x - 12, top.y, 24, base.y - top.y);
    ctx.fillStyle = '#8f89b8';
    ctx.fillRect(base.x - 16, base.y - 8, 32, 12);
    // 腕
    ctx.lineCap = 'round';
    ctx.strokeStyle = c.clawDark;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.strokeStyle = c.claw;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(top.x, top.y, 7, 0, Math.PI * 2);
    ctx.fill();
  },

  // ショベルを横から見たときの大きさと、吊り棒をつなぐ蝶番（ちょうつがい）の画面上の位置。
  // ショベルは蝶番を中心に傾くので、傾けても吊り棒とつながったまま
  bucketShape() {
    const g = this.cfg();
    const v = g.view;
    const lv = this.levelSettings();
    const f = this.bucketFrame();
    const s = this.proj(f.x, f.y, this.bucketHeight());
    const k = s.k;
    const L = (lv.bucketWidth * 0.5 + 44) * k;     // 横から見た長さ（広いショベルは大きく見せる）
    const H = 40 * k;                              // 高さ
    const W = lv.bucketWidth * v.squash * k;       // 奥行き（ショベルの幅を斜めから見た分）
    const pivot = this.proj(g.pivotX, g.pivotY, 0);
    const dir = pivot.x >= s.x ? 1 : -1;          // 入り口が向く向き（画面の右なら 1）
    const hx = -L * 0.2;                           // 蝶番は、ショベルの背の上の角
    const hy = -H;
    const sway = this.wobble();
    return { s, k, L, H, W, dir, hx, hy, hingeX: s.x + sway + dir * hx, hingeY: s.y + hy };
  },

  // ショベルの形の中の位置（lx, ly：底の真ん中が 0、右が入り口）を、傾きを入れた画面上の位置にする。
  // depth は奥行きの分のずれ（画面の上が奥）。傾きは横から見た面の中だけなので、奥行きのずれは回さない
  bucketPoint(b, lx, ly, depth) {
    const t = this.arm.tilt * 1.1;
    const cx = lx - b.hx;
    const cy = ly - b.hy;
    const rx = cx * Math.cos(t) - cy * Math.sin(t);
    const ry = cx * Math.sin(t) + cy * Math.cos(t);
    return { x: b.hingeX + b.dir * rx, y: b.hingeY + depth + ry };
  },

  // ショベルを横から見た形で描く。入り口は、すくうときに引く向き（腕の柱の側）を向く
  drawBucket(ctx) {
    const g = this.cfg();
    const v = g.view;
    const c = CONFIG.colors;
    const a = this.arm;
    const f = this.bucketFrame();
    const h = this.bucketHeight();
    const b = this.bucketShape();
    const { L, H, W } = b;
    const P = (lx, ly, d) => this.bucketPoint(b, lx, ly, d);

    // 横から見たショベルの形（右が入り口。底は丸く、入り口のふちは平ら）
    const side = (d) => {
      const p0 = P(-L / 2, -H, d);
      const p1 = P(-L / 2, -H * 0.35, d);
      const q = P(-L / 2, 0, d);
      const p2 = P(-L * 0.1, 0, d);
      const p3 = P(L / 2, 0, d);
      const p4 = P(L * 0.05, -H * 0.55, d);
      const p5 = P(-L * 0.2, -H, d);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.quadraticCurveTo(q.x, q.y, p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.lineTo(p5.x, p5.y);
      ctx.closePath();
    };
    const poly = (pts) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
    };

    // 奥側の板
    side(-W / 2);
    ctx.fillStyle = '#6f78a3';
    ctx.fill();

    // 吊り棒（腕の先から、ショベルの真ん中の奥行きにある蝶番まで、まっすぐ下へ）
    const end = this.proj(f.x, f.y, v.boomHeight);
    ctx.strokeStyle = c.claw;
    ctx.lineWidth = 6 * b.k;
    ctx.beginPath();
    ctx.moveTo(b.hingeX, end.y);
    ctx.lineTo(b.hingeX, b.hingeY);
    ctx.stroke();
    // 蝶番の軸（奥から手前の板まで通っている）
    ctx.strokeStyle = '#5c6590';
    ctx.lineWidth = 4 * b.k;
    ctx.beginPath();
    ctx.moveTo(b.hingeX, b.hingeY - W / 2);
    ctx.lineTo(b.hingeX, b.hingeY + W / 2);
    ctx.stroke();

    // 中身（すくった景品）は、2 枚の板の間に見える
    const sway = this.wobble();
    for (const p of a.load) {
      const size = Math.round(p.r * 2.2 * b.k * (1 - Math.max(0, a.tilt) * 0.3));
      const angle = PRIZE_SPRITES[p.type].round ? p.angle : 0;
      // ショベルの中に収まるように、前後のずれは小さくして、底の少し上に置く
      const lx = Math.max(-L * 0.28, Math.min(L * 0.2, -p.u * b.k));
      const depth = Math.max(-W * 0.3, Math.min(W * 0.3, (p.v + sway) * v.squash * b.k));
      const at = P(lx, -H * 0.45, depth);
      Render.drawPrizeImage(p.type, at.x, at.y - size * 0.25, size, angle);
    }

    // 底（奥と手前の板をつなぐ面）
    ctx.fillStyle = '#9aa3c7';
    poly([P(-L / 2, -H * 0.35, W / 2), P(-L / 2, -H * 0.35, -W / 2), P(L / 2, 0, -W / 2), P(L / 2, 0, W / 2)]);
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
    // 手前側の板（景品の下半分を隠す）
    side(W / 2);
    ctx.fillStyle = '#b8c0e0';
    ctx.fill();
    ctx.strokeStyle = '#5c6590';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 蝶番の丸（手前の板の上）
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(b.hingeX, b.hingeY + W / 2, 4 * b.k, 0, Math.PI * 2);
    ctx.fill();
  },
};
