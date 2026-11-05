// ゲームの起動とメインループ
(function () {
  const canvas = document.getElementById('game');
  Render.init(canvas);
  Input.init();

  const HELP = '← → で移動、スペースで下ろす';
  // ゲーム内のセリフ
  const MESSAGES = {
    get: 'やったね！ ゲットだ！',
    miss: 'あれれ… つかめなかった',
    slip: 'おしい！ おちちゃった…',
    clear: 'ぜんぶ ゲット！ R でもういちど',
  };

  let score = 0;
  let message = HELP;
  let messageTimer = 0;
  let time = 0;

  function showMessage(key) {
    message = MESSAGES[key];
    messageTimer = 2.5;
  }

  // アームからの知らせを、メッセージ・効果音・演出に振り分ける
  function onClawEvent(kind) {
    if (kind === 'drop') Sound.drop();
    if (kind === 'grab') Sound.grab();
    if (kind === 'miss') { Sound.miss(); showMessage('miss'); }
    if (kind === 'slip') {
      Sound.slip();
      showMessage('slip');
      Effects.popup('おしい！', Claw.x, Claw.y + 20, '#6fd3ff');
    }
  }

  function onCaptured() {
    const chute = CONFIG.chute;
    const x = chute.x + chute.w / 2;
    const allClear = Prizes.list.length === 0;
    Effects.burst(x, chute.y, allClear ? 120 : 50);
    Effects.popup(allClear ? 'ぜんぶゲット！' : 'ゲット！', allClear ? CONFIG.width / 2 : x + 30, chute.y - 40);
    if (allClear) {
      Sound.clear();
      showMessage('clear');
      messageTimer = Infinity; // リセットするまで出しておく
    } else {
      Sound.get();
      showMessage('get');
    }
  }

  function resetGame() {
    score = 0;
    message = HELP;
    messageTimer = 0;
    Prizes.reset();
    Claw.reset();
    Effects.reset();
  }

  // 最初に何か操作したときに、音を鳴らす準備をする
  const unlockSound = () => Sound.unlock();
  window.addEventListener('keydown', unlockSound);
  window.addEventListener('pointerdown', unlockSound);

  Claw.onResult = onClawEvent;
  resetGame();

  let lastTime = performance.now();

  function update(dt) {
    time += dt;
    if (Input.wasPressed('KeyR')) resetGame();
    if (Input.wasPressed('KeyM')) Sound.toggle();

    Claw.update(dt, Prizes.list);
    const captured = Prizes.update(dt);
    if (captured > 0) {
      score += captured;
      onCaptured();
    }
    Effects.update(dt);

    // 一定時間たったら操作説明に戻す
    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) message = HELP;
    }
  }

  function draw() {
    Render.drawMachine(time);
    Render.drawPrizes(Prizes.list);
    Render.drawClaw(Claw);
    Effects.draw(Render.ctx);
    Render.drawHud(score, message, Sound.enabled);
  }

  function loop(now) {
    // 経過時間（秒）。タブ切り替え直後などの大きな値は上限を設ける
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
