// ぬしの台：ステップの最後に出る台。大きな「ぬし」は大きすぎてつかめないので、
// アームを当てて体力を減らしていき、0 にすると取り出し口へ転がり落ちてゲットになる。
// 横から見たクラシックと同じ筐体とアームを使う。ぬしは難しさごとに違い、図鑑の「ひみつ」の景品になる。
// クエストでは、章ごとに決めた ぬし（js/quest.js）が出て、体力も章ごとに変わる
const BossMode = {
  key: 'boss',
  session: null,
  time: 0,
  boss: null, // ぬし（取り出し口に落ちたら null）

  start() {
    this.session = new GameSession('boss', { restartHint: 'R か「下ろす」で もういちど' });
    Claw.cfg = Level.apply(CONFIG.claw);
    Claw.autoMove = false;
    this.reset();
    Claw.onResult = (kind) => {
      if (kind === 'drop') this.session.usePlay();
      this.session.onClawEvent(kind, Claw.x, Claw.y + 20);
    };
    // ぬしが倒れて転がっている間は、次を下ろせない
    Claw.canDrop = () => this.session.canPlay() && !(this.boss && this.boss.down);
    Claw.onHit = (target, offset) => this.hit(offset);
  },

  reset() {
    this.session.reset();
    this.session.help = 'ぬしの まんなかを ねらって 下ろそう';
    const b = CONFIG.boss;
    const quest = this.session.quest;
    const hp = quest ? Math.round(b.hp * quest.bossHp) : b.hp;
    this.boss = {
      // ステップでは難しさに合った ひみつの景品、クエストでは その章の ぬし
      type: quest ? PRIZE_SPRITES.findIndex((s) => s.name === quest.bossName) : PRIZE_SPRITES.findIndex((s) => s.secret === Level.key),
      x: 320,
      y: CONFIG.floorY - b.r,
      r: b.r,
      hp: hp,
      maxHp: hp,
      dir: Math.random() < 0.5 ? -1 : 1, // 左右に動く向き
      shake: 0,   // 当たったときに震える時間
      down: false, // 体力が 0 になって、取り出し口へ転がっている
      vx: 0,
      vy: 0,
      angle: 0,
    };
    Prizes.list = [];
    Claw.reset();
    Effects.reset();
  },

  // ぬしが動ける左右の範囲（取り出し口の仕切りより右）
  minX() { return CONFIG.chute.x + CONFIG.chute.w + this.boss.r + 8; },
  maxX() { return CONFIG.case.x + CONFIG.case.w - this.boss.r; },

  // アームが当たったとき。真ん中に近いほど大きく体力を減らし、取り出し口の方へ押し戻す
  hit(offset) {
    const boss = this.boss;
    if (!boss || boss.down) return;
    const b = CONFIG.boss;
    const x = boss.x;
    const y = boss.y - boss.r;
    if (offset > 1) {
      Sound.miss();
      this.session.message = 'かすった…';
      this.session.messageTimer = 2;
      return;
    }
    const damage = Math.max(3, Math.round(b.damage * (1 - offset * 0.8) * b.damageRate[Level.key]));
    boss.hp = Math.max(0, boss.hp - damage);
    boss.shake = 0.4;
    boss.x = Math.max(this.minX(), boss.x - b.push * (1 - offset * 0.5));
    Sound.grab();
    Effects.burst(x, y + 20, offset < 0.25 ? 60 : 25);
    Effects.popup('-' + damage, x + 30, y, offset < 0.25 ? '#ffe066' : '#f4f1ff');
    if (boss.hp === 0) {
      // 体力が 0 になったら、取り出し口へ転がっていく
      boss.down = true;
      boss.vx = -160;
      Sound.clear();
      this.session.message = 'ぬしが まいった！';
      this.session.messageTimer = 3;
    } else {
      this.session.message = offset < 0.25 ? 'クリティカル！' : offset < 0.6 ? 'あたった！' : 'はしっこに あたった';
      this.session.messageTimer = 2;
    }
  },

  updateBoss(dt) {
    const boss = this.boss;
    if (!boss) return;
    boss.shake = Math.max(0, boss.shake - dt);
    if (boss.down) {
      boss.x += boss.vx * dt;
      boss.angle += boss.vx * dt / boss.r;
      const chute = CONFIG.chute;
      // 仕切りを越えたら、取り出し口へ落ちる
      if (boss.x < chute.x + chute.w) {
        boss.vy += CONFIG.prize.gravity * dt;
        boss.y += boss.vy * dt;
      }
      if (boss.y - boss.r > chute.y + 40) {
        this.boss = null;
        this.session.onCaptured({ type: boss.type }, chute.x + chute.w / 2, chute.y);
      }
      return;
    }
    // 左右にゆっくり歩く（アームが下りている間や、当たって震えている間は止まる）
    // ステップでは難しさで、クエストでは章で決めた速さで歩く
    const quest = this.session.quest;
    const speed = quest ? quest.bossSpeed : CONFIG.boss.wanderSpeed[Level.key];
    if (speed > 0 && boss.shake === 0 && (Claw.state === 'idle' || Claw.state === 'return' || Claw.state === 'dropWait' || Claw.state === 'wait' || Claw.state === 'shut')) {
      boss.x += boss.dir * speed * dt;
      if (boss.x >= this.maxX()) { boss.x = this.maxX(); boss.dir = -1; }
      if (boss.x <= this.minX()) { boss.x = this.minX(); boss.dir = 1; }
    }
  },

  // 今押せるキー（画面のボタンの色と、押せないときの入力を捨てるのに使う）
  usableKeys() {
    return Input.usable(Claw.state === 'idle' && Claw.canDrop(), !!this.session.gameOver, ['ArrowLeft', 'ArrowRight']);
  },

  update(dt) {
    this.time += dt;
    if (Input.wasPressed('KeyR')) this.reset();
    if (this.session.gameOver && Input.wasPressed('Space')) this.session.continueOr(() => this.reset());
    const boss = this.boss;
    Claw.update(dt, boss && !boss.down ? [boss] : []);
    this.updateBoss(dt);
    Effects.update(dt);
    this.session.update(dt, Claw.state === 'idle' && !(this.boss && this.boss.down), this.boss ? 1 : 0);
  },

  draw() {
    Render.drawMachine(this.time);
    const boss = this.boss;
    if (boss) {
      const shakeX = boss.shake > 0 ? Math.sin(this.time * 80) * 4 : 0;
      // ふだんは少し上下に弾んで、生きている感じを出す
      const bob = boss.down ? 0 : Math.abs(Math.sin(this.time * 3)) * -4;
      Render.drawPrizeImage(boss.type, boss.x + shakeX, boss.y + bob, Math.round(boss.r * 2.2), boss.down ? boss.angle : 0);
      if (!boss.down) this.drawHpBar(boss);
    }
    Render.drawClaw(Claw);
    Effects.draw(Render.ctx);
    this.session.drawHud();
  },

  // ぬしの体力のゲージ。アームや ぬしと重ならないように、床の部分に名前と一緒に出す
  drawHpBar(boss) {
    const ctx = Render.ctx;
    const x = CONFIG.chute.x + CONFIG.chute.w + 16;
    const w = CONFIG.case.x + CONFIG.case.w - 16 - x;
    const y = CONFIG.floorY + 24;
    const ratio = boss.hp / boss.maxHp;
    ctx.fillStyle = '#f4f1ff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(PRIZE_SPRITES[boss.type].name, x, y - 6);
    ctx.textAlign = 'right';
    ctx.fillText('たいりょく ' + boss.hp + ' / ' + boss.maxHp, x + w, y - 6);
    ctx.fillStyle = '#3d3866';
    ctx.fillRect(x, y, w, 10);
    ctx.fillStyle = ratio > 0.5 ? '#9cf07a' : ratio > 0.25 ? '#ffd23f' : '#ff7a8a';
    ctx.fillRect(x, y, Math.round(w * ratio), 10);
  },
};
