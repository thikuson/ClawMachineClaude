// ゲーム全体で使う設定値をまとめる
const CONFIG = {
  width: 480,   // キャンバスの幅
  height: 640,  // キャンバスの高さ

  // 筐体（ガラスケース）の内側の範囲
  case: { x: 30, y: 60, w: 420, h: 480 },

  // 景品の取り出し口
  chute: { x: 40, y: 400, w: 100, h: 140 },

  colors: {
    background: '#2b2745',
    frame: '#e85d8a',
    glass: '#3d3866',
    floor: '#5a4f8c',
    chute: '#1a1730',
    text: '#f4f1ff',
  },
};
