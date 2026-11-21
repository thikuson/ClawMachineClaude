// プレイヤーの持ち物と記録。ブラウザに保存して、次に開いたときも残す
//   図鑑：景品ごとの「見つけたことがあるか」と「持っている数」（売ると数は減るが、見つけた記録は残る）
//   コイン：銀コインと金コイン（全部のモードで共通。使い方は config.js の CONFIG.coins）
//   ステップ：難しさごとに、クリアしたゲーム
const Collection = {
  STORAGE_KEY: 'clawMachineClaude.save',
  counts: [],      // 種類ごとの、持っている数
  found: [],       // 種類ごとの、見つけたことがあるか（売って 0 こになっても図鑑は埋まったまま）
  silver: 0,       // 銀コイン
  gold: 0,         // 金コイン
  level: 'normal', // メニューで最後に選んだ難しさ（次に開いたときも同じ難しさから始める）
  playMode: 'free', // メニューの一番上のタブ（フリー・チャレンジ・ステップ）で最後に選んだもの
  stepCleared: { easy: [], normal: [], hard: [] }, // ステップでクリアしたゲーム（難しさごと）
  SAVE_VERSION: 3, // 保存の形式の版。3 でスコアをやめてコインになった
  listElement: null,
  onChange: null,  // 持ち物が変わったときに呼ぶ（main.js がメニューの表示を直すのに使う）

  init(listElement) {
    this.listElement = listElement;
    this.counts = PRIZE_SPRITES.map(() => 0);
    this.found = PRIZE_SPRITES.map(() => false);
    this.silver = CONFIG.coins.startSilver;
    this.load();
    // デバッグモードでは、コインを気にせず全部の機能を試せるようにする（保存はしないので、いつもの記録は変わらない）
    if (DEBUG) {
      this.silver = 999;
      this.gold = 999;
    }
    this.renderList();
  },

  // 保存できない環境（プライベートモードなど）でも遊べるように、失敗しても止めない
  load() {
    try {
      const data = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
      // 景品の種類を増やしても記録がずれないように、名前ごとに数を保存している
      let byName = data.countsByName;
      if (!byName && Array.isArray(data.counts)) {
        // 以前の形式（並び順の番号で保存）を、そのころの並び順で名前に置き換える
        const oldOrder = ['くま', 'ねこ', 'ひよこ', 'うさぎ', 'ペンギン', 'おばけ', 'きんのほし'];
        byName = {};
        data.counts.forEach((n, i) => { if (oldOrder[i]) byName[oldOrder[i]] = n || 0; });
      }
      if (byName) {
        PRIZE_SPRITES.forEach((s, i) => { this.counts[i] = byName[s.name] || 0; });
      }
      // 見つけた記録がない以前の形式では、持っている景品を見つけたことにする
      const foundNames = data.foundNames || PRIZE_SPRITES.filter((s, i) => this.counts[i] > 0).map((s) => s.name);
      PRIZE_SPRITES.forEach((s, i) => { this.found[i] = foundNames.includes(s.name) || this.counts[i] > 0; });
      if (typeof data.silver === 'number') this.silver = data.silver;
      if (typeof data.gold === 'number') this.gold = data.gold;
      if (LEVEL_KEYS.includes(data.level)) this.level = data.level;
      if (PLAY_MODES.some((m) => m.key === data.playMode)) this.playMode = data.playMode;
      if (data.stepCleared) {
        for (const level of LEVEL_KEYS) {
          if (Array.isArray(data.stepCleared[level])) this.stepCleared[level] = data.stepCleared[level];
        }
      }
    } catch (e) {
      // 読めなければ最初からにする
    }
  },

  save() {
    if (DEBUG) return; // デバッグモードの結果は、いつもの記録に残さない
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        countsByName: Object.fromEntries(PRIZE_SPRITES.map((s, i) => [s.name, this.counts[i]])),
        foundNames: PRIZE_SPRITES.filter((s, i) => this.found[i]).map((s) => s.name),
        silver: this.silver,
        gold: this.gold,
        level: this.level,
        playMode: this.playMode,
        stepCleared: this.stepCleared,
        saveVersion: this.SAVE_VERSION,
      }));
    } catch (e) {
      // 保存できなくてもゲームは続ける
    }
  },

  // 持ち物が変わったときに、保存して、図鑑とメニューの表示を直す
  changed() {
    this.save();
    this.renderList();
    if (this.onChange) this.onChange();
  },

  // 景品を獲得したときに呼ぶ。初めての種類なら true を返す
  add(type) {
    const isNew = !this.found[type];
    this.found[type] = true;
    this.counts[type]++;
    this.changed();
    return isNew;
  },

  // 図鑑で景品を押したときに呼ぶ。2 こ以上持っていたら 1 こ売って、銀コインを増やす。もらった枚数を返す
  sell(type) {
    if (this.counts[type] < 2) return 0;
    const coins = prizeSilver(PRIZE_SPRITES[type]);
    this.counts[type]--;
    this.silver += coins;
    Sound.get();
    this.popSell(type, coins);
    this.changed();
    return coins;
  },

  // 銀コインを使う。足りなければ使わずに false を返す
  spendSilver(n) {
    if (this.silver < n) return false;
    this.silver -= n;
    this.changed();
    return true;
  },

  // 金コインを使う。足りなければ使わずに false を返す
  spendGold(n) {
    if (this.gold < n) return false;
    this.gold -= n;
    this.changed();
    return true;
  },

  addGold(n) {
    this.gold += n;
    this.changed();
  },

  // ステップの並び順（おまかせから順に。config.js の unlockOrder）
  stepOrder() {
    return GAMES.filter((g) => g.unlockOrder).sort((a, b) => a.unlockOrder - b.unlockOrder);
  },

  // ステップで、その難しさのそのゲームが遊べるか。最初のゲームと、1 つ前をクリアしたゲームが遊べる
  isStepOpen(level, key) {
    if (DEBUG) return true; // デバッグモードでは全部遊べる
    const order = this.stepOrder();
    const i = order.findIndex((g) => g.key === key);
    return i === 0 || (i > 0 && this.stepCleared[level].includes(order[i - 1].key));
  },

  // ステップでゲームをクリアしたときに呼ぶ。新しく次のゲームが遊べるようになったら true を返す
  clearStep(level, key) {
    const list = this.stepCleared[level];
    if (list.includes(key)) return false;
    list.push(key);
    this.changed();
    const order = this.stepOrder();
    const i = order.findIndex((g) => g.key === key);
    return i >= 0 && i < order.length - 1;
  },

  // メニューの一番上のタブを選んだときに呼ぶ
  setPlayMode(key) {
    this.playMode = key;
    this.save();
  },

  // メニューで難しさを選んだときに呼ぶ
  setLevel(level) {
    this.level = level;
    this.save();
  },

  // 図鑑の一覧。最初の 1 回だけ景品ごとの枠を作り、あとは中身だけを書き換える
  // （長押しで売っている途中に枠を作り直すと、指を離したことがわからなくなるため）
  items: [],

  buildList() {
    this.listElement.innerHTML = '';
    this.items = PRIZE_SPRITES.map((sprite, i) => {
      const item = document.createElement('li');
      item.className = 'zukan-item';
      const iconBox = document.createElement('span');
      iconBox.className = 'zukan-icon-box';
      const name = document.createElement('span');
      name.className = 'zukan-name';
      const info = document.createElement('span');
      info.className = 'zukan-info';
      const sell = document.createElement('span');
      sell.className = 'zukan-sell';
      item.append(iconBox, name, info, sell);
      this.setUpLongPress(item, i);
      this.listElement.appendChild(item);
      return { item, iconBox, name, info, sell, found: null };
    });
  },

  // 押すと 1 こ売る。押したままにすると、少し待ってから続けて売る（だんだん速くなる）。
  // 1 こになったら止まる（1 こは図鑑用に残す）。
  // スマホで図鑑の上をなでてスクロールしたときに売れてしまわないように、
  // 1 こ売るのは指を離したとき（click）にして、押したまま指が動いたら続けて売るのをやめる
  setUpLongPress(item, type) {
    let timer = null;
    let start = null;
    let repeated = false; // 長押しで売ったか（そのあとの click では売らない）
    const stop = () => {
      clearTimeout(timer);
      timer = null;
      item.classList.remove('pressing');
    };
    const repeat = (wait) => {
      timer = setTimeout(() => {
        if (!this.sell(type)) { stop(); return; }
        repeated = true;
        repeat(Math.max(60, wait * 0.8));
      }, wait);
    };
    item.addEventListener('pointerdown', (e) => {
      repeated = false;
      if (this.counts[type] < 2) return;
      start = { x: e.clientX, y: e.clientY };
      item.classList.add('pressing');
      repeat(450);
    });
    item.addEventListener('pointermove', (e) => {
      if (timer && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) stop();
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) item.addEventListener(ev, stop);
    item.addEventListener('click', () => {
      if (!repeated) this.sell(type);
      repeated = false;
    });
  },

  // 図鑑の表示を、今の持ち物に合わせて書き換える。まだ見つけていない種類は影と「？？？」で表示する。
  // 2 こ以上持っている景品は押すと売れるので、売り値を出して押せる見た目にする
  renderList() {
    if (!this.listElement) return;
    if (this.items.length === 0) this.buildList();
    PRIZE_SPRITES.forEach((sprite, i) => {
      const el = this.items[i];
      const got = this.found[i];
      const count = this.counts[i];
      const sellable = count >= 2;
      el.item.classList.toggle('unknown', !got);
      el.item.classList.toggle('rare', !!sprite.rare);
      el.item.classList.toggle('secret', !!sprite.secret);
      el.item.classList.toggle('sellable', sellable);
      // ドット絵は、見つけたかどうかが変わったときだけ描き直す
      if (el.found !== got) {
        el.found = got;
        const icon = buildSprite(sprite, !got);
        icon.className = 'zukan-icon';
        el.iconBox.replaceChildren(icon);
      }
      el.name.textContent = got ? sprite.name : '？？？';
      // ひみつの景品は、まだ見つけていないときに、どこで手に入るかのヒントを出す
      el.info.textContent = got ? '×' + count : sprite.secret ? 'ひみつ（' + LEVELS[sprite.secret].label + '）' : '';
      el.sell.textContent = sellable ? 'うる 🥈+' + prizeSilver(sprite) : '';
      el.item.title = sellable ? 'おすと 1 こ うる（おしたままで つづけて うる）' : '';
    });
    // 図鑑の上の、持っている銀コインと「まとめて うる」ボタン
    const silver = document.getElementById('zukan-silver');
    if (silver) silver.textContent = '🥈 ' + this.silver;
    const sellAll = document.getElementById('sell-all');
    if (sellAll) {
      const value = this.extraValue();
      sellAll.disabled = value === 0;
      sellAll.textContent = value > 0 ? 'ダブりを ぜんぶ うる 🥈+' + value : 'ダブりは ないよ';
    }
  },

  // 売ったときに、景品の枠の上に「+3」のように浮かび上がらせる
  popSell(type, coins) {
    const el = this.items[type];
    if (!el) return;
    const pop = document.createElement('span');
    pop.className = 'zukan-pop';
    pop.textContent = '+' + coins;
    el.item.appendChild(pop);
    setTimeout(() => pop.remove(), 700);
  },

  // ダブっている景品（2 こ目から）を全部売ったときにもらえる銀コイン
  extraValue() {
    return PRIZE_SPRITES.reduce((sum, s, i) => sum + Math.max(0, this.counts[i] - 1) * prizeSilver(s), 0);
  },

  // ダブっている景品を、1 こずつ残して全部売る。もらった枚数を返す
  sellAllExtras() {
    const value = this.extraValue();
    if (value === 0) return 0;
    PRIZE_SPRITES.forEach((s, i) => {
      if (this.counts[i] > 1) {
        this.popSell(i, (this.counts[i] - 1) * prizeSilver(s));
        this.counts[i] = 1;
      }
    });
    this.silver += value;
    Sound.clear();
    this.changed();
    return value;
  },

  // コインと図鑑を、最初の状態に戻す（ステップの進み具合と、選んでいる難しさ・モードは残す）
  resetAll() {
    this.counts = PRIZE_SPRITES.map(() => 0);
    this.found = PRIZE_SPRITES.map(() => false);
    this.silver = CONFIG.coins.startSilver;
    this.gold = 0;
    this.changed();
  },

  // ステップのクリアの記録を、全部の難しさの分消す（コインと図鑑は残す）
  resetSteps() {
    this.stepCleared = { easy: [], normal: [], hard: [] };
    this.changed();
  },

  completedCount() {
    return this.found.filter((f) => f).length;
  },
};
