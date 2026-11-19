// 起動処理、メニュー画面、メインループ
(function () {
  const canvas = document.getElementById('game');
  Render.init(canvas);
  Input.init();
  Collection.init(document.getElementById('zukan-list'));
  RingMode.setUp(); // メニューの背景に、景品を載せた台とリングを出せるようにしておく
  ShovelMode.setUp(); // メニューの背景に、回るテーブルと景品を出せるようにしておく
  BanbanMode.setUp(); // メニューの背景に、高い床に積んだ景品を出せるようにしておく

  const MODES = { auto: AutoMode, classic: ClassicMode, button: ButtonMode, three: ThreeClawMode, ring: RingMode, shovel: ShovelMode, banban: BanbanMode };
  // 7 つのゲーム。メニューの上から順
  const MODE_KEYS = ['auto', 'classic', 'button', 'three', 'ring', 'shovel', 'banban'];
  // メニューに並ぶもの。7 つのゲームの下に、そのどれかを選ぶランダムがある。数字キーの 1〜8 もこの順
  const MENU_KEYS = MODE_KEYS.concat('random');

  const menu = document.getElementById('menu');
  const menuButtons = Array.from(menu.querySelectorAll('[data-mode]'));   // 7 つのゲームとランダム
  const levelButtons = Array.from(menu.querySelectorAll('.level-tab'));  // かんたん・ふつう・むずかしい
  const scoreLabels = Array.from(menu.querySelectorAll('[data-score-for]'));
  const playBar = document.getElementById('play-bar'); // メニューへ・並べ直す のボタン
  const nextRandomButton = document.getElementById('next-random'); // ランダムで遊び終わったときの「次のランダム」
  const controls = {
    auto: document.getElementById('controls-auto'),
    classic: document.getElementById('controls-classic'),
    button: document.getElementById('controls-button'),
    three: document.getElementById('controls-three'),
    ring: document.getElementById('controls-ring'),
    shovel: document.getElementById('controls-shovel'),
    banban: document.getElementById('controls-banban'),
  };
  const helps = {
    auto: document.getElementById('help-auto'),
    classic: document.getElementById('help-classic'),
    button: document.getElementById('help-button'),
    three: document.getElementById('help-three'),
    ring: document.getElementById('help-ring'),
    shovel: document.getElementById('help-shovel'),
    banban: document.getElementById('help-banban'),
  };
  const zukanProgress = document.getElementById('zukan-progress');

  let current = null;   // 遊んでいるモード（メニュー表示中は null）
  // キーボードで選んでいるゲーム（menuButtons の番号）。-1 は何も選んでいない状態
  // メニューを開いた直後は選ばず、↑ ↓ を押したときだけ枠を光らせる（前に遊んだゲームが選ばれたままに見えないように）
  let selected = -1;
  let levelKey = Collection.level; // メニューで選んでいる難しさ。前回選んだものから始める
  let lastPlayed = 'auto';  // 最後に遊んだゲーム（メニューの背景に使う）
  let playingRandom = false; // ランダムで遊んでいるか
  let lastRandom = null;     // ランダムで最後に選ばれたゲーム
  let hovered = null;       // マウスを乗せているゲーム
  let time = 0;

  function updateZukanProgress() {
    zukanProgress.textContent = Collection.completedCount() + ' / ' + PRIZE_SPRITES.length + ' しゅるい';
  }

  function selectMenu(index) {
    selected = index < 0 ? -1 : index % menuButtons.length;
    menuButtons.forEach((b, i) => b.classList.toggle('selected', i === selected));
  }

  // 難しさを選ぶ。ボタンの見た目・説明・ハイスコアの表示を、選んだ難しさに合わせる
  function selectLevel(key) {
    levelKey = key;
    levelButtons.forEach((b) => {
      const on = b.dataset.level === key;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    menu.dataset.level = key; // ゲームのボタンの枠の色を、難しさに合わせて変える（css）
    Collection.setLevel(key);
    updateMenuScores();
  }

  // ゲームそれぞれに、選んでいる難しさでのハイスコアを表示する
  function updateMenuScores() {
    for (const label of scoreLabels) {
      const scoreKey = GameSession.scoreKey(label.dataset.scoreFor, levelKey);
      label.textContent = Collection.highScores[scoreKey] || 0;
    }
  }

  function showMenu() {
    current = null;
    menu.hidden = false;
    playBar.hidden = true;
    for (const key of MODE_KEYS) {
      controls[key].hidden = true;
      helps[key].hidden = true;
    }
    Input.clearPressed();
    selectMenu(-1);
    selectLevel(levelKey);
  }

  // メニューに書いてあるゲームの名前（「2. クラシック」から番号を除いたもの）。ランダムの画面に出す
  function modeName(key) {
    const button = menuButtons.find((b) => b.dataset.mode === key);
    return button.querySelector('.menu-name').textContent.replace(/^\d+\.\s*/, '');
  }

  // ランダム：7 つのゲームのどれかを選んで始める。続けて遊んだときに同じゲームが続かないように、
  // 前回ランダムで選ばれたゲームは選ばない
  function startRandom() {
    const choices = MODE_KEYS.filter((k) => k !== lastRandom);
    const key = choices[Math.floor(Math.random() * choices.length)];
    lastRandom = key;
    playingRandom = true;
    GameSession.randomName = modeName(key);
    startGame(key);
    // どのゲームが選ばれたか、最初に大きく知らせる
    current.session.message = '「' + GameSession.randomName + '」で あそぼう！';
    current.session.messageTimer = 2.5;
  }

  // key はメニューで選んだもの（7 つのゲームか、ランダム）
  function startMode(key) {
    if (key === 'random') {
      startRandom();
      return;
    }
    playingRandom = false;
    GameSession.randomName = null;
    startGame(key);
  }

  // key は遊び方。難しさは、メニューで選んでいるもの
  function startGame(key) {
    current = MODES[key];
    lastPlayed = key;
    hovered = null;
    menu.hidden = true;
    playBar.hidden = false;
    nextRandomButton.hidden = true;
    for (const k of MODE_KEYS) {
      controls[k].hidden = k !== key;
      helps[k].hidden = k !== key;
    }
    Input.clearPressed();
    Level.set(levelKey);
    current.start();
  }

  menuButtons.forEach((b) => {
    b.addEventListener('click', () => startMode(b.dataset.mode));
    b.addEventListener('pointerenter', () => { hovered = b.dataset.mode; });
    b.addEventListener('pointerleave', () => { if (hovered === b.dataset.mode) hovered = null; });
  });
  levelButtons.forEach((b) => b.addEventListener('click', () => selectLevel(b.dataset.level)));
  document.getElementById('back-to-menu').addEventListener('click', showMenu);

  // 図鑑のリセット。間違えて押しても消えないように、確認してから消す
  document.getElementById('zukan-reset').addEventListener('click', () => {
    if (!window.confirm('けいひんずかんを リセットしますか？\n（あつめた けいひんの きろくが すべて きえます。ハイスコアは のこります）')) return;
    Collection.resetCounts();
  });

  // ハイスコアのリセット。図鑑と同じく、確認してから消す
  document.getElementById('score-reset').addEventListener('click', () => {
    if (!window.confirm('ハイスコアを リセットしますか？\n（すべての あそびかたの ハイスコアが 0 に もどります。ずかんは のこります）')) return;
    Collection.resetHighScores();
    updateMenuScores();
  });

  // 最初に何か操作したときに、音を鳴らす準備をする
  const unlockSound = () => Sound.unlock();
  window.addEventListener('keydown', unlockSound);
  window.addEventListener('pointerdown', unlockSound);

  function updateMenu() {
    // ↑ ↓ で遊び方、← → で難しさを選ぶ
    // 何も選んでいないときは、↓ で一番上、↑ で一番下から選び始める
    const count = menuButtons.length;
    if (Input.wasPressed('ArrowUp')) selectMenu(selected < 0 ? count - 1 : (selected - 1 + count) % count);
    if (Input.wasPressed('ArrowDown')) selectMenu(selected < 0 ? 0 : selected + 1);
    const li = LEVEL_KEYS.indexOf(levelKey);
    if (Input.wasPressed('ArrowLeft') && li > 0) selectLevel(LEVEL_KEYS[li - 1]);
    if (Input.wasPressed('ArrowRight') && li < LEVEL_KEYS.length - 1) selectLevel(LEVEL_KEYS[li + 1]);
    for (let n = 1; n <= MENU_KEYS.length; n++) {
      if (Input.wasPressed('Digit' + n)) {
        startMode(MENU_KEYS[n - 1]);
        return;
      }
    }
    if ((Input.wasPressed('Enter') || Input.wasPressed('Space')) && selected >= 0) startMode(MENU_KEYS[selected]);
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
    // ランダムで遊び終わったあとは、N（「次のランダム」）で別のゲームを選び直す。
    // 「下ろす」などのいつものやり方では、今の景品のまま同じゲームを続けて遊ぶ（GameSession の continueOr）。
    // 遊んでいる途中に押した N が、終わったときに効いてしまわないように、毎回読んで消しておく
    const nextPressed = Input.wasPressed('KeyN');
    if (playingRandom && current.session.gameOver && nextPressed) {
      startRandom();
      return;
    }
    current.update(dt);
    nextRandomButton.hidden = !(playingRandom && current.session.gameOver);
  }

  // メニューの背景に出すゲーム。マウスを乗せているもの → キーボードで選んでいるもの → 最後に遊んだもの の順に決める
  // （どのゲームの筐体かが、選ぶ前からわかるようにするため）
  function previewKey() {
    const key = hovered || (selected >= 0 ? MENU_KEYS[selected] : lastPlayed);
    // ランダムを選んでいるときは、7 つのゲームの筐体を順番に見せる
    if (key === 'random') return MODE_KEYS[Math.floor(time / 1.5) % MODE_KEYS.length];
    return key;
  }

  function draw() {
    if (current) {
      current.draw();
      return;
    }
    const key = previewKey();
    if (key === 'banban') {
      // 高い床に景品を積んだ、横から見た筐体
      BanbanMode.drawScene(time);
    } else if (key === 'shovel') {
      // 斜め上から見た、回るテーブルの筐体
      ShovelMode.drawScene(time);
    } else if (key === 'ring') {
      // リングの筐体（台と景品とリング）
      RingMode.drawScene(time);
    } else if (key === 'button' || key === 'three') {
      // 斜め前から見た筐体。2 ボタンと 3 本爪では取り出し口の大きさが違うので、そのゲームの配置で描く
      FloorRender.layout = MODES[key].layout;
      FloorRender.drawMachine(Render.ctx, time);
    } else {
      // おまかせとクラシックは同じ、横から見た筐体
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
