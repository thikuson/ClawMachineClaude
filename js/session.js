// 1 ゲーム分の進行（スコア・残り回数・メッセージ・終了判定）。どのモードでも共通で使う
function GameSession(modeKey, options) {
  this.modeKey = modeKey;          // 'classic' や 'button'。ハイスコアをモードごとに分けるため
  this.restartHint = options.restartHint;
  this.reset();
}

// ゲーム内のセリフ
GameSession.MESSAGES = {
  get: 'やったね！ ゲットだ！',
  newGet: 'あたらしい なかまが ふえた！',
  rare: 'すごい！ きんのほしだ！',
  miss: 'あれれ… つかめなかった',
  slip: 'おしい！ おちちゃった…',
  lastPlay: 'さいごの いっかい！',
};

GameSession.prototype.reset = function () {
  this.score = 0;
  this.playsLeft = CONFIG.game.plays;
  this.gameOver = null;  // 終わったときの結果（遊んでいる間は null）
  this.help = '';        // 何もないときに出す操作説明（モードが状態に合わせて設定する）
  this.message = '';
  this.messageTimer = 0;
  this.endTimer = 0;     // 最後の 1 回のあと、景品が落ち着くまで待つ時間
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
  this.score += sprite.points;
  const isNew = Collection.add(prize.type);

  Effects.burst(x, y, sprite.rare ? 120 : 50);
  Effects.popup('+' + sprite.points + '点', x + 40, y - 40);
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
    highScore: Collection.highScores[this.modeKey],
    message: this.message || this.help,
    soundOn: Sound.enabled,
  });
  if (this.gameOver) {
    Render.drawGameOver(this.gameOver, Collection.highScores[this.modeKey], this.restartHint);
  }
};
