// 1 ゲーム分の進行（取った数・残り回数・コイン・メッセージ・終了判定）。どのモードでも共通で使う
function GameSession(modeKey, options) {
  // ランダムで選ばれたゲームのときは、選ばれたゲームの名前が入っている（main.js が始める前に設定する）
  this.randomName = GameSession.randomName;
  this.gameKey = modeKey;
  // メニューの一番上のタブで選んでいたモード（'free'・'challenge'・'step'。main.js が始める前に設定する）
  this.playMode = GameSession.playMode;
  this.plays = this.randomName ? CONFIG.game.randomPlays : CONFIG.game.plays;
  this.restartHint = options.restartHint;
  // 難しさの表示に、アームの揺れのあり・なしを添えるか（リングはどの難しさでも揺れるので添えない）
  this.showSwing = options.showSwing !== false;
  // どのモードも、作ったあとに自分の reset から session.reset を呼ぶ。
  // ステップの金コインがそのときに 2 回払われないように、ここでは払わずに準備だけする
  this.paying = false;
  this.reset();
  this.paying = true;
}

// ランダムで遊んでいるときに、選ばれたゲームの名前を入れておく（それ以外は null）
GameSession.randomName = null;
GameSession.playMode = 'free';

// ゲーム内のセリフ
GameSession.MESSAGES = {
  get: 'やったね！ ゲットだ！',
  newGet: 'あたらしい なかまが ふえた！',
  rare: 'すごい！ きんのほしだ！',
  miss: 'あれれ… つかめなかった',
  slip: 'おしい！ おちちゃった…',
  lastPlay: 'さいごの いっかい！',
  hook: 'ひっかかった！ そのまま ひきあげろ！',
  ringRim: 'フックに あたって はじかれた…',
  ringOff: 'おしい！ リングが はずれちゃった…',
  scoopMiss: 'あれれ… すくえなかった',
  scoopSpill: 'おしい！ こぼれちゃった…',
  bbThrow: 'ぽーん！ なげちゃった！',
};

GameSession.prototype.reset = function () {
  this.gets = 0;          // このゲームで取った景品の数
  this.earnedGold = 0;    // このゲームでもらった金コイン（チャレンジ）
  this.playsLeft = this.plays;
  this.gameOver = null;  // 終わったときの結果（遊んでいる間は null）
  this.help = '';        // 何もないときに出す操作説明（モードが状態に合わせて設定する）
  this.message = '';
  this.messageTimer = 0;
  this.endTimer = 0;     // 最後の 1 回のあと、景品が落ち着くまで待つ時間
  this.stepCleared = false; // ステップで、このゲームをクリアしたか
  // チャレンジは、回数ではなく銀コインがあるだけ遊べる
  if (this.playMode === 'challenge') this.playsLeft = Math.floor(Collection.silver / CONFIG.coins.challengeCost);
  // ステップは、1 ゲームごとに金コインを払う。足りなければ遊べないので、すぐに終わりの画面を出す
  // （デバッグモードでは払わない）
  if (this.playMode === 'step' && this.paying && !DEBUG && !Collection.spendGold(this.stepCost())) {
    this.playsLeft = 0;
    this.gameOver = { gets: 0, title: 'きんコインが たりない', noGold: true };
  }
};

// 終わったあとに「もういちど」遊ぶとき。ふだんは reset（景品を並べ直して最初から）を呼ぶ。
// ランダムでは、景品を並べ直さずに今の状態のまま、回数だけを足して続けて遊ぶ。
// 景品が全部なくなって終わったときは、続けられないので並べ直す
GameSession.prototype.continueOr = function (reset) {
  if (!this.randomName || !this.gameOver || this.gameOver.allClear) {
    reset();
    return;
  }
  this.gets = 0;
  this.playsLeft = this.plays;
  this.gameOver = null;
  this.endTimer = 0;
  this.message = 'つづけて あと ' + this.plays + ' 回！';
  this.messageTimer = 2.5;
  Sound.grab();
};

