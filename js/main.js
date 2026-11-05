// ゲームの起動とメインループ
(function () {
  const canvas = document.getElementById('game');
  Render.init(canvas);
  Input.init();

  const HELP = '← → で移動、スペースで下ろす';
  const MESSAGES = {
    get: 'ゲット！',
    miss: 'つかめなかった…',
    slip: 'おしい！ 落ちちゃった',
    clear: '全部獲得！ R でリセット',
  };

  let score = 0;
  let message = HELP;
  let messageTimer = 0;

  function showMessage(key) {
    message = MESSAGES[key];
    messageTimer = 2;
  }

  function resetGame() {
    score = 0;
    message = HELP;
    messageTimer = 0;
    Prizes.reset();
    Claw.reset();
  }

  Claw.onResult = showMessage;
  resetGame();

  let lastTime = performance.now();

  function update(dt) {
    if (Input.wasPressed('KeyR')) resetGame();

    Claw.update(dt, Prizes.list);
    const captured = Prizes.update(dt);
    if (captured > 0) {
      score += captured;
      showMessage(Prizes.list.length === 0 ? 'clear' : 'get');
      if (Prizes.list.length === 0) messageTimer = Infinity;
    }

    // 一定時間たったら操作説明に戻す
    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) message = HELP;
    }
  }

  function draw() {
    Render.drawMachine();
    Render.drawPrizes(Prizes.list);
    Render.drawClaw(Claw);
    Render.drawHud(score, message);
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
