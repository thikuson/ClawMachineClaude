// ゲーム全体で使う設定値をまとめる
const CONFIG = {
  width: 480,   // キャンバスの幅
  height: 640,  // キャンバスの高さ

  // 筐体（ガラスケース）の内側の範囲
  case: { x: 30, y: 60, w: 420, h: 480 },

  // 床の上端の y 座標（ケースの下から 40px）
  floorY: 500,

  // 景品の取り出し口（この範囲の上から落ちた景品が獲得になる）
  chute: { x: 40, y: 400, w: 100, h: 140 },

  // アーム
  claw: {
    homeX: 90,         // 開始位置（取り出し口の真上）
    homeY: 100,        // 待機中の本体の高さ（中心の y 座標）
    minX: 70,          // 左右に動ける範囲
    maxX: 410,
    moveSpeed: 160,    // 左右の移動速度（px/秒）
    downSpeed: 150,    // 下降速度（px/秒）
    upSpeed: 120,      // 上昇速度（px/秒）
    returnSpeed: 140,  // 取り出し口へ戻る速度（px/秒）
    armLength: 44,     // 本体から爪の先までの長さ
    tipClosed: 8,      // 閉じたときの爪の先の、中心からの距離
    tipOpen: 34,       // 開いたときの爪の先の、中心からの距離
    closeTime: 0.45,   // 閉じるのにかかる時間（秒）
    openTime: 0.3,     // 開くのにかかる時間（秒）
  },

  // 景品
  prize: {
    count: 8,          // 最初に置く数
    minRadius: 17,
    maxRadius: 22,
    gravity: 900,      // 重力加速度（px/秒^2）
    spawnMinX: 175,    // 最初に置く範囲（取り出し口より右）
    spawnMaxX: 425,
    rareChance: 0.35,  // レア景品が混ざる確率
  },

  // 2 ボタンモード。景品を左右（x）と奥行き（z）の床に置き、斜め前から見た画面で描く
  // 座標の単位は「世界」の長さ。画面上の位置は render_floor.js の project() で計算する
  ufo: {
    worldW: 400,       // 床の横幅
    worldD: 200,       // 床の奥行き
    topH: 400,         // アームの待機する高さ
    frontY: 515,       // 床の手前の辺の、画面上の y 座標
    backY: 365,        // 床の奥の辺の、画面上の y 座標
    centerX: 240,      // 画面の中心の x 座標
    backScale: 0.65,   // 奥に行くほど小さく見せる割合（奥の辺での大きさ）
    home: { x: 45, z: 40 },          // 開始位置（取り出し口の真上）
    chute: { w: 90, d: 80 },         // 取り出し口（左手前の角の範囲）
    maxX: 380,         // ① で動ける右の端
    maxZ: 185,         // ② で動ける奥の端
    moveSpeed: 110,    // ① ② で動く速さ
    downSpeed: 150,
    upSpeed: 120,
    returnSpeed: 160,
    spawnMinX: 130,    // 景品を置く範囲
    spawnMaxX: 375,
    spawnMinZ: 30,
    spawnMaxZ: 180,
  },

  // 2 ボタンモードの爪（2 本）
  twoClawArm: {
    prongs: 2,
    armLength: 44,     // 本体から爪の先までの長さ
    tipClosed: 8,      // 閉じたときの爪の先の、中心からの距離
    tipOpen: 34,       // 開いたときの爪の先の、中心からの距離
    hugRatio: 0.75,    // 景品をつかんだとき、景品の半径のどこまで爪が閉じるか
    closeTime: 0.45,
    openTime: 0.3,
    gripFactor: 1,     // つかむ力の倍率（景品ごとのつかみやすさに掛ける）
  },

  // 3 本爪モード。床などは 2 ボタンモードと同じで、取り出し口と動ける範囲が違う
  threeClaw: {
    worldW: 400,
    worldD: 200,
    topH: 400,
    frontY: 515,
    backY: 365,
    centerX: 240,
    backScale: 0.65,
    home: { x: 60, z: 50 },
    chute: { w: 120, d: 100 },  // 大きい景品が入るように広くする
    minX: 40,          // 十字キーで動ける範囲
    maxX: 375,
    minZ: 30,
    maxZ: 180,
    moveSpeed: 100,
    downSpeed: 140,
    upSpeed: 110,
    returnSpeed: 150,
    timeLimit: 15,     // 1 回ごとの制限時間（秒）。過ぎると自動で下りる
    prizeCount: 3,     // 置く景品の数
    prizeScale: 2.1,   // 景品の大きさの倍率
    pointScale: 2,     // 大きい景品なので、点数を 2 倍にする
    spawnMinX: 180,
    spawnMaxX: 350,
    spawnMinZ: 60,
    spawnMaxZ: 150,
  },

  // 3 本爪モードの爪。大きい景品を包むように 3 本の爪で囲む
  threeClawArm: {
    prongs: 3,
    armLength: 70,
    tipClosed: 12,
    tipOpen: 62,
    hugRatio: 0.85,
    closeTime: 0.6,
    openTime: 0.35,
    gripFactor: 0.9,   // 3 本爪は力が弱めで、真ん中をとらえないと落としやすい
  },

  // アームの揺れ（js/swing.js）
  swing: {
    stiffness: 27,     // 元に戻ろうとする強さ（大きいほど速く揺れる）
    damping: 1.0,      // 揺れの収まりやすさ（大きいほど早く止まる）
    strength: 0.6,     // 台車の速さが変わったときの振られやすさ
    maxOffset: 22,     // 揺れの最大の幅
    grabKick: 25,      // つかんだときのガクンという揺れの強さ
    slipStart: 7,      // 揺れの幅がこれを超えると、運んでいる景品が落ちることがある
    slipRate: 0.35,    // 揺れによる落ちやすさ
  },

  // ゲームの決まり
  game: {
    plays: 10,         // 1 ゲームで遊べる回数
  },

  colors: {
    background: '#2b2745',
    frame: '#e85d8a',
    glass: '#3d3866',
    floor: '#5a4f8c',
    chute: '#1a1730',
    chuteEdge: '#f2c94c',
    cable: '#c9c4e8',
    claw: '#d9d6f0',
    clawDark: '#8f89b8',
    text: '#f4f1ff',
  },
};