// ステップで 1 ゲーム遊ぶのに使う金コイン（ぬしの台は多め）
GameSession.prototype.stepCost = function () {
  const game = GAMES.find((g) => g.key === this.gameKey);
  return (game && game.stepCost) || CONFIG.coins.stepCost;
};

GameSession.prototype.canPlay = function () {
  return this.playsLeft > 0 && !this.gameOver;
};

GameSession.prototype.showMessage = function (key) {
  this.message = GameSession.MESSAGES[key];
  this.messageTimer = 2.5;
};

// 1 回分の回数を使う。チャレンジでは銀コインを払う
GameSession.prototype.usePlay = function () {
  if (this.playMode === 'challenge') {
    Collection.spendSilver(CONFIG.coins.challengeCost);
    this.playsLeft = Math.floor(Collection.silver / CONFIG.coins.challengeCost);
  } else {
    this.playsLeft--;
  }
  if (this.playsLeft === 1) this.showMessage('lastPlay');
};

// アームからの知らせ（つかんだ・失敗した・落とした）を、効果音・演出・セリフに振り分ける
// x, y はアームの画面上の位置
GameSession.prototype.onClawEvent = function (kind, x, y) {
  if (kind === 'drop') Sound.drop();
  if (kind === 'grab') Sound.grab();
  if (kind === 'miss') { Sound.miss(); this.showMessage('miss'); }
  if (kind === 'slip') {
    Sound.slip();
    this.showMessage('slip');
    Effects.popup('おしい！', x, y, '#6fd3ff');
  }
};

// 景品が取り出し口に入ったとき。x, y は演出を出す画面上の位置
GameSession.prototype.onCaptured = function (prize, x, y) {
  const sprite = PRIZE_SPRITES[prize.type];
  this.gets++;
  const isNew = Collection.add(prize.type);

  Effects.burst(x, y, sprite.rare ? 120 : 50);
  // チャレンジでは、景品のほかに金コインももらえる（景品・ゲーム・難しさで枚数が変わる）
  if (this.playMode === 'challenge') {
    const gold = prizeGold(sprite, this.gameKey, Level.key);
    Collection.addGold(gold);
    this.earnedGold += gold;
    Effects.popup('🥇+' + gold, x + 40, y - 40);
  } else {
    Effects.popup('ゲット！', x + 40, y - 40);
  }
  if (isNew) Effects.popup('はじめて！', x + 40, y - 80, '#ff7aa8');

  // ステップ：決まった数の景品を取ったら、このゲームはクリア。同じ難しさの次のゲームが遊べるようになる
  const game = GAMES.find((g) => g.key === this.gameKey);
  let announced = false; // 大きな知らせを出したか（出したら、いつものセリフは出さない）
  if (this.playMode === 'step' && !this.stepCleared && game && this.gets >= game.clearGets) {
    this.stepCleared = true;
    const opened = Collection.clearStep(Level.key, this.gameKey);
    Effects.popup('クリア！', x, y - 120, '#9cf07a');
    Sound.clear();
    this.message = this.gameKey === 'boss' ? 'ぬしを たおした！ ひみつの けいひん ゲット！'
      : opened ? 'クリア！ つぎの だんが ひらいた！' : 'クリア！';
    this.messageTimer = 4;
    announced = true;
  }
  // 図鑑が全部そろったら、大きく知らせる（ひみつの景品も含めて全部）
  if (isNew && Collection.completedCount() === PRIZE_SPRITES.length) {
    Sound.clear();
    Effects.burst(x, y - 100, 200);
    Effects.popup('ずかん コンプリート！', CONFIG.width / 2, 200, '#ffe066');
    this.message = 'ずかん コンプリート！ おめでとう！';
    this.messageTimer = 6;
    announced = true;
  }
  if (announced) return;
  if (sprite.rare) { Sound.clear(); this.showMessage('rare'); }
  else if (isNew) { Sound.clear(); this.showMessage('newGet'); }
  else { Sound.get(); this.showMessage('get'); }
};

