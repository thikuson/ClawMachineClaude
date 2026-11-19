// 1 ゲーム分の進行（スコア・残り回数・メッセージ・終了判定）。どのモードでも共通で使う
function GameSession(modeKey, options) {
  // ランダムで選ばれたゲームのときは、選ばれたゲームの名前が入っている（main.js が始める前に設定する）
  this.randomName = GameSession.randomName;
  // ハイスコアを遊び方と難しさごとに分けるための名前。
  // ランダムは回数が少なく、ほかのゲームの記録と比べられないので、どのゲームが選ばれてもランダム用の記録にまとめる
  this.modeKey = GameSession.scoreKey(this.randomName ? 'random' : modeKey, Level.key);
  this.plays = this.randomName ? CONFIG.game.randomPlays : CONFIG.game.plays;
  this.restartHint = options.restartHint;
  // 難しさの表示に、アームの揺れのあり・なしを添えるか（リングはどの難しさでも揺れるので添えない）
  this.showSwing = options.showSwing !== false;
  this.reset();
}

// むずかしいは遊び方の名前のまま（以前の「揺れあり」の記録を引き継ぐため）、
// ふつうは後ろに '_normal'、かんたんは '_easy' を付ける
// ランダムで遊んでいるときに、選ばれたゲームの名前を入れておく（それ以外は null）
GameSession.randomName = null;

GameSession.scoreKey = function (modeKey, levelKey) {
  if (levelKey === 'hard') return modeKey;
  return modeKey + '_' + levelKey;
};

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
  this.score = 0;
  this.playsLeft = this.plays;
  this.gameOver = null;  // 終わったときの結果（遊んでいる間は null）
  this.help = '';        // 何もないときに出す操作説明（モードが状態に合わせて設定する）
  this.message = '';
  this.messageTimer = 0;
  this.endTimer = 0;     // 最後の 1 回のあと、景品が落ち着くまで待つ時間
};

// 終わったあとに「もういちど」遊ぶとき。ふだんは reset（景品を並べ直して最初から）を呼ぶ。
// ランダムでは、景品を並べ直さずに今の状態のまま、回数だけを足して続けて遊ぶ。
// スコアは 3 回ごとの記録にするため 0 に戻す。景品が全部なくなって終わったときは、続けられないので並べ直す
GameSession.prototype.continueOr = function (reset) {
  if (!this.randomName || !this.gameOver || this.gameOver.allClear) {
    reset();
    return;
  }
  this.score = 0;
  this.playsLeft = this.plays;
  this.gameOver = null;
  this.endTimer = 0;
  this.message = 'つづけて あと ' + this.plays + ' 回！';
  this.messageTimer = 2.5;
  Sound.grab();
};

GameSession.prototype.canPlay = function () {
  return this.playsLeft > 0 && !this.gameOver;
};

GameSession.prototype.showMessage = function (key) {
  this.message = GameSession.MESSAGES[key];
  this.messageTimer = 2.5;
};

// 1 回分の回数を使う
GameSession.prototype.usePlay = function () {
  this.playsLeft--;
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
  const points = sprite.points * (prize.pointScale || 1); // 3 本爪モードの大きい景品は点数が高い
  this.score += points;
  const isNew = Collection.add(prize.type);

  Effects.burst(x, y, sprite.rare ? 120 : 50);
  Effects.popup('+' + points + '点', x + 40, y - 40);
  if (isNew) Effects.popup('はじめて！', x + 40, y - 80, '#ff7aa8');

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
  const noPrizes = prizesLeft === 0;
  if ((this.playsLeft > 0 && !noPrizes) || !clawIdle) {
    this.endTimer = 0;
    return;
  }
  // 最後に落とした景品が取り出し口に入るかもしれないので、少し待つ
  this.endTimer += dt;
  if (this.endTimer < 1) return;
  const isRecord = Collection.submitScore(this.modeKey, this.score);
  this.gameOver = { score: this.score, isRecord, allClear: noPrizes };
  if (isRecord || noPrizes) Sound.clear();
};

GameSession.prototype.drawHud = function () {
  Render.drawHud({
    score: this.score,
    playsLeft: this.playsLeft,
    highScore: Collection.highScores[this.modeKey] || 0,
    // ランダムのときは、どのゲームが選ばれたかも添える
    levelLabel: (this.randomName ? 'ランダム：' + this.randomName + '　' : '') +
      Level.settings.label + (!this.showSwing ? '' : Level.settings.swing ? '（揺れあり）' : '（揺れなし）'),
    message: this.message || this.help,
    soundOn: Sound.enabled,
  });
  if (this.gameOver) {
    // ランダムでは、同じゲームでもう一度遊ぶか、別のゲームを選び直すかを選べる
    // （続けて遊ぶのは、景品が残っているときだけ。全部取ったときは並べ直して同じゲームをもう一度）
    // R は「並べ直す」なので、続けて遊ぶ案内からは外す
    let hint = this.restartHint;
    if (this.randomName) {
      const again = this.gameOver.allClear
        ? hint.replace('もういちど', 'おなじゲーム')
        : hint.replace(/^R か ?/, '').replace('もういちど', 'つづけて ' + this.plays + ' 回');
      hint = again + '\nN か「次のランダム」で べつのゲーム';
    }
    Render.drawGameOver(this.gameOver, Collection.highScores[this.modeKey] || 0, hint);
  }
};
