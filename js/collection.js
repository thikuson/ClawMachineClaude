// 獲得一覧（図鑑）とハイスコア。ブラウザに保存して、次に開いたときも残す
const Collection = {
  STORAGE_KEY: 'clawMachineClaude.save',
  counts: [],      // 種類ごとの、これまでに獲得した数
  highScore: 0,
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
      if (Array.isArray(data.counts)) {
        data.counts.forEach((n, i) => { if (i < this.counts.length) this.counts[i] = n || 0; });
      }
      this.highScore = data.highScore || 0;
    } catch (e) {
      // 読めなければ最初からにする
    }
  },

  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        counts: this.counts,
        highScore: this.highScore,
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
  submitScore(score) {
    if (score <= this.highScore) return false;
    this.highScore = score;
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
