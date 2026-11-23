// 3 本爪モード：十字キーで左右・奥行きに自由に動かし、スペースで下ろす
// 大きめの景品が最大 3 個だけ置かれる。1 回ごとに制限時間があり、時間切れになると自動で下りる
const FreeControl = {
  firstState: 'ready',
  states: ['ready', 'aim'],
  help: {
    ready: '十字キーで うごかして スペースで おろす',
  },

  // 終了画面でスペースを押すと、もう一度遊べる
  // アームが下りている間などに押されたスペースは読み捨てる（次の回にすぐ下りてしまわないように）
  restartPressed(mode) {
    if (mode.session.gameOver || !this.states.includes(mode.claw.state)) {
      return Input.wasPressed('Space');
    }
    return false;
  },

  anyMoveKey() {
    return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].some((k) => Input.isDown(k));
  },

  update(mode, dt) {
    const u = mode.layout;
    const c = mode.claw;
    switch (c.state) {
      case 'ready': {
        // 動かすか下ろすかしたら、1 回分を使って制限時間が始まる
        const drop = Input.wasPressed('Space');
        if ((this.anyMoveKey() || drop) && mode.session.canPlay()) {
          mode.session.usePlay();
          mode.setState('aim');
          if (drop) this.startDrop(mode);
        }
        break;
      }

      case 'aim': {
        // ↑ が奥、↓ が手前。何度でも、どの向きにも動かせる
        if (Input.isDown('ArrowLeft')) c.x -= u.moveSpeed * dt;
        if (Input.isDown('ArrowRight')) c.x += u.moveSpeed * dt;
        if (Input.isDown('ArrowUp')) c.z += u.moveSpeed * dt;
        if (Input.isDown('ArrowDown')) c.z -= u.moveSpeed * dt;
        c.x = Math.max(u.minX, Math.min(u.maxX, c.x));
        c.z = Math.max(u.minZ, Math.min(u.maxZ, c.z));

        const left = Math.ceil(u.timeLimit - c.timer);
        mode.session.help = 'のこり ' + left + ' びょう　スペースで おろす';
        if (Input.wasPressed('Space') || c.timer >= u.timeLimit) this.startDrop(mode);
        break;
      }
    }
  },

  startDrop(mode) {
    mode.setState('down');
    mode.report('drop');
  },

  // 床の手前の板に、残り時間を表示する
  drawPanel(ctx, mode) {
    const c = mode.claw;
    const u = mode.layout;
    const aiming = c.state === 'aim';
    const left = aiming ? Math.max(0, Math.ceil(u.timeLimit - c.timer)) : u.timeLimit;
    FloorRender.drawLamps(ctx, [
      { text: String(left), lit: aiming, warn: aiming && left <= 5 },
    ]);
  },
};

const ThreeClawMode = createFloorMode({
  key: 'three',
  restartHint: 'R か スペースで もういちど',
  layout: CONFIG.threeClaw,
  arm: CONFIG.threeClawArm,
  prizeCount: CONFIG.threeClaw.prizeCount,
  prizeScale: CONFIG.threeClaw.prizeScale,
  pointScale: CONFIG.threeClaw.pointScale,
  control: FreeControl,
});

// ガイドあり：狙っている間、爪の真下の床に赤い十字の印と点線、爪と同じ奥行きの床に赤い光の帯を出す。それ以外は同じ
const ThreeGuideMode = createFloorMode({
  key: 'threeGuide',
  restartHint: 'R か スペースで もういちど',
  layout: CONFIG.threeClaw,
  arm: CONFIG.threeClawArm,
  prizeCount: CONFIG.threeClaw.prizeCount,
  prizeScale: CONFIG.threeClaw.prizeScale,
  pointScale: CONFIG.threeClaw.pointScale,
  control: FreeControl,
  guide: true,
});
