// ゲーム全体で使う設定値をまとめる

// 試しに遊ぶためのデバッグモード（一時的なもの）。アドレスの後ろに ?debug を付けて開くとオンになる
// （例：index.html?debug）。オンのときは、いつもの記録を読み込んだうえで、ステップの全部の台（ぬしの台も）が
// 最初から遊べて、金コインも使わない。銀コインと金コインは 999 枚から始まる。
// デバッグ中に遊んだ結果（コイン・図鑑・ステップ）は保存しないので、?debug を外して開けば、いつもの記録のまま
const DEBUG = (() => {
  try { return new URLSearchParams(location.search).has('debug'); } catch (e) { return false; }
})();
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
    maxX: 428,         // 右の壁ぎわの景品の真上まで届くようにする（はみ出た爪は render.js でケースの外を描かない）
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

  // おまかせモード。クラシックの左右の移動を自動にして、「下ろす」だけで遊べるようにした遊び方
  // ここにない値はクラシック（CONFIG.claw）と同じ。爪の開きとつかむ力は、難しさ（js/level.js）で決まる
  autoClaw: {
    autoSpeed: 110,    // 自動で左右に動く速さ（px/秒、ずっと一定）
    prizeCount: 4,     // 景品の数（クラシックの半分）
  },

  // リングモード。横から見た筐体で、取り出し口の右に傾く台を置き、景品を載せる。
  // アームの先には丸いリングがぶら下がり、床には「？」の形のフックが立っている。フックと台の留め具はひもでつながっていて、
  // リングをフックに引っかけて引き上げると台が傾き、載っている景品が全部取り出し口に流れ込む
  ring: {
    trayX: 150,        // 台の左端（傾くときの軸）の x 座標。取り出し口のすぐ右
    trayY: 330,        // 台の上面の y 座標
    trayLength: 130,   // 台の長さ
    openAngle: 0.5,    // 台が傾く角度（ラジアン）
    prizeCount: 3,     // 台に載せる景品の数
    hookMinX: 330,     // 「？」のフックを立てる範囲（フックの柱と輪の中心の x 座標）
    hookMaxX: 400,
    postHeight: 46,    // 床からフックの柱のいちばん上（輪のいちばん下）までの高さ。どの大きさでも同じ。
                       // 小さいフックと大きいリングの組み合わせでも、フックの先の下にリングがくぐれる高さにしてある
    curlR: 11,         // フックの上の輪（円の 3/4）の半径（中の大きさ）
    hookWire: 3,       // フックの針金の太さの半分
    ringR: 14,         // リングの半径（針金の中心まで、中の大きさ）
    ringWire: 2.5,     // リングの針金の太さの半分
    sizes: [0.75, 1, 1.3], // フックとリングの大きさ（小・中・大）。景品が取れるたびに、それぞれランダムに選び直す（curlR・ringR は中の大きさ）
    armLength: 30,     // 本体からリングを下げる棒の先までの長さ
    stringLen: 22,     // 棒の先からリングの上のふちまでのひもの長さ。リングはこのひもで振り子のように揺れる
    dropKick: 35,      // 下ろし始めにリングが横に揺れ出す速さの最大値（px/秒）
    settleTime: 0.8,   // 下りきってから引き上げ始めるまでの時間（秒）。この間もリングは揺れている
    hookMass: 1.5,     // フックの重さ（リングの何倍か）。重いほど、引っかけたリングが下に引かれる
    pullToOpen: 45,    // フックをこの高さだけ引き上げると、ひもが張って台が傾く
    maxLift: 60,       // フックが上がれる高さ。ここまで上がると、リングがフックから抜ける
    // 難しさごとの違い。damping は揺れの止まりやすさ、tipZone はフックの先の、リングがくぐれる部分の長さ、
    // tipFacing はリングがどれだけフックの先の正面から来ればくぐれるか（小さいほど甘い）、slip は引き上げ中に外れる確率、
    // tipAngle はフックの輪の終わり（先）の角度（×π）。0 なら先が真下を向き、大きいほど内側へ巻き込んでくぐらせにくくなる
    levels: {
      easy:   { damping: 1.6, tipZone: 14, tipFacing: -0.4, slip: 0.03, tipAngle: 0 },
      normal: { damping: 0.9, tipZone: 5, tipFacing: 0.3, slip: 0.1, tipAngle: 0.05 },
      hard:   { damping: 0.3, tipZone: 3, tipFacing: 0.55, slip: 0.25, tipAngle: 0.1 },
    },
  },

  // リング（2だん）（js/modes/ring2.js）。上の段の左右にフックが 1 本ずつ立ち、下の段の左右に景品を載せた台がある。
  // 真ん中の下が取り出し口。フックを引き上げると、ひもでつながった下の台の外側が持ち上がり、景品が真ん中へ流れ込む。
  // リングとフックの大きさ・揺れ・くぐらせ方・難しさは CONFIG.ring と同じものを使う
  ring2: {
    shelfY: 290,        // 上の段の上面の y 座標（フックが立ち、リングはここより下へ下りない）
    shelfInnerL: 190,   // 左の棚の右端（真ん中はあいている）
    shelfInnerR: 290,   // 右の棚の左端
    trayY: 452,         // 下の台の上面の y 座標
    trayLength: 130,    // 下の台の長さ（取り出し口のそばの軸から、外側へ）
    prizesPerTray: 2,   // 1 つの台に載せる景品の数
    chute: { x: 200, w: 80 }, // 真ん中の取り出し口の左右の範囲
    hookLeft: [70, 160],  // 左のフックを立てる範囲（x 座標）。この真ん中に立てる
    hookRight: [320, 410], // 右のフックを立てる範囲
    homeX: 240,         // アームの待つ位置（取り出し口の上）
    armMinX: 60,        // アームが動ける範囲
    armMaxX: 420,
    // 上の段からアームの待つ高さまでは、ふつうのリングより引き上げられる距離が短いので、
    // 少し引き上げただけで台が傾くようにする（ふつうのリングの pullToOpen・maxLift の代わり）
    pullToOpen: 22,     // フックをこの高さだけ引き上げると、下の台が傾く
    maxLift: 34,        // フックが上がれる高さ。ここまで上がると、リングがフックから抜ける
    // 難しさごとの違い（ふつうのリングの CONFIG.ring.levels に上書きする）。
    // フックは「？」がいろいろな向き（上から見た回り具合）を向き、リングも吊られてくるくる回る。
    // align は、リングの穴の向きがフックの面にどれだけそろえば先がくぐれるか（0〜1、大きいほど厳しい）。
    // 引っかかりさえすれば取れるように、引き上げる途中では外れない（slip 0）
    levels: {
      easy:   { align: 0.5, slip: 0 },
      normal: { align: 0.7, slip: 0 },
      hard:   { align: 0.82, slip: 0 },
    },
  },

  // スウィート（スウィートランド系、js/modes/sweet.js）。ショベル（CONFIG.shovel）と同じ斜め上から見た画面で、
  // 奥のドームの中でテーブルが回り、手前にプッシャーの床がある。ショベルは毎回同じ場所に下りて、景品の山に沈んで少し止まり、
  // 引き上げる（0 個のことも、何個もすくえることもある）。すくった景品はプッシャーの床へ落とし、押し板に押されて
  // 手前のふちから取り出し口へ落ちた景品が獲得になる。ここにない値の意味は CONFIG.shovel と同じ
  sweet: {
    tableX: 235, tableY: 215, tableR: 130, spin: 0.45, prizeCount: 12, refillBelow: 10,
    pivotX: 38, pivotY: 290,
    aimAngle: 0,
    waitLength: 150,   // 待っているときの、軸からショベルの中心までの長さ
    landLength: 232,   // 伸ばす長さ（ここで真下へ沈む）
    swoopTime: 1.4,    // 伸びながら 1/4 円を描いて沈むまでの時間（秒）
    holdTime: 0.6,     // 沈んだまま止まっている時間
    curlTime: 1.1,     // 内側へ巻き込みながら引き上げる時間
    curlBack: 40,      // 巻き込むときに、内側（軸の方）へ引く長さ
    gatherUntil: 0.2,  // 引き上げの高さがここまでのあいだは、通り道の景品をかき集める（0〜1）
    chuteAngle: 0.5,   // プッシャーの床の上（景品を落とす所）に来る角度
    chuteLength: 240,  // プッシャーの床の上に来る長さ
    carrySpeed: 1.1,
    dropWait: 6,       // プッシャーの床の上で「おとす」を待つ時間。過ぎると自動で落とす
    chute: { x: 0, y: 900, w: 0, h: 0 }, // （使わない。取り出し口はプッシャーの床の手前）
    hubR: 50, ringOut: 100,
    bucketDepth: 40,
    view: {
      centerX: 240, originY: 262, squash: 0.68, backScale: 0.82, tableThick: 14, wallHeight: 22,
      boomHeight: 190, bucketLow: 2, bucketHigh: 80,
    },
    // プッシャー（真上から見た位置）。押し板（上の段）の前の面が pushMin〜pushMax（奥行き y）を pushPeriod 秒で往復し、
    // 床（下の段）の景品を手前へ押す。上の段の景品は、下がるときに奥の壁（wallY）に止められて、少しずつ下の段へ落ちる。
    // 床は cx を中心に、奥（backY）で半分の幅 backHalf、手前のふち（frontY）で frontHalf に広がる扇形。
    // 手前のふちを越えた景品は取り出し口へ落ちてゲット、扇の横から出た景品は取れない。topCount は最初に上の段に置く数
    pusher: { cx: 240, backHalf: 100, frontHalf: 160, wallY: 352, backY: 398, pushMin: 402, pushMax: 436, pushPeriod: 3, pushH: 16, frontY: 522, packing: 0.92, startCount: 18, topCount: 7 },
    settleTime: 3, // 最後に落としてから、終わりにするまで待つ時間（押し出されて落ちる景品を待つ）
    // 難しさごとの違い。bucketWidth はショベルの幅、capacity は一度にすくえる数、spill は持ち上げるときのこぼれやすさ
    levels: {
      easy:   { bucketWidth: 72, capacity: 4, spill: 0.35, wobble: 0 },
      normal: { bucketWidth: 68, capacity: 3, spill: 0.45, wobble: 0 },
      hard:   { bucketWidth: 62, capacity: 3, spill: 0.6, wobble: 1 },
    },
  },

  // バンバンモード（台湾式のキャッチャー）。横から見た筐体で、真ん中の取り出し口の左右に高い床があり、景品をぎゅうぎゅうに積む。
  // 3 本爪のアームはケーブルで吊られていて、どの難しさでも下ろすときに大きく揺れる（左右に動かしたときの揺れは、むずかしいだけ）。
  // つかんだ景品は持ち上げる途中で投げることが多く、揺れる爪に当たった景品は弾かれたり転がったりする。床の内側のふちから落ちた景品が獲得になる
  banban: {
    shelfY: 330,       // 高い床の上面の y 座標（ふつうの床より 170px 高い）
    chute: { x: 200, w: 80 }, // 取り出し口の左右の範囲（真ん中）。この左右が高い床
    prizeCount: 36,    // 景品の数（同じ種類が何個あってもよい）。左右の床に 18 個ずつ、5 段に積む
    minR: 15,          // 景品の大きさ（ほかのゲームより小さめにして、たくさん詰める）
    maxR: 18,
    spawnMargin: 10,   // 景品を積むときに、床の内側のふちから空けておく幅
    groundWeight: 0.15, // 床に着いている景品の動きにくさ（景品どうしが押し合うとき、ほかの景品の何倍しか動かないか）
    lipFriction: 0.8,  // 床のふちのでっぱりに当たったときの遅くなり方（1 回の計算ごと）
    sleepSpeed: 12,    // この速さ（px/秒）より遅い状態が sleepTime 秒続いた景品は、止まったものとして眠らせる
    sleepTime: 0.4,
    pushScale: 0.35,   // 爪が景品に当たったとき、爪の速さのどれだけを景品に与えるか
    maxPush: 120,      // 爪が景品に与える速さの上限（px/秒）
    rollFriction: 0.99,  // 床とこすれたときの遅くなり方（転がる景品）
    slideFriction: 0.9,  // 床とこすれたときの遅くなり方（転がらない景品。ほかのゲームより滑りやすくして、押されると動く）
    throwMin: 150,     // 投げるときの、上向きの速さ（px/秒）
    throwMax: 320,
    throwSideMin: 90,  // 投げるときの、横向きの速さ（px/秒）。爪の間から確実に飛び出す速さにする
    throwSideMax: 220,
    // アームの設定。爪の開きとつかむ力は、難しさ（js/level.js）で変わる
    claw: {
      homeX: 240, homeY: 100, minX: 52, maxX: 428,
      moveSpeed: 200, downSpeed: 240, upSpeed: 170, returnSpeed: 190,
      autoSpeed: 150, // おまかせバンバンで、アームが自動で左右に往復する速さ（px/秒、ずっと一定）
      armLength: 44, tipClosed: 6, tipOpen: 28, closeTime: 0.4, openTime: 0.3,
    },
    // ケーブルの揺れ。振り子と同じく、ケーブルが長いほどゆっくり揺れる
    swing: {
      gravity: 900,      // 揺れを戻す強さ（重力と同じ値）
      minCable: 40,      // ケーブルの長さの下限（短すぎると揺れが速くなりすぎるため）
      damping: 0.35,     // 揺れの収まりやすさ（小さいので、なかなか止まらない）
      calmDamping: 4,    // かんたん・ふつうで、上まで戻ったあとの揺れの収まりやすさ
      strength: 0.5,     // 台車の速さが変わったときの振られやすさ（むずかしいだけ）
      maxOffset: 70,     // 揺れの最大の幅
      dropKickMin: 90,   // 下ろし始めに揺れ出す速さ（px/秒）。向きはランダム
      dropKickMax: 160,
      liftKick: 60,      // 引き上げ始めのガクンという揺れの強さ
    },
    // 難しさごとの違い。grab はつかめる確率のもと、throwChance は持ち上げる途中で投げる確率、
    // pushPower は爪が景品を弾く強さ（強いほど、ふちから押し出しやすい）、
    // lipR は床の内側のふちの低い丸いでっぱりの半径（積んだ景品が自然に崩れ落ちないように支える。大きいほど乗り越えにくい）、
    // pairFriction は景品どうしの摩擦（0〜1。こすれ合う向きの速さの差を、1 回の計算でどれだけ小さくするか。大きいほど山が崩れにくい）、
    // throwToChute は投げる向きが取り出し口の方になる確率
    levels: {
      easy:   { grab: 0.95, throwChance: 0.45, pushPower: 1.4, lipR: 10, pairFriction: 0.4, throwToChute: 0.7 },
      normal: { grab: 0.75, throwChance: 0.75, pushPower: 0.8, lipR: 17, pairFriction: 0.65, throwToChute: 0.5 },
      hard:   { grab: 0.5, throwChance: 0.9, pushPower: 0.45, lipR: 20, pairFriction: 0.85, throwToChute: 0.25 },
    },
  },

  // ショベルモード。斜め上から見た筐体で、丸いドームの中の回るテーブルに景品が載っている。
  // ショベルはテーブルの中心の少し左手前の上で止まって待っている。「下ろす」を押すと、「⊃」の形に
  // （持ち上げたまま右へ伸ばし、右へふくらみながら下りて）毎回同じ場所に下り、左へ引きながら景品をすくって、手前の真ん中の取り出し口まで運んで落とす
  shovel: {
    tableX: 235,       // 回るテーブルの中心
    tableY: 268,
    tableR: 140,       // テーブルの半径（ドームの内側）
    spin: 0.45,        // テーブルが回る速さ（ラジアン/秒、反時計回り）
    prizeCount: 8,     // 景品の数
    pivotX: 38,        // アームの軸（テーブルの左、中心より手前）。すくう線がテーブルの手前（時計の 4 時半〜7 時半あたり）を通る
    pivotY: 343,       // テーブルは反時計回りなので、手前側の景品は左から右へ流れて、左へ引くショベルに向かってくる
    aimAngle: 0,       // すくう向き（ラジアン。0 が右）。軸から真横に伸びる
    waitLength: 147,   // 待っているときの、軸からショベルの中心までの長さ（テーブルの中心の少し左手前の上）
    landLength: 247,   // 「⊃」の上の線：持ち上げたまま右へ伸ばす長さ（テーブルの中心の少し右手前）
    curveR: 25,        // 「⊃」の丸み：右へふくらみながら下りる大きさ（px）
    curveTime: 0.6,    // 丸みに沿って下りる時間（秒）
    digTo: 147,        // 「⊃」の下の線：床をこすって左へ引く終わり（待つ位置と同じ）。左右に 50px ずつの短い通り道
    reachSpeed: 260,   // 右へ伸ばす速さ（px/秒）
    digSpeed: 150,     // 左へ引く速さ（px/秒）
    chuteAngle: 0.59,  // 取り出し口（テーブルの手前の真ん中）の上に来る角度
    chuteLength: 237,  // 取り出し口の上に来る長さ
    carrySpeed: 1.1,   // 取り出し口へ運ぶ・戻るときに回る速さ（ラジアン/秒）
    chute: { x: 185, y: 428, w: 100, h: 92 }, // 取り出し口（テーブルの手前の真ん中）
    hubR: 55,          // 景品の中心は、テーブルの中心からこれより内側に入らない（真ん中には台がある）
    ringOut: 110,      // 景品の中心は、テーブルの中心からこれより外へも出ない。
                       // 景品は hubR〜ringOut の輪の上を回るので、短い通り道でも、どの景品も回ってくれば届く
    bucketDepth: 38,   // ショベルの奥行き（アームの向き）
    // 斜め上から見た画面にするための値。動きは真上から見た位置で計算し、描くときだけこの値で斜めの形にする
    view: {
      centerX: 240,    // 奥のものを小さくするときの中心
      originY: 300,    // テーブルの中心を描く高さ
      squash: 0.68,    // 奥行きを縦につぶす割合
      backScale: 0.82, // テーブルのいちばん奥の大きさ（手前を 1 として）
      tableThick: 14,  // テーブルの厚み（側面）
      wallHeight: 22,  // ドームの透明な壁の高さ
      boomHeight: 200, // 腕の高さ（持ち上げたショベルより上を通るように）
      bucketLow: 2,    // 下ろしたときのショベルの底の高さ
      bucketHigh: 80,  // 持ち上げたときのショベルの底の高さ
    },
    // 難しさごとの違い。bucketWidth はショベルの幅、capacity は一度にすくえる数、
    // spill は持ち上げるときに景品がこぼれやすい度合い（0 ならこぼれない）、wobble は運ぶときのショベルの揺れ
    // 景品は台のまわりの輪に集まっていてすくいやすいので、かんたんでも一度に 2 個までにして取れすぎないようにする
    levels: {
      easy:   { bucketWidth: 76, capacity: 2, spill: 0.15, wobble: 0 },
      normal: { bucketWidth: 62, capacity: 1, spill: 0.35, wobble: 0 },
      hard:   { bucketWidth: 60, capacity: 1, spill: 0.6, wobble: 1 },
    },
  },

  // 最初の並びのチェック。並べたあと、どの景品もアームが真上近くまで届くかを確かめ、
  // 届かない景品があれば並べ直す（絶対に取れない並びで始まらないようにするため）
  layoutCheck: {
    reachRatio: 0.3,   // アームの中心が、景品の中心から半径のこの割合の距離まで届けば OK
    maxTries: 30,      // 並べ直す回数の上限（ほとんどの場合 1〜2 回で決まる）
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
    randomPlays: 3,    // ランダムで遊ぶときの回数（気軽に遊べるように少なくする）
  },

  // 銀コインと金コイン（js/collection.js の持ち物。全部のモードで共通）
  //   フリー：コインいらずで遊べる。取った景品は図鑑に入る
  //   図鑑：2 こ目からの景品を押すと、1 こ売って銀コインになる（1 こは図鑑用に残る）
  //   チャレンジ：1 回下ろすごとに銀コイン 1 枚。景品を取ると、景品のほかに金コインももらえる
  //   ステップ：1 ゲーム（10 回）遊ぶのに金コインがいる
  coins: {
    startSilver: 10,     // 最初に持っている銀コイン（最初は売る景品がないので、チャレンジを試せるように少し持たせる）
    silverPerPoint: 0.1, // 売ったときの銀コイン ＝ 景品の点数（sprites.js の points）× これ（四捨五入、1 枚以上）
    challengeCost: 1,    // チャレンジで 1 回下ろすのに使う銀コイン
    goldPerPoint: 1 / 30, // チャレンジで景品を取ったときの金コインの基本 ＝ 点数 × これ（四捨五入、1 枚以上）
    goldLevelRate: { easy: 1, normal: 2, hard: 3 }, // 難しさの倍率（むずかしいほど多くもらえる）
    // ゲームの倍率は、GAMES の difficulty（★ の数）をそのまま使う（取りにくいゲームほど多くもらえる）
    stepCost: 3,         // ステップで 1 ゲーム遊ぶのに使う金コイン（GAMES の stepCost があれば、そちらを使う）
  },

  // ぬしの台（js/modes/boss.js）。ステップの最後に出る、大きな「ぬし」を何回もアームで叩いて倒す台
  boss: {
    r: 62,             // ぬしの大きさ（半径）
    hp: 100,           // ぬしの体力
    damage: 26,        // 真ん中に当てたときに減らせる体力（端に当てるほど少なくなる）
    push: 30,          // 当てたときに、取り出し口の方へ押し戻す距離
    // 難しさごとの、減らせる体力の倍率と、ぬしが左右に動く速さ（px/秒）
    damageRate: { easy: 1.5, normal: 1.2, hard: 1 },
    wanderSpeed: { easy: 0, normal: 30, hard: 55 },
  },

  colors: {
    background: '#2b2745',
    frame: '#e85d8a',
    glass: '#3d3866',
    floor: '#5a4f8c',
    chute: '#1a1730',
    chuteEdge: '#f2c94c',
    wall: '#332e57',        // 奥行きのある筐体（3 本爪・2 ボタン・おまかせ・ショベル）の奥の壁
    floorEdge: '#463d73',   // 奥行きのある筐体の、床の手前の厚み
    shovelFloor: '#3a3462', // ショベルの床
    tableSide: '#2a2550',   // ショベルの回るテーブルの側面
    tableTop: '#4a4380',    // ショベルの回るテーブルの上の面
    tableStripe: '#544c8f', // ショベルの回るテーブルの模様
    cable: '#c9c4e8',
    claw: '#d9d6f0',
    clawDark: '#8f89b8',
    text: '#f4f1ff',
  },
};

