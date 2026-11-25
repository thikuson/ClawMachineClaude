// 画面の描画を担当する
const Render = {
  ctx: null,
  prizeImages: [], // 景品のドット絵（PRIZE_SPRITES と同じ順番）
  clawHeadImage: null,

  init(canvas) {
    this.ctx = canvas.getContext('2d');
    // ドット絵を拡大したときにぼやけないようにする
    this.ctx.imageSmoothingEnabled = false;
    this.prizeImages = PRIZE_SPRITES.map((sprite) => buildSprite(sprite));
    this.clawHeadImage = buildSprite(CLAW_HEAD_SPRITE);
  },

  // 筐体（枠・ガラス・床・取り出し口）を描く
  drawMachine(time) {
    const ctx = this.ctx;
    const c = CONFIG.colors;
    const box = CONFIG.case;
    const chute = CONFIG.chute;

    ctx.fillStyle = c.background;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    // 外枠
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

    // ガラスケースの中
    ctx.fillStyle = c.glass;
    ctx.fillRect(box.x, box.y, box.w, box.h);

    // 床（取り出し口の右から）
    ctx.fillStyle = c.floor;
    ctx.fillRect(chute.x + chute.w, CONFIG.floorY, box.x + box.w - chute.x - chute.w, box.y + box.h - CONFIG.floorY);

    // 取り出し口
    ctx.fillStyle = c.chute;
    ctx.fillRect(chute.x, chute.y, chute.w, chute.h);
    ctx.fillStyle = c.chuteEdge;
    ctx.fillRect(chute.x + chute.w - 4, chute.y, 6, chute.h);
    ctx.fillRect(chute.x, chute.y - 3, chute.w + 2, 4);

    // 取り出し口の案内
    ctx.fillStyle = c.chuteEdge;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('とりだし口', chute.x + chute.w / 2, chute.y + 26);

    // アームのレール
    ctx.fillStyle = c.frame;
    ctx.fillRect(box.x, box.y + 10, box.w, 6);

    // ガラスの反射
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.moveTo(box.x + 40, box.y);
    ctx.lineTo(box.x + 90, box.y);
    ctx.lineTo(box.x + 20, box.y + 180);
    ctx.lineTo(box.x, box.y + 180);
    ctx.lineTo(box.x, box.y + 100);
    ctx.closePath();
    ctx.fill();
  },

  // 景品。当たり判定の円より少し大きめにドット絵を描く
  drawPrizes(prizes) {
    for (const p of prizes) this.drawPrizeImage(p.type, p.x, p.y, Math.round(p.r * 2.2), p.angle);
  },

  // 景品の絵を (x, y) を中心に描く。転がる景品は angle だけ回転させる
  drawPrizeImage(type, x, y, size, angle) {
    const ctx = this.ctx;
    const img = this.prizeImages[type];
    if (PRIZE_SPRITES[type].round && angle) {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(angle);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      ctx.drawImage(img, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    }
  },

  // アーム（ケーブル・本体・2 本の爪）
  drawClaw(claw) {
    const ctx = this.ctx;
    // 壁ぎわでは爪がケースの外にはみ出すので、ケースの内側だけに描く（壁の向こうに隠れて見える）
    const box = CONFIG.case;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, 0, box.w, CONFIG.height);
    ctx.clip();
    this.drawClawInCase(claw);
    ctx.restore();
  },

  drawClawInCase(claw) {
    const ctx = this.ctx;
    const c = CONFIG.colors;
    const railY = CONFIG.case.y + 13;
    const headTop = claw.y - 10;
    const hx = claw.headX(); // 揺れを含めたアーム本体の位置

    // ケーブル（揺れているときは斜めになる）
    ctx.strokeStyle = c.cable;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(claw.x, railY);
    ctx.lineTo(hx, headTop);
    ctx.stroke();

    // レールの上の台車
    ctx.fillStyle = c.clawDark;
    ctx.fillRect(Math.round(claw.x) - 16, railY - 7, 32, 12);

    // 爪
    const spread = claw.tipSpread();
    const tipY = claw.tipY();
    ctx.strokeStyle = c.claw;
    ctx.lineWidth = 5;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    const elbow = this.armElbow(8, claw.y + 6, spread, tipY, claw.openness);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + side * 8, claw.y + 6);
      ctx.lineTo(hx + side * elbow.r, elbow.y);
      ctx.lineTo(hx + side * spread, tipY);
      ctx.stroke();
    }
    // 爪の先の金属の板
    for (const side of [-1, 1]) this.drawMetalTip(ctx, hx + side * spread, tipY, -side, 0, 1, false, this.tipPlateLength(spread));

    // 本体（ドット絵を 3 倍に拡大）
    const img = this.clawHeadImage;
    ctx.drawImage(img, Math.round(hx - img.width * 1.5), Math.round(headTop - 2),
      img.width * 3, img.height * 3);
  },

  // 爪の曲がり角（ひじ）の位置。爪は「上の棒」と「下の棒」が直角につながった 1 本の部品で、付け根を軸に回る形にする。
  // 開ききると上の棒が真横、下の棒が真下（「|_   _|」の形）、閉じると上の棒が斜め下、下の棒が内側へ斜めになる（「＜_ _＞」の形）。
  // 爪の先の位置（当たり判定）は今までどおり tipSpread と tipY で決まっているので、付け根と先を結ぶ線の上に
  // 直角の角ができる点を、上の棒の向きから求める（先を上の棒の線に垂直に下ろした点）。
  // r は中心から外へ向かう距離、y は下向き。openness は爪の開き具合（0 で閉じ、1 で全開）
  armElbow(rootR, rootY, tipR, tipY, openness) {
    const o = Math.max(0, Math.min(1, openness));
    const a = (50 * Math.PI / 180) * (1 - o); // 上の棒が真横から下へ傾く角度
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const len = Math.max(0, (tipR - rootR) * ux + (tipY - rootY) * uy);
    return { r: rootR + ux * len, y: rootY + uy * len };
  },

  // 爪の先の金属の板の長さ。閉じたときに左右の板がぶつからないよう、先の位置が中心に近いときは短くする
  tipPlateLength(spread) {
    return Math.max(4, Math.min(12, spread - 2));
  },

  // 爪の先に付いた金属（アルミやステンレス）の薄い板。横から見た形で描く
  // (x, y) は爪の先の付け根、(ix, iy) は爪の内側へ向かう向き（長さ 1）、k は大きさの倍率
  // 板はまっすぐで、真横よりほんの少しだけ下を向く。dim を true にすると、奥にある爪として暗めに描く
  drawMetalTip(ctx, x, y, ix, iy, k, dim, length) {
    // 少し下へ傾けた向き
    let dx = ix;
    let dy = iy + 0.15;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    // 板の厚みの向き（上側）
    let nx = dy;
    let ny = -dx;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const len = (length || 12) * k;
    const half = Math.max(1.5, 1.8 * k); // 厚みの半分
    const pt = (a, b) => ({ x: x + dx * a + nx * b, y: y + dy * a + ny * b });
    const c = [pt(0, half), pt(len, half * 0.8), pt(len, -half * 0.8), pt(0, -half)];
    ctx.save();
    // 板の地（銀色）と、まわりの縁
    ctx.beginPath();
    ctx.moveTo(c[0].x, c[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(c[i].x, c[i].y);
    ctx.closePath();
    ctx.fillStyle = dim ? '#8a939d' : '#b9c3cc';
    ctx.fill();
    ctx.strokeStyle = dim ? '#3f454d' : '#4d5560';
    ctx.lineWidth = 1;
    ctx.lineJoin = 'miter';
    ctx.stroke();
    // 上の面に光が当たって明るく見える筋
    const t0 = pt(1, half * 0.45);
    const t1 = pt(len - 1, half * 0.35);
    ctx.strokeStyle = dim ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = Math.max(0.8, 0.9 * k);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(t0.x, t0.y);
    ctx.lineTo(t1.x, t1.y);
    ctx.stroke();
    // 板を爪に留めているびょう
    ctx.fillStyle = dim ? '#5f6770' : '#6b747f';
    ctx.beginPath();
    ctx.arc(pt(2.5 * k, 0).x, pt(2.5 * k, 0).y, Math.max(0.8, 0.9 * k), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // 上の取った数・残り回数・持っているコインと、下のメッセージ
  drawHud(hud) {
    const ctx = this.ctx;
    ctx.fillStyle = CONFIG.colors.text;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(hud.left, 24, 32);
    ctx.textAlign = 'center';
    ctx.fillStyle = hud.warn ? '#ff7aa8' : CONFIG.colors.text;
    ctx.fillText(hud.center, CONFIG.width / 2 + 10, 32);
    ctx.fillStyle = CONFIG.colors.text;
    ctx.textAlign = 'right';
    ctx.font = '15px sans-serif';
    ctx.fillText(hud.right, CONFIG.width - 24, 32);

    this.drawText(hud.message, CONFIG.width / 2, CONFIG.height - 52);
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.7;
    ctx.fillText(hud.levelLabel + '　効果音：' +
      (hud.soundOn ? 'オン' : 'オフ') + '（M）', CONFIG.width / 2, CONFIG.height - 20);
    ctx.globalAlpha = 1;
  },

  // ゲーム終了の画面。lines は真ん中に出す結果（取った数・もらったコインなど）
  drawGameOver(result, lines, restartHint) {
    const ctx = this.ctx;
    const cx = CONFIG.width / 2;
    ctx.fillStyle = 'rgba(26, 23, 48, 0.82)';
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    // 枠
    ctx.fillStyle = CONFIG.colors.frame;
    ctx.fillRect(cx - 170, 170, 340, 270);
    ctx.fillStyle = CONFIG.colors.background;
    ctx.fillRect(cx - 164, 176, 328, 258);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(result.title || (result.allClear ? 'ぜんぶ ゲット！' : 'ゲーム しゅうりょう'), cx, 228);

    ctx.fillStyle = CONFIG.colors.text;
    lines.forEach((line, i) => {
      ctx.font = i === 0 ? 'bold 22px sans-serif' : '18px sans-serif';
      ctx.fillText(line, cx, 285 + i * 34);
    });

    ctx.fillStyle = CONFIG.colors.text;
    ctx.font = '16px sans-serif';
    ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(performance.now() / 400));
    // 案内が 2 行（ランダムのとき）なら、少し小さくして枠に収める
    const hints = restartHint.split('\n');
    if (hints.length > 1) ctx.font = '15px sans-serif';
    hints.forEach((line, i) => ctx.fillText(line, cx, 410 - (hints.length - 1) * 12 + i * 24));
    ctx.globalAlpha = 1;
  },

  drawText(text, x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = CONFIG.colors.text;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  },
};
