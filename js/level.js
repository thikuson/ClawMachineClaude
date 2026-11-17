// 難しさ（かんたん・ふつう・むずかしい）。どのゲームにも同じ考え方で効かせる
//   openScale  爪の開き具合の倍率（アームの tipOpen に掛ける）
//   gripPower  つかむ力。大きいほど、景品の真ん中からずれていてもつかみやすく、運ぶ途中で落としにくい
//   swing      アームが揺れるかどうか
const LEVELS = {
  easy:   { label: 'かんたん', openScale: 1.4, gripPower: 2, swing: false },
  normal: { label: 'ふつう', openScale: 1, gripPower: 1, swing: false },
  hard:   { label: 'むずかしい', openScale: 1, gripPower: 1, swing: true },
};
const LEVEL_KEYS = ['easy', 'normal', 'hard'];

const Level = {
  key: 'normal',

  get settings() {
    return LEVELS[this.key];
  },

  // ゲームを始めるときに呼ぶ。揺れはここで全ゲームまとめて切り替える
  set(key) {
    this.key = key;
    Swing.enabled = LEVELS[key].swing;
  },

  // アームの設定 base に、今の難しさの「爪の開き」と「つかむ力」を反映した写しを返す（base は書き換えない）
  apply(base) {
    const s = this.settings;
    return Object.assign({}, base, {
      tipOpen: base.tipOpen * s.openScale,
      gripPower: (base.gripPower || 1) * s.gripPower,
    });
  },
};
