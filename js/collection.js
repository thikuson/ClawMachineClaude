// 獲得一覧（図鑑）とハイスコア。ブラウザに保存して、次に開いたときも残す
// 図鑑はモード共通、ハイスコアはモードごとに分けて記録する
const Collection = {
  STORAGE_KEY: 'clawMachineClaude.save',
  counts: [],      // 種類ごとの、これまでに獲得した数
  highScores: {}, // 'classic' や 'button_easy' などの名前ごとのハイスコア（js/session.js の scoreKey）
  listElement: null,

  init(listElement) {
    this.listElement = listElement;
    this.counts = PRIZE_SPRITES.map(() => 0);
    this.load();
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
      if (data.highScores) Object.assign(this.highScores, data.highScores);
      // 以前の形式（ハイスコアが 1 つだけ）はクラシックモードの記録として引き継ぐ
      if (data.highScore && !data.highScores) this.highScores.classic = data.highScore;
    } catch (e) {
      // 読めなければ最初からにする
    }
  },

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        countsByName: Object.fromEntries(PRIZE_SPRITES.map((s, i) => [s.name, this.counts[i]])),
        highScores: this.highScores,
      }));
    } catch (e) {
      // 保存できなくてもゲームは続ける
    }
  },

  // 景品を獲得したときに呼ぶ。初めての種類なら true を返す
  add(type) {
    const isNew = this.counts[type] === 0;
    this.counts[type]++;
    this.save();
    this.renderList();
    return isNew;
  },

  // ゲーム終了時に呼ぶ。ハイスコアを更新したら true を返す
  submitScore(modeKey, score) {
    if (score <= (this.highScores[modeKey] || 0)) return false;
    this.highScores[modeKey] = score;
    this.save();
    return true;
  },

  // 図鑑の一覧を作り直す。まだ獲得していない種類は影と「？？？」で表示する
  renderList() {
    if (!this.listElement) return;
    this.listElement.innerHTML = '';
    PRIZE_SPRITES.forEach((sprite, i) => {
      const got = this.counts[i] > 0;
      const item = document.createElement('li');
      item.className = 'zukan-item' + (got ? '' : ' unknown') + (sprite.rare ? ' rare' : '');

      const icon = buildSprite(sprite, !got);
      icon.className = 'zukan-icon';
      item.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'zukan-name';
      name.textContent = got ? sprite.name : '？？？';
      item.appendChild(name);

      const info = document.createElement('span');
      info.className = 'zukan-info';
      info.textContent = got ? sprite.points + '点・×' + this.counts[i] : sprite.points + '点';
      item.appendChild(info);

      this.listElement.appendChild(item);
    });
  },

  completedCount() {
    return this.counts.filter((n) => n > 0).length;
  },
};
