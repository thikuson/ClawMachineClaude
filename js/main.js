// 起動処理、メニュー画面、メインループ
(function () {
  const canvas = document.getElementById('game');
  Render.init(canvas);
  Input.init();
  Collection.init(document.getElementById('zukan-list'));

  const MODES = { classic: ClassicMode, button: ButtonMode };
  const MODE_KEYS = ['classic', 'button'];

  const menu = document.getElementById('menu');
  const menuButtons = Array.from(menu.querySelectorAll('[data-mode]'));
  const backButton = document.getElementById('back-to-menu');
  const controls = {
    classic: document.getElementById('controls-classic'),
    button: document.getElementById('controls-button'),
  };
  const helps = {
    classic: document.getElementById('help-classic'),
    button: document.getElementById('help-button'),
  };
  const zukanProgress = document.getElementById('zukan-progress');

  let current = null;   // 遊んでいるモード（メニュー表示中は null）
  let selected = 0;     // メニューで選んでいる項目
  let time = 0;

  function updateZukanProgress() {
    zukanProgress.textContent = Collection.completedCount() + ' / ' + PRIZE_SPRITES.length + ' しゅるい';
  }

  function selectMenu(index) {
    selected = (index + menuButtons.length) % menuButtons.length;
    menuButtons.forEach((b, i) => b.classList.toggle('selected', i === selected));
  }

  function showMenu() {
    current = null;
    menu.hidden = false;
    backButton.hidden = true;
    for (const key of MODE_KEYS) {
      controls[key].hidden = true;
      helps[key].hidden = true;
      document.getElementById('hiscore-' + key).textContent = Collection.highScores[key];
    }
    Input.clearPressed();
    selectMenu(selected);
  }

  function startMode(key) {
    current = MODES[key];
    selected = MODE_KEYS.indexOf(key);
    menu.hidden = true;
    backButton.hidden = false;
    for (const k of MODE_KEYS) {
      controls[k].hidden = k !== key;
      helps[k].hidden = k !== key;
    }
    Input.clearPressed();
    current.start();
  }

  menuButtons.forEach((b) => b.addEventListener('click', () => startMode(b.dataset.mode)));
  backButton.addEventListener('click', showMenu);

  // 最初に何か操作したときに、音を鳴らす準備をする
  const unlockSound = () => Sound.unlock();
  window.addEventListener('keydown', unlockSound);
  window.addEventListener('pointerdown', unlockSound);

  function updateMenu() {
    if (Input.wasPressed('ArrowUp') || Input.wasPressed('ArrowLeft')) selectMenu(selected - 1);
    if (Input.wasPressed('ArrowDown') || Input.wasPressed('ArrowRight')) selectMenu(selected + 1);
    if (Input.wasPressed('Digit1')) startMode('classic');
    else if (Input.wasPressed('Digit2')) startMode('button');
    else if (Input.wasPressed('Enter') || Input.wasPressed('Space')) startMode(MODE_KEYS[selected]);
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
