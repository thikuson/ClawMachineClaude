// 画面の描画を担当する
const Render = {
  ctx: null,
  prizeImages: [], // 景品のドット絵（PRIZE_SPRITES と同じ順番）
  clawHeadImage: null,

  init(canvas) {
    this.ctx = canvas.getContext('2d');
    // ドット絵を拡大したときにぼやけないようにする
    this.ctx.imageSmoothingEnabled = false;
    this.prizeImages = PRIZE_SPRITES.map(buildSprite);
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
    const ctx = this.ctx;
    for (const p of prizes) {
      const size = Math.round(p.r * 2.2);
      ctx.drawImage(this.prizeImages[p.type],
        Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
    }
  },

  // アーム（ケーブル・本体・2 本の爪）
  drawClaw(claw) {
    const ctx = this.ctx;
    const c = CONFIG.colors;
    const railY = CONFIG.case.y + 13;
    const headTop = claw.y - 10;

    // ケーブル
    ctx.strokeStyle = c.cable;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(claw.x, railY);
    ctx.lineTo(claw.x, headTop);
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
      ctx.moveTo(claw.x + side * 8, claw.y + 6);
      ctx.lineTo(claw.x + side * (spread + 8), elbowY);
      ctx.lineTo(claw.x + side * spread, tipY);
      ctx.lineTo(claw.x + side * (spread - 7), tipY - 2); // 先の返し
      ctx.stroke();
    }

    // 本体（ドット絵を 3 倍に拡大）
    const img = this.clawHeadImage;
    ctx.drawImage(img, Math.round(claw.x - img.width * 1.5), Math.round(headTop - 2),
      img.width * 3, img.height * 3);
  },

  // 上の獲得数と下のメッセージ
  drawHud(score, message, soundOn) {
    const ctx = this.ctx;
    ctx.fillStyle = CONFIG.colors.text;
    ctx.textAlign = 'left';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('獲得：' + score, 24, 34);
    ctx.textAlign = 'right';
    ctx.fillText('残り：' + Prizes.list.length, CONFIG.width - 24, 34);
    this.drawText(message, CONFIG.width / 2, CONFIG.height - 52);
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.7;
    ctx.fillText('効果音：' + (soundOn ? 'オン' : 'オフ') + '（M で切り替え）', CONFIG.width / 2, CONFIG.height - 20);
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