// メニューに並べるゲームの一覧。メニューはこの一覧から自動で作る（js/menu.js）
// ゲームを増やすときは、ここに 1 行足す（遊び方の処理は js/main.js の MODES にも足す）
//   genre：メニューで、どの見出しの下に並べるか（GENRES の key）
//   difficulty：むずかしさの目安（★ の数、1〜3）。チャレンジでもらえる金コインの倍率にもなる
//   clearGets：ステップで、景品をいくつ取ったらクリアか（ゲームごとに取りやすさが違うので、別々に決める）。
//             ステップでは genre ごとの段（STEP_STAGES）に分けて並べ、段の中のどれか 1 つをクリアすると次の段が遊べるようになる
//   stepOnly：ステップだけに出す（フリー・チャレンジ・ランダムには出さない）。stepCost：ステップで 1 ゲームに使う金コイン
const GAMES = [
  { key: 'auto',    name: 'おまかせ',   desc: '自動で動くアームを下ろすだけ', genre: 'onetouch',   difficulty: 1, clearGets: 3 },
  { key: 'classic', name: 'クラシック', desc: '← → で動かして下ろす', genre: 'arm',   difficulty: 1, clearGets: 3 },
  { key: 'button',  name: '2ボタン',    desc: '① で右、② で奥へ動かす', genre: 'arm',   difficulty: 2, clearGets: 3 },
  { key: 'three',   name: '3本爪',      desc: '十字キーで自由に動かす', genre: 'arm',   difficulty: 2, clearGets: 2 },
  { key: 'buttonGuide', name: '2ボタン ガイド', desc: 'ねらいの光つきの 2ボタン', genre: 'arm', difficulty: 1, clearGets: 3 },
  { key: 'threeGuide',  name: '3本爪 ガイド',  desc: 'ねらいの光つきの 3本爪', genre: 'arm', difficulty: 1, clearGets: 2 },
  { key: 'shovel',  name: 'ショベル',   desc: '回る台の景品をすくう', genre: 'onetouch', difficulty: 1, clearGets: 3 },
  { key: 'sweet',   name: 'スウィート', desc: 'まわる台から すくって おしだす', genre: 'onetouch', difficulty: 1, clearGets: 3 },
  { key: 'autobanban', name: 'おまかせバンバン', desc: '自動で動く揺れる爪を下ろすだけ', genre: 'onetouch', difficulty: 1, clearGets: 3 },
  { key: 'ring',    name: 'リング',     desc: 'リングをフックにかける', genre: 'trick', difficulty: 1, clearGets: 3 },
  { key: 'ring2',   name: 'リング2だん', desc: 'うえの フックで したの台を ひく', genre: 'trick', difficulty: 2, clearGets: 2 },
  { key: 'banban',  name: 'バンバン',   desc: '揺れる爪で弾き落とす', genre: 'trick', difficulty: 1, clearGets: 3 },
  { key: 'boss',    name: 'ぬしの台',   desc: 'おおきな ぬしを たおせ！', genre: 'boss', difficulty: 3, clearGets: 1, stepOnly: true, stepCost: 10 },
  { key: 'random',  name: 'ランダム',   desc: 'どれかを3回だけお手軽に', genre: 'extra', difficulty: 0 },
];

