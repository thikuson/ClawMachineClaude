// ドット絵のデータ。1 文字が 1 ドットで、'.' は透明
// 文字と色の対応は、共通の色（COMMON）と、絵ごとの色（colors）を合わせて使う
const SPRITE_COMMON_COLORS = {
  k: '#2b2745', // 輪郭
  w: '#ffffff',
  p: '#ff8fb1', // ほっぺ
};

const PRIZE_SPRITES = [
  {
    name: 'くま',
    points: 30,  // 獲得したときの点数
    grip: 0.9,   // つかみやすさ（1 が基準。大きいほどつかみやすく落ちにくい）
    colors: { a: '#c98a5a', b: '#f0d2b0' },
    rows: [
      '..kkk......kkk..',
      '.kaaak....kaaak.',
      '.kabakkkkkkabak.',
      '.kaaaaaaaaaaaak.',
      '..kaaaaaaaaaak..',
      '.kaaaaaaaaaaaak.',
      '.kaakaaaaaakaak.',
      'kaaakaaaaaakaaak',
      'kapaaabbbbaaapak',
      'kaaaabbkkbbaaaak',
      'kaaaabbbbbbaaaak',
      '.kaaaabkkbaaaak.',
      '.kaaaaabbaaaaak.',
      '..kaaaaaaaaaak..',
      '...kkaaaaaakk...',
      '.....kkkkkk.....',
    ],
  },
  {
    name: 'ねこ',
    points: 20,  // 獲得したときの点数
    grip: 1.0,   // つかみやすさ（1 が基準。大きいほどつかみやすく落ちにくい）
    colors: { a: '#a7b0c4', b: '#ffffff' },
    rows: [
      '.k............k.',
      '.kk..........kk.',
      '.kak........kak.',
      '.kaak......kaak.',
      '.kaaakkkkkkaaak.',
      'kaaaaaaaaaaaaaak',
      'kaaaaaaaaaaaaaak',
      'kaaakaaaaaakaaak',
      'kaaakaaaaaakaaak',
      'kpaaaaabbaaaaapk',
      'kaaaaabkkbaaaaak',
      'kaaaaaabbaaaaaak',
      '.kaaaaaaaaaaaak.',
      '..kaaaaaaaaaak..',
      '...kkkaaaakkk...',
      '......kkkk......',
    ],
  },
  {
    name: 'ひよこ',
    points: 10,  // 獲得したときの点数
    grip: 1.15,   // つかみやすさ（1 が基準。大きいほどつかみやすく落ちにくい）
    colors: { a: '#ffd84d', b: '#ff9d3b' },
    rows: [
      '......kkkk......',
      '.....kaaaak.....',
      '....kaaaaaak....',
      '...kaaaaaaaak...',
      '..kaaaaaaaaaak..',
      '..kaakaaaakaak..',
      '.kaaakaaaakaaak.',
      '.kpaaaabbaaaapk.',
      '.kaaaabbbbaaaak.',
      'kaaaaaabbaaaaaak',
      'kaaaaaaaaaaaaaak',
      'kaakaaaaaaaakaak',
      '.kaakkaaaakkaak.',
      '..kaaaaaaaaaak..',
      '...kkaaaaaakk...',
      '.....kkkkkk.....',
    ],
  },
  {
    name: 'うさぎ',
    points: 20,  // 獲得したときの点数
    grip: 1.0,   // つかみやすさ（1 が基準。大きいほどつかみやすく落ちにくい）
    colors: { a: '#ffffff', b: '#ffb3c8' },
    rows: [
      '...kk......kk...',
      '..kabk....kbak..',
      '..kabk....kbak..',
      '..kabk....kbak..',
      '..kaak....kaak..',
      '...kakkkkkkak...',
      '..kaaaaaaaaaak..',
      '.kaaaaaaaaaaaak.',
      '.kaakaaaaaakaak.',
      'kaaakaaaaaakaaak',
      'kpaaaaakkaaaaapk',
      'kaaaaakbbkaaaaak',
      '.kaaaaaaaaaaaak.',
      '..kaaaaaaaaaak..',
      '...kkkkkkkkkk...',
      '................',
    ],
  },
  {
    name: 'ペンギン',
    points: 30,  // 獲得したときの点数
    grip: 0.9,   // つかみやすさ（1 が基準。大きいほどつかみやすく落ちにくい）
    colors: { a: '#3b4a7a', b: '#ffffff', c: '#ffa63b' },
    rows: [
      '.....kkkkkk.....',
      '...kkaaaaaakk...',
      '..kaaaaaaaaaak..',
      '.kaaaaaaaaaaaak.',
      '.kaabbbaabbbaak.',
      'kaabbkbbbbkbbaak',
      'kaabbkbbbbkbbaak',
      'kaabbbbccbbbbaak',
      'kaabpbccccbpbaak',
      'kaabbbbbbbbbbaak',
      'kaabbbbbbbbbbaak',
      '.kaabbbbbbbbaak.',
      '.kaabbbbbbbbaak.',
      '..kaabbbbbbaak..',
      '...kkcckkcckk...',
      '................',
    ],
  },
  {
    name: 'おばけ',
    points: 40,  // 獲得したときの点数
    grip: 0.85,   // つかみやすさ（1 が基準。大きいほどつかみやすく落ちにくい）
    colors: { a: '#e9e4ff' },
    rows: [
      '.....kkkkkk.....',
      '...kkaaaaaakk...',
      '..kaaaaaaaaaak..',
      '.kaaaaaaaaaaaak.',
      '.kaaaaaaaaaaaak.',
      'kaaaakaaaakaaaak',
      'kaaakkaaaakkaaak',
      'kaaaaaaaaaaaaaak',
      'kapaaaakkaaaapak',
      'kaaaaaakkaaaaaak',
      'kaaaaaaaaaaaaaak',
      'kaaaaaaaaaaaaaak',
      'kaaaaaaaaaaaaaak',
      'kaakaaakkaaakaak',
      '.kk.kkk..kkk.kk.',
      '................',
    ],
  },
  {
    name: 'ボール',
    points: 15,
    grip: 0.95,
    round: true, // 丸いので、落ちたり爪に押されたりすると転がる
    colors: { a: '#ff6b6b', b: '#ffffff', c: '#4d9de0' },
    rows: [
      '.....kkkkkk.....',
      '...kkaabbcckk...',
      '..kaaaabbcccck..',
      '.kabbaabbccccck.',
      '.kabaaabbccccck.',
      'kaaaaaabbcccccck',
      'kaaaaaabbcccccck',
      'kaaaaaabbcccccck',
      'kaaaaaabbcccccck',
      'kaaaaaabbcccccck',
      '.kaaaaabbccccck.',
      '.kaaaaabbccccck.',
      '..kaaaabbcccck..',
      '...kkaabbcckk...',
      '.....kkkkkk.....',
      '................',
    ],
  },
  {
    name: 'りんご',
    points: 15,
    grip: 1.0,
    round: true,
    colors: { a: '#ff5a5a', b: '#6cc24a', c: '#8a5a2b' },
    rows: [
      '.......kk.......',
      '.......kckbb....',
      '....kkkkckbbk...',
      '..kkaaaakaaaakk.',
      '.kawwaaaaaaaaak.',
      'kaawwaaaaaaaaaak',
      'kaawaaaaaaaaaaak',
      'kaaaakaaaakaaaak',
      'kaaaakaaaakaaaak',
      'kapaaaaaaaaaapak',
      'kaaaaaakkaaaaaak',
      '.kaaaaaaaaaaaak.',
      '.kaaaaaaaaaaaak.',
      '..kaaaakkaaaak..',
      '...kkkk..kkkk...',
      '................',
    ],
  },
  {
    name: 'ぶた',
    points: 25,
    grip: 1.0,
    colors: { a: '#ffb3c1', b: '#ff8fa8' },
    rows: [
      '................',
      '..kk........kk..',
      '.kbbk......kbbk.',
      '.kbaakkkkkkaabk.',
      '.kaaaaaaaaaaaak.',
      'kaaaaaaaaaaaaaak',
      'kaaakaaaaaakaaak',
      'kaaakaaaaaakaaak',
      'kpaaaabbbbaaaapk',
      'kaaaabkbbkbaaaak',
      'kaaaabbbbbbaaaak',
      '.kaaaaaaaaaaaak.',
      '.kaaaaaaaaaaaak.',
      '..kaaaaaaaaaak..',
      '...kkkkkkkkkk...',
      '................',
    ],
  },
  {
    name: 'さかな',
    points: 45,
    grip: 0.75, // つるつるしていて、つかみにくい
    colors: { a: '#6fa8ff', b: '#cfe3ff', c: '#4a7fd1' },
    rows: [
      '................',
      '................',
      '.....kkkkkk.....',
      '...kkaaaaaakk.kk',
      '..kaaaaaaaaaakck',
      '.kawkaaaaaaaakck',
      '.kaakaaaaaaaakck',
      'kpaaaaaaaaaaaack',
      'kbbbbbbbbbbbbkck',
      '.kbbbbbbbbbbbkck',
      '..kbbbbbbbbbbk.k',
      '...kkbbbbbbkk...',
      '.....kkkkkk.....',
      '................',
      '................',
      '................',
    ],
  },
  {
    name: 'きんのほし',
    points: 100,
    grip: 0.7,
    rare: true, // レア景品。たまにしか出ない
    colors: { a: '#ffd23f', b: '#fff3a8', c: '#d99a00' },
    rows: [
      '.......kk.......',
      '......kbak......',
      '......kbak......',
      '.....kbaaak.....',
      'kkkkkkbaaackkkkk',
      'kbbbbbaaaaaaaack',
      '.kcaakaaaakaack.',
      '..kcakaaaakack..',
      '...kcaaaaaack...',
      '...kaapaapaak...',
      '..kaaaakkaaaak..',
      '..kaaaaaaaaaak..',
      '.kaaacckkccaaak.',
      '.kaacck..kccaak.',
      'kacck......kccak',
      'kkk..........kkk',
    ],
  },
];

// アームの本体（爪は動くので render.js で線として描く）
const CLAW_HEAD_SPRITE = {
  colors: { a: '#8f89b8', b: '#d9d6f0', c: '#ffe066' },
  rows: [
    '...kkkkkkkkkk...',
    '..kbbbbbbbbbbk..',
    '.kbaaaaaaaaaabk.',
    '.kacakacakacaak.',
    '.kaaaaaaaaaaaak.',
    '..kkkkkkkkkkkk..',
  ],
};

// 文字の行から、1 ドット 1px の小さなキャンバスを作る。描くときに拡大して使う
// silhouette を true にすると、図鑑の「まだ獲得していない」表示用に黒い影で描く
function buildSprite(sprite, silhouette) {
  const rows = sprite.rows;
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  const palette = Object.assign({}, SPRITE_COMMON_COLORS, sprite.colors);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = silhouette ? '#1a1730' : color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}
