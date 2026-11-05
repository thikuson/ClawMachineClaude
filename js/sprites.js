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
function buildSprite(sprite) {
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
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}