// ステップの段。上から順に進み、段の中のゲームのどれか 1 つをクリアすると、次の段のゲームが遊べるようになる。
// 段に入るゲームは、GAMES の genre が key と同じもの（ランダムは入れない）
const STEP_STAGES = [
  { key: 'onetouch', name: 'ワンタッチ' },
  { key: 'arm',      name: 'アームで つかむ' },
  { key: 'trick',    name: 'しかけで おとす' },
  { key: 'boss',     name: 'さいごの だい' },
];

// メニューの見出し。この順に上から並べる
const GENRES = [
  { key: 'onetouch', name: 'ワンタッチ' }, // ボタンを 1 回押すだけで遊べるゲーム
  { key: 'arm',   name: 'アームで つかむ' },
  { key: 'trick', name: 'しかけで おとす' },
  { key: 'extra', name: 'おたのしみ' },
];

// メニューの一番上のタブ（遊び方の決まり）
//   フリー：全部のゲームを自由に、コインいらずで遊ぶ
//   チャレンジ：銀コインを使って遊び、景品と一緒に金コインを集める
//   ステップ：金コインを使って、ジャンルの段を順に進む。段の中のどれか 1 つをクリアすると、次の段が遊べるようになる。難しさごとに別々に記録する
// machine は、そのモードで遊ぶときの筐体の色（CONFIG.colors の一部を置きかえる）。
// どのモードで遊んでいるかが一目でわかるように、外枠・ガラス・床・取り出し口などの色をモードごとに変える。
// アームやひもの色は、どのモードでも同じにする
const PLAY_MODES = [
  // フリー：ピンクの枠に紫のガラス（もとからの色）
  { key: 'free', name: 'フリー', machine: {
    background: '#2b2745', frame: '#e85d8a', glass: '#3d3866', floor: '#5a4f8c', chute: '#1a1730', chuteEdge: '#f2c94c',
    wall: '#332e57', floorEdge: '#463d73', shovelFloor: '#3a3462', tableSide: '#2a2550', tableTop: '#4a4380', tableStripe: '#544c8f',
  } },
  // チャレンジ：金コインをかせぐモードなので、金色の枠にえんじ色のガラス
  { key: 'challenge', name: 'チャレンジ', machine: {
    background: '#2e1f22', frame: '#d4952a', glass: '#4a2c35', floor: '#74404c', chute: '#1e1013', chuteEdge: '#ff8a5a',
    wall: '#3a2229', floorEdge: '#5a3340', shovelFloor: '#43282f', tableSide: '#2e1a1f', tableTop: '#5a3540', tableStripe: '#673d4a',
  } },
  // ステップ：1 本道を進んでいくモードなので、水色の枠に青緑のガラス
  { key: 'step', name: 'ステップ', machine: {
    background: '#1c2f38', frame: '#3fc1c9', glass: '#284650', floor: '#3c6a72', chute: '#0f1d22', chuteEdge: '#f2c94c',
    wall: '#1f3a42', floorEdge: '#30565e', shovelFloor: '#22424a', tableSide: '#172f36', tableTop: '#2f5a63', tableStripe: '#376770',
  } },
];

// 景品を売ったときの銀コイン
function prizeSilver(sprite) {
  return Math.max(1, Math.round(sprite.points * CONFIG.coins.silverPerPoint));
}

// チャレンジで景品を取ったときの金コイン。景品・ゲーム・難しさで変わる
function prizeGold(sprite, gameKey, levelKey) {
  const c = CONFIG.coins;
  const game = GAMES.find((g) => g.key === gameKey);
  const base = Math.max(1, Math.round(sprite.points * c.goldPerPoint));
  return base * Math.max(1, game ? game.difficulty : 1) * c.goldLevelRate[levelKey];
}
