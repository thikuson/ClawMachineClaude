// らせんタワー：横から見た筐体で、ほかの台とは左右が逆（左にタワー、右に取り出し口）。
// アームは左右に動かせず、いつも真ん中で待っている。使うのは、左の「おとす」①②③（1・2・3 キー）と、右の「下ろす」（スペース）だけ。
// 左側の床が「＼」の坂になっていて、坂の上（左端）に、らせんの坂が巻き付いたタワーが立っている。
// 景品はタワーのらせんの上の方に積んであり、「おとす」のどれかを押すと、いちばん下の景品が らせんを回りながら下りてきて、
// 坂を右へ転がってくる。おりてくる速さ（おそい・ふつう・はやい）は、押すたびにランダムに決まる（どのボタンがどの速さかは、毎回入れかわる）。
// 転がってくる景品が爪の間に入るタイミングでアームを下ろすと、つかめる。つかんだら右の取り出し口へ運んで離し、真ん中へ戻る。爪は坂に下りているあいだ壁になるので、
// 早すぎると景品は爪の外で止められ、遅すぎると通りすぎる。
// 坂の下まで転がった景品は「もどり口」に落ちて、タワーの上へ戻る（なくならない）。設定は CONFIG.spiral
const SpiralMode = {
  key: 'spiral',
  session: null,
  time: 0,
  tower: [],   // タワーに積んである景品（0 がいちばん下）。{ type, r, u（らせんの位置：下から何周目か）, angle }
  moving: [],  // タワーから出た景品。mode は spiral（らせんを下りる）・roll（坂を転がる）・fall（落ちる）・held（アームがつかんでいる）・back（もどり口からタワーへ戻るところ）
  dropKeys: ['Digit1', 'Digit2', 'Digit3'], // 「おとす」ボタン ①②③ のキー

  cfg() { return CONFIG.spiral; },
  lv() { return CONFIG.spiral.levels[Level.key] || CONFIG.spiral.levels.normal; },

  // メニューの背景に出せるように、景品を積んだタワーを作っておく
  setUp() {
    this.fillTower();
  },

  start() {
    this.session = new GameSession('spiral', { restartHint: 'R か「下ろす」で もういちど' });
    Claw.cfg = Level.apply(Object.assign({}, CONFIG.claw, this.cfg().claw));
    Claw.autoMove = false;
    Claw.floorAt = (x) => this.clawFloor(x);
    this.reset();
    Claw.onResult = (kind) => {
      if (kind === 'drop') this.session.usePlay();
      this.session.onClawEvent(kind, Claw.x, Claw.y + 20);
      if (kind === 'grab') this.checkJust();
    };
    Claw.canDrop = () => this.session.canPlay();
  },

  reset() {
    this.session.reset();
    this.fillTower();
    Claw.reset();
    Effects.reset();
  },

  // タワーに景品を積む。種類はクラシックと同じく、かたよらないように混ぜて選び、たまにレア景品を混ぜる
  fillTower() {
    const s = this.cfg();
    const normal = [];
    PRIZE_SPRITES.forEach((sp, i) => { if (!sp.rare && !sp.secret) normal.push(i); });
    normal.sort(() => Math.random() - 0.5);
    const types = [];
    for (let i = 0; i < s.prizeCount; i++) types.push(normal[i % normal.length]);
    if (Math.random() < CONFIG.prize.rareChance) types[0] = PRIZE_SPRITES.findIndex((sp) => sp.rare);
    types.sort(() => Math.random() - 0.5);
    this.tower = types.map((type, i) => ({ type, r: s.prizeRadius, u: this.slotU(i), angle: 0 }));
    this.moving = [];
  },

  // タワーの i 番目（0 がいちばん下）の景品を置く、らせんの位置
  slotU(i) {
    const t = this.cfg().tower;
    return t.storeBase + i * t.slotGap;
  },

  // ---- 形（坂・もどり口・タワー） ----

  // 坂と台の上の面の高さ。もどり口と取り出し口の上には床がないので null
  ground(x) {
    const sl = this.cfg().slope;
    if (x > sl.xBottom) return null;
    if (x > sl.xTop) return sl.topY + (x - sl.xTop) * this.slopeRate();
    return sl.topY;
  },

  // 坂のかたむき（横に 1 進むと、下がる高さ）
  slopeRate() {
    const sl = this.cfg().slope;
    return (CONFIG.floorY - sl.topY) / (sl.xBottom - sl.xTop);
  },

  // アームが下りられる高さ。坂の上では爪の真ん中の真下の面まで（上り側の爪の先は坂の面にもぐるが、坂を手前に描き直して隠す）
  clawFloor(x) {
    const g = this.ground(x);
    return g === null ? CONFIG.floorY : g;
  },

  // らせんの位置 u（下から何周目か）にある景品の、画面上の位置と奥行き（depth：1 で手前、-1 で奥）
  helixPos(u, r) {
    const t = this.cfg().tower;
    const a = u * Math.PI * 2; // u = 0（いちばん下の出口）で柱の右
    return {
      x: t.poleX + t.radius * Math.cos(a),
      y: this.cfg().slope.topY - r - u * t.pitch,
      depth: Math.sin(a),
    };
  },

  // ---- 遊びの進行 ----

  // 「おとす」を押せるか。景品が動いているあいだと、アームが真ん中に戻って待つまでは、次の景品は出さない（1 こずつ ねらう）。
  // 回数が残っていないなら、出しても取れないので出さない
  canRelease() {
    if (this.session.gameOver || !this.tower.length) return false;
    if (this.busy()) return false;
    return Claw.state === 'idle' && this.session.canPlay();
  },

  // 1 回押すと、タワーの下から CONFIG.spiral.perRelease こ（残りが少なければ残り全部）を、同じ速さで続けて出す。
  // 積んである間かくのまま らせんを下りるので、少しずつ間をあけて転がってくる。
  // おりてくる速さは、どのボタンを押しても、3 つの速さからランダムに選ぶ（押すたびに、どのボタンがどの速さかが入れかわるのと同じ）。
  // 速さは画面には出さないので、らせんを下りる様子を見てタイミングを決める。button は押したボタンの番号（0〜2）
  release(button) {
    const speeds = this.cfg().speeds;
    const rate = speeds[Math.floor(Math.random() * speeds.length)];
    const count = Math.min(this.cfg().perRelease, this.tower.length);
    for (const p of this.tower.splice(0, count)) {
      p.mode = 'spiral';
      p.rate = rate;
      this.moving.push(p);
    }
    Sound.drop();
    this.flashButton(button);
  },

  // 押した「？」ボタンを、少しのあいだ光らせる（css の .picked）
  flashButton(button) {
    const btn = document.querySelector('#controls-spiral [data-key="' + this.dropKeys[button] + '"]');
    if (!btn) return;
    btn.classList.remove('picked');
    void btn.offsetWidth; // 続けて押したときも、光る動きを最初からやり直す
    btn.classList.add('picked');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => btn.classList.remove('picked'), 900);
  },

  // ジャスト判定：爪の先が景品の高さまで下りた瞬間に、景品が爪の真ん中近くにいたら「ジャスト！」と出す（点数やコインは変わらない）。
  // 爪は閉じるときに景品を真ん中へ寄せるので、つかんだときの位置ではなく、爪の間に入った瞬間の位置（blockByClaw の entry）で決める
  checkJust() {
    const p = Claw.held;
    if (!p || p.entry === undefined || p.entry > this.cfg().justRange) return;
    Effects.popup('ジャスト！', Claw.headX(), Claw.tipY() - 60, '#ffe066');
    Effects.burst(Claw.headX(), Claw.tipY() - 20, 40);
    Sound.clear();
  },

  // 景品がタワーから出て動いているか（戻っているところは数えない）
  busy() {
    return this.moving.some((p) => p.mode !== 'back');
  },

  usableKeys() {
    const over = !!this.session.gameOver;
    const keys = Input.usable(Claw.state === 'idle' && Claw.canDrop(), over); // アームは左右に動かせない
    const can = this.canRelease();
    for (const code of this.dropKeys) keys[code] = can;
    return keys;
  },

  update(dt) {
    this.time += dt;
    if (Input.wasPressed('KeyR')) this.reset();
    if (this.session.gameOver && Input.wasPressed('Space')) this.session.continueOr(() => this.reset());
    this.dropKeys.forEach((code, i) => {
      if (Input.wasPressed(code) && this.canRelease()) this.release(i);
    });

    // アームがつかめるのは、坂を転がっている景品と、落ちている景品だけ
    Claw.update(dt, this.moving.filter((p) => p.mode === 'roll' || p.mode === 'fall' || p.mode === 'held'));
    this.updateTower(dt);
    this.updatePrizes(dt);
    this.separatePrizes();
    Effects.update(dt);
    this.updateHelp();
    const left = this.tower.length + this.moving.length;
    this.session.update(dt, Claw.state === 'idle' && !this.busy(), left);
  },

  // 状態に合わせた操作の案内
  updateHelp() {
    const s = this.session;
    if (this.moving.some((p) => p.mode === 'roll')) s.help = 'いまだ！ 爪の あいだに いれよう';
    else if (this.moving.some((p) => p.mode === 'spiral')) s.help = 'くるくる おりてくる… タイミングを はかろう';
    else if (this.busy()) s.help = '';
    else s.help = 'どの「？」を おす？ けいひんが おりてくるよ';
  },

  // 積んである景品は、下が空いたら 1 段ずつ らせんを下りて詰める
  updateTower(dt) {
    const speed = this.lv().spin;
    const t = this.cfg().tower;
    // らせんを下りている景品（遅いこともある）に追いついて重ならないように、そのすぐ上までしか下りない
    const spiralTop = Math.max(-Infinity, ...this.moving.filter((p) => p.mode === 'spiral').map((p) => p.u));
    this.tower.forEach((p, i) => {
      const target = Math.max(this.slotU(i), spiralTop + t.slotGap * (i + 1));
      if (p.u > target) {
        const step = Math.min(p.u - target, speed * dt);
        p.u -= step;
        p.angle += step * Math.PI * 2 * t.radius / p.r; // らせんを転がる分だけ回す
      }
    });
  },

  updatePrizes(dt) {
    const s = this.cfg();
    const lv = this.lv();
    const t = s.tower;
    const chute = s.chute;
    const g = CONFIG.prize.gravity;
    for (const p of this.moving.slice()) {
      if (p.held) { p.mode = 'held'; continue; }
      const rate = p.rate || 1;
      switch (p.mode) {
        case 'held':
          // アームから離れた（取り出し口の上で離した・途中で落とした）。揺れの勢いは Claw.releasePrize が vx に入れている
          p.mode = 'fall';
          break;

        case 'spiral': {
          // らせんを回りながら下りる。下まで来たら、出口から坂へ転がり出る
          const step = lv.spin * rate * dt;
          p.u -= step;
          p.angle += step * Math.PI * 2 * t.radius / p.r;
          if (p.u <= 0) {
            const pos = this.helixPos(0, p.r);
            p.x = pos.x;
            p.y = pos.y;
            p.vx = lv.roll * rate * 0.6;
            p.vy = 0;
            p.mode = 'roll';
          }
          break;
        }

        case 'roll': {
          // 坂を右へ転がる。速さは、難しさとボタンの速さに近づける（タワーの下の平らな所では、勢いで出ていく）
          const onSlope = p.x > s.slope.xTop;
          const target = lv.roll * rate * (onSlope ? 1 : 0.6);
          p.vx += (target - p.vx) * Math.min(1, dt * 3);
          p.x += p.vx * dt;
          p.angle += p.vx * dt / p.r;
          p.x = Math.max(p.x, CONFIG.case.x + p.r);
          this.blockByClaw(p);
          const gy = this.ground(p.x);
          if (gy === null) {
            // 坂の下のはしから落ちる
            p.mode = 'fall';
            p.vy = Math.abs(p.vx) * this.slopeRate();
          } else {
            p.y = gy - p.r;
          }
          break;
        }

        case 'fall': {
          p.vy += g * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.angle += p.vx * dt / p.r;
          this.blockByClaw(p);
          this.constrainFall(p);
          // 取り出し口に入ったらゲット
          if (p.x > chute.x && p.y - p.r > chute.y) {
            this.moving.splice(this.moving.indexOf(p), 1);
            // 演出の文字は景品の右に出るので、取り出し口が右にあるこの台では、画面からはみ出さないように左へずらす
            this.session.onCaptured(p, chute.x - 40, chute.y);
            break;
          }
          // もどり口の底まで落ちたら、タワーへ戻す
          if (p.x >= s.hole.x && p.x < s.hole.x + s.hole.w && p.y - p.r > CONFIG.floorY + 4) {
            p.mode = 'back';
            p.timer = 0;
            Sound.slip();
            this.session.message = 'おしい！ タワーに もどった…';
            this.session.messageTimer = 2;
            Effects.popup('もどる', s.hole.x + s.hole.w / 2, CONFIG.floorY - 10, '#6fd3ff');
            break;
          }
          // 坂か台に着いたら、転がり始める
          const gy = this.ground(p.x);
          if (gy !== null && p.y + p.r >= gy) {
            p.y = gy - p.r;
            p.vy = 0;
            p.mode = 'roll';
          }
          break;
        }

        case 'back': {
          // 少し待ってから、タワーのいちばん上に戻す（そこから空いている段まで下りてくる）
          p.timer += dt;
          if (p.timer >= s.returnDelay) {
            this.moving.splice(this.moving.indexOf(p), 1);
            p.mode = undefined;
            p.u = this.slotU(this.tower.length) + 0.5;
            this.tower.push(p);
            const top = this.helixPos(p.u, p.r);
            Effects.popup('タワーへ', top.x + 60, top.y - 20, '#6fd3ff');
          }
          break;
        }
      }
    }
  },

  // 坂を転がっている景品・落ちている景品どうしが重ならないように押し離す（3 こ続けて転がってくるので、
  // 前の景品が爪に止められると、後ろの景品はその後ろで止まる）。アームがつかんでいる景品は動かさず、相手だけを押す
  separatePrizes() {
    const list = this.moving.filter((p) => p.mode === 'roll' || p.mode === 'fall' || p.mode === 'held');
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const overlap = a.r + b.r - dist;
        if (overlap <= 0) continue;
        const wa = a.held ? 0 : b.held ? 1 : 0.5;
        const wb = b.held ? 0 : a.held ? 1 : 0.5;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * overlap * wa;
        b.x += nx * overlap * wb;
        // 転がっている景品は坂の面に沿って動くので、高さは面に合わせ直す。落ちている景品は上下にも押す
        if (a.mode === 'fall') a.y -= ny * overlap * wa;
        if (b.mode === 'fall') b.y += ny * overlap * wb;
        for (const p of [a, b]) {
          if (p.mode !== 'roll') continue;
          const gy = this.ground(p.x);
          if (gy !== null) p.y = gy - p.r;
        }
        // 後ろの景品は、前の景品の速さより速く進まない
        const back = a.x < b.x ? a : b;
        const front = back === a ? b : a;
        if (!back.held && back.vx > front.vx) back.vx = front.vx;
      }
    }
  },

  // 落ちている景品が、壁・取り出し口の仕切り・もどり口のふちを通り抜けないようにする
  constrainFall(p) {
    const s = this.cfg();
    const chute = s.chute;
    const box = CONFIG.case;
    const wallL = s.hole.x + s.hole.w; // 取り出し口の左の仕切り（黄色い板）の左の面
    const wallR = chute.x + 4;          // 仕切りの右の面
    if (p.x - p.r < box.x) { p.x = box.x + p.r; p.vx = Math.abs(p.vx) * 0.3; }
    if (p.x + p.r > box.x + box.w) { p.x = box.x + box.w - p.r; p.vx = -Math.abs(p.vx) * 0.3; }
    // タワーのガラスの筒の中には入らない
    const glassR = this.glassRight();
    if (p.x > glassR && p.x - p.r < glassR && p.y > this.towerTop()) { p.x = glassR + p.r; p.vx = Math.abs(p.vx) * 0.3; }
    // 仕切りより下では、左右に通り抜けない
    if (p.y + p.r > chute.y) {
      const mid = (wallL + wallR) / 2;
      if (p.x < mid && p.x + p.r > wallL) { p.x = wallL - p.r; p.vx = -Math.abs(p.vx) * 0.3; }
      if (p.x >= mid && p.x - p.r < wallR) { p.x = wallR + p.r; p.vx = Math.abs(p.vx) * 0.3; }
    }
    // もどり口の中では、左のふち（坂の下の壁）を通り抜けない
    const holeL = s.hole.x;
    if (p.x > holeL && p.y + p.r > CONFIG.floorY && p.x - p.r < holeL) { p.x = holeL + p.r; p.vx = Math.abs(p.vx) * 0.3; }
  },

  // 下りている爪は、景品にとって壁になる。爪の先が景品の高さまで下りた瞬間に、景品が爪の間にあれば間に閉じこめ（閉じると真ん中に寄る）、
  // 外にあれば外で止める（早く下ろしすぎると、転がってきた景品は外側の爪に止められる）
  blockByClaw(p) {
    const hx = Claw.headX();
    const spread = Claw.tipSpread();
    const reach = Claw.tipY() > p.y - p.r && Claw.y < p.y + p.r && Claw.state !== 'idle';
    if (!reach) { p.side = null; return; }
    const rel = p.x - hx;
    if (p.side === null || p.side === undefined) {
      p.side = Math.abs(rel) < spread ? 0 : Math.sign(rel);
      // 爪の間に入ったときの、真ん中からのずれ（0 で真ん中、1 で爪の先）。ジャスト判定に使う
      p.entry = p.side === 0 ? Math.abs(rel) / spread : undefined;
    }
    const m = p.r * 0.7; // 景品の絵は当たり判定より大きいので、少し重なってよい
    let x = p.x;
    if (p.side === 0) {
      const room = Math.max(0, spread - m);
      x = Math.max(hx - room, Math.min(hx + room, x));
    } else if (p.side > 0) {
      x = Math.max(x, hx + spread + m);
    } else {
      x = Math.min(x, hx - spread - m);
    }
    if (x !== p.x) {
      p.x = x;
      p.vx = 0;
    }
  },

  // ---- 描画 ----

  towerTop() {
    const t = this.cfg().tower;
    return this.cfg().slope.topY - this.cfg().prizeRadius * 2 - t.turns * t.pitch - 14;
  },
  glassRight() {
    const t = this.cfg().tower;
    return t.poleX + t.radius + this.cfg().prizeRadius + 4;
  },

  draw() {
    this.drawScene(this.time);
    for (const p of this.moving) if (p.mode !== 'spiral' && p.mode !== 'back') this.drawPrize(p, p.x, p.y, 1, 1);
    Render.drawClaw(Claw);
    // 坂にもぐった爪の先を隠すため、坂の手前の面をもう一度描く
    this.drawSlope(false);
    Effects.draw(Render.ctx);
    this.session.drawHud();
  },

  // 筐体・坂・もどり口・タワー（積んである景品と、らせんを下りている景品）。メニューの背景にも使う
  drawScene(time) {
    this.drawMachine(time);
    this.drawHole();
    this.drawSlope(true);
    this.drawTower(time);
  },

  // 筐体（枠・電飾・ガラス・取り出し口・レール）。render.js の drawMachine を左右逆にして、取り出し口を右に置いたもの
  drawMachine(time) {
    const ctx = Render.ctx;
    const c = CONFIG.colors;
    const box = CONFIG.case;
    const chute = this.cfg().chute;

    ctx.fillStyle = c.background;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.fillStyle = c.frame;
    ctx.fillRect(box.x - 12, box.y - 12, box.w + 24, box.h + 24);
    // 外枠の電飾。2 色が交互に点滅する
    const lightOn = Math.floor(time * 3) % 2;
    const step = 28;
    for (let x = box.x + 2; x < box.x + box.w; x += step) {
      const i = Math.round((x - box.x) / step);
      ctx.fillStyle = (i + lightOn) % 2 ? '#ffe066' : '#ffffff';
      ctx.fillRect(x, box.y - 9, 6, 6);
    }
    ctx.fillStyle = c.glass;
    ctx.fillRect(box.x, box.y, box.w, box.h);

    // 取り出し口（右）
    ctx.fillStyle = c.chute;
    ctx.fillRect(chute.x, chute.y, chute.w, chute.h);
    ctx.fillStyle = c.chuteEdge;
    ctx.fillRect(chute.x - 2, chute.y, 6, chute.h);
    ctx.fillRect(chute.x - 2, chute.y - 3, chute.w + 2, 4);
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('とりだし口', chute.x + chute.w / 2, chute.y + 26);

    // アームのレール
    ctx.fillStyle = c.frame;
    ctx.fillRect(box.x, box.y + 10, box.w, 6);

    // ガラスの反射（右上）
    const rx = box.x + box.w;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.moveTo(rx - 40, box.y);
    ctx.lineTo(rx - 90, box.y);
    ctx.lineTo(rx - 20, box.y + 180);
    ctx.lineTo(rx, box.y + 180);
    ctx.lineTo(rx, box.y + 100);
    ctx.closePath();
    ctx.fill();
  },

  drawHole() {
    const ctx = Render.ctx;
    const s = this.cfg();
    const bottom = CONFIG.case.y + CONFIG.case.h;
    ctx.fillStyle = CONFIG.colors.chute;
    ctx.fillRect(s.hole.x, CONFIG.floorY, s.hole.w, bottom - CONFIG.floorY);
    ctx.fillStyle = '#6fd3ff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('もどる↻', s.hole.x + s.hole.w / 2, CONFIG.floorY + 24);
  },

  // 坂と、タワーが載る台。withMarks が true なら、坂の向きの矢印も描く
  drawSlope(withMarks) {
    const ctx = Render.ctx;
    const c = CONFIG.colors;
    const sl = this.cfg().slope;
    const left = CONFIG.case.x;
    const bottom = CONFIG.case.y + CONFIG.case.h;
    ctx.fillStyle = c.floor;
    ctx.beginPath();
    ctx.moveTo(left, sl.topY);
    ctx.lineTo(sl.xTop, sl.topY);
    ctx.lineTo(sl.xBottom, CONFIG.floorY);
    ctx.lineTo(sl.xBottom, bottom);
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.fill();
    // 坂の上の面のふち
    ctx.strokeStyle = c.chuteEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left, sl.topY);
    ctx.lineTo(sl.xTop, sl.topY);
    ctx.lineTo(sl.xBottom, CONFIG.floorY);
    ctx.stroke();
    if (!withMarks) return;
    // 坂の側面に、転がる向きの矢印
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    for (let x = sl.xBottom - 50; x > sl.xTop; x -= 60) ctx.fillText('▶', x, this.ground(x) + 28);
  },

  // タワー：柱・らせんの坂・ガラスの筒。奥にある景品と坂は柱より先に（薄く）描き、手前のものはあとから描く
  drawTower(time) {
    const ctx = Render.ctx;
    const s = this.cfg();
    const t = s.tower;
    const c = CONFIG.colors;
    const top = this.towerTop();
    const glassR = this.glassRight();
    const left = CONFIG.case.x;
    const items = this.tower.concat(this.moving.filter((p) => p.mode === 'spiral'))
      .map((p) => ({ p, pos: this.helixPos(p.u, p.r) }));

    // ガラスの筒の中
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(left, top, glassR - left, s.slope.topY - top);

    // らせんの坂（奥の半分）と、奥の景品
    this.drawRamp(ctx, false);
    for (const it of items) if (it.pos.depth < 0) this.drawPrize(it.p, it.pos.x, it.pos.y, 1 + it.pos.depth * 0.1, 0.7);

    // 柱
    ctx.fillStyle = c.clawDark;
    ctx.fillRect(t.poleX - 5, top + 6, 10, s.slope.topY - top - 6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(t.poleX - 3, top + 6, 2, s.slope.topY - top - 6);

    // らせんの坂（手前の半分）と、手前の景品
    this.drawRamp(ctx, true);
    for (const it of items) if (it.pos.depth >= 0) this.drawPrize(it.p, it.pos.x, it.pos.y, 1 + it.pos.depth * 0.1, 1);

    // ガラスの筒のふち。右の下は、景品が出てくる出口なので開けておく
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(glassR, s.slope.topY - s.prizeRadius * 2 - 8);
    ctx.lineTo(glassR, top);
    ctx.lineTo(left, top);
    ctx.stroke();
    // てっぺんの屋根と、電飾
    ctx.fillStyle = c.frame;
    ctx.fillRect(left, top - 12, glassR - left + 6, 12);
    const on = Math.floor(time * 3) % 2;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = (i + on) % 2 ? '#ffe066' : '#ffffff';
      ctx.fillRect(left + 8 + i * 15, top - 9, 5, 5);
    }
  },

  // らせんの坂を、景品の下の面に沿って描く。front が true なら手前の半分、false なら奥の半分
  drawRamp(ctx, front) {
    const s = this.cfg();
    const t = s.tower;
    const r = s.prizeRadius;
    ctx.save();
    ctx.strokeStyle = CONFIG.colors.frame;
    ctx.globalAlpha = front ? 1 : 0.45; // 奥の半分は、ガラスの向こうなので薄く
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const steps = Math.ceil(t.turns * 48);
    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i <= steps; i++) {
      const u = -0.05 + (t.turns + 0.05) * i / steps;
      const pos = this.helixPos(u, r);
      if ((pos.depth >= 0) === front) {
        const y = pos.y + r + 2;
        if (!drawing) { ctx.moveTo(pos.x, y); drawing = true; } else ctx.lineTo(pos.x, y);
      } else {
        drawing = false;
      }
    }
    ctx.stroke();
    ctx.restore();
  },

  // 景品を回転させて描く（らせんや坂を転がるので、丸くない景品も回す）。scale は奥行きの大きさ、alpha は奥の暗さ
  drawPrize(p, x, y, scale, alpha) {
    const ctx = Render.ctx;
    const size = Math.round(p.r * 2.2 * scale);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(p.angle || 0);
    ctx.drawImage(Render.prizeImages[p.type], -size / 2, -size / 2, size, size);
    ctx.restore();
  },
};
