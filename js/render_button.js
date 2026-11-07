// 2 ボタンモードの描画。床を斜め前から見た形で描き、奥にあるものほど小さく上に描く
const ButtonRender = {
  // 世界の座標（x：左右、z：奥行き、h：高さ）を画面上の位置と大きさの倍率 k に変える
  project(x, z, h) {
    const u = CONFIG.ufo;
    const t = z / u.worldD;                     // 0 が手前、1 が奥
    const k = 1 - (1 - u.backScale) * t;
    return {
      x: u.centerX + (x - u.worldW / 2) * k,
      y: u.frontY - (u.frontY - u.backY) * t - h * k,
      k,
    };
  },

  // 床の上の四角形（x0〜x1、z0〜z1）の道を作る
  floorPath(ctx, x0, z0, x1, z1) {
    const a = this.project(x0, z0, 0);
    const b = this.project(x1, z0, 0);
    const c = this.project(x1, z1, 0);
    const d = this.project(x0, z1, 0);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
  },

  drawScene(time, claw, prizes, mode) {
    const ctx = Render.ctx;
    this.drawMachine(ctx, time);

    // 奥にあるものから順に描くと、手前のものが前に重なる
    const items = prizes.map((p) => ({ z: p.z, draw: () => this.drawPrize(ctx, p) }));
    items.push({ z: mode.headZ() - 0.5, draw: () => this.drawClaw(ctx, claw, mode) });
    // 影は床の上なので、すべての物より先に描く
    for (const p of prizes) this.drawShadow(ctx, p.x, p.z, p.r, p.h);
    this.drawShadow(ctx, mode.headX(), mode.headZ(), 18, claw.h - CONFIG.claw.armLength);
    items.sort((a, b) => b.z - a.z);
    for (const item of items) item.draw();

    this.drawButtonLamps(ctx, claw.state);
  },

  drawMachine(ctx, time) {
    const c = CONFIG.colors;
    const u = CONFIG.ufo;
    const box = CONFIG.case;

    ctx.fillStyle = c.background;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    // 外枠と電飾（クラシックモードと同じ見た目）
    ctx.fillStyle = c.frame;
    ctx.fillRect(box.x - 12, box.y - 12, box.w + 24, box.h + 24);
    const lightOn = Math.floor(time * 3) % 2;
    for (let x = box.x + 2, i = 0; x < box.x + box.w; x += 28, i++) {
      ctx.fillStyle = (i + lightOn) % 2 ? '#ffe066' : '#ffffff';
      ctx.fillRect(x, box.y - 9, 6, 6);
    }

    // ケースの中（奥の壁を少し明るくして奥行きを出す）
    ctx.fillStyle = '#332e57';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    const backLeft = this.project(0, u.worldD, 0);
    const backRight = this.project(u.worldW, u.worldD, 0);
    ctx.fillStyle = c.glass;
    ctx.fillRect(backLeft.x, box.y, backRight.x - backLeft.x, backLeft.y - box.y);

    // 床
    ctx.fillStyle = c.floor;
    this.floorPath(ctx, 0, 0, u.worldW, u.worldD);
    ctx.fill();
    // 床の格子（奥行きをわかりやすくするため）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let z = 40; z < u.worldD; z += 40) {
      const a = this.project(0, z, 0);
      const b = this.project(u.worldW, z, 0);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (let x = 50; x < u.worldW; x += 50) {
      const a = this.project(x, 0, 0);
      const b = this.project(x, u.worldD, 0);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // 床の手前の厚み
    const fl = this.project(0, 0, 0);
    const fr = this.project(u.worldW, 0, 0);
    ctx.fillStyle = '#463d73';
    ctx.fillRect(fl.x, fl.y, fr.x - fl.x, box.y + box.h - fl.y);

    // 取り出し口（左手前の穴）
    ctx.fillStyle = c.chute;
    this.floorPath(ctx, 0, 0, u.chute.w, u.chute.d);
    ctx.fill();
    ctx.fillRect(fl.x, fl.y, this.project(u.chute.w, 0, 0).x - fl.x, box.y + box.h - fl.y);
    ctx.strokeStyle = c.chuteEdge;
    ctx.lineWidth = 3;
    this.floorPath(ctx, 0, 0, u.chute.w, u.chute.d);
    ctx.stroke();
    const label = this.project(u.chute.w / 2, 0, 0);
    ctx.fillStyle = c.chuteEdge;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('とりだし口', label.x, label.y + 18);
  },

  // 床に落ちる影。高いところにあるほど薄く小さくする
  drawShadow(ctx, x, z, r, h) {
    const u = CONFIG.ufo;
    if (x < u.chute.w && z < u.chute.d) return; // 穴の上には影を落とさない
    const p = this.project(x, z, 0);
    const fade = Math.max(0.15, 1 - Math.max(0, h) / u.topH);
    ctx.fillStyle = 'rgba(10, 8, 25, ' + (0.45 * fade) + ')';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * p.k * (0.6 + 0.4 * fade), r * p.k * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  drawPrize(ctx, p) {
    const u = CONFIG.ufo;
    const center = this.project(p.x, p.z, p.h + p.r);
    const size = Math.round(p.r * 2.2 * center.k);
    ctx.save();
    // 取り出し口に落ちていく景品は、穴の中だけに見えるようにする
    if (p.h < 0) {
      this.floorPath(ctx, 0, 0, u.chute.w, u.chute.d);
      ctx.clip();
    }
    Render.drawPrizeImage(p.type, center.x, center.y, size, p.angle);
    ctx.restore();
  },

  drawClaw(ctx, claw, mode) {
    const c = CONFIG.colors;
    const u = CONFIG.ufo;
    // 本体は揺れを含めた位置、ケーブルの上端は台車の位置
    const head = this.project(mode.headX(), mode.headZ(), claw.h);
    const top = this.project(claw.x, claw.z, u.topH + 40);
    const k = head.k;

    // レール（アームのある奥行きの位置に横向きに渡す）
    const railL = this.project(0, claw.z, u.topH + 40);
    const railR = this.project(u.worldW, claw.z, u.topH + 40);
    ctx.fillStyle = c.frame;
    ctx.fillRect(railL.x, railL.y - 3, railR.x - railL.x, 6);
    ctx.fillStyle = c.clawDark;
    ctx.fillRect(Math.round(top.x - 16 * k), Math.round(top.y - 6), Math.round(32 * k), 12);

    // ケーブル
    ctx.strokeStyle = c.cable;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(head.x, head.y - 10 * k);
    ctx.stroke();

    // 爪
    const spread = mode.tipSpread() * k;
    const armLen = CONFIG.claw.armLength * k;
    const tipY = head.y + armLen;
    const elbowY = head.y + armLen * 0.55;
    ctx.strokeStyle = c.claw;
    ctx.lineWidth = Math.max(3, 5 * k);
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(head.x + side * 8 * k, head.y + 6 * k);
      ctx.lineTo(head.x + side * (spread + 8 * k), elbowY);
      ctx.lineTo(head.x + side * spread, tipY);
      ctx.lineTo(head.x + side * (spread - 7 * k), tipY - 2);
      ctx.stroke();
    }

    // 本体
    const img = Render.clawHeadImage;
    const s = 3 * k;
    ctx.drawImage(img, Math.round(head.x - img.width * s / 2), Math.round(head.y - 12 * k),
      Math.round(img.width * s), Math.round(img.height * s));
  },

  // 床の手前の板に、いま押せるボタンを光らせて表示する
  drawButtonLamps(ctx, state) {
    const lit1 = state === 'ready1' || state === 'move1';
    const lit2 = state === 'ready2' || state === 'move2';
    const lamps = [
      { label: '①', arrow: '→', lit: lit1, x: 392 },
      { label: '②', arrow: '↑', lit: lit2, x: 428 },
    ];
    const y = 528; // 床の手前の板の上
    for (const lamp of lamps) {
      ctx.fillStyle = lamp.lit ? '#ffe066' : '#4a4470';
      ctx.beginPath();
      ctx.arc(lamp.x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = lamp.lit ? '#2b2745' : '#8f89b8';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lamp.label + lamp.arrow, lamp.x, y + 4);
    }
  },
};
