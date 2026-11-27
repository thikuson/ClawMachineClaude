// 起動処理、メニュー画面、メインループ
(function () {
  const canvas = document.getElementById('game');
  Render.init(canvas);
  Input.init();
  Collection.init(document.getElementById('zukan-list'));
  RingMode.setUp(); // メニューの背景に、景品を載せた台とリングを出せるようにしておく
  SweetMode.setUp(); // メニューの背景に、ドームとプッシャーの台を出せるようにしておく
  Ring2Mode.setUp(); // メニューの背景に、2 段の台を出せるようにしておく
  ShovelMode.setUp(); // メニューの背景に、回るテーブルと景品を出せるようにしておく
  BanbanMode.setUp(); // メニューの背景に、高い床に積んだ景品を出せるようにしておく
  SpiralMode.setUp(); // メニューの背景に、景品を積んだらせんタワーを出せるようにしておく

  const MODES = { auto: AutoMode, classic: ClassicMode, spiral: SpiralMode, button: ButtonMode, buttonGuide: ButtonGuideMode, three: ThreeClawMode, threeGuide: ThreeGuideMode, ring: RingMode, ring2: Ring2Mode, shovel: ShovelMode, sweet: SweetMode, banban: BanbanMode, autobanban: BanbanAutoMode, boss: BossMode };
  // 遊べるゲーム（ランダムは、このどれかを選ぶので含めない）。並び順は config.js の GAMES
  const MODE_KEYS = GAMES.map((g) => g.key).filter((k) => MODES[k]);
  // ランダムで選ぶゲーム（ステップだけのぬしの台は入れない）
  const RANDOM_KEYS = GAMES.filter((g) => MODES[g.key] && !g.stepOnly).map((g) => g.key);

  const menu = document.getElementById('menu');
  const menuList = document.getElementById('menu-list');
  const menuInfo = document.getElementById('menu-info');
  const modeTabs = Array.from(menu.querySelectorAll('.mode-tab'));     // フリー・チャレンジ・ステップ
  const levelButtons = Array.from(menu.querySelectorAll('.level-tab'));  // かんたん・ふつう・むずかしい
  const wallet = document.getElementById('menu-wallet'); // メニューの持ち物（銀コイン・金コイン）
  // ゲームのボタン（押せるものだけ、上から順）。モードのタブを切り替えるたびに作り直す
  let menuButtons = [];
  const playBar = document.getElementById('play-bar'); // メニューへ・並べ直す のボタン
  const nextRandomButton = document.getElementById('next-random'); // ランダムで遊び終わったときの「次のランダム」
  const controls = {
    auto: document.getElementById('controls-auto'),
    classic: document.getElementById('controls-classic'),
    spiral: document.getElementById('controls-spiral'),
    button: document.getElementById('controls-button'),
    buttonGuide: document.getElementById('controls-button'), // ガイドありも、操作ボタンは同じ
    three: document.getElementById('controls-three'),
    threeGuide: document.getElementById('controls-three'),
    ring: document.getElementById('controls-ring'),
    ring2: document.getElementById('controls-ring2'),
    shovel: document.getElementById('controls-shovel'),
    sweet: document.getElementById('controls-sweet'),
    banban: document.getElementById('controls-banban'),
    autobanban: document.getElementById('controls-autobanban'),
    boss: document.getElementById('controls-boss'),
  };
  const helps = {
    auto: document.getElementById('help-auto'),
    classic: document.getElementById('help-classic'),
    spiral: document.getElementById('help-spiral'),
    button: document.getElementById('help-button'),
    buttonGuide: document.getElementById('help-button'),
    three: document.getElementById('help-three'),
    threeGuide: document.getElementById('help-three'),
    ring: document.getElementById('help-ring'),
    ring2: document.getElementById('help-ring2'),
    shovel: document.getElementById('help-shovel'),
    sweet: document.getElementById('help-sweet'),
    banban: document.getElementById('help-banban'),
    autobanban: document.getElementById('help-autobanban'),
    boss: document.getElementById('help-boss'),
  };
  const zukanProgress = document.getElementById('zukan-progress');

  let current = null;   // 遊んでいるモード（メニュー表示中は null）
  // キーボードで選んでいるゲーム（menuButtons の番号）。-1 は何も選んでいない状態
  // メニューを開いた直後は選ばず、↑ ↓ を押したときだけ枠を光らせる（前に遊んだゲームが選ばれたままに見えないように）
  let selected = -1;
  let levelKey = Collection.level; // メニューで選んでいる難しさ。前回選んだものから始める
  let playMode = Collection.playMode; // メニューの一番上のタブ。前回選んだものから始める
  let lastPlayed = 'auto';  // 最後に遊んだゲーム（メニューの背景に使う）
  let playingRandom = false; // ランダムで遊んでいるか
  let lastRandom = null;     // ランダムで最後に選ばれたゲーム
  let hovered = null;       // マウスを乗せているゲーム
  let time = 0;

  function updateZukanProgress() {
    const done = Collection.completedCount();
    const complete = done === PRIZE_SPRITES.length;
    zukanProgress.textContent = done + ' / ' + PRIZE_SPRITES.length + ' しゅるい' + (complete ? '　🏆 コンプリート！' : '');
    // 全部そろったら、図鑑の枠を金色にする
    zukanProgress.closest('.zukan').classList.toggle('complete', complete);
  }

  function selectMenu(index) {
    selected = index < 0 ? -1 : index % menuButtons.length;
    menuButtons.forEach((b, i) => b.classList.toggle('selected', i === selected));
    // ゲームのボタンの部分はスクロールするので、キーボードで選んだボタンが隠れていたら見える位置まで動かす
    if (selected >= 0) menuButtons[selected].scrollIntoView({ block: 'nearest' });
  }

  // 一番上のタブ（フリー・チャレンジ・ステップ）を選ぶ
  function selectPlayMode(key) {
    playMode = key;
    Collection.setPlayMode(key);
    modeTabs.forEach((b) => {
      const on = b.dataset.playMode === key;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    menu.dataset.playMode = key;
    // 筐体の色を、モードの色にする（config.js の PLAY_MODES の machine）
    Object.assign(CONFIG.colors, PLAY_MODES.find((m) => m.key === key).machine);
    rebuildMenu();
  }

  // ゲームのボタンを、選んでいるモードと難しさで作り直す。
  // タブを切り替えてもタブや難しさのボタンの位置がずれないように、メニューは上ぞろえにして、
  // 一番項目の多いフリーのときに上下の真ん中に来る位置を、どのモードでも使う
  function rebuildMenu() {
    Menu.build(menuList, menuInfo, 'free', levelKey);
    const shown = Array.from(menu.children).filter((el) => el.offsetParent !== null);
    const top = shown[0].getBoundingClientRect().top;
    const bottom = Math.max(...shown.map((el) => el.getBoundingClientRect().bottom));
    const space = menu.clientHeight - (bottom - top);
    menu.style.paddingTop = Math.max(6, Math.floor(space / 2)) + 'px';
    menuButtons = Menu.build(menuList, menuInfo, playMode, levelKey);
    wallet.innerHTML = (DEBUG ? '<span class="menu-warn">デバッグ（きろくは のこらない）</span>' : '') + '<span class="silver">🥈 ぎん <b>' + Collection.silver + '</b></span>' +
      '<span class="gold">🥇 きん <b>' + Collection.gold + '</b></span>';
    menuButtons.forEach((b) => {
      b.addEventListener('click', () => startMode(b.dataset.mode));
      b.addEventListener('pointerenter', () => { hovered = b.dataset.mode; });
      b.addEventListener('pointerleave', () => { if (hovered === b.dataset.mode) hovered = null; });
    });
    hovered = null;
    selectMenu(-1);
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
    rebuildMenu(); // ステップは難しさごとに遊べるゲームが違い、チャレンジの金コインも難しさで変わるので作り直す
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
    selectPlayMode(playMode);
    selectLevel(levelKey);
  }

  // ゲームの名前。ランダムの画面に出す
  function modeName(key) {
    return GAMES.find((g) => g.key === key).name;
  }

  // ランダム：全部のゲームのどれかを選んで始める。続けて遊んだときに同じゲームが続かないように、
  // 前回ランダムで選ばれたゲームは選ばない
  function startRandom() {
    const choices = RANDOM_KEYS.filter((k) => k !== lastRandom);
    const key = choices[Math.floor(Math.random() * choices.length)];
    lastRandom = key;
    playingRandom = true;
    GameSession.randomName = modeName(key);
    startGame(key);
    // どのゲームが選ばれたか、最初に大きく知らせる
    current.session.message = '「' + GameSession.randomName + '」で あそぼう！';
    current.session.messageTimer = 2.5;
  }

  // key はメニューで選んだもの（ゲームのどれかか、ランダム）
  function startMode(key) {
    GameSession.playMode = playMode;
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
    // ガイドありの台は、ふつうの台と同じ操作ボタンを使うので、全部隠してから、遊ぶ台のものだけ出す
    for (const k of MODE_KEYS) {
      controls[k].hidden = true;
      helps[k].hidden = true;
    }
    controls[key].hidden = false;
    helps[key].hidden = false;
    Input.clearPressed();
    Level.set(levelKey);
    Claw.onHit = null; // アームを「当てる」使い方にするのは、ぬしの台だけ（ぬしの台の start で設定する）
    Claw.floorAt = null; // 床の高さが場所で変わるのは、らせんタワーの坂だけ（らせんタワーの start で設定する）
    current.start();
  }

  modeTabs.forEach((b) => b.addEventListener('click', () => selectPlayMode(b.dataset.playMode)));
  // 画面の幅が変わると（スマホの向きなど）ボタンの高さが変わるので、高さを測り直す
  window.addEventListener('resize', () => { if (!current) rebuildMenu(); });
  // メニューを出している間だけ、Tab キーでモードのタブを順に切り替える（Shift + Tab で逆回り）
  window.addEventListener('keydown', (e) => {
    if (current || e.code !== 'Tab') return;
    e.preventDefault();
    const i = PLAY_MODES.findIndex((m) => m.key === playMode);
    const n = PLAY_MODES.length;
    selectPlayMode(PLAY_MODES[(i + (e.shiftKey ? n - 1 : 1)) % n].key);
  });
  levelButtons.forEach((b) => b.addEventListener('click', () => selectLevel(b.dataset.level)));
  document.getElementById('back-to-menu').addEventListener('click', showMenu);

  // コインと図鑑のリセット。間違えて押しても消えないように、確認してから消す
  document.getElementById('all-reset').addEventListener('click', () => {
    if (!window.confirm('コインと ずかんを リセットしますか？\n（あつめた けいひんと コインが さいしょに もどります。ステップの すすみぐあいは のこります）')) return;
    Collection.resetAll();
  });

  // ダブっている景品を、1 こずつ残してまとめて売る（ボタンに合計の枚数が出ているので、確認せずにすぐ売る）
  document.getElementById('sell-all').addEventListener('click', () => Collection.sellAllExtras());

  // ステップのリセット。確認してから消す
  document.getElementById('step-reset').addEventListener('click', () => {
    if (!window.confirm('ステップの クリアの きろくを リセットしますか？\n（すべての むずかしさで さいしょの だんから やりなおしに なります。コインと ずかんは のこります）')) return;
    Collection.resetSteps();
  });

  // 図鑑で景品を売ったときなど、持ち物が変わったら、メニューを出しているときはメニューの表示を直す
  // （コインが増えて、チャレンジやステップが遊べるようになることがあるため）
  Collection.onChange = () => { if (!current) rebuildMenu(); };

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
    // 数字キーは、押せるボタンの上からの番号（ボタンの左に書いてある数字）
    for (let n = 1; n <= 9; n++) {
      if (Input.wasPressed('Digit' + n) && menuButtons[n - 1]) {
        startMode(menuButtons[n - 1].dataset.mode);
        return;
      }
    }
    if ((Input.wasPressed('Enter') || Input.wasPressed('Space')) && selected >= 0) startMode(menuButtons[selected].dataset.mode);
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
    updateButtons(true);
    current.update(dt);
    updateButtons(false);
    nextRandomButton.hidden = !(playingRandom && current.session.gameOver);
  }

  // 画面の操作ボタン：今押せるボタンだけを光らせて（ピンク）、押せないボタンは灰色にして押せなくする。
  // 押せるかどうかは、各モードの usableKeys() で決める。
  // before が true のとき（モードを動かす前）は、押せないときに押されたキーを捨てる。
  // 残しておくと、あとで押せるようになったときに勝手に動いてしまうため（例：アームが戻ったとたんに、また下りてしまう）
  function updateButtons(before) {
    if (!current.usableKeys) return;
    const keys = current.usableKeys();
    if (before) {
      for (const code in keys) if (!keys[code]) Input.wasPressed(code);
      return;
    }
    const box = controls[current.key];
    if (!box) return;
    for (const btn of box.querySelectorAll('[data-key]')) {
      const usable = keys[btn.dataset.key];
      if (usable === undefined) continue;
      btn.classList.toggle('off', !usable);
      btn.setAttribute('aria-disabled', usable ? 'false' : 'true');
    }
  }

  // メニューの背景に出すゲーム。マウスを乗せているもの → キーボードで選んでいるもの → 最後に遊んだもの の順に決める
  // （どのゲームの筐体かが、選ぶ前からわかるようにするため）
  function previewKey() {
    const key = hovered || (selected >= 0 ? menuButtons[selected].dataset.mode : lastPlayed);
    // ランダムを選んでいるときは、全部のゲームの筐体を順番に見せる
    if (key === 'random') return RANDOM_KEYS[Math.floor(time / 1.5) % RANDOM_KEYS.length];
    return key;
  }

  function draw() {
    if (current) {
      current.draw();
      return;
    }
    const key = previewKey();
    if (key === 'banban' || key === 'autobanban') {
      // 高い床に景品を積んだ、横から見た筐体
      BanbanMode.drawScene(time);
    } else if (key === 'spiral') {
      // 右側が坂で、右端にらせんタワーが立つ、横から見た筐体
      SpiralMode.drawScene(time);
    } else if (key === 'shovel') {
      // 斜め上から見た、回るテーブルの筐体
      ShovelMode.drawScene(time);
    } else if (key === 'sweet') {
      // 横から見た、ドームのターンテーブルとプッシャーの台
      SweetMode.drawScene(time);
    } else if (key === 'ring2') {
      // 2 段のリングの筐体
      Ring2Mode.drawScene(time);
    } else if (key === 'ring') {
      // リングの筐体（台と景品とリング）
      RingMode.drawScene(time);
    } else if (key === 'button' || key === 'three' || key === 'buttonGuide' || key === 'threeGuide') {
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
