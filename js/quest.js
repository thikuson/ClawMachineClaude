// クエスト：ぬしを追って町から町へ旅をする、物語つきのモード
//   章（しょう）ごとに、町の人の「おねがい」が 3 つある。おねがいは「その台で、1 ゲーム（10 回）のうちに 決まった数の景品を取る」こと。
//   3 つ全部かなえると、その章の ぬしの台がひらく。ぬしを たおすと、次の章へ進める。
//   コインいらずで遊べて、おねがいを はじめて かなえたときに、お礼の「おみやげ」がもらえる（js/quest_art.js の QUEST_SOUVENIRS）。
//   もらった おみやげは、図鑑の下の「たびの おみやげ」に並ぶ。ぬしを たおすと、ぬしが図鑑に入る。
//   物語は 1 つだけで、難しさを変えても同じ物語の続きから遊べる。
//   進み具合は js/collection.js の questDone（かなえた おねがい）と questSeen（読んだ会話）に保存する
//
// 章を増やすときは、QUEST_CHAPTERS に 1 つ足す。
//   place：町の名前　boss：その章の ぬし（js/sprites.js の name）　bossHp：ぬしの体力の倍率（CONFIG.boss.hp × これ）
//   bossSpeed：ぬしが左右に歩く速さ（px/秒、0 は止まったまま）。クエストでは難しさではなく章で決める（章が進むほど速く歩く）
//   requests：おねがい。who（だれの）・game（GAMES の key）・gets（取る数）・text（おねがいの ことば）
//   intro：章の はじめの会話　outro：ぬしを たおしたあとの会話（[話す人, ことば] の並び。話す人の顔は js/quest_art.js の QUEST_FACES）
const QUEST_CHAPTERS = [
  {
    place: 'うみべの まち',
    boss: 'たこの ぬし',
    bossHp: 0.8,
    bossSpeed: 0,
    requests: [
      { who: 'りょうしの子', game: 'auto', gets: 3, text: 'ぬいぐるみが ほしいな。3こ とってきて！' },
      { who: 'パンやさん', game: 'hold', gets: 3, text: '3こ とれたら、ぬしの はなしを してあげる' },
      { who: 'とうだいもり', game: 'shovel', gets: 3, text: 'とうだいに かざる けいひんを 3こ たのむよ' },
    ],
    intro: [
      ['てんちょう', 'やあ、みならいくん。きみに ないしょの はなしが あるんだ。'],
      ['てんちょう', 'せかいには 5たいの「ぬし」が いて、いちばん おくに「ほうおうの ぬし」が いるらしい。'],
      ['てんちょう', 'ぬしを さがす たびに でてみないか？ まずは となりの うみべの まちへ いってごらん。'],
      ['みならい', 'ぬしに あえるの？ いってきます！'],
      ['りょうしの子', 'あっ、クレーンの ひと？ うみに おっきな たこが いるんだよ！'],
      ['りょうしの子', 'まちの みんなの おねがいを きいてくれたら、たこの いばしょを おしえてあげる！'],
      ['みならい', 'まかせて！ クレーンなら とくいだよ。'],
    ],
    outro: [
      ['りょうしの子', 'すごい！ たこの ぬしを つかまえちゃった！'],
      ['とうだいもり', 'とうだいから みえたよ。みなとの ほうに、くじらが きているらしい。'],
      ['みならい', 'つぎは くじらか…！ みなとへ いってみよう。'],
    ],
  },
  {
    place: 'みなとの いちば',
    boss: 'くじらの ぬし',
    bossHp: 1,
    bossSpeed: 25,
    requests: [
      { who: 'さかなやさん', game: 'classic', gets: 3, text: 'みせの かんばんに する けいひんを 3こ ほしい' },
      { who: 'ふなのりさん', game: 'buttonGuide', gets: 3, text: 'ふねの おまもりに 3こ たのむぜ' },
      { who: 'おばあちゃん', game: 'threeGuide', gets: 2, text: 'まごに あげたいの。2こ とってくれる？' },
    ],
    intro: [
      ['ふなのりさん', 'よう、たこの ぬしを つかまえた みならいって、きみか！'],
      ['ふなのりさん', 'みなとの おきに、くじらの ぬしが でるんだ。でも だれも ちかよれなくてな。'],
      ['おばあちゃん', 'いちばの みんなの おねがいを きいてくれたら、ふねを だしてあげるよ。'],
      ['みならい', 'がんばります！ くじらの ぬしに あいたいんです。'],
    ],
    outro: [
      ['ふなのりさん', 'くじらの ぬしまで！ きみは ほんものだ！'],
      ['さかなやさん', 'そういえば、いわばの どうくつで おおきな はさみを みた ひとが いるよ。'],
    ],
  },
  {
    place: 'いわばの どうくつ',
    boss: 'かにの ぬし',
    bossHp: 1.2,
    bossSpeed: 35,
    requests: [
      { who: 'たんけんか', game: 'ring', gets: 3, text: 'どうくつの ちずと こうかんだ。3こ たのむ' },
      { who: 'こうもりの子', game: 'sweet', gets: 3, text: 'あまい けいひんが ほしいな。3こ ちょうだい' },
      { who: 'いしやさん', game: 'banban', gets: 3, text: 'いわを かざる けいひんを 3こ たのめるかい' },
    ],
    intro: [
      ['たんけんか', 'ここが いわばの どうくつだ。おくから カチカチと おとが するだろう？'],
      ['たんけんか', 'あれは かにの ぬしの はさみの おと。くらくて すすめないんだ。'],
      ['こうもりの子', 'みんなの おねがいを きいてくれたら、おくまで あんないするよ！'],
      ['みならい', 'くらいのは ちょっと こわいけど… いこう！'],
    ],
    outro: [
      ['たんけんか', 'かにの ぬしを たおしたのか！ どうくつが しずかに なった。'],
      ['いしやさん', 'どうくつの むこうの かざんで、ドラゴンが あばれているらしい。きをつけてな。'],
    ],
  },
  {
    place: 'かざんの やま',
    boss: 'ドラゴンの ぬし',
    bossHp: 1.4,
    bossSpeed: 45,
    requests: [
      { who: 'せんにん', game: 'spiral', gets: 2, text: 'ころがる けいひんを 2こ とらえてみよ' },
      { who: 'おかみさん', game: 'button', gets: 3, text: 'おきゃくさんへの おみやげを 3こ ほしいの' },
      { who: 'かじやさん', game: 'three', gets: 2, text: 'つめの うでまえを みせてくれ。2こだ' },
    ],
    intro: [
      ['せんにん', 'よく きたな、みならい。この やまの ドラゴンの ぬしは とても つよい。'],
      ['せんにん', 'やまの みんなの むずかしい おねがいを かなえて、うでを みがくのじゃ。'],
      ['みならい', 'はい！ しゅぎょう します！'],
    ],
    outro: [
      ['せんにん', 'みごと！ ドラゴンの ぬしまで たおすとは。'],
      ['せんにん', 'さいごの ぬし、ほうおうは くもの うえの「そらの しま」に いる。ドラゴンに のせてもらうと よい。'],
    ],
  },
  {
    place: 'そらの しま',
    boss: 'ほうおうの ぬし',
    bossHp: 1.7,
    bossSpeed: 60,
    requests: [
      { who: 'こびと', game: 'autobanban', gets: 4, text: 'くもの うえは けいひんが すくないの。4こ ほしい' },
      { who: 'ほしよみさん', game: 'ring2', gets: 2, text: 'ほしの かずだけ…いや、2こで いいよ' },
      { who: 'たびびと', game: 'spiral', gets: 3, text: 'かぜに のって ころがる けいひんを 3こ たのむ' },
    ],
    intro: [
      ['ドラゴンの ぬし', 'ついたぞ。ここが そらの しまだ。'],
      ['こびと', 'ようこそ！ ほうおうさまに あうには、しまの みんなに みとめられないと いけないよ。'],
      ['みならい', 'さいごの ぬし…！ ぜったいに あってみせる。'],
    ],
    outro: [
      ['ほうおうの ぬし', '……みごとだ。5たいの ぬしを すべて あつめた ものは、きみが はじめてだ。'],
      ['みならい', 'やった…！ てんちょうに しらせなきゃ！'],
      ['てんちょう', 'おかえり！ きみは もう みならいじゃない。りっぱな クレーンの めいじんだ！'],
      ['てんちょう', 'クエスト クリア！ おめでとう！'],
    ],
  },
];

