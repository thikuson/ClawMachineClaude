// ゲームの起動とメインループ
(function () {
  const canvas = document.getElementById('game');
  Render.init(canvas);
  Input.init();
  Collection.init(document.getElementById('zukan-list'));
  const zukanProgress = document.getElementById('zukan-progress');

  const HELP = '← → で移動、スペースで下ろす';
  // ゲーム内のセリフ
  const MESSAGES = {
    get: 'やったね！ ゲットだ！',
    newGet: 'あたらしい なかまが ふえた！',
    rare: 'すごい！ きんのほしだ！',
    miss: 'あれれ… つかめなかった',
    slip: 'おしい！ おちちゃった…',
    lastPlay: 'さいごの いっかい！',
  };

  // ゲームの状態
  let score = 0;
  let playsLeft = 0;
  let gameOver = null;  // 終わったときの結果（遊んでいる間は null）
  let message = HELP;
  let messageTimer = 0;
  let time = 0;
  let endTimer = 0;     // 最後の 1 回のあと、景品が落ち着くまで待つ時間

  function showMessage(key) {
    message = MESSAGES[key];
    messageTimer = 2.5;
  }

  function updateZukanProgress() {
    zukanProgress.textContent = Collection.completedCount() + ' / ' + PRIZE_SPRITES.length + ' しゅるい';
  }

  // アームからの知らせを、メッセージ・効果音・演出に振り分ける
  function onClawEvent(kind) {
    if (kind === 'drop') {
      Sound.drop();
      playsLeft--;
      if (playsLeft === 1) showMessage('lastPlay');
    }
    if (kind === 'grab') Sound.grab();
    if (kind === 'miss') { Sound.miss(); showMessage('miss'); }
    if (kind === 'slip') {
      Sound.slip();
      showMessage('slip');
      Effects.popup('おしい！', Claw.x, Claw.y + 20, '#6fd3ff');
    }
  }

  function onCaptured(prize) {
    const sprite = PRIZE_SPRITES[prize.type];
    const chute = CONFIG.chute;
    const x = chute.x + chute.w / 2;
    score += sprite.points;
    const isNew = Collection.add(prize.type);
    updateZukanProgress();

    Effects.burst(x, chute.y, sprite.rare ? 120 : 50);
    Effects.popup('+' + sprite.points + '点', x + 40, chute.y - 40);
    if (isNew) Effects.popup('はじめて！', x + 40, chute.y - 80, '#ff7aa8');

    if (sprite.rare) { Sound.clear(); showMessage('rare'); }
    else if (isNew) { Sound.clear(); showMessage('newGet'); }
    else { Sound.get(); showMessage('get'); }
  }

  // 回数を使い切ったか、景品がなくなったら終わり
  function checkGameOver(dt) {
    if (gameOver) return;
    const noPrizes = Prizes.list.length === 0;
    if ((playsLeft > 0 && !noPrizes) || Claw.state !== 'idle') {
      endTimer = 0;
      return;
    }
    // 最後に落とした景品が取り出し口に入るかもしれないので、少し待つ
    endTimer += dt;
    if (endTimer < 1) return;
    const isRecord = Collection.submitScore(score);
    gameOver = { score, isRecord, allClear: noPrizes };
    if (isRecord || noPrizes) Sound.clear();
  }

  function resetGame() {
    score = 0;
    playsLeft = CONFIG.game.plays;
    gameOver = null;
    endTimer = 0;
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
  Claw.canDrop = () => playsLeft > 0 && !gameOver;
  resetGame();
  updateZukanProgress();

  let lastTime = performance.now();

  function update(dt) {
    time += dt;
    if (Input.wasPressed('KeyR')) resetGame();
    if (Input.wasPressed('KeyM')) Sound.toggle();
    // 終わったあとは「下ろす」でも、もう一度遊べる
    if (gameOver && Input.wasPressed('Space')) resetGame();

    Claw.update(dt, Prizes.list);
    for (const prize of Prizes.update(dt)) onCaptured(prize);
    Effects.update(dt);
    checkGameOver(dt);

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
    Render.drawHud({ score, playsLeft, highScore: Collection.highScore, message, soundOn: Sound.enabled });
    if (gameOver) Render.drawGameOver(gameOver, Collection.highScore);
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
