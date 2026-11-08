// 起動処理、メニュー画面、メインループ
(function () {
  const canvas = document.getElementById('game');
  Render.init(canvas);
  Input.init();
  Collection.init(document.getElementById('zukan-list'));

  const MODES = { classic: ClassicMode, button: ButtonMode, three: ThreeClawMode };
  const MODE_KEYS = ['classic', 'button', 'three'];

  const menu = document.getElementById('menu');
  // 並び順は 行（遊び方）ごとに かんたん → むずかしい。index が偶数なら かんたん、奇数なら むずかしい
  const menuButtons = Array.from(menu.querySelectorAll('[data-mode]'));
  const scoreLabels = Array.from(menu.querySelectorAll('[data-score-for]'));
  const backButton = document.getElementById('back-to-menu');
  const controls = {
    classic: document.getElementById('controls-classic'),
    button: document.getElementById('controls-button'),
    three: document.getElementById('controls-three'),
  };
  const helps = {
    classic: document.getElementById('help-classic'),
    button: document.getElementById('help-button'),
    three: document.getElementById('help-three'),
  };
  const zukanProgress = document.getElementById('zukan-progress');

  let current = null;   // 遊んでいるモード（メニュー表示中は null）
  let selected = 0;     // メニューで選んでいる項目（menuButtons の番号）
  let time = 0;

  function updateZukanProgress() {
    zukanProgress.textContent = Collection.completedCount() + ' / ' + PRIZE_SPRITES.length + ' しゅるい';
  }

  function selectMenu(index) {
    selected = (index + menuButtons.length) % menuButtons.length;
    menuButtons.forEach((b, i) => b.classList.toggle('selected', i === selected));
  }

  // 6 つのメニューそれぞれに、その遊び方と難しさのハイスコアを表示する
  function updateMenuScores() {
    for (const label of scoreLabels) {
      const scoreKey = GameSession.scoreKey(label.dataset.scoreFor, label.dataset.scoreLevel === 'hard');
      label.textContent = Collection.highScores[scoreKey] || 0;
    }
  }

  function showMenu() {
    current = null;
    menu.hidden = false;
    backButton.hidden = true;
    for (const key of MODE_KEYS) {
      controls[key].hidden = true;
      helps[key].hidden = true;
    }
    Input.clearPressed();
    selectMenu(selected);
    updateMenuScores();
  }

  // key は遊び方、hard は むずかしい（揺れあり）かどうか
  function startMode(key, hard) {
    current = MODES[key];
    selected = MODE_KEYS.indexOf(key) * 2 + (hard ? 1 : 0);
    menu.hidden = true;
    backButton.hidden = false;
    for (const k of MODE_KEYS) {
      controls[k].hidden = k !== key;
      helps[k].hidden = k !== key;
    }
    Input.clearPressed();
    Swing.enabled = hard;
    current.start();
  }

  menuButtons.forEach((b) => b.addEventListener('click', () =>
    startMode(b.dataset.mode, b.dataset.level === 'hard')));
  backButton.addEventListener('click', showMenu);

  // 最初に何か操作したときに、音を鳴らす準備をする
  const unlockSound = () => Sound.unlock();
  window.addEventListener('keydown', unlockSound);
  window.addEventListener('pointerdown', unlockSound);

  function updateMenu() {
    // ↑ ↓ で遊び方、← → で かんたん・むずかしい を選ぶ
    if (Input.wasPressed('ArrowUp')) selectMenu(selected - 2);
    if (Input.wasPressed('ArrowDown')) selectMenu(selected + 2);
    if (Input.wasPressed('ArrowLeft')) selectMenu(selected - (selected % 2));
    if (Input.wasPressed('ArrowRight')) selectMenu(selected - (selected % 2) + 1);
    // 1〜3 は かんたん、4〜6 は むずかしい
    for (let n = 1; n <= 6; n++) {
      if (Input.wasPressed('Digit' + n)) {
        startMode(MODE_KEYS[(n - 1) % 3], n > 3);
        return;
      }
    }
    if (Input.wasPressed('Enter') || Input.wasPressed('Space')) {
      startMode(MODE_KEYS[Math.floor(selected / 2)], selected % 2 === 1);
    }
  }

  function update(dt) {
    time += dt;
    if (Input.wasPressed('KeyM')) Sound.toggle();
    if (!current) {
      updateMenu();
      return;
    }
    if (Input.wasPressed('Escape')) {
      showMenu();
      return;
    }
    current.update(dt);
  }

  function draw() {
    if (current) {
      current.draw();
    } else {
      // メニューの後ろには、クラシックモードの筐体を背景として描く
      Render.drawMachine(time);
    }
  }

  let lastTime = performance.now();
  let lastCollectionCount = -1;

  function loop(now) {
    // 経過時間（秒）。タブ切り替え直後などの大きな値は上限を設ける
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(dt);
    draw();
    // 図鑑の進み具合は、数が変わったときだけ書き換える
    const count = Collection.completedCount();
    if (count !== lastCollectionCount) {
      lastCollectionCount = count;
      updateZukanProgress();
    }
    requestAnimationFrame(loop);
  }

  showMenu();
  requestAnimationFrame(loop);
})();
