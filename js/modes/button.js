// 2 ボタンモード：① を押している間は右へ、② を押している間は奥へ動き、② を離すと下りる
// 本物のクレーンゲームと同じく、① → ② の順に 1 回ずつしか押せない
// ① と ② は、キーボードでは → と ↑（または 1 と 2）
const ButtonControl = {
  firstState: 'ready1',
  states: ['ready1', 'move1', 'ready2', 'move2'],
  help: {
    ready1: '① を おしているあいだ 右へ',
    move1: 'はなすと とまるよ',
    ready2: '② を おしているあいだ 奥へ',
    move2: 'はなすと アームが おりるよ',
  },

  button1() { return Input.isDown('ArrowRight') || Input.isDown('Digit1'); },
  button2() { return Input.isDown('ArrowUp') || Input.isDown('Digit2'); },

  // 終了画面で ① を押すと、もう一度遊べる
  restartPressed() {
    const a = Input.wasPressed('ArrowRight');
    const b = Input.wasPressed('Digit1');
    return a || b;
  },

  update(mode, dt) {
    const u = mode.layout;
    const c = mode.claw;
    switch (c.state) {
      case 'ready1':
        // ① を押したら 1 回分を使って動き始める
        if (this.button1() && mode.session.canPlay()) {
          mode.session.usePlay();
          mode.setState('move1');
        }
        break;

      case 'move1':
        c.x = Math.min(u.maxX, c.x + u.moveSpeed * dt);
        if (!this.button1() || c.x >= u.maxX) mode.setState('ready2');
        break;

      case 'ready2':
        if (this.button2()) mode.setState('move2');
        break;

      case 'move2':
        c.z = Math.min(u.maxZ, c.z + u.moveSpeed * dt);
        if (!this.button2() || c.z >= u.maxZ) {
          mode.setState('down');
          mode.report('drop');
        }
        break;
    }
  },

  // 床の手前の板に、いま押せるボタンを光らせて表示する
  drawPanel(ctx, mode) {
    const state = mode.claw.state;
    FloorRender.drawLamps(ctx, [
      { text: '①→', lit: state === 'ready1' || state === 'move1' },
      { text: '②↑', lit: state === 'ready2' || state === 'move2' },
    ]);
  },
};

const ButtonMode = createFloorMode({
  key: 'button',
  restartHint: 'R か ① で もういちど',
  layout: CONFIG.ufo,
  arm: CONFIG.twoClawArm,
  prizeCount: CONFIG.prize.count,
  prizeScale: 1,
  pointScale: 1,
  control: ButtonControl,
});

// ガイドあり：狙っている間、爪の真下の床に赤い十字の印と点線、爪と同じ奥行きの床に赤い光の帯を出す。それ以外は同じ
const ButtonGuideMode = createFloorMode({
  key: 'buttonGuide',
  restartHint: 'R か ① で もういちど',
  layout: CONFIG.ufo,
  arm: CONFIG.twoClawArm,
  prizeCount: CONFIG.prize.count,
  prizeScale: 1,
  pointScale: 1,
  control: ButtonControl,
  guide: true,
});
