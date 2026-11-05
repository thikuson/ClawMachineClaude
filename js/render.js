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

    // 床
    ctx.fillStyle = c.floor;
    ctx.fillRect(box.x, box.y + box.h - 40, box.w, 40);

    // 取り出し口
    ctx.fillStyle = c.chute;
    ctx.fillRect(chute.x, chute.y, chute.w, chute.h);

    // アームのレール
    ctx.fillStyle = c.frame;
    ctx.fillRect(box.x, box.y + 10, box.w, 6);
  },

  drawText(text, x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = CONFIG.colors.text;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  },
};
