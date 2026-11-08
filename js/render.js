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
    const elbowY = claw.y + CONFIG.claw.armLength * 0.55;
    ctx.strokeStyle = c.claw;
    ctx.lineWidth = 5;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + side * 8, claw.y + 6);
      ctx.lineTo(hx + side * (spread + 8), elbowY);
      ctx.lineTo(hx + side * spread, tipY);
      ctx.lineTo(hx + side * (spread - 7), tipY - 2); // 先の返し
      ctx.stroke();
    }

    // 本体（ドット絵を 3 倍に拡大）
    const img = this.clawHeadImage;
    ctx.drawImage(img, Math.round(hx - img.width * 1.5), Math.round(headTop - 2),
      img.width * 3, img.height * 3);
  },

  // 上のスコア・残り回数・ハイスコアと、下のメッセージ
  drawHud(hud) {
    const ctx = this.ctx;
    ctx.fillStyle = CONFIG.colors.text;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('スコア：' + hud.score, 24, 32);
    ctx.textAlign = 'center';
    // 残り回数は、少なくなったら色を変えて目立たせる
    ctx.fillStyle = hud.playsLeft <= 2 ? '#ff7aa8' : CONFIG.colors.text;
    ctx.fillText('のこり ' + hud.playsLeft + ' 回', CONFIG.width / 2, 32);
    ctx.fillStyle = CONFIG.colors.text;
    ctx.textAlign = 'right';
    ctx.font = '15px sans-serif';
    ctx.fillText('ハイスコア：' + hud.highScore, CONFIG.width - 24, 32);

    this.drawText(hud.message, CONFIG.width / 2, CONFIG.height - 52);
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.7;
    ctx.fillText((hud.swingOn ? 'むずかしい（揺れあり）' : 'かんたん（揺れなし）') + '　効果音：' +
      (hud.soundOn ? 'オン' : 'オフ') + '（M）', CONFIG.width / 2, CONFIG.height - 20);
    ctx.globalAlpha = 1;
  },

  // ゲーム終了の画面
  drawGameOver(result, highScore, restartHint) {
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
    ctx.fillText(result.allClear ? 'ぜんぶ ゲット！' : 'ゲーム しゅうりょう', cx, 228);

    ctx.fillStyle = CONFIG.colors.text;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('スコア：' + result.score + ' 点', cx, 285);
    ctx.font = '18px sans-serif';
    ctx.fillText('ハイスコア：' + highScore + ' 点', cx, 320);

    if (result.isRecord) {
      ctx.fillStyle = '#ff7aa8';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('しんきろく！', cx, 360);
    }

    ctx.fillStyle = CONFIG.colors.text;
    ctx.font = '16px sans-serif';
    ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(performance.now() / 400));
    ctx.fillText(restartHint, cx, 410);
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
