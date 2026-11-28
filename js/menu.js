// メニューのゲームのボタンを、config.js の GAMES・GENRES から作る
// 一番上のタブ（フリー・チャレンジ・ステップ・クエスト）によって、並べ方と見せ方を変える
const Menu = {
  // 難しさの目安を ★ で書く（0 は書かない）
  stars(n) {
    return n > 0 ? '★'.repeat(n) + '☆'.repeat(3 - n) : '';
  },

  // ゲーム 1 つ分のボタンを作る。number はキーボードの数字キーの番号（押せないボタンは null）
  // state は、ステップでの状態（'cleared' クリアした・'next' 次に遊ぶ・'locked' まだ遊べない）
  // note は 3 行目に出す、モードごとの一言（チャレンジでもらえる金コインなど）。poor はコインが足りなくて押せないとき
  card(game, number, state, note, poor) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'menu-item' + (state ? ' ' + state : '');
    b.dataset.mode = game.key;
    const locked = state === 'locked';
    if (locked || poor) b.disabled = true;
    if (poor) b.classList.add('poor');
    // クエストのボタンは名前の左に顔があって せまいので、✔ を付けずに名前の色（みどり）だけで、かなえたことを見せる
    const mark = locked ? '🔒 ' : state === 'cleared' && !game.face ? '✔ ' : '';
    // まだ遊べないときの説明（クエストでは game.lockText を使う）
    const desc = locked ? (game.lockText || 'まえの だんを クリアで ひらく') : game.desc;
    b.innerHTML =
      '<span class="menu-name">' + (number ? '<span class="menu-num">' + number + '</span>' : '') + mark + (locked && !game.lockText ? '？？？' : game.name) + '</span>' +
      '<span class="menu-stars">' + (locked ? '' : this.stars(game.difficulty)) + '</span>' +
      '<span class="menu-desc">' + desc + '</span>' +
      '<span class="menu-note">' + (locked ? '　' : note) + '</span>';
    return b;
  },

  // メニューの中身を作り直す。押せるボタンを、上から（数字キーの）順に返す
  build(listElement, infoElement, playMode, level) {
    listElement.innerHTML = '';
    const buttons = [];
    const add = (parent, game, state, note, poor) => {
      const usable = state !== 'locked' && !poor;
      const b = this.card(game, usable ? buttons.length + 1 : null, state, note, poor);
      parent.appendChild(b);
      if (usable) buttons.push(b);
    };
    const section = (title) => {
      const h = document.createElement('p');
      h.className = 'menu-genre';
      h.textContent = title;
      const grid = document.createElement('div');
      grid.className = 'menu-grid';
      listElement.append(h, grid);
      return grid;
    };
    const value = (text) => '<span class="menu-info-value">' + text + '</span>';

    if (playMode === 'quest') {
      this.buildQuest(infoElement, section, add, buttons);
      return buttons;
    }

    const cost = CONFIG.coins.stepCost;
    if (playMode === 'step') {
      // ステップ：ジャンルの段（STEP_STAGES）ごとに並べる。段の中のどれか 1 つをクリアすると、次の段が遊べるようになる。
      // クリアしたもの（✔）、遊べてまだクリアしていない段のもの（光らせる）、まだ遊べないもの（鍵）。難しさごとに別々
      // 1 ゲーム遊ぶのに金コインがいる。足りないときは押せない
      const stages = Collection.stepStages();
      const cleared = Collection.stepCleared[level];
      const count = stages.filter((st, i) => Collection.isStageCleared(level, i)).length;
      const poor = !DEBUG && Collection.gold < cost;
      infoElement.innerHTML = (DEBUG ? '<span class="menu-warn">デバッグ：ぜんぶ むりょう</span>' : '<span>1 ゲーム 🥇' + cost + ' 枚</span>') +
        value(count + ' / ' + stages.length + ' だん クリア') +
        (poor ? '<span class="menu-warn">🥇が たりない</span>' : '');
      stages.forEach((stage, i) => {
        const stageDone = Collection.isStageCleared(level, i);
        const last = i === stages.length - 1;
        const title = (stageDone ? '✔ ' : '') + (i + 1) + 'だんめ：' + stage.name +
          (last ? '' : stageDone ? '（クリア！）' : '（どれか 1 つ クリア）');
        const grid = section(title);
        for (const g of stage.games) {
          const open = Collection.isStepOpen(level, g.key);
          const state = cleared.includes(g.key) ? 'cleared' : !open ? 'locked' : stageDone ? null : 'next';
          // ぬしの台は金コインを多めに使う
          const gameCost = g.stepCost || cost;
          const note = g.stepCost ? '🥇' + gameCost + ' 枚で ちょうせん' : 'けいひん ' + g.clearGets + ' こで クリア';
          add(grid, g, state, note, !DEBUG && Collection.gold < gameCost);
          if (g.stepOnly) grid.lastChild.classList.add('boss');
        }
      });
      return buttons;
    }

    let poor = false;
    if (playMode === 'challenge') {
      // チャレンジ：1 回下ろすごとに銀コインを使い、取った景品で金コインがもらえる。ランダムは入れない
      poor = Collection.silver < CONFIG.coins.challengeCost;
      infoElement.innerHTML = poor
        ? '<span class="menu-warn">🥈が ないよ。ずかんで けいひんを うろう</span>'
        : '<span>1 回 🥈' + CONFIG.coins.challengeCost + ' 枚。とると 🥇 が もらえる</span>';
    } else {
      infoElement.innerHTML = '<span>コイン いらずで あそべる</span>';
    }
    // チャレンジでもらえる金コイン（ふつうの景品のいちばん少ない枚数 〜 いちばん多い枚数）
    const goldRange = (g) => {
      const all = PRIZE_SPRITES.filter((sp) => !sp.secret).map((sp) => prizeGold(sp, g.key, level));
      return '1こ 🥇' + Math.min(...all) + '〜' + Math.max(...all);
    };
    for (const genre of GENRES) {
      const games = GAMES.filter((g) => g.genre === genre.key && (playMode === 'free' || g.key !== 'random'));
      if (games.length === 0) continue;
      const grid = section(genre.name);
      games.forEach((g) => add(grid, g, null,
        playMode === 'challenge' ? goldRange(g) : g.key === 'random' ? CONFIG.game.randomPlays + ' 回' : CONFIG.game.plays + ' 回 むりょう',
        poor));
    }
    return buttons;
  },

  // クエスト：見ている章の おねがい 3 つと、ぬしの台を並べる（クリアした章の数は、説明の行に出す）。
  // 章の見出しの左右の ◀ ▶ で、クリアした章にもどって もう一度遊べる（お礼は はじめての 1 回だけ）。
  // ボタンの dataset.quest に おねがいの名前を入れておき、main.js が遊ぶときに読む
  buildQuest(infoElement, section, add, buttons) {
    const c = Quest.shownChapter();
    const ch = QUEST_CHAPTERS[c];
    infoElement.innerHTML = '<span>コイン いらず</span>' +
      '<span class="menu-info-value">' + Quest.doneCount() + ' / ' + QUEST_CHAPTERS.length + ' しょう クリア</span>' +
      '<button type="button" class="quest-replay">📖 おはなし</button>';
    infoElement.querySelector('.quest-replay').addEventListener('click', () => Quest.showTalk(Quest.replayTalk()));
    const done = Quest.chapterDone(c);
    const grid = section((done ? '✔ ' : '') + (c + 1) + 'しょう：' + ch.place + (done ? '（クリア！）' : ''));
    // 見出しの左右に、前の章・次の章へ動くボタンを付ける（行けない向きは押せない）
    const heading = grid.previousSibling;
    heading.classList.add('quest-heading');
    const nav = (text, step, enabled) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'quest-nav';
      b.textContent = text;
      b.disabled = !enabled;
      b.addEventListener('click', () => Quest.moveView(step));
      return b;
    };
    heading.prepend(nav('◀', -1, c > 0));
    heading.append(nav('▶', 1, c < Quest.currentChapter()));
    const card = (id, game, state, note, boss) => {
      add(grid, game, state, note, false);
      const b = grid.lastChild;
      b.dataset.quest = id;
      if (boss) b.classList.add('boss');
    };
    ch.requests.forEach((r, k) => {
      const id = Quest.requestId(c, k);
      const g = GAMES.find((x) => x.key === r.game);
      card(id, { key: r.game, face: true, name: r.who, desc: '「' + r.text + '」', difficulty: g.difficulty },
        Quest.isDone(id) ? 'cleared' : 'next', g.name + 'で ' + r.gets + 'こ　🎁 ' + QUEST_SOUVENIRS[id].name);
      Menu.questFace(grid.lastChild, r.who);
    });
    // ぬしの台は、おねがいを 3 つ かなえると ひらく
    const open = DEBUG || Quest.requestsDone(c);
    card(Quest.bossId(c), { key: 'boss', face: open || done, name: ch.boss, desc: 'おおきな ぬしを たおせ！', difficulty: 3, lockText: 'おねがいを 3つ かなえると ひらく' },
      done ? 'cleared' : open ? 'next' : 'locked', 'たおすと ずかんに のる', true);
    if (open || done) Menu.questFace(grid.lastChild, ch.boss);
  },

  // クエストのボタンの名前の左に、その人（ぬし）の小さな顔を出す
  questFace(button, who) {
    const face = QuestArt.face(who);
    if (!face) return;
    const img = document.createElement('canvas');
    img.width = face.width;
    img.height = face.height;
    img.className = 'quest-face';
    img.getContext('2d').drawImage(face, 0, 0);
    button.querySelector('.menu-name').prepend(img);
  },
};
