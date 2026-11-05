// キーボード入力の状態を管理する
const Input = {
  keys: {},

  init() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      // スペースや矢印キーでページがスクロールしないようにする
      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  },

  isDown(code) {
    return !!this.keys[code];
  },
};
