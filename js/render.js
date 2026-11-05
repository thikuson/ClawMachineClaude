// 画面の描画を担当する
const Render = {
  ctx: null,

  init(canvas) {
    this.ctx = canvas.getContext('2d');
  },

  // 筐体（枠・ガラス・床・取り出し口）を描く
  drawMachine() {
    const ctx = this.ctx;
    const c = CONFIG.colors;
    const box = CONFIG.case;
    const chute = CONFIG.chute;

    ctx.fillStyle = c.background;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);

    // 外枠
    ctx.fillStyle = c.frame;
    ctx.fillRect(box.x - 12, box.y - 12, box.w + 24, box.h + 24);

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

    // アームのレール
    ctx.fillStyle = c.frame;
    ctx.fillRect(box.x, box.y + 10, box.w, 6);
  },

  // 景品（ステップ3でドット絵に置き換える予定）
  drawPrizes(prizes) {
    const ctx = this.ctx;
    for (const p of prizes) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      // 顔
      ctx.fillStyle = '#2b2745';
      ctx.beginPath();
      ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.1, p.r * 0.12, 0, Math.PI * 2);
      ctx.arc(p.x + p.r * 0.35, p.y - p.r * 0.1, p.r * 0.12, 0, Math.PI * 2);
      ctx.fill();
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
    ctx.fillRect(claw.x - 16, railY - 7, 32, 12);

    // 爪
    const spread = claw.tipSpread();
    const tipY = claw.tipY();
    const elbowY = claw.y + CONFIG.claw.armLength * 0.55;
    ctx.strokeStyle = c.claw;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(claw.x + side * 8, claw.y + 6);
      ctx.lineTo(claw.x + side * (spread + 8), elbowY);
      ctx.lineTo(claw.x + side * spread, tipY);
      ctx.lineTo(claw.x + side * (spread - 7), tipY - 2); // 先の返し
      ctx.stroke();
    }

    // 本体
    ctx.fillStyle = c.clawDark;
    ctx.fillRect(claw.x - 16, headTop, 32, 18);
    ctx.fillStyle = c.claw;
    ctx.fillRect(claw.x - 12, headTop + 3, 24, 5);
  },

  // 上の獲得数と下のメッセージ
  drawHud(score, message) {
    const ctx = this.ctx;
    ctx.fillStyle = CONFIG.colors.text;
    ctx.textAlign = 'left';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('獲得：' + score, 24, 34);
    ctx.textAlign = 'right';
    ctx.fillText('残り：' + Prizes.list.length, CONFIG.width - 24, 34);
    this.drawText(message, CONFIG.width / 2, CONFIG.height - 44);
  },

  drawText(text, x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = CONFIG.colors.text;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  },
};