const Quest = {
  // おねがいの名前（保存に使う）。c0r1 は「1 しょうの 2 ばんめの おねがい」、c0boss は「1 しょうの ぬし」
  requestId(chapter, index) { return 'c' + chapter + 'r' + index; },
  bossId(chapter) { return 'c' + chapter + 'boss'; },

  // その名前のおねがい（ぬしも含む）を、遊ぶときに使う形で返す
  find(id) {
    for (let c = 0; c < QUEST_CHAPTERS.length; c++) {
      const ch = QUEST_CHAPTERS[c];
      if (id === this.bossId(c)) {
        return { id, chapter: c, boss: true, who: ch.boss, game: 'boss', gets: 1,
          bossName: ch.boss, bossHp: ch.bossHp, bossSpeed: ch.bossSpeed };
      }
      const i = ch.requests.findIndex((r, k) => this.requestId(c, k) === id);
      if (i >= 0) return Object.assign({ id, chapter: c, boss: false, souvenir: QUEST_SOUVENIRS[id].name }, ch.requests[i]);
    }
    return null;
  },

  isDone(id) { return Collection.questDone.includes(id); },

  // その章の おねがいが 3 つ全部かなったか（ぬしの台がひらくか）
  requestsDone(chapter) {
    return QUEST_CHAPTERS[chapter].requests.every((r, k) => this.isDone(this.requestId(chapter, k)));
  },

  chapterDone(chapter) { return this.isDone(this.bossId(chapter)); },

  // 今すすめている章（全部クリアしたら、最後の章）
  currentChapter() {
    const i = QUEST_CHAPTERS.findIndex((ch, c) => !this.chapterDone(c));
    return i < 0 ? QUEST_CHAPTERS.length - 1 : i;
  },

  allDone() { return QUEST_CHAPTERS.every((ch, c) => this.chapterDone(c)); },

  // クリアした章の数
  doneCount() { return QUEST_CHAPTERS.filter((ch, c) => this.chapterDone(c)).length; },

  // まだ読んでいない会話を、読む順に並べて返す（ぬしを たおしたあとの会話 → 次の章の はじめの会話）
  // 返すと同時に「読んだ」にする
  pendingTalks() {
    const lines = [];
    QUEST_CHAPTERS.forEach((ch, c) => {
      if (this.chapterDone(c) && this.markSeen('c' + c + 'out')) lines.push(...ch.outro);
    });
    const c = this.currentChapter();
    if (!this.chapterDone(c) && this.markSeen('c' + c + 'in')) lines.push(...QUEST_CHAPTERS[c].intro);
    return lines;
  },

  // 読んだ印を付ける。はじめて付けたときは true
  markSeen(key) {
    if (Collection.questSeen.includes(key)) return false;
    Collection.questSeen.push(key);
    Collection.save();
    return true;
  },

  // メニューで見ている章（null は今すすめている章）。クリアした章にもどって、もう一度遊んだり会話を読んだりできる
  viewChapter: null,
  onViewChange: null, // 見る章を変えたときに呼ぶ（main.js がメニューを作り直す）

  // メニューで見ている章
  shownChapter() {
    const c = this.currentChapter();
    return this.viewChapter === null ? c : Math.max(0, Math.min(c, this.viewChapter));
  },

  // 見る章を前後に動かす（今すすめている章より先には行けない）
  moveView(step) {
    const c = this.shownChapter() + step;
    if (c < 0 || c > this.currentChapter()) return;
    this.viewChapter = c === this.currentChapter() ? null : c;
    if (this.onViewChange) this.onViewChange();
  },

  // 見ている章の会話を、もう一度読むとき（クリアした章は、はじめと おわりの会話を続けて）
  replayTalk() {
    const c = this.shownChapter();
    const ch = QUEST_CHAPTERS[c];
    return this.chapterDone(c) ? ch.intro.concat(ch.outro) : ch.intro;
  },

  // ---- 会話の画面（キャンバスの上に重ねる） ----
  talkBox: null,
  talkLines: [],
  talkIndex: 0,

  init() {
    this.talkBox = document.getElementById('quest-talk');
    this.talkWho = document.getElementById('quest-talk-who');
    this.talkText = document.getElementById('quest-talk-text');
    this.talkStep = document.getElementById('quest-talk-step');
    this.talkFace = document.getElementById('quest-talk-face');
    this.souvenirList = document.getElementById('souvenir-list');
    this.souvenirProgress = document.getElementById('souvenir-progress');
    // 会話の画面のどこを押しても、次へ進む
    this.talkBox.addEventListener('click', () => this.nextTalk());
  },

  // 図鑑の下の「たびの おみやげ」。おねがいを かなえると、その おみやげが並ぶ（まだのものは影と「？？？」）
  renderSouvenirs() {
    if (!this.souvenirList) return;
    this.souvenirList.replaceChildren();
    let got = 0;
    const ids = Object.keys(QUEST_SOUVENIRS);
    for (const id of ids) {
      const have = this.isDone(id);
      if (have) got++;
      const li = document.createElement('li');
      li.className = 'zukan-item souvenir' + (have ? '' : ' unknown');
      const box = document.createElement('span');
      box.className = 'zukan-icon-box';
      const icon = QuestArt.souvenir(id, !have);
      const img = document.createElement('canvas');
      img.width = icon.width;
      img.height = icon.height;
      img.className = 'zukan-icon';
      img.getContext('2d').drawImage(icon, 0, 0);
      box.appendChild(img);
      const name = document.createElement('span');
      name.className = 'zukan-name';
      name.textContent = have ? QUEST_SOUVENIRS[id].name : '？？？';
      const info = document.createElement('span');
      info.className = 'zukan-info';
      const q = this.find(id);
      info.textContent = q.chapter + 1 + 'しょう・' + q.who;
      li.append(box, name, info);
      this.souvenirList.appendChild(li);
    }
    this.souvenirProgress.textContent = got + ' / ' + ids.length + ' こ' + (got === ids.length ? '　🏆 コンプリート！' : '');
  },

  isTalking() { return !!this.talkBox && !this.talkBox.hidden; },

  showTalk(lines) {
    if (!lines.length) return;
    this.talkLines = lines;
    this.talkIndex = 0;
    this.talkBox.hidden = false;
    this.renderTalk();
  },

  nextTalk() {
    this.talkIndex++;
    if (this.talkIndex >= this.talkLines.length) {
      this.talkBox.hidden = true;
      return;
    }
    this.renderTalk();
  },

  // 会話を 1 つ出す。左に話す人の顔、上に名前の札（その人の服の色）を出す。
  // 話す人が変わったときは、顔を小さく はねさせて、だれが話しはじめたかを わかりやすくする
  renderTalk() {
    const [who, text] = this.talkLines[this.talkIndex];
    const prev = this.talkIndex > 0 ? this.talkLines[this.talkIndex - 1][0] : null;
    this.talkWho.textContent = who;
    this.talkWho.style.background = QuestArt.color(who);
    this.talkText.textContent = text;
    const face = QuestArt.face(who);
    this.talkFace.replaceChildren();
    if (face) {
      const img = document.createElement('canvas');
      img.width = face.width;
      img.height = face.height;
      img.getContext('2d').drawImage(face, 0, 0);
      this.talkFace.appendChild(img);
    }
    // 主人公（みならい）は右、ほかの人は左に出す
    this.talkBox.classList.toggle('me', who === 'みならい');
    if (who !== prev) {
      this.talkFace.classList.remove('hop');
      void this.talkFace.offsetWidth; // アニメーションを最初から やり直すため
      this.talkFace.classList.add('hop');
    }
    const last = this.talkIndex === this.talkLines.length - 1;
    this.talkStep.textContent = (this.talkIndex + 1) + ' / ' + this.talkLines.length + '　' + (last ? 'とじる ▶' : 'つぎへ ▶');
  },
};
