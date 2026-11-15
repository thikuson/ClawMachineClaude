// おまかせモード：アームが自動で左右に往復するので、スペース（「下ろす」）を押すだけで遊べる
// クラシックモードの仕組みをそのまま使い、アームの設定と景品の数だけを変える
const AutoMode = {
  key: 'auto',
  session: null,
  time: 0,

  start() {
    this.session = new GameSession('auto', { restartHint: 'R か「下ろす」で もういちど' });
    // 爪を大きく開き、つかむ力も強くする（CONFIG.autoClaw にない値はクラシックと同じ）
    Claw.cfg = Object.assign({}, CONFIG.claw, CONFIG.autoClaw);
    Claw.autoMove = true;
    this.reset();
    Claw.onResult = (kind) => {
      if (kind === 'drop') this.session.usePlay();
      this.session.onClawEvent(kind, Claw.x, Claw.y + 20);
    };
    Claw.canDrop = () => this.session.canPlay();
  },

  reset() {
    this.session.reset();
    this.session.help = 'ここだ！ と思ったら スペースで下ろす';
    Prizes.reset(CONFIG.autoClaw.prizeCount);
    Claw.reset();
    Effects.reset();
  },

  update(dt) {
    ClassicMode.update.call(this, dt);
  },

  draw() {
    ClassicMode.draw.call(this);
  },
};
