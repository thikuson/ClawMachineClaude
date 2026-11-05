// ゲームの起動とメインループ
(function () {
  const canvas = document.getElementById('game');
  Render.init(canvas);
  Input.init();

  let lastTime = performance.now();

  // 状態の更新（ステップ2でアームの動きなどを追加する）
  function update(dt) {}

  function draw() {
    Render.drawMachine();
    Render.drawText('じゅんび ちゅう…', CONFIG.width / 2, CONFIG.height - 40);
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