// 回数を使い切ったか、景品がなくなったら終わり。clawIdle はアームが待機中かどうか
GameSession.prototype.update = function (dt, clawIdle, prizesLeft) {
  if (this.messageTimer > 0) {
    this.messageTimer -= dt;
    if (this.messageTimer <= 0) this.message = '';
  }

  if (this.gameOver) return;
  // チャレンジでは、遊んでいる途中に図鑑で景品を売って銀コインが増えることがあるので、毎回数え直す
  if (this.playMode === 'challenge') this.playsLeft = Math.floor(Collection.silver / CONFIG.coins.challengeCost);
  const noPrizes = prizesLeft === 0;
  if ((this.playsLeft > 0 && !noPrizes) || !clawIdle) {
    this.endTimer = 0;
    return;
  }
  // 最後に落とした景品が取り出し口に入るかもしれないので、少し待つ
  this.endTimer += dt;
  if (this.endTimer < 1) return;
  this.gameOver = { gets: this.gets, earnedGold: this.earnedGold, allClear: noPrizes };
  if (this.playMode === 'challenge' && !noPrizes) this.gameOver.title = 'ぎんコインが なくなった';
  else if (this.stepCleared) this.gameOver.title = 'クリア！';
  if (noPrizes || this.stepCleared) Sound.clear();
};

GameSession.prototype.drawHud = function () {
  const challenge = this.playMode === 'challenge';
  const game = GAMES.find((g) => g.key === this.gameKey) || {};
  Render.drawHud({
    left: 'ゲット ' + this.gets + ' こ' + (this.playMode === 'step' ? ' / ' + game.clearGets : ''),
    center: challenge ? '🥈 のこり ' + this.playsLeft + ' 枚' : 'のこり ' + this.playsLeft + ' 回',
    warn: this.playsLeft <= 2, // 残りが少なくなったら色を変えて目立たせる
    right: '🥈' + Collection.silver + '　🥇' + Collection.gold,
    // ランダムのときは、どのゲームが選ばれたかも添える
    levelLabel: (this.randomName ? 'ランダム：' + this.randomName + '　' : '') +
      (challenge ? 'チャレンジ　' : '') + (this.playMode === 'step' ? 'ステップ　' : '') +
      Level.settings.label + (!this.showSwing ? '' : Level.settings.swing ? '（揺れあり）' : '（揺れなし）'),
    message: this.message || this.help,
    soundOn: Sound.enabled,
  });
  if (this.gameOver) {
    const over = this.gameOver;
    const lines = [];
    let hint = this.restartHint;
    if (over.noGold) {
      lines.push('あそぶには 🥇 ' + this.stepCost() + ' 枚 いるよ');
      lines.push('チャレンジで あつめよう');
      hint = 'Esc か「メニューへ」で もどる';
    } else {
      lines.push('ゲット：' + over.gets + ' こ');
      if (challenge) lines.push('きんコイン：+' + over.earnedGold + ' 枚');
      if (this.playMode === 'step') lines.push(this.stepCleared ? 'つぎの だんへ すすもう！' : 'クリアまで あと ' + Math.max(0, game.clearGets - over.gets) + ' こ');
    }
    if (challenge) {
      hint = this.playsLeft > 0
        ? 'のこり 🥈 ' + this.playsLeft + ' 枚。「下ろす」で つづける\nEsc か「メニューへ」で べつの ゲーム'
        : 'ずかんの けいひんを うると 🥈 が ふえるよ\nEsc か「メニューへ」で もどる';
    } else if (this.playMode === 'step' && !over.noGold) {
      hint = hint + '（🥇 ' + this.stepCost() + ' 枚）';
    }
    // ランダムでは、同じゲームでもう一度遊ぶか、別のゲームを選び直すかを選べる
    // （続けて遊ぶのは、景品が残っているときだけ。全部取ったときは並べ直して同じゲームをもう一度）
    // R は「並べ直す」なので、続けて遊ぶ案内からは外す
    if (this.randomName) {
      const again = over.allClear
        ? hint.replace('もういちど', 'おなじゲーム')
        : hint.replace(/^R か ?/, '').replace('もういちど', 'つづけて ' + this.plays + ' 回');
      hint = again + '\nN か「次のランダム」で べつのゲーム';
    }
    Render.drawGameOver(over, lines, hint);
  }
};
