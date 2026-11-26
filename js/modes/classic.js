// クラシックモード：← → で左右に動かし、スペースで下ろす（横から見た画面）
const ClassicMode = {
  key: 'classic',
  session: null,
  time: 0,

  start() {
    this.session = new GameSession('classic', { restartHint: 'R か「下ろす」で もういちど' });
    // 難しさに合わせて、爪の開きとつかむ力を決める（おまかせモードのあとでも、手で動かすアームに戻す）
    Claw.cfg = Level.apply(CONFIG.claw);
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

  // 今押せるキー（画面のボタンの色と、押せないときの入力を捨てるのに使う。main.js の updateButtons）
  usableKeys() {
    return Input.usable(Claw.state === 'idle' && Claw.canDrop(), !!this.session.gameOver, ['ArrowLeft', 'ArrowRight']);
  },

  update(dt) {
    this.time += dt;
    if (Input.wasPressed('KeyR')) this.reset();
    // 終わったあとは「下ろす」でも、もう一度遊べる（ランダムでは、今の景品のまま続けて遊ぶ）
    if (this.session.gameOver && Input.wasPressed('Space')) this.session.continueOr(() => this.reset());

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
