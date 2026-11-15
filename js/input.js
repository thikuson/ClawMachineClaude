// キーボードと画面のボタンの入力を管理する
const Input = {
  keys: {},           // 押し続けているキー
  pressedQueue: {},   // 押された瞬間を 1 回だけ伝えるためのキー

  init() {
    const blockScroll = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressedQueue[e.code] = true;
      this.keys[e.code] = true;
      // スペースや矢印キーでページがスクロールしないようにする
      if (blockScroll.includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
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

  // 押された瞬間かどうか（1 回読むと消える）
  wasPressed(code) {
    const pressed = !!this.pressedQueue[code];
    this.pressedQueue[code] = false;
    return pressed;
  },
};
