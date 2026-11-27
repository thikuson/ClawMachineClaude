// ながおしモード：「下ろす」を押しているあいだアームが右へ進み、はなすとブレーキをかけて止まってから下りる。
// 押している時間が長いほどアームはどんどん速くなり、はなしたあとも少しすべるので、「どこで はなすか」を考えて遊ぶ。
// アームの上げ下げ・つかむ判定・景品の物理はクラシック（js/claw.js・js/prize.js）と同じで、
// 待っている間の動き（押している間の加速と、はなしたあとのブレーキ）だけをこのモードで動かす。
// おまかせと見た目でも区別できるように、レールの電球（進んだところまで光る）、取り出し口の上の速さのメーター、
// 速いときのアームの残像を描く。かんたんでは、今はなしたら止まる場所を床に出す
const HoldMode = {
  key: 'hold',
  session: null,
  time: 0,
  phase: 'ready', // ready（押すのを待つ）/ move（押している）/ brake（はなしてブレーキ中）/ claw（アームが下りて戻るまで）
  speed: 0,       // 今の右へ進む速さ（px/秒）
  trail: [],      // 残像に使う、少し前のアームの位置
  trailTimer: 0,
  reach: 0,       // 今回進んだいちばん右の位置（レールの電球をここまで光らせる）
  bulbSpeeds: [], // 電球ごとの、アームが通ったときの速さの割合（電球をその速さの色で光らせる）

  start() {
    this.session = new GameSession('hold', { restartHint: 'R か「下ろす」で もういちど' });
    // 難しさに合わせて、爪の開きとつかむ力を決める（左右は自分で動かさないので autoMove は使わない）
    Claw.cfg = Level.apply(Object.assign({}, CONFIG.claw, CONFIG.holdClaw));
    Claw.autoMove = false;
    this.reset();
    Claw.onResult = (kind) => {
      if (kind === 'drop') this.session.usePlay();
      this.session.onClawEvent(kind, Claw.x, Claw.y + 20);
    };
    Claw.canDrop = () => this.session.canPlay();
  },

  reset() {
    this.session.reset();
    Prizes.reset(CONFIG.holdClaw.prizeCount);
    Claw.reset();
    Effects.reset();
    this.toReady();
  },

  toReady() {
    this.phase = 'ready';
    this.speed = 0;
    this.trail = [];
    this.reach = Claw.cfg.homeX;
    this.bulbSpeeds = [];
    this.session.help = 'おしているあいだ 進むよ。はなすと 下りる';
  },

  // 今押せるキー。押している間（move）も、はなしたことを伝えられるように押せるままにする
  usableKeys() {
    const ready = this.phase === 'ready' && Claw.state === 'idle' && Claw.canDrop();
    return { Space: ready || this.phase === 'move' || !!this.session.gameOver };
  },

  // ブレーキをかけてから止まるまでに進む距離
  brakeDistance(speed) {
    return speed * speed / (2 * CONFIG.holdClaw.brake);
  },

  update(dt) {
    this.time += dt;
    const h = CONFIG.holdClaw;
    const c = Claw.cfg;
    if (Input.wasPressed('KeyR')) this.reset();
    // 終わったあとは「下ろす」でも、もう一度遊べる（ランダムでは、今の景品のまま続けて遊ぶ）
    if (this.session.gameOver && Input.wasPressed('Space')) this.session.continueOr(() => this.reset());

    // 「下ろす」の押した瞬間は、ここで読んで消す（claw.js の idle がそのまま下ろしてしまわないように）
    const pressed = Input.wasPressed('Space');
    switch (this.phase) {
      case 'ready':
        if (pressed && Claw.state === 'idle' && Claw.canDrop() && !this.session.gameOver) {
          this.phase = 'move';
          this.speed = h.startSpeed;
          this.session.help = 'はなすと ブレーキ！';
          Sound.tone(330, 440, 0.12, 'square', 0.05);
        }
        break;

      case 'move':
        // 押している間は、だんだん速くなる
        this.speed = Math.min(h.maxSpeed, this.speed + h.accel * dt);
        Claw.x += this.speed * dt;
        if (!Input.isDown('Space')) {
          this.phase = 'brake';
          this.session.help = '';
          Sound.tone(520, 260, 0.18, 'triangle', 0.06);
        }
        break;

      case 'brake':
        // はなしたあとは、ブレーキをかけて少しすべってから止まる
        this.speed = Math.max(0, this.speed - h.brake * dt);
        Claw.x += this.speed * dt;
        break;
    }
    // 右の端に着いたら、そこで止める（押したままでも、そこで下りる）
    if ((this.phase === 'move' || this.phase === 'brake') && Claw.x >= c.maxX) {
      Claw.x = c.maxX;
      this.speed = 0;
    }
    if ((this.phase === 'move' || this.phase === 'brake') && this.speed <= 0) this.dropClaw();
    if (this.phase === 'move' && Claw.x >= c.maxX) this.dropClaw();
    if (this.phase !== 'ready' && this.phase !== 'claw') {
      this.reach = Math.max(this.reach, Claw.x);
      // 通りすぎた電球に、そのときの速さを覚えさせる
      const i = Math.floor((Claw.x - c.homeX) / h.bulbStep);
      for (let k = this.bulbSpeeds.length; k <= i; k++) this.bulbSpeeds[k] = this.speedRatio();
    }

    // 残像：速いときほど、こまめに位置を覚える
    this.trailTimer += dt;
    if (this.trailTimer >= 0.03) {
      this.trailTimer = 0;
      if (this.speed > h.trailSpeed) this.trail.push({ x: Claw.x, life: 1 });
    }
    for (const t of this.trail) t.life -= dt * 3;
    this.trail = this.trail.filter((t) => t.life > 0);

    Claw.update(dt, Prizes.list);
    // アームが取り出し口から戻ってきたら、また押せるようにする
    if (this.phase === 'claw' && Claw.state === 'idle') this.toReady();

    const chute = CONFIG.chute;
    for (const prize of Prizes.update(dt)) {
      this.session.onCaptured(prize, chute.x + chute.w / 2, chute.y);
    }
    Effects.update(dt);
    this.session.update(dt, Claw.state === 'idle' && this.phase === 'ready', Prizes.list.length);
  },

  // 止まったところで爪を開いて下ろす（claw.js の流れに渡す）
  dropClaw() {
    this.phase = 'claw';
    this.speed = 0;
    Claw.setState('open');
    Claw.report('drop');
  },

  draw() {
    this.drawScene(this.time);
    this.session.drawHud();
  },

  // メニューの背景：筐体とメーターと電球だけを描く（景品とアームは、遊び始めるまで出さない）
  drawPreview(time) {
    const ctx = Render.ctx;
    const saved = this.phase;
    this.phase = 'ready';
    Render.drawMachine(time);
    this.drawMeter(ctx, time);
    this.drawBulbs(ctx, time, true);
    this.phase = saved;
  },

  // 筐体・メーター・電球・景品・アームを描く
  drawScene(time) {
    const ctx = Render.ctx;
    Render.drawMachine(time);
    this.drawMeter(ctx, time);
    this.drawBulbs(ctx, time);
    if (Level.key === 'easy' && (this.phase === 'move' || this.phase === 'brake')) this.drawStopMark(ctx, time);
    Render.drawPrizes(Prizes.list);
    this.drawTrail(ctx);
    Render.drawClaw(Claw);
    Effects.draw(ctx);
  },

  // 進む速さの割合（0〜1）
  speedRatio() {
    return Math.max(0, Math.min(1, this.speed / CONFIG.holdClaw.maxSpeed));
  },

  // 速さに合わせた色（おそい：緑 → 黄色 → はやい：赤）
  speedColor(ratio) {
    const hue = 120 - 120 * ratio;
    return 'hsl(' + hue + ', 90%, 60%)';
  },

  // レールの下に並べた電球。アームが進んだところまで、速さの色で光る。
  // 押すのを待っている間は、左から右へ光が流れて「押してね」と知らせる
  drawBulbs(ctx, time, preview) {
    const c = Claw.cfg;
    const y = CONFIG.case.y + 24;
    const step = CONFIG.holdClaw.bulbStep;
    const min = c.homeX;
    const max = c.maxX;
    const count = Math.floor((max - min) / step);
    const waiting = preview || (this.phase === 'ready' && Claw.state === 'idle');
    const chase = (time * 10) % (count + 6);
    for (let i = 0; i <= count; i++) {
      const x = min + i * step;
      const ratio = i / count;
      const passed = !waiting && this.bulbSpeeds[i] !== undefined;
      const lit = waiting ? Math.abs(i - chase) < 1.5 : passed;
      // 待っている間の流れる光は左から右へ色が変わり、通ったあとは通ったときの速さの色
      ctx.fillStyle = lit ? this.speedColor(passed ? this.bulbSpeeds[i] : ratio) : 'rgba(255, 255, 255, 0.14)';
      ctx.beginPath();
      ctx.arc(x, y, lit ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (lit) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // 取り出し口の上の、速さのメーター（半円の目盛りと針）
  drawMeter(ctx, time) {
    const chute = CONFIG.chute;
    const cx = chute.x + chute.w / 2;
    const cy = chute.y - 28;
    const r = 36;
    // 台
    ctx.fillStyle = 'rgba(26, 23, 48, 0.75)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, Math.PI, 0);
    ctx.lineTo(cx + r + 8, cy + 12);
    ctx.lineTo(cx - r - 8, cy + 12);
    ctx.closePath();
    ctx.fill();
    // 目盛り（左が おそい、右が はやい）
    const ticks = 10;
    for (let i = 0; i <= ticks; i++) {
      const a = Math.PI + Math.PI * i / ticks;
      ctx.strokeStyle = this.speedColor(i / ticks);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    // 針。押すのを待っている間は、少しだけ ふるえて「動くよ」と見せる
    let ratio = this.speedRatio();
    if (this.phase === 'ready') ratio = 0.03 + 0.03 * Math.sin(time * 6);
    const a = Math.PI + Math.PI * ratio;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
    ctx.stroke();
    ctx.fillStyle = this.speedColor(ratio);
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    // 文字
    ctx.fillStyle = CONFIG.colors.text;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('はやさ', cx, cy + 10);
    if (this.phase === 'brake') {
      ctx.fillStyle = '#ff7aa8';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('ブレーキ！', cx, cy - r - 12);
    }
  },

  // 速いときのアームの残像（うすい色で、少し前の位置に描く）
  drawTrail(ctx) {
    if (!this.trail.length) return;
    const real = Claw.x;
    for (const t of this.trail) {
      ctx.globalAlpha = 0.25 * t.life;
      Claw.x = t.x;
      Render.drawClaw(Claw);
    }
    Claw.x = real;
    ctx.globalAlpha = 1;
  },

  // かんたんのときだけ：今はなしたら止まる場所を、床に▼の印で出す
  drawStopMark(ctx, time) {
    const c = Claw.cfg;
    const x = Math.min(c.maxX, Claw.x + this.brakeDistance(this.speed));
    const y = CONFIG.floorY + 14;
    ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(time * 8));
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x - 8, y + 6);
    ctx.lineTo(x + 8, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  },
};
