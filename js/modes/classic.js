// クラシックモード：← → で左右に動かし、スペースで下ろす（横から見た画面）
const ClassicMode = {
  key: 'classic',
  session: null,
  time: 0,

  start() {
    this.session = new GameSession('classic', { restartHint: 'R か「下ろす」で もういちど' });
    // おまかせモードのあとでも、ふつうのアームに戻す
    Claw.cfg = CONFIG.claw;
    Claw.autoMove = false;
    this.reset();
    Claw.onResult = (kind) => {
      if (kind === 'drop') this.session.usePlay();
      this.session.onClawEvent(kind, Claw.x, Claw.y + 20);
    };
    Claw.canDrop = () => this.session.canPlay();
  },

  reset() {
    this.session.reset();
    this.session.help = '← → で移動、スペースで下ろす';
    Prizes.reset();
    Claw.reset();
    Effects.reset();
  },

  update(dt) {
    this.time += dt;
    if (Input.wasPressed('KeyR')) this.reset();
    // 終わったあとは「下ろす」でも、もう一度遊べる
    if (this.session.gameOver && Input.wasPressed('Space')) this.reset();

    Claw.update(dt, Prizes.list);
    const chute = CONFIG.chute;
    for (const prize of Prizes.update(dt)) {
      this.session.onCaptured(prize, chute.x + chute.w / 2, chute.y);
    }
    Effects.update(dt);
    this.session.update(dt, Claw.state === 'idle', Prizes.list.length);
  },

  draw() {
    Render.drawMachine(this.time);
    Render.drawPrizes(Prizes.list);
    Render.drawClaw(Claw);
    Effects.draw(Render.ctx);
    this.session.drawHud();
  },
};
