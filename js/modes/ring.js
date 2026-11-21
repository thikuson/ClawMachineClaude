// リングモード：リングをぶら下げたアームを ← → で動かし、スペース（Enter）で下ろす（横から見た画面）
// リングはひもでぶら下がっていて、アームを動かしたり止めたりすると振り子のように揺れる。
// 床には「？」の形のフックが立っている。リングの輪はフックの針金を通り抜けられないが、フックの先（下を向いた端）だけは
// 輪の中にくぐらせられる。先が輪に入ったまま引き上げると、輪がフックの曲がった部分に引っかかってフックが持ち上がり、
// フックとつながったひもが引かれて台が傾き、台に載っている景品が全部取り出し口に流れ込む。
// 取れたら、新しい景品が置かれ、フックの位置・向き（右開き・左開き）・大きさと、リングの大きさも変わって続く
const RingMode = {
  key: 'ring',
  session: null,
  time: 0,
  STEP: 1 / 240, // 揺れの計算の細かさ（秒）。速く動いてもフックをすり抜けないように、1 フレームを何回かに分けて計算する

  // リングをぶら下げたアーム（本体の位置。リングの位置は ring にある）
  arm: {
    state: 'idle', // idle / down / settle / up / return / wait
    x: 0,
    y: 0,
    timer: 0,
    result: '',     // この回の結果（hook / rim / miss）
    slipAt: -1,     // 引っかかってから外れるまでの時間（-1 なら外れない）
    carryTime: 0,
  },

  // リング。x, y は輪の中心、px, py は 1 回前の計算での位置（いまの位置との差が速さになる）
  // mode は free（フックにかかっていない）/ entering（フックの先が輪をくぐっている途中）/ hooked（引っかかっている）。
  // ghost の間は、フックと当たらない（外れた直後など、輪とフックが重なっているときに、変にはじかれないようにする）
  ring: { x: 0, y: 0, px: 0, py: 0, mode: 'free', ghost: false, touched: false, scale: 1 },

  // 床に立っている「？」のフック。x は柱（輪の中心の真下）の位置、lifted は引き上げられた高さ。
  // dir は向き（1 なら柱が左で先が右に垂れる。-1 はその左右反対）、scale は大きさ（中を 1 とする）
  target: { x: 0, lifted: 0, liftedPrev: 0, dir: 1, scale: 1 },

  // 傾く台と、載っている景品
  tray: { angle: 0, opening: false, closing: false, refillTimer: 0 },
  prizes: [], // 台の上の景品 { type, r, s（台の軸からの距離）, v, falling, x, y, vx, vy, angle }

  start() {
    this.session = new GameSession('ring', { restartHint: 'R か「下ろす」で もういちど', showSwing: false });
    this.reset();
  },

  reset() {
    this.session.reset();
    this.session.help = 'リングを フックの さきに くぐらせよう';
    Effects.reset();
    const a = this.arm;
    a.state = 'idle';
    a.x = this.homeX();
    a.y = CONFIG.claw.homeY;
    a.timer = 0;
    this.tray.angle = 0;
    this.tray.opening = false;
    this.tray.closing = false;
    this.tray.refillTimer = 0;
    this.setUp(); // フックの形（先の向き）は難しさで変わるので、ここで作り直す
    this.hangRing();
  },

  // リングを、揺れていない状態でアームの真下にぶら下げる
  hangRing() {
    const r = this.ring;
    const p = this.pivot();
    r.x = r.px = p.x;
    r.y = r.py = p.y + this.stringReach();
    r.mode = 'free';
    r.ghost = false;
    r.touched = false;
  },

  // 新しい景品を台に載せ、フックを立て直す
  setUp() {
    const g = CONFIG.ring;
    const p = CONFIG.prize;
    const normalTypes = [];
    PRIZE_SPRITES.forEach((s, i) => { if (!s.rare && !s.secret) normalTypes.push(i); });
    normalTypes.sort(() => Math.random() - 0.5);
    const types = normalTypes.slice(0, g.prizeCount);
    if (Math.random() < p.rareChance) types[0] = PRIZE_SPRITES.findIndex((s) => s.rare);
    // 台の上に、軸に近い方から等間隔に並べる
    const gap = g.trayLength / g.prizeCount;
    this.prizes = types.map((type, i) => ({
      type,
      r: 17 + Math.random() * 3,
      s: gap * (i + 0.5),
      v: 0,
      falling: false,
      x: 0, y: 0, vx: 0, vy: 0,
      angle: 0,
    }));

    // フックの位置・向き・大きさと、リングの大きさを毎回ランダムに変える
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const t = this.target;
    t.x = g.hookMinX + Math.random() * (g.hookMaxX - g.hookMinX);
    t.dir = Math.random() < 0.5 ? 1 : -1;
    t.scale = pick(g.sizes);
    this.ring.scale = pick(g.sizes);
    t.lifted = 0;
    t.liftedPrev = 0;
    this.buildHook();
    this.updateTray(0); // 景品を台の上の位置に置く（メニューの背景に出すときも、すぐ正しい位置に見えるように）
  },

  // 難しさごとの設定
  levelSettings() {
    return CONFIG.ring.levels[Level.key] || CONFIG.ring.levels.normal;
  },

  // ひもを下げる棒の先（リングの揺れの支点）
  pivot() {
    return { x: this.arm.x, y: this.arm.y + CONFIG.ring.armLength };
  },

  // いまのリングの半径（針金の中心まで）
  ringR() {
    return CONFIG.ring.ringR * this.ring.scale;
  },

  // 支点からリングの中心までの長さ（ひもの長さ＋リングの半径）
  stringReach() {
    return CONFIG.ring.stringLen + this.ringR();
  },

  // アームがいちばん下まで下りたときの本体の高さ。ぶら下がったリングが、床にちょうど着くところ
  lowestY() {
    const g = CONFIG.ring;
    return CONFIG.floorY - this.ringR() - g.ringWire - this.stringReach() - g.armLength + 2;
  },

  // アームの初期位置（引き上げたあとに戻る位置）。景品は台から取り出し口へ流れ込むので、取り出し口の上までは行かず、
  // 動ける範囲の左端にする。範囲の外に戻すと、次に動かしたときに範囲の端へ飛んで見えてしまうため
  homeX() {
    return this.armRange().min;
  },

  // アームが動ける左右の範囲。リングが台や景品の上に下りないように、左は台の右端より右にする。
  // リングの大きさが変わっても初期位置が動かないように、いちばん大きいリングで決める
  armRange() {
    const g = CONFIG.ring;
    return {
      min: g.trayX + g.trayLength + g.ringR * Math.max(...g.sizes) + g.ringWire + 6,
      max: CONFIG.claw.maxX,
    };
  },

  // 「？」の形のフックの針金を、根元からフックの先まで細かい点の並びにしておく（柱の位置を x の原点、y は床が基準）。
  // s は根元からの長さ。リングとの当たり判定にも、描くのにも使う。左右反対の向きのときは、x を反対にする
  buildHook() {
    const g = CONFIG.ring;
    const t = this.target;
    const r = g.curlR * t.scale;
    const bottomY = -g.postHeight;   // 柱のいちばん上（輪のいちばん下）の高さ。床からの高さはマイナス
    const cy = bottomY - r;          // 輪の中心の高さ
    const pts = [];
    const baseY = -8;                // 台座の上
    // 柱（台座から真上へ、輪のいちばん下まで）
    for (let y = baseY; y > bottomY; y -= 4) pts.push({ x: 0, y });
    // 輪（いちばん下から左を通って上へ回り、右で先が下を向く。円の 3/4）
    const start = Math.PI / 2;
    const end = Math.PI * (2 + this.levelSettings().tipAngle);
    const steps = Math.ceil((end - start) * r / 2);
    for (let i = 0; i <= steps; i++) {
      const a = start + (end - start) * i / steps;
      pts.push({ x: Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    if (t.dir < 0) pts.forEach((p) => { p.x = -p.x; });
    let s = 0;
    pts.forEach((p, i) => {
      if (i > 0) s += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      p.s = s;
    });
    const n = pts.length;
    const dx = pts[n - 1].x - pts[n - 2].x;
    const dy = pts[n - 1].y - pts[n - 2].y;
    const len = Math.hypot(dx, dy);
    this.hook = { pts, length: s, cy, tipDir: { x: dx / len, y: dy / len } };
  },

  // フックのいまの位置での、点 i の画面上の座標
  hookPoint(i) {
    const p = this.hook.pts[i];
    return { x: this.target.x + p.x, y: CONFIG.floorY - this.target.lifted + p.y };
  },

  // フックの先（端）の位置
  hookTip() {
    return this.hookPoint(this.hook.pts.length - 1);
  },

  // 床からフックのいちばん上までの高さ。柱の高さはどの大きさでも同じで、輪の大きさの分だけ高くなる
  hookHeight() {
    const g = CONFIG.ring;
    return g.postHeight + g.curlR * this.target.scale * 2 + g.hookWire;
  },

  // フックの柱の x 座標（輪の真下）
  hookPostX() {
    return this.target.x;
  },

  // フックのいちばん上の高さ。引き上げられると上がる
  hookTopY() {
    return CONFIG.floorY - this.hookHeight() - this.target.lifted;
  },

  // 点 (x, y) にいちばん近い、フックの針金の上の点。dist はその距離、s は根元からの長さ
  closestOnHook(x, y) {
    const pts = this.hook.pts;
    const ox = this.target.x;
    const oy = CONFIG.floorY - this.target.lifted;
    let best = null;
    for (let i = 1; i < pts.length; i++) {
      const ax = ox + pts[i - 1].x, ay = oy + pts[i - 1].y;
      const bx = ox + pts[i].x, by = oy + pts[i].y;
      const ex = bx - ax, ey = by - ay;
      const len2 = ex * ex + ey * ey;
      let u = ((x - ax) * ex + (y - ay) * ey) / len2;
      u = Math.max(0, Math.min(1, u));
      const qx = ax + ex * u, qy = ay + ey * u;
      const d = Math.hypot(x - qx, y - qy);
      if (!best || d < best.dist) best = { x: qx, y: qy, dist: d, s: pts[i - 1].s + (pts[i].s - pts[i - 1].s) * u };
    }
    return best;
  },

  update(dt) {
    this.time += dt;
    if (Input.wasPressed('KeyR')) this.reset();
    // 終わったあとは「下ろす」で、もう一度遊べる（ランダムでは、今の景品のまま続けて遊ぶ）
    if (this.session.gameOver && Input.wasPressed('Space')) {
      this.session.continueOr(() => this.reset());
      return;
    }
    this.updateArm(dt);
    this.updateTarget(dt);
    this.updateTray(dt);
    Effects.update(dt);
    // 景品は取れるたびに置き直すので、「景品がなくなって終わり」にはしない（残り数は常に 1 以上として渡す）
    this.session.update(dt, this.arm.state === 'idle' && !this.busy(), 1);
  },

  // 台が傾いている途中や、景品を置き直す前は、まだ次を遊ばせない（終了の判定も待つ）
  busy() {
    const t = this.tray;
    return t.opening || t.closing || t.refillTimer > 0;
  },

  updateArm(dt) {
    const a = this.arm;
    const c = CONFIG.claw;
    const g = CONFIG.ring;
    const ring = this.ring;
    a.timer += dt;

    // アーム（支点）を動かしながら、リングの揺れを細かく分けて計算する
    const steps = Math.max(1, Math.ceil(dt / this.STEP));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.moveArm(h);
      this.stepRing(h);
    }

    switch (a.state) {
      case 'idle':
        if (Input.wasPressed('Space') && this.session.canPlay() && !this.busy()) {
          this.session.usePlay();
          Sound.drop();
          a.result = '';
          ring.touched = false;
          // 下ろし始めに、リングが少し横に揺れ出す（真下にまっすぐは下りない）
          const kick = (Math.random() * 2 - 1) * g.dropKick * h;
          ring.px -= kick;
          this.setArm('down');
        }
        break;

      case 'down': {
        // いつも同じ深さ（リングが床に届くところ）まで下りる。途中でリングがフックに載っても止まらないので、
        // ひもがゆるんだリングはフックの肩をすべり落ちる
        if (a.y >= this.lowestY()) {
          a.y = this.lowestY();
          this.setArm('settle');
        }
        break;
      }

      case 'settle':
        // 少し止まってから引き上げる。止まっている間もリングは揺れている
        if (a.timer >= g.settleTime) this.setArm('up');
        break;

      case 'up':
        this.checkRingSlip(dt);
        if (a.y <= c.homeY) {
          a.y = c.homeY;
          if (ring.mode === 'hooked') this.releaseRing();
          if (!a.result) {
            a.result = ring.touched ? 'rim' : 'miss';
            Sound.miss();
            this.session.showMessage(ring.touched ? 'ringRim' : 'miss');
          }
          this.setArm('return');
        }
        break;

      case 'return':
        if (a.x === this.homeX()) this.setArm('wait');
        break;

      case 'wait':
        if (a.timer >= 0.4) this.setArm('idle');
        break;
    }
  },

  // 状態に合わせて、アームの本体を少しだけ動かす（揺れの計算の 1 回分）
  moveArm(h) {
    const a = this.arm;
    const c = CONFIG.claw;
    const range = this.armRange();
    switch (a.state) {
      case 'idle':
        if (Input.isDown('ArrowLeft')) a.x -= c.moveSpeed * h;
        if (Input.isDown('ArrowRight')) a.x += c.moveSpeed * h;
        a.x = Math.max(range.min, Math.min(range.max, a.x));
        break;
      case 'down':
        a.y = Math.min(this.lowestY(), a.y + c.downSpeed * h);
        break;
      case 'up':
        a.y = Math.max(c.homeY, a.y - c.upSpeed * h);
        break;
      case 'return': {
        const home = this.homeX();
        const dir = Math.sign(home - a.x);
        a.x += dir * c.returnSpeed * h;
        if ((dir < 0 && a.x <= home) || (dir > 0 && a.x >= home)) a.x = home;
        break;
      }
    }
  },

  setArm(next) {
    this.arm.state = next;
    this.arm.timer = 0;
  },

  // リングとフックを、時間 h だけ進める
  stepRing(h) {
    const g = CONFIG.ring;
    const ring = this.ring;
    const t = this.target;
    const gravity = CONFIG.prize.gravity;
    // リング：いまの速さに重力を足して進める。damping の分だけ揺れが少しずつおさまる
    const keep = Math.max(0, 1 - this.levelSettings().damping * h);
    const vx = (ring.x - ring.px) * keep;
    const vy = (ring.y - ring.py) * keep;
    ring.px = ring.x;
    ring.py = ring.y;
    ring.x += vx;
    ring.y += vy + gravity * h * h;
    // フック：持ち上げられていれば、重さで下に戻ろうとする
    const lv = t.lifted - t.liftedPrev;
    t.liftedPrev = t.lifted;
    t.lifted += lv - gravity * h * h;
    if (t.lifted <= 0) t.lifted = t.liftedPrev = 0;

    // ひも・フック・床と壁の決まりを、何回か繰り返して全部に合わせる
    for (let k = 0; k < 3; k++) {
      this.keepString();
      this.collideHook();
      this.keepInCase();
    }
    if (t.lifted > g.maxLift) t.lifted = g.maxLift;
  },

  // ひもは伸びないので、リングは支点からひもの長さより遠くへは行けない（ゆるむのはよい）
  keepString() {
    const ring = this.ring;
    const p = this.pivot();
    const dx = ring.x - p.x;
    const dy = ring.y - p.y;
    const d = Math.hypot(dx, dy);
    const L = this.stringReach();
    if (d > L) {
      ring.x = p.x + dx * L / d;
      ring.y = p.y + dy * L / d;
    }
  },

  // リングは床より下へ行かず、ケースの壁からはみ出さない
  keepInCase() {
    const g = CONFIG.ring;
    const ring = this.ring;
    const outer = this.ringR() + g.ringWire;
    const box = CONFIG.case;
    const floor = CONFIG.floorY - outer;
    if (ring.y > floor) {
      ring.y = floor;
      ring.py = floor; // 床に当たったら縦の速さはなくなる
      ring.px = ring.x - (ring.x - ring.px) * 0.9; // 床とこすれて横の速さも少し落ちる
    }
    ring.x = Math.max(box.x + outer, Math.min(box.x + box.w - outer, ring.x));
  },

  // リングの輪とフックの針金の当たり方
  collideHook() {
    const g = CONFIG.ring;
    const ring = this.ring;
    const lv = this.levelSettings();
    const R = this.ringR();
    const touch = g.ringWire + g.hookWire; // 針金どうしが触れる距離（太さの半分の和）
    const q = this.closestOnHook(ring.x, ring.y);
    if (q.dist < 1e-6) return;
    const nx = (ring.x - q.x) / q.dist; // フックから輪の中心へ向かう向き
    const ny = (ring.y - q.y) / q.dist;
    const tipDir = this.hook.tipDir;
    const atTip = q.s >= this.hook.length - lv.tipZone; // フックの先のあたりに触れているか

    if (ring.ghost) {
      // 外れた直後などで重なっているときは、離れきるまで当たらない
      if (q.dist > R + touch + 1) ring.ghost = false;
      return;
    }

    if (ring.mode === 'free') {
      if (q.dist >= R + touch) return; // 触れていない
      if (q.dist < R - touch) { ring.ghost = true; return; } // 急に重なった（すり抜け）ときは、変にはじかない
      // フックの先に、輪が先の正面から（先の向きと逆の向きへ動いて）かぶさってきたら、先が輪の中へくぐる
      const vx = ring.x - ring.px;
      const vy = ring.y - ring.py;
      const facing = nx * tipDir.x + ny * tipDir.y;
      const moving = vx * tipDir.x + vy * tipDir.y;
      if (atTip && facing > lv.tipFacing && moving < 0) {
        ring.mode = 'entering';
        return;
      }
      // それ以外は、輪の針金がフックの針金に当たって押し返される（輪は外側へすべる）
      ring.x = q.x + nx * (R + touch);
      ring.y = q.y + ny * (R + touch);
      if (!ring.touched && this.arm.state === 'down') {
        Effects.popup('カツン', q.x, q.y - 14, '#6fd3ff');
        Sound.tone(900, 600, 0.06, 'square', 0.05);
      }
      ring.touched = true;
      return;
    }

    if (ring.mode === 'entering') {
      // くぐっている途中。先が輪の内側まで入ったら引っかかり、抜けて離れたら元に戻る
      const tip = this.hookTip();
      if (Math.hypot(ring.x - tip.x, ring.y - tip.y) <= R - touch) this.hookRing();
      else if (q.dist >= R + touch) ring.mode = 'free';
      else if (!atTip) {
        // 先からずれて、フックの横に輪の針金が当たった。くぐるのはやめて、押し返される
        ring.mode = 'free';
        ring.x = q.x + nx * (R + touch);
        ring.y = q.y + ny * (R + touch);
      }
      return;
    }

    // 引っかかっている：フックの針金は輪の内側から出られない。
    // ただし、フックの先の方へずれて、先から輪が抜けてしまったら外れる
    if (q.dist <= R - touch) return;
    const tip = this.hookTip();
    const beyondTip = q.s >= this.hook.length - 0.01 && (ring.x - tip.x) * tipDir.x + (ring.y - tip.y) * tipDir.y > 0;
    if (beyondTip) {
      this.slipRing();
      return;
    }
    // 輪の内側のふちがフックを引っぱる。リングとフックの重さの比で、両方が動く（フックは上下にしか動かない）
    const over = q.dist - (R - touch);
    const ringShare = g.hookMass / (1 + g.hookMass);
    ring.x -= nx * over * ringShare;
    ring.y -= ny * over * ringShare;
    const t = this.target;
    t.lifted = Math.max(0, t.lifted - ny * over * (1 - ringShare));
  },

  // フックの先が輪をくぐって、リングが引っかかった
  hookRing() {
    const a = this.arm;
    const ring = this.ring;
    ring.mode = 'hooked';
    a.result = 'hook';
    a.carryTime = 0;
    a.slipAt = Math.random() < this.levelSettings().slip ? 0.15 + Math.random() * 0.3 : -1;
    Sound.grab();
    this.session.showMessage('hook');
  },

  // 引き上げる途中で、リングがフックから外れた
  slipRing() {
    const ring = this.ring;
    ring.mode = 'free';
    ring.ghost = true;
    if (this.arm.result === 'hook') this.arm.result = 'slip';
    Sound.slip();
    this.session.showMessage('ringOff');
    Effects.popup('おしい！', this.target.x, this.hookTopY() - 20, '#6fd3ff');
  },

  // 台が傾いたあと、フックが上がりきったら（またはアームが上まで来たら）、リングがフックから抜けて、フックは床へ戻る
  releaseRing() {
    this.ring.mode = 'free';
    this.ring.ghost = true;
  },

  // 引っかかってから台が傾くまでの間に、たまにリングが外れる（難しさで外れやすさが変わる）
  checkRingSlip(dt) {
    const a = this.arm;
    if (this.ring.mode !== 'hooked' || this.tray.opening || this.tray.angle > 0) return;
    a.carryTime += dt;
    if (a.slipAt >= 0 && a.carryTime >= a.slipAt) this.slipRing();
  },

  // フックが引き上げられてひもが張ったら、台の留め具が外れて台が傾く。上がりきったら、リングが抜ける
  updateTarget() {
    const g = CONFIG.ring;
    const t = this.target;
    if (this.ring.mode !== 'hooked') return;
    if (t.lifted >= g.pullToOpen && !this.tray.opening && this.tray.angle === 0 && this.prizes.length) {
      this.tray.opening = true;
      Sound.clear();
    }
    if (t.lifted >= g.maxLift - 0.5) this.releaseRing();
  },

  // 台の軸の位置と、台の向き（軸から右端へ向かう単位ベクトル）
  trayFrame() {
    const g = CONFIG.ring;
    const a = this.tray.angle;
    return {
      px: g.trayX, py: g.trayY,
      dx: Math.cos(a), dy: -Math.sin(a), // 傾くと右端が持ち上がる
      nx: -Math.sin(a), ny: -Math.cos(a), // 台の上面に垂直な、上向きの向き
    };
  },

  updateTray(dt) {
    const g = CONFIG.ring;
    const t = this.tray;
    const gravity = CONFIG.prize.gravity;
    if (t.opening) t.angle = Math.min(g.openAngle, t.angle + dt * 1.6);

    const f = this.trayFrame();
    const chute = CONFIG.chute;
    for (const p of this.prizes) {
      if (!p.falling) {
        // 台が傾いている間は、軸の方（左下）へすべり落ちる
        if (t.angle > 0) {
          p.v += gravity * Math.sin(t.angle) * dt;
          p.s -= p.v * dt;
          if (PRIZE_SPRITES[p.type].round) p.angle -= p.v * dt / p.r;
        }
        p.x = f.px + f.dx * p.s + f.nx * p.r;
        p.y = f.py + f.dy * p.s + f.ny * p.r;
        if (p.s < 0) {
          // 台の端から落ちて、取り出し口へ
          p.falling = true;
          p.vx = -p.v * Math.cos(t.angle);
          p.vy = p.v * Math.sin(t.angle);
        }
      } else {
        p.vy += gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // 取り出し口の左右の壁からはみ出さない
        p.x = Math.max(chute.x + p.r, Math.min(chute.x + chute.w - p.r, p.x));
      }
    }

    // 取り出し口に十分落ちた景品を獲得にする
    this.prizes = this.prizes.filter((p) => {
      const captured = p.falling && p.y - p.r > chute.y + 10;
      if (captured) this.session.onCaptured(p, chute.x + chute.w / 2, chute.y);
      return !captured;
    });

    // 全部落ちたら台を戻し、少し待ってから新しい景品を置き、フックを立て直す
    if (t.opening && this.prizes.length === 0) {
      t.opening = false;
      t.closing = true;
    }
    if (t.closing) {
      t.angle = Math.max(0, t.angle - dt * 0.8);
      if (t.angle === 0 && this.ring.mode !== 'hooked' && this.target.lifted === 0) {
        t.closing = false;
        t.refillTimer = 0.8;
      }
    }
    if (t.refillTimer > 0) {
      t.refillTimer -= dt;
      if (t.refillTimer <= 0) {
        t.refillTimer = 0;
        this.setUp();
        this.hangRing(); // リングの大きさが変わるので、ぶら下げ直す
      }
    }
  },

  draw() {
    this.drawScene(this.time);
    this.drawArm();
    Effects.draw(Render.ctx);
    this.session.drawHud();
  },

  // 筐体・台・景品・フック・ひもを描く。メニューの背景にも使う（アームと文字は描かない）
  drawScene(time) {
    const ctx = Render.ctx;
    const g = CONFIG.ring;
    Render.drawMachine(time);

    // 台を支える柱（台の右端の下）と、ひもの留め具
    const postX = g.trayX + g.trayLength - 10;
    ctx.fillStyle = '#8f89b8';
    ctx.fillRect(postX - 4, g.trayY + 6, 8, CONFIG.floorY - g.trayY - 6);
    const pinY = CONFIG.floorY - 14;
    ctx.fillStyle = '#f2c94c';
    ctx.fillRect(postX - 6, pinY - 4, 12, 8);

    // 台（軸を中心に回して描く）
    ctx.save();
    ctx.translate(g.trayX, g.trayY);
    ctx.rotate(-this.tray.angle);
    ctx.fillStyle = '#c9c4e8';
    ctx.fillRect(0, 0, g.trayLength, 8);
    ctx.fillStyle = '#8f89b8';
    ctx.fillRect(g.trayLength - 6, -14, 6, 14); // 右端のストッパー
    ctx.restore();
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(g.trayX, g.trayY + 4, 5, 0, Math.PI * 2); // 軸
    ctx.fill();

    // 景品
    for (const p of this.prizes) Render.drawPrizeImage(p.type, p.x, p.y, Math.round(p.r * 2.2), p.angle);

    // フックの台座
    const t = this.target;
    ctx.fillStyle = '#8f89b8';
    const footX = this.hookPostX();
    ctx.fillRect(Math.round(footX) - 12, CONFIG.floorY - 8, 24, 8);

    // 留め具とフックの根元をつなぐひも。フックを引き上げるほど張る
    const footY = CONFIG.floorY - 8 - t.lifted;
    const taut = Math.min(1, t.lifted / g.pullToOpen);
    ctx.strokeStyle = '#ff7aa8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(footX, footY);
    ctx.quadraticCurveTo((footX + postX) / 2, CONFIG.floorY - 2 - taut * 20, postX + 6, pinY);
    ctx.stroke();

    this.drawTargetHook(ctx);
  },

  // 「？」の形のフック（柱と、上の円の 3/4 の輪）
  drawTargetHook(ctx) {
    const g = CONFIG.ring;
    ctx.strokeStyle = '#d9d6f0';
    ctx.lineWidth = g.hookWire * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    this.hook.pts.forEach((p, i) => {
      const q = this.hookPoint(i);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  },

  // アームとリング。フックより手前にリングが重なるように、シーンのあとに描く
  drawArm() {
    const ctx = Render.ctx;
    const c = CONFIG.colors;
    const g = CONFIG.ring;
    const a = this.arm;
    const ring = this.ring;
    const box = CONFIG.case;
    const railY = box.y + 13;
    const headTop = a.y - 10;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, 0, box.w, CONFIG.height);
    ctx.clip();

    ctx.strokeStyle = c.cable;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, railY);
    ctx.lineTo(a.x, headTop);
    ctx.stroke();
    ctx.fillStyle = c.clawDark;
    ctx.fillRect(Math.round(a.x) - 16, railY - 7, 32, 12);

    // リングを下げる棒と、リングの上のふちへつながるひも
    const p = this.pivot();
    ctx.strokeStyle = c.claw;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + 4);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    const dx = p.x - ring.x;
    const dy = p.y - ring.y;
    const d = Math.hypot(dx, dy) || 1;
    ctx.strokeStyle = c.cable;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(ring.x + dx / d * this.ringR(), ring.y + dy / d * this.ringR());
    ctx.stroke();

    // リング（まん丸の輪）
    this.drawRing(ctx);

    // フックが輪を通っているときは、輪の先の側の半分（右開きなら右半分）だけフックを輪の手前に描き直して、輪にくぐっているように見せる
    if (ring.mode !== 'free') {
      const outer = this.ringR() + g.ringWire + 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.target.dir > 0 ? ring.x : ring.x - outer, ring.y - outer, outer, outer * 2);
      ctx.clip();
      this.drawTargetHook(ctx);
      ctx.restore();
    }

    const img = Render.clawHeadImage;
    ctx.drawImage(img, Math.round(a.x - img.width * 1.5), Math.round(headTop - 2), img.width * 3, img.height * 3);
    ctx.restore();
  },

  // リングの輪。金色の針金に、左上に光った筋を入れる
  drawRing(ctx) {
    const g = CONFIG.ring;
    const ring = this.ring;
    const R = this.ringR();
    ctx.strokeStyle = '#b8901c';
    ctx.lineWidth = g.ringWire * 2 + 1;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = g.ringWire * 2 - 1;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, R, Math.PI * 1.05, Math.PI * 1.45);
    ctx.stroke();
  },
};
