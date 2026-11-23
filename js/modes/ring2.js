// リング（2だん）：リングをぶら下げたアームを ← → で動かし、スペース（Enter）で下ろす（横から見た画面）
// 実機によくある 2 段の台。上の段の左右に「？」のフックが 1 本ずつ立っていて、下の段の左右には景品を載せた台がある。
// 真ん中の下が取り出し口。フックと、その真下の台の外側の端はひもでつながっていて、
// リングをフックに引っかけて引き上げると、台の外側が持ち上がって、載っている景品が真ん中の取り出し口へ流れ込む。
// リングの揺れ方や、フックにくぐらせる決まりは、ふつうのリング（ring.js）と同じ仕組みを使う
// それに加えて、フックの「？」は上から見ていろいろな向きを向き、吊られたリングもくるくる回る。
// リングがフックの先にかぶさっても、リングの穴の向きがフックの面にそろっていないと、はじかれて引っかからない
const Ring2Mode = Object.assign(Object.create(RingMode), {
  key: 'ring2',
  session: null,
  time: 0,

  // ring.js と同じ形の状態を、こちら用に別に持つ（ふつうのリングのメニューの背景と混ざらないように）
  arm: { state: 'idle', x: 0, y: 0, timer: 0, result: '', slipAt: -1, carryTime: 0 },
  ring: { x: 0, y: 0, px: 0, py: 0, mode: 'free', ghost: false, touched: false, scale: 1, station: null },

  // 左右の台とフック。side は -1 が左、1 が右。target・hook は ring.js と同じ形、tray は傾く台、prizes は台の上の景品
  stations: [],

  start() {
    this.session = new GameSession('ring2', { restartHint: 'R か「下ろす」で もういちど', showSwing: false });
    this.reset();
  },

  reset() {
    this.session.reset();
    this.session.help = 'リングの むきが フックの さきに あうと ひっかかるよ';
    Effects.reset();
    const a = this.arm;
    a.state = 'idle';
    a.x = this.homeX();
    a.y = CONFIG.claw.homeY;
    a.timer = 0;
    this.setUp();
    this.hangRing();
  },

  // 左右の台に景品を載せ、フックを立てる。メニューの背景に出すときにも使う
  setUp() {
    this.stations = [-1, 1].map((side) => ({
      side,
      target: { x: 0, lifted: 0, liftedPrev: 0, dir: 1, scale: 1, baseY: CONFIG.ring2.shelfY },
      hook: null,
      tray: { angle: 0, opening: false, closing: false, refillTimer: 0 },
      prizes: [],
    }));
    for (const st of this.stations) this.refill(st);
    this.ring.scale = this.pickSize();
    this.ring.station = null;
    this.select(this.stations[0]);
  },

  // 難しさごとの違い。ふつうのリング（CONFIG.ring.levels）に、リング2だん用の違い（CONFIG.ring2.levels）を上書きする
  levelSettings() {
    const key = CONFIG.ring.levels[Level.key] ? Level.key : 'normal';
    return Object.assign({}, CONFIG.ring.levels[key], CONFIG.ring2.levels[key]);
  },

  // リングとフックの大きさは、いつも「中」にする（毎回変わると難しいので）
  pickSize() {
    return 1;
  },

  // 台に新しい景品を載せ、その台のフックの向き（左か右）だけを決め直す。位置と大きさはいつも同じ
  refill(st) {
    const g = CONFIG.ring2;
    const normalTypes = [];
    PRIZE_SPRITES.forEach((s, i) => { if (!s.rare && !s.secret) normalTypes.push(i); });
    normalTypes.sort(() => Math.random() - 0.5);
    const types = normalTypes.slice(0, g.prizesPerTray);
    if (Math.random() < CONFIG.prize.rareChance) types[0] = PRIZE_SPRITES.findIndex((s) => s.rare);
    const gap = g.trayLength / g.prizesPerTray;
    st.prizes = types.map((type, i) => ({
      type, r: 17 + Math.random() * 3, s: gap * (i + 0.5), v: 0, falling: false, x: 0, y: 0, vx: 0, vy: 0, angle: 0,
    }));
    st.tray.angle = 0;
    st.done = false;
    const t = st.target;
    const range = st.side < 0 ? g.hookLeft : g.hookRight;
    t.x = (range[0] + range[1]) / 2;
    t.dir = Math.random() < 0.5 ? 1 : -1;
    // フックの向き（上から見た回り具合）。0 で「？」が正面を向き、大きいほど奥か手前へ回って細く見える
    t.face = (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.95);
    t.scale = this.pickSize();
    t.lifted = t.liftedPrev = 0;
    this.select(st);
    this.buildHook();
    st.hook = this.hook;
    this.placeTrayPrizes(st);
  },

  // 「？」のフックを作る（ring.js と同じ形を、向き face だけ回す）。横から見ると左右が cos(face) 倍に縮み、
  // 回った分だけ奥（z がプラス）と手前に分かれる。当たり判定は、縮んだ形のまま横から見た面の中で行う
  buildHook() {
    RingMode.buildHook.call(this);
    const f = this.target.face || 0;
    const c = Math.cos(f), sn = Math.sin(f);
    const pts = this.hook.pts;
    let len = 0;
    pts.forEach((p, i) => {
      p.z = p.x * sn;
      p.x = p.x * c;
      if (i > 0) len += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
      p.s = len;
    });
    const n = pts.length;
    const dx = pts[n - 1].x - pts[n - 2].x, dy = pts[n - 1].y - pts[n - 2].y;
    const d = Math.hypot(dx, dy) || 1;
    this.hook.length = len;
    this.hook.tipDir = { x: dx / d, y: dy / d };
  },

  // リングの向きが、フックの先をくぐれる向きになっているか（0〜1）。
  // リングは上から見て psi だけ回っている（0 で輪が正面を向く）。フックの先は、フックの面（face の向き）の中で動くので、
  // 輪の穴の向き（輪の面に直角）がフックの面にそろうほど、先が輪の穴に入りやすい
  ringAlign() {
    return Math.abs(Math.sin((this.ring.psi || 0) + (this.target.face || 0)));
  },

  // ring.js の仕組みは this.target・this.hook を使うので、扱うフックをそこに入れる
  select(st) {
    this.target = st.target;
    this.hook = st.hook;
    this.tray = st.tray;
  },

  hookBaseY() {
    return this.target.baseY;
  },

  // リングは上の段より下へは下りない
  ringFloorY() {
    return CONFIG.ring2.shelfY;
  },

  // アームは真ん中（取り出し口の上）で待ち、左右どちらのフックにも届く
  homeX() {
    return CONFIG.ring2.homeX;
  },

  armRange() {
    const g = CONFIG.ring2;
    return { min: g.armMinX, max: g.armMaxX };
  },

  busy() {
    return this.stations.some((st) => st.tray.opening || st.tray.closing || st.tray.refillTimer > 0);
  },

  // リングと、左右のフックを時間 h だけ進める（ring.js の stepRing を、フック 2 本に広げたもの）
  stepRing(h) {
    const g = CONFIG.ring;
    const ring = this.ring;
    const gravity = CONFIG.prize.gravity;
    // リングはひもで吊られているので、上から見てくるくる回る。下ろし始めに勢いよく回り出し、だんだんゆっくりになる
    if (ring.psi === undefined) { ring.psi = 0; ring.omega = 0.8; }
    if (this.arm.state === 'down' && !ring.spun) {
      ring.omega = (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 1.6);
      ring.spun = true;
    }
    if (this.arm.state === 'idle') {
      ring.spun = false;
      ring.omega = Math.sign(ring.omega || 1) * 0.8; // 待っている間もゆっくり回る
    }
    if (ring.mode !== 'free' && ring.station) {
      // 引っかかっているときは、フックの先が穴を通る向きのまま
      ring.psi = Math.PI / 2 - ring.station.target.face;
      ring.omega = 0;
    } else {
      ring.psi += ring.omega * h;
      if (this.arm.state !== 'idle') ring.omega *= Math.max(0, 1 - 0.3 * h);
    }
    const keep = Math.max(0, 1 - this.levelSettings().damping * h);
    const vx = (ring.x - ring.px) * keep;
    const vy = (ring.y - ring.py) * keep;
    ring.px = ring.x;
    ring.py = ring.y;
    ring.x += vx;
    ring.y += vy + gravity * h * h;
    for (const st of this.stations) {
      const t = st.target;
      const lv = t.lifted - t.liftedPrev;
      t.liftedPrev = t.lifted;
      t.lifted += lv - gravity * h * h;
      if (t.lifted <= 0) t.lifted = t.liftedPrev = 0;
    }
    for (let k = 0; k < 3; k++) {
      this.keepString();
      this.collideHook();
      this.keepInCase();
    }
    for (const st of this.stations) {
      if (st.target.lifted > CONFIG.ring2.maxLift) st.target.lifted = CONFIG.ring2.maxLift;
    }
    if (ring.station) this.select(ring.station);
  },

  // かかっていないときは両方のフックと当たり、かかっている（くぐっている）ときは、そのフックとだけ当たる
  collideHook() {
    const ring = this.ring;
    if (ring.mode !== 'free' && ring.station) {
      this.select(ring.station);
      RingMode.collideHook.call(this);
      if (ring.mode === 'free') ring.station = null;
      return;
    }
    ring.station = null;
    if (ring.ghost) {
      // 外れた直後などで重なっているときは、どちらのフックからも離れきるまで当たらない
      const touch = CONFIG.ring.ringWire + CONFIG.ring.hookWire;
      const near = this.stations.some((st) => {
        this.select(st);
        return this.closestOnHook(ring.x, ring.y).dist <= this.ringR() + touch + 1;
      });
      if (!near) ring.ghost = false;
      return;
    }
    for (const st of this.stations) {
      this.select(st);
      RingMode.collideHook.call(this);
      if (ring.mode === 'entering' && this.ringAlign() < this.levelSettings().align) {
        // 先が輪にかぶさる位置に来たが、輪の向きが合っていない：輪の針金がフックの先に当たって、はじかれる
        const touch = CONFIG.ring.ringWire + CONFIG.ring.hookWire;
        const q = this.closestOnHook(ring.x, ring.y);
        const d = q.dist || 1;
        ring.mode = 'free';
        ring.x = q.x + (ring.x - q.x) / d * (this.ringR() + touch);
        ring.y = q.y + (ring.y - q.y) / d * (this.ringR() + touch);
        ring.omega += (Math.random() - 0.5) * 2; // 当たって、回り方が少し変わる
        if (!ring.touched && this.arm.state === 'down') {
          Effects.popup('カツン', q.x, q.y - 14, '#6fd3ff');
          Sound.tone(900, 600, 0.06, 'square', 0.05);
        }
        ring.touched = true;
      }
      if (ring.mode !== 'free') {
        ring.station = st;
        return;
      }
    }
  },

  checkRingSlip(dt) {
    if (this.ring.station) this.select(this.ring.station);
    RingMode.checkRingSlip.call(this, dt);
  },

  // かかったフックが引き上げられてひもが張ったら、その下の台が傾く。上がりきったら、リングが抜ける
  updateTarget() {
    const g = CONFIG.ring2;
    const st = this.ring.station;
    if (!st || this.ring.mode !== 'hooked') return;
    this.select(st);
    if (st.target.lifted >= g.pullToOpen && !st.tray.opening && st.tray.angle === 0 && st.prizes.length) {
      st.tray.opening = true;
      Sound.clear();
    }
    if (st.target.lifted >= g.maxLift - 0.5) this.releaseRing();
  },

  // 台の軸（取り出し口のそば）と、軸から外側の端へ向かう向き。傾くと外側の端が持ち上がる
  trayFrameOf(st) {
    const g = CONFIG.ring2;
    const a = st.tray.angle;
    const d = st.side; // 左の台は左へ、右の台は右へのびる
    return {
      px: g.chute.x + g.chute.w / 2 + d * (g.chute.w / 2 + 2), py: g.trayY,
      dx: d * Math.cos(a), dy: -Math.sin(a),
      nx: -d * Math.sin(a), ny: -Math.cos(a),
    };
  },

  placeTrayPrizes(st) {
    const f = this.trayFrameOf(st);
    for (const p of st.prizes) {
      p.x = f.px + f.dx * p.s + f.nx * p.r;
      p.y = f.py + f.dy * p.s + f.ny * p.r;
    }
  },

  updateTray(dt) {
    const g = CONFIG.ring2;
    const gravity = CONFIG.prize.gravity;
    const chute = g.chute;
    for (const st of this.stations) {
      const t = st.tray;
      if (t.opening) t.angle = Math.min(CONFIG.ring.openAngle, t.angle + dt * 1.6);
      const f = this.trayFrameOf(st);
      for (const p of st.prizes) {
        if (!p.falling) {
          if (t.angle > 0) {
            p.v += gravity * Math.sin(t.angle) * dt;
            p.s -= p.v * dt;
            if (PRIZE_SPRITES[p.type].round) p.angle -= st.side * p.v * dt / p.r;
          }
          p.x = f.px + f.dx * p.s + f.nx * p.r;
          p.y = f.py + f.dy * p.s + f.ny * p.r;
          if (p.s < 0) {
            // 台の内側の端から、真ん中の取り出し口へ落ちる
            p.falling = true;
            p.vx = -st.side * p.v * Math.cos(t.angle);
            p.vy = p.v * Math.sin(t.angle);
          }
        } else {
          p.vy += gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.x = Math.max(chute.x + p.r, Math.min(chute.x + chute.w - p.r, p.x));
        }
      }
      st.prizes = st.prizes.filter((p) => {
        const captured = p.falling && p.y - p.r > CONFIG.floorY + 10;
        if (captured) this.session.onCaptured(p, chute.x + chute.w / 2, CONFIG.floorY - 20);
        return !captured;
      });
      if (t.opening && st.prizes.length === 0) {
        t.opening = false;
        t.closing = true;
      }
      if (t.closing) {
        t.angle = Math.max(0, t.angle - dt * 0.8);
        const hooked = this.ring.mode === 'hooked' && this.ring.station === st;
        if (t.angle === 0 && !hooked && st.target.lifted === 0) {
          t.closing = false;
          // 取れた方の台は空のまま残す（フックも残り、また引っかけて引き上げられるが、景品はもうない）。両方とも取れたら、少し待ってから両方を並べ直す
          st.done = true;
          if (this.stations.every((o) => o.done)) this.stations[0].tray.refillTimer = 0.8;
        }
      }
      if (t.refillTimer > 0) {
        t.refillTimer -= dt;
        if (t.refillTimer <= 0) {
          t.refillTimer = 0;
          // 両方の台に景品を置き直し、フックの向きを決め直す
          for (const o of this.stations) this.refill(o);
          this.ring.scale = this.pickSize();
          this.ring.station = null;
          this.hangRing();
        }
      }
    }
    if (this.ring.station) this.select(this.ring.station);
  },

  // フック。奥にある部分は暗く、手前にある部分は明るく描いて、どちらへ向いているかが分かるようにする。先には小さな玉
  drawTargetHook(ctx) {
    const g = CONFIG.ring;
    const pts = this.hook.pts;
    ctx.lineWidth = g.hookWire * 2;
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = this.hookPoint(i - 1), b = this.hookPoint(i);
      const z = (pts[i - 1].z + pts[i].z) / 2;
      const light = Math.max(0, Math.min(1, 0.55 - z / (g.curlR * 2.2)));
      const v = Math.round(130 + 110 * light);
      ctx.strokeStyle = 'rgb(' + v + ',' + (v - 4) + ',' + Math.min(255, v + 25) + ')';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    const tip = this.hookTip();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, g.hookWire + 0.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // リングのふちの、中心から向き (ux, uy) の方にある点。横から見たリングは楕円なので、楕円のふちの上の点にする
  // （ひもがいつもリングにつながって見えるように）
  ringEdge(ux, uy) {
    const R = this.ringR();
    const rx = Math.max(1.5, R * Math.abs(Math.cos(this.ring.psi || 0)));
    const k = 1 / Math.hypot(ux / rx, uy / R);
    return { x: this.ring.x + ux * k, y: this.ring.y + uy * k };
  },

  // リング。上から見て psi だけ回っているので、横から見ると細い楕円に見える。奥の半分は暗く、手前の半分は明るく描く
  drawRing(ctx) {
    const g = CONFIG.ring;
    const ring = this.ring;
    const R = this.ringR();
    const psi = ring.psi || 0;
    const rx = Math.max(1.5, R * Math.abs(Math.cos(psi)));
    // 手前の半分が、画面の右か左か
    const frontRight = Math.sin(psi) * Math.cos(psi) < 0;
    const half = (bright, right) => {
      ctx.strokeStyle = bright ? '#ffd23f' : '#9a7616';
      ctx.lineWidth = g.ringWire * 2 + (bright ? 0 : -0.5);
      ctx.beginPath();
      if (right) ctx.ellipse(ring.x, ring.y, rx, R, 0, -Math.PI / 2, Math.PI / 2);
      else ctx.ellipse(ring.x, ring.y, rx, R, 0, Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
    };
    half(false, !frontRight);
    half(true, frontRight);
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(ring.x, ring.y, rx, R, 0, frontRight ? -Math.PI * 0.4 : Math.PI * 1.05, frontRight ? -Math.PI * 0.1 : Math.PI * 1.35);
    ctx.stroke();
  },

  draw() {
    this.drawScene(this.time);
    if (this.ring.station) this.select(this.ring.station);
    this.drawArm();
    Effects.draw(Render.ctx);
    this.session.drawHud();
  },

  // 筐体・上の段・下の台・景品・フック・ひもを描く。メニューの背景にも使う
  drawScene(time) {
    const ctx = Render.ctx;
    const g = CONFIG.ring2;
    const c = CONFIG.colors;
    const box = CONFIG.case;
    const bottom = box.y + box.h;
    ctx.fillStyle = c.background;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    ctx.fillStyle = c.frame;
    ctx.fillRect(box.x - 12, box.y - 12, box.w + 24, box.h + 24);
    const lightOn = Math.floor(time * 3) % 2;
    for (let x = box.x + 2, i = 0; x < box.x + box.w; x += 28, i++) {
      ctx.fillStyle = (i + lightOn) % 2 ? '#ffe066' : '#ffffff';
      ctx.fillRect(x, box.y - 9, 6, 6);
    }
    ctx.fillStyle = c.glass;
    ctx.fillRect(box.x, box.y, box.w, box.h);

    // 下の床と、真ん中の取り出し口
    const ch = g.chute;
    ctx.fillStyle = c.floor;
    ctx.fillRect(box.x, CONFIG.floorY, box.w, bottom - CONFIG.floorY);
    ctx.fillStyle = c.chute;
    ctx.fillRect(ch.x, g.trayY + 6, ch.w, bottom - g.trayY - 6);
    ctx.fillStyle = c.chuteEdge;
    ctx.fillRect(ch.x - 3, g.trayY + 6, 4, bottom - g.trayY - 6);
    ctx.fillRect(ch.x + ch.w - 1, g.trayY + 6, 4, bottom - g.trayY - 6);
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('とりだし口', ch.x + ch.w / 2, bottom - 12);

    // 上の段（左右の棚）。真ん中はあいていて、取り出し口が見える
    ctx.fillStyle = '#8f89b8';
    for (const [x0, x1] of [[box.x, g.shelfInnerL], [g.shelfInnerR, box.x + box.w]]) {
      ctx.fillRect(x0, g.shelfY, x1 - x0, 8);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(x0, g.shelfY, x1 - x0, 2);
      ctx.fillStyle = '#8f89b8';
    }

    // アームのレール
    ctx.fillStyle = c.frame;
    ctx.fillRect(box.x, box.y + 10, box.w, 6);

    for (const st of this.stations) this.drawStation(ctx, st);
  },

  // 1 つの台とフック（台・台の脚・景品・フックの台座・ひも・フック）
  drawStation(ctx, st) {
    const g = CONFIG.ring2;
    const f = this.trayFrameOf(st);
    // 台の脚（軸の下）
    ctx.fillStyle = '#8f89b8';
    ctx.fillRect(f.px - 3, g.trayY + 6, 6, CONFIG.floorY - g.trayY - 6);
    // 台（軸を中心に回して描く）
    ctx.save();
    ctx.translate(f.px, f.py);
    ctx.scale(st.side, 1);
    ctx.rotate(-st.tray.angle);
    ctx.fillStyle = '#c9c4e8';
    ctx.fillRect(0, 0, g.trayLength, 8);
    ctx.fillStyle = '#8f89b8';
    ctx.fillRect(g.trayLength - 6, -14, 6, 14); // 外側の端のストッパー
    ctx.restore();
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(f.px, f.py + 4, 5, 0, Math.PI * 2);
    ctx.fill();

    for (const p of st.prizes) Render.drawPrizeImage(p.type, p.x, p.y, Math.round(p.r * 2.2), p.angle);

    // フックの台座と、台の外側の端へつながるひも（上の段の穴を通って、下の台を引き上げる）
    const t = st.target;
    const end = { x: f.px + f.dx * (g.trayLength - 3), y: f.py + f.dy * (g.trayLength - 3) };
    const footY = g.shelfY - 8 - t.lifted;
    ctx.fillStyle = '#8f89b8';
    ctx.fillRect(Math.round(t.x) - 12, g.shelfY - 8, 24, 8);
    ctx.strokeStyle = '#ff7aa8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x, footY);
    ctx.lineTo(t.x, g.shelfY + 8);
    const sag = 18 * (1 - Math.min(1, t.lifted / g.pullToOpen));
    ctx.quadraticCurveTo((t.x + end.x) / 2, (g.shelfY + 8 + end.y) / 2 + sag, end.x, end.y);
    ctx.stroke();

    this.select(st);
    this.drawTargetHook(ctx);
  },
});
