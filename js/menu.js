// メニューのゲームのボタンを、config.js の GAMES・GENRES から作る
// 一番上のタブ（フリー・チャレンジ・ステップ）によって、並べ方と見せ方を変える
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
    const mark = locked ? '🔒 ' : state === 'cleared' ? '✔ ' : '';
    const desc = locked ? 'まえの だんを クリアで ひらく' : game.desc;
    b.innerHTML =
      '<span class="menu-name">' + (number ? '<span class="menu-num">' + number + '</span>' : '') + mark + (locked ? '？？？' : game.name) + '</span>' +
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
};
