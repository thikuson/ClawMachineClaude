// スウィート（スウィートランド系）：スペース（Enter）を押すだけで遊べる（斜め上から見た画面。ショベル（shovel.js）の仕組みを使う）
// 奥の丸いドームの中で、景品を載せたテーブルが回っている。手前は 2 段のプッシャーで、上の段（押し板）が前後に動き、
// 下の段（床）は取り出し口に向かって広がる扇形。扇の横から落ちた景品は取れない。
// 押すと、ショベルが「ウィーン」と 1/4 円を描くように伸びながら、毎回同じ場所の景品の山へ沈み、少し止まってから引き上げる。
// 引き上げるときは内側へ巻き込むように引きながら持ち上げ、通り道の景品をかき集めてすくう（0 個のことも、何個も取れることもある）。すくった景品はプッシャーの床の上まで運び、
// 「おとす」（↓）を押したときに落とす（押さないとしばらくして自動で落とす）。
// 押し板に押された景品がほかの景品を押して、手前のふちから取り出し口へ落ちた景品が獲得になる
const SweetMode = Object.assign(Object.create(ShovelMode), {
  key: 'sweet',
  session: null,
  time: 0,
  // ショベルのアーム（形は ShovelMode と同じ。ShovelMode の状態とまざらないように、こちら用に持つ）
  arm: { state: 'wait', angle: 0, length: 0, height: 1, timer: 0, load: [], tilt: 0 },
  tableAngle: 0,
  prizes: [],
  falling: [],
  drops: [],      // プッシャーの床の上と、そこへ落ちていく景品 { type, r, x, y（真上から見た位置）, h（高さ）, vh, angle, state }
  pushTime: 0,
  plateY: 0,      // 押し板の前の面の位置（奥行き y）
  sinceDump: 99,
  spillPopup: false, // 文字がごちゃごちゃしないように、こぼれても景品の上に文字は出さない（下の文字だけ）

  cfg() {
    return CONFIG.sweet;
  },

  start() {
    this.session = new GameSession('sweet', { restartHint: 'R か「下ろす」で もういちど' });
    this.reset();
  },

  reset() {
    this.session.reset();
    this.session.help = 'けいひんが まわってきたら スペースで下ろす';
    Effects.reset();
    this.setUp();
  },

  // テーブルとプッシャーの床に景品を並べ直す。メニューの背景に出すときにも使う
  setUp() {
    ShovelMode.setUp.call(this);
    const pu = this.cfg().pusher;
    this.drops = [];
    this.pushTime = 0;
    this.plateY = pu.pushMin;
    // 床（下の段）と押し板の上（上の段）には、最初から景品を並べておく（あとから落とした景品が、前の景品を押し出す）
    for (let i = 0; i < pu.startCount + pu.topCount; i++) {
      const p = this.newPrize();
      const onTop = i >= pu.startCount;
      p.y = onTop ? pu.wallY + p.r + Math.random() * (pu.pushMin - pu.wallY - p.r * 1.5)
        : pu.pushMax + p.r + Math.random() * (pu.frontY - pu.pushMax - p.r * 3);
      const half = this.fanHalf(onTop ? pu.backY : p.y) - p.r * 1.5;
      p.x = pu.cx - half + Math.random() * half * 2;
      p.h = onTop ? pu.pushH : 0;
      p.vh = 0;
      p.state = onTop ? 'top' : 'floor';
      this.drops.push(p);
    }
    for (let i = 0; i < 240; i++) this.stepPusher(1 / 60, true);
    this.drops = this.drops.filter((p) => p.state === 'floor' || p.state === 'top');
    this.pushTime = 0;
    this.sinceDump = 99;
  },

  newPrize() {
    const normalTypes = [];
    PRIZE_SPRITES.forEach((s, i) => { if (!s.rare && !s.secret) normalTypes.push(i); });
    let type = normalTypes[Math.floor(Math.random() * normalTypes.length)];
    if (Math.random() < CONFIG.prize.rareChance * 0.15) type = PRIZE_SPRITES.findIndex((s) => s.rare);
    return { type, r: 16 + Math.random() * 3, angle: 0 };
  },

  // テーブルの景品が減ったら、奥の方に足す（いつも山になっているように）
  refillTable() {
    const g = this.cfg();
    if (this.prizes.length >= g.refillBelow || this.arm.state === 'swoop' || this.arm.state === 'hold' || this.arm.state === 'curl') return;
    const p = this.newPrize();
    p.dist = g.hubR + Math.random() * (g.ringOut - g.hubR);
    p.ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.8; // 奥
    p.angle = Math.random() * Math.PI * 2;
    this.prizes.push(p);
    this.separatePrizes();
  },

  update(dt) {
    this.time += dt;
    if (Input.wasPressed('KeyR')) this.reset();
    if (this.session.gameOver && Input.wasPressed('Space')) {
      this.session.continueOr(() => this.reset());
      return;
    }
    const spin = this.cfg().spin * dt;
    this.tableAngle -= spin;
    for (const p of this.prizes) {
      p.ang -= spin;
      p.angle -= spin;
    }
    this.refillTable();
    this.updateArm(dt);
    this.updateFalling(dt);
    this.sinceDump += dt;
    for (const p of this.stepPusher(dt, false)) {
      const at = this.proj(p.x, this.cfg().pusher.frontY, 0);
      this.session.onCaptured(p, at.x, at.y);
    }
    Effects.update(dt);
    const busy = this.arm.state !== 'wait' || this.sinceDump < this.cfg().settleTime;
    this.session.update(dt, !busy, 1);
    this.updateButtons();
  },

  // 画面のボタン：今押せるボタンだけをピンクにして、押せないボタンは暗くして押せなくする。
  // アームが待っているあいだは「下ろす」、すくった景品をプッシャーの上まで運び終えたら「おとす」。
  // 下ろしてから運び終えるまでは、どちらも押せない。ゲームが終わったあとは、「下ろす」で もういちど 遊べる
  updateButtons() {
    const lower = document.querySelector('#controls-sweet .lower');
    const release = document.querySelector('#controls-sweet .release');
    if (!lower || !release) return;
    const canLower = this.arm.state === 'wait' || this.session.gameOver;
    const canRelease = this.arm.state === 'ready' && !this.session.gameOver;
    lower.disabled = !canLower;
    lower.classList.toggle('idle', !canLower);
    release.disabled = !canRelease;
    release.classList.toggle('idle', !canRelease);
  },

  // 下ろす（1/4 円を描いて斜めに沈む）・止まる・巻き込んで引き上げる・おとす のタイミングは、ここで動かす。
  // 落とす・戻る は、ショベルと同じ動き
  updateArm(dt) {
    const g = this.cfg();
    const a = this.arm;
    // 使えないときに押されたボタンは、ここで捨てる。残しておくと、あとで使えるようになったときに勝手に動いてしまうため
    // （例：すくったあとにスペースを押すと、アームが戻ったとたんに、また下ろしてしまう）
    if (a.state !== 'wait') Input.wasPressed('Space');
    if (a.state !== 'ready') Input.wasPressed('ArrowDown');
    switch (a.state) {
      case 'wait':
        a.timer += dt;
        if (Input.wasPressed('Space') && this.session.canPlay()) {
          this.session.usePlay();
          Sound.tone(300, 520, g.swoopTime * 0.5, 'sawtooth', 0.025); // ウィーン（伸びる）
          this.setArm('swoop');
          a.whine = false;
        }
        return;
      case 'swoop': {
        // 持ち上げた位置から、1/4 円を描くように、伸びながら景品の山へ沈む。
        // はじめは横へ、だんだん斜め下へ、最後は真下へ動くので、止まらずにひと続きで下りる
        a.timer += dt;
        const u = Math.min(1, a.timer / g.swoopTime);
        const th = (Math.PI / 2) * (0.5 - 0.5 * Math.cos(Math.PI * u));
        a.length = g.waitLength + (g.landLength - g.waitLength) * Math.sin(th);
        a.height = Math.cos(th);
        if (!a.whine && u >= 0.5) {
          a.whine = true;
          Sound.tone(480, 220, g.swoopTime * 0.5, 'sawtooth', 0.025); // ウィーン（沈む）
        }
        if (u >= 1) {
          // 沈んだ時点では、まだ何が入るか決めない（止まっているあいだも、テーブルは回り続ける）
          a.height = 0;
          this.setArm('hold');
        }
        return;
      }
      case 'hold':
        // 少しのあいだ沈黙してから、引き上げる。引き上げ始めたときに、ショベルの口の中にある景品がすくわれる
        a.timer += dt;
        if (a.timer >= g.holdTime) {
          Sound.tone(260, 420, g.curlTime, 'sawtooth', 0.02); // ウィーン（巻き込みながら引き上げる）
          this.setArm('curl');
        }
        return;
      case 'curl': {
        // ショベルらしく、軸の方（内側）へ巻き込むように、引きながら口を上へ起こして持ち上げる。
        // 引きずっている前半は、通り道の景品をかき集めながらすくう（入りきらない景品は横へ押しのけられる）
        a.timer += dt;
        const u = Math.min(1, a.timer / g.curlTime);
        const th = (Math.PI / 2) * (0.5 - 0.5 * Math.cos(Math.PI * u));
        a.length = g.landLength - g.curlBack * Math.sin(th);
        a.height = 1 - Math.cos(th);
        a.tilt = 0.15 - 0.6 * Math.sin(th);
        const before = a.load.length;
        if (a.height < g.gatherUntil) this.scoop();
        if (a.load.length > before) Sound.tone(500 + a.load.length * 80, 700 + a.load.length * 80, 0.08, 'triangle', 0.05);
        this.checkSpill(dt);
        if (u >= 1) {
          a.height = 1;
          if (!a.load.length) {
            Sound.miss();
            this.session.showMessage('scoopMiss');
            this.setArm('back');
          } else {
            Sound.grab();
            this.setArm('carry');
          }
        }
        return;
      }
      case 'carry': {
        // プッシャーの床の上まで運んだら、「おとす」を待つ
        const done = this.turnToward(g.chuteAngle, dt);
        const lenDone = this.stretchToward(g.chuteLength, dt);
        this.checkSpill(dt);
        if (done && lenDone) {
          if (!a.load.length) this.setArm('back');
          else {
            this.setArm('ready');
            this.session.help = 'すきな タイミングで ↓ で おとす';
          }
        }
        return;
      }
      case 'ready':
        // おとすボタン（↓）を待つ。しばらく押さないと、自動で落とす。
        // 「下ろす」（スペース）では落とさない。画面に「下ろす」と「おとす」の 2 つのボタンがあるので、まぎれないようにするため
        a.timer += dt;
        a.tilt = -0.2 + Math.sin(this.time * 4) * 0.03;
        if (Input.wasPressed('ArrowDown') || a.timer >= g.dropWait) {
          this.session.help = 'けいひんが まわってきたら スペースで下ろす';
          this.setArm('dump');
        }
        return;
    }
    ShovelMode.updateArm.call(this, dt);
  },

  // 上から沈むので、ショベルの口の中にある景品は、まとめてすくえる（入りきらない分は横へ押しのけられる）
  scoop() {
    const g = this.cfg();
    const lv = this.levelSettings();
    const a = this.arm;
    const f = this.bucketFrame();
    const halfW = lv.bucketWidth / 2;
    const halfD = g.bucketDepth / 2;
    const hits = [];
    for (const p of this.prizes) {
      const pos = this.prizePos(p);
      const dx = pos.x - f.x, dy = pos.y - f.y;
      const u = dx * f.ux + dy * f.uy;
      const v = dx * f.vx + dy * f.vy;
      if (Math.abs(u) > halfD + p.r || Math.abs(v) > halfW + p.r) continue;
      hits.push({ p, pos, u, v, inside: Math.abs(u) <= halfD + p.r * 0.4 && Math.abs(v) <= halfW - p.r * 0.2 });
    }
    // 真ん中に近い景品から順に入る
    hits.sort((x, y) => Math.abs(x.v) - Math.abs(y.v));
    for (const h of hits) {
      const p = h.p;
      if (h.inside && a.load.length < lv.capacity) {
        const edge = Math.abs(h.v) / halfW;
        const grip = PRIZE_SPRITES[p.type].grip * Math.sqrt(Level.settings.gripPower);
        const chance = Math.min(0.9, lv.spill * (0.3 + edge) / grip);
        p.u = Math.max(-halfD + p.r * 0.5, Math.min(halfD - p.r * 0.5, h.u));
        p.v = h.v;
        p.spillAt = Math.random() < chance ? 0.1 + Math.random() * 0.5 : -1;
        p.carry = 0;
        a.load.push(p);
        this.prizes.splice(this.prizes.indexOf(p), 1);
        continue;
      }
      const side = h.v >= 0 ? 1 : -1;
      const pushV = side * (halfW + p.r + 1) - h.v;
      this.setPrizePos(p, h.pos.x + f.vx * pushV, h.pos.y + f.vy * pushV);
    }
    this.separatePrizes();
  },

  // 運んだ景品を落とす（ショベルの入り口からすべり出て落ちていく）。
  // 押し板の上の段に落ちるか、下の段（床）に落ちるかは、落としたときの押し板の位置で変わる
  releaseLoad() {
    const a = this.arm;
    const f = this.bucketFrame();
    const h = this.bucketHeight();
    const pu = this.cfg().pusher;
    a.load.forEach((p, i) => {
      const spread = (i - (a.load.length - 1) / 2) * 24;
      const y = Math.max(pu.wallY + p.r, f.y + f.vy * spread - f.uy * 10);
      const half = this.fanHalf(y) - p.r;
      this.drops.push({
        type: p.type, r: p.r, angle: p.angle,
        x: Math.max(pu.cx - half, Math.min(pu.cx + half, f.x + f.vx * spread - f.ux * 10)),
        y, h, vh: 20, state: 'air',
      });
    });
    a.load = [];
    this.sinceDump = 0;
    Sound.slip();
  },

  // こぼれた景品：プッシャーの上ならそこへ落ち、テーブルの上ならテーブルに戻る
  updateFalling(dt) {
    const pu = this.cfg().pusher;
    for (const f of this.falling.slice()) {
      if (f.y > pu.wallY && f.y < pu.frontY && Math.abs(f.x - pu.cx) < this.fanHalf(f.y)) {
        this.falling.splice(this.falling.indexOf(f), 1);
        this.drops.push({ type: f.type, r: f.r, angle: f.angle, x: f.x, y: f.y, h: f.h, vh: 0, state: 'air' });
        this.sinceDump = 0;
      }
    }
    ShovelMode.updateFalling.call(this, dt);
  },

  // 扇形の床の、奥行き y での半分の幅（奥が狭く、取り出し口に向かって広がる）。押し板の上の段は、押し板の幅
  fanHalf(y) {
    const pu = this.cfg().pusher;
    const t = Math.max(0, Math.min(1, (y - pu.backY) / (pu.frontY - pu.backY)));
    return pu.backHalf + (pu.frontHalf - pu.backHalf) * t;
  },

  // 重なった景品どうしを離す。stuck(p, ny) が true の景品は、その向きには動けない
  separate(list, packing, stuck) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const over = (a.r + b.r) * packing - d;
        if (over <= 0) continue;
        const nx = dx / d, ny = dy / d;
        const aStuck = stuck(a, -ny);
        const bStuck = stuck(b, ny);
        const sa = aStuck && !bStuck ? 0 : bStuck && !aStuck ? 1 : 0.5;
        a.x -= nx * over * sa; a.y -= ny * over * sa;
        b.x += nx * over * (1 - sa); b.y += ny * over * (1 - sa);
      }
    }
  },

  // プッシャーを時間 dt だけ進める。取り出し口に落ちきった景品の一覧を返す
  stepPusher(dt, quiet) {
    const pu = this.cfg().pusher;
    const gravity = CONFIG.prize.gravity;
    const oldPlate = this.plateY;
    this.pushTime += dt;
    this.plateY = pu.pushMin + (pu.pushMax - pu.pushMin) * (0.5 - 0.5 * Math.cos(this.pushTime * Math.PI * 2 / pu.pushPeriod));
    const move = this.plateY - oldPlate;
    const captured = [];
    const lost = [];
    for (const p of this.drops) {
      if (p.state === 'air') {
        // 落ちていく途中。押し板の上なら上の段に、そうでなければ床に着く
        p.vh -= gravity * dt;
        p.h += p.vh * dt;
        const onTop = p.y < this.plateY;
        const ground = onTop ? pu.pushH : 0;
        if (p.h <= ground) {
          p.h = ground;
          p.vh = 0;
          p.state = onTop ? 'top' : 'floor';
          if (!quiet) Sound.tone(220, 160, 0.06, 'triangle', 0.05);
        }
      } else if (p.state === 'top') {
        // 上の段：押し板と一緒に前後に動くが、下がるときは奥の壁に止められる
        p.y += move;
        if (p.y - p.r < pu.wallY) p.y = pu.wallY + p.r;
      } else if (p.state === 'fall') {
        // 手前のふちから、取り出し口へ落ちていく
        p.vh -= gravity * dt;
        p.h += p.vh * dt;
        p.y += 40 * dt;
        if (p.h < -70) captured.push(p);
      } else if (p.state === 'side') {
        // 扇の横から落ちた景品は、取れない（横のすき間に落ちて見えなくなる）
        p.vh -= gravity * dt;
        p.h += p.vh * dt;
        p.x += p.side * 30 * dt;
        if (p.h < -60) lost.push(p);
      }
    }
    // 上の段：景品どうしの押し合い。手前のふち（押し板の前の面）を越えた景品は、下の段へ落ちる
    const top = this.drops.filter((p) => p.state === 'top');
    for (let k = 0; k < 3; k++) {
      this.separate(top, 1, (p, ny) => ny < 0 && p.y - p.r <= pu.wallY + 0.5);
      for (const p of top) {
        const half = this.fanHalf(pu.backY) - p.r;
        p.x = Math.max(pu.cx - half, Math.min(pu.cx + half, p.x));
        if (p.y - p.r < pu.wallY) p.y = pu.wallY + p.r;
      }
    }
    for (const p of top) {
      if (p.y > this.plateY) {
        p.state = 'air';
        p.vh = 0;
        p.y = Math.max(p.y, this.plateY + p.r * 0.6);
      }
    }
    // 床（下の段）：押し板と景品どうしの押し合いで動かす
    const floor = this.drops.filter((p) => p.state === 'floor');
    for (let k = 0; k < 4; k++) {
      for (const p of floor) if (p.y - p.r < this.plateY) p.y = this.plateY + p.r;
      this.separate(floor, pu.packing, (p, ny) => ny < 0 && p.y - p.r <= this.plateY + 0.5);
    }
    for (const p of floor) {
      if (p.y > pu.frontY) {
        p.state = 'fall';
        p.vh = 0;
        if (!quiet) Sound.slip();
      } else if (Math.abs(p.x - pu.cx) > this.fanHalf(p.y)) {
        p.state = 'side';
        p.side = p.x > pu.cx ? 1 : -1;
        p.vh = 0;
        if (!quiet) Sound.tone(200, 120, 0.15, 'triangle', 0.04);
      }
    }
    this.drops = this.drops.filter((p) => !captured.includes(p) && !lost.includes(p));
    return captured;
  },

  // 扇形の床・横のすき間・押し板（上の段）・取り出し口（ショベルの取り出し口の代わり）
  drawChute(ctx) {
    const pu = this.cfg().pusher;
    const c = CONFIG.colors;
    const box = CONFIG.case;
    const P = (x, y, h) => this.proj(x, y, h);
    const quad = (pts, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.fill();
    };
    const L = (y) => pu.cx - this.fanHalf(y);
    const R = (y) => pu.cx + this.fanHalf(y);
    const bottom = box.y + box.h;
    // 横のすき間と取り出し口（暗い穴）。その上に扇形の床を重ねる
    const gl = P(pu.cx - pu.frontHalf - 6, pu.backY, 0), gr = P(pu.cx + pu.frontHalf + 6, pu.backY, 0);
    ctx.fillStyle = c.chute;
    ctx.fillRect(gl.x, gl.y, gr.x - gl.x, bottom - gl.y);
    quad([P(L(pu.backY), pu.backY, 0), P(R(pu.backY), pu.backY, 0), P(R(pu.frontY), pu.frontY, 0), P(L(pu.frontY), pu.frontY, 0)], c.floor);
    // 扇のふち（左右と手前）
    ctx.strokeStyle = c.chuteEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const a0 = P(L(pu.backY), pu.backY, 0), a1 = P(L(pu.frontY), pu.frontY, 0);
    const b0 = P(R(pu.backY), pu.backY, 0), b1 = P(R(pu.frontY), pu.frontY, 0);
    ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(b0.x, b0.y);
    ctx.stroke();
    ctx.fillStyle = c.chuteEdge;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('とりだし口', (a1.x + b1.x) / 2, bottom - 6);
    // 押し板（上の段）。奥の壁から手前の前の面まで。幅は扇の奥の幅
    const hw = this.fanHalf(pu.backY);
    const xl = pu.cx - hw, xr = pu.cx + hw;
    quad([P(xl, pu.wallY, pu.pushH), P(xr, pu.wallY, pu.pushH), P(xr, this.plateY, pu.pushH), P(xl, this.plateY, pu.pushH)], '#8f89b8');
    quad([P(xl, this.plateY, 0), P(xr, this.plateY, 0), P(xr, this.plateY, pu.pushH), P(xl, this.plateY, pu.pushH)], '#6a6399');
    // 上の段の奥の壁
    quad([P(xl - 6, pu.wallY, pu.pushH), P(xr + 6, pu.wallY, pu.pushH), P(xr + 6, pu.wallY, pu.pushH + 18), P(xl - 6, pu.wallY, pu.pushH + 18)], '#4d4775');
    const s0 = P(xl, this.plateY, pu.pushH), s1 = P(xr, this.plateY, pu.pushH);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(s0.x, s0.y - 1, s1.x - s0.x, 3);
  },

  // プッシャーの上の景品と、落ちていく景品。取り出し口や横のすき間へ落ちていく景品は、床より下を見せないように切り取る
  drawDrop(ctx, d) {
    if (d.state !== 'fall' && d.state !== 'side') {
      this.drawPrizeAt(ctx, d, d.x, d.y, d.h);
      return;
    }
    ctx.save();
    ctx.globalAlpha = d.state === 'side' ? Math.max(0, 1 + d.h / 60) : 1;
    this.drawPrizeAt(ctx, d, d.x, d.y, d.h);
    ctx.restore();
  },
});
