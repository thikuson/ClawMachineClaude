// キーボードと画面のボタンの入力を管理する
const Input = {
  keys: {},           // 押し続けているキー
  pressedQueue: {},   // 押された瞬間を 1 回だけ伝えるためのキー

  init() {
    // Enter と スペース・矢印キーは、ブラウザの動き（ページのスクロールや、最後に押した画面のボタンをもう一度押すこと）を止める
    const blockDefault = ['Space', 'Enter', 'NumpadEnter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    // Enter キーはスペースキーと同じ働きにする（下ろす・もう一度遊ぶ）。どちらでも押しやすい方で遊べるように
    const aliases = { Enter: 'Space', NumpadEnter: 'Space' };

    window.addEventListener('keydown', (e) => {
      const codes = aliases[e.code] ? [e.code, aliases[e.code]] : [e.code];
      for (const code of codes) {
        if (!e.repeat) this.pressedQueue[code] = true;
        this.keys[code] = true;
      }
      if (blockDefault.includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (aliases[e.code]) this.keys[aliases[e.code]] = false;
    });
    // ウィンドウからフォーカスが外れたら、押しっぱなし扱いを解除する
    window.addEventListener('blur', () => {
      this.keys = {};
    });

    // スマホで画面を長押ししたときに、文字の選択やメニュー（コピーなど）が出て
    // 端末が振動しないようにする。ゲームの画面では文字を選ぶ必要がないため
    const app = document.querySelector('.app');
    if (app) {
      app.addEventListener('contextmenu', (e) => e.preventDefault());
      app.addEventListener('selectstart', (e) => e.preventDefault());
    }

    // 画面のボタン（スマホ向け）。data-key に対応するキーを押したことにする
    document.querySelectorAll('[data-key]').forEach((btn) => {
      const code = btn.dataset.key;
      const press = (e) => {
        e.preventDefault();
        // 今は押せないボタン（灰色にしたもの）は、押しても何もしない
        if (btn.disabled || btn.classList.contains('off')) return;
        this.keys[code] = true;
        this.pressedQueue[code] = true;
      };
      const release = () => {
        this.keys[code] = false;
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
    });
  },

  // 押し続けているかどうか
  isDown(code) {
    return !!this.keys[code];
  },

  // 画面を切り替えたときに、前の画面で押されたキーが残らないように消す
  clearPressed() {
    this.pressedQueue = {};
  },

  // 各モードの usableKeys() で使う。今押せるキーの一覧を作る。
  // ready：今アームを動かしたり下ろしたりできるか。over：ゲームが終わって、スペース（「下ろす」）で もういちど 遊べるか。
  // moveKeys：ready のときだけ使える移動のキー
  usable(ready, over, moveKeys = []) {
    const keys = { Space: ready || over };
    for (const k of moveKeys) keys[k] = ready;
    return keys;
  },

  // 押された瞬間かどうか（1 回読むと消える）
  wasPressed(code) {
    const pressed = !!this.pressedQueue[code];
    this.pressedQueue[code] = false;
    return pressed;
  },
};
