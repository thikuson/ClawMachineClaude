// クエストの絵：町の人の顔と、おねがいを かなえたときに もらえる「おみやげ」のドット絵
//   顔は、髪・帽子・ひげなどの部品を 16×16 のマスに塗り重ねて作り、最後にまわりを輪郭の色でふちどる
//   （1 人ずつ手で描くよりも、顔の形や目の位置がそろうため）。
//   おみやげは 12×12 のマスに手で描き、同じようにふちどる。左右対称のものは左半分だけを書く（sym: true）

// 顔の部品。色の文字：s はだ、h かみ、t ぼうし、u ぼうしの かざり、c ふく、e ひげ・めがね（k・w・p は共通の色）
// 話す人ごとの見た目。ぬし（ドラゴンの ぬし など）は、景品のドット絵をそのまま使う
const QUEST_FACES = {
  'みならい':     { skin: '#ffd9b8', hair: '#7a4a2a', style: 'spiky', hat: 'cap', hatColor: '#e85d8a', hatColor2: '#ffe066', cloth: '#4d9de0' },
  'てんちょう':   { skin: '#f5c9a0', hair: '#9aa3b0', style: 'side', extra: 'mustache', extraColor: '#9aa3b0', cloth: '#e85d8a' },
  'りょうしの子': { skin: '#e8b48a', hair: '#2b2745', style: 'short', hat: 'bandana', hatColor: '#4d9de0', cloth: '#ffffff' },
  'パンやさん':   { skin: '#ffd9b8', hair: '#c98a5a', style: 'short', hat: 'chef', hatColor: '#ffffff', extra: 'mustache', extraColor: '#c98a5a', cloth: '#f4f1ea' },
  'とうだいもり': { skin: '#f0c8a0', hair: '#e8ecf2', style: 'short', hat: 'cap', hatColor: '#3b4a7a', hatColor2: '#ffe066', extra: 'beard', extraColor: '#e8ecf2', cloth: '#3b4a7a' },
  'さかなやさん': { skin: '#e8b48a', hair: '#2b2745', style: 'short', hat: 'headband', hatColor: '#ffffff', cloth: '#4a7fd1' },
  'ふなのりさん': { skin: '#f0c8a0', hair: '#ffd23f', style: 'short', hat: 'sailor', hatColor: '#ffffff', hatColor2: '#3b4a7a', cloth: '#3b4a7a' },
  'おばあちゃん': { skin: '#f5d0b0', hair: '#c9c4e8', style: 'short', hat: 'kerchief', hatColor: '#9b6fd6', extra: 'glasses', extraColor: '#8a5a2b', cloth: '#6cc24a' },
  'たんけんか':   { skin: '#e8b48a', hair: '#7a4a2a', style: 'short', hat: 'helmet', hatColor: '#d9c08a', hatColor2: '#ffe066', extra: 'mustache', extraColor: '#7a4a2a', cloth: '#a89060' },
  'こうもりの子': { skin: '#ffe4d0', hair: '#5a3a80', style: 'short', hat: 'batHood', hatColor: '#5a3a80', cloth: '#5a3a80' },
  'いしやさん':   { skin: '#e0a880', hair: '#6a6a6a', style: 'none', extra: 'beard', extraColor: '#8a8a8a', cloth: '#8a5a2b' },
  'せんにん':     { skin: '#f5d0b0', hair: '#ffffff', style: 'side', extra: 'longBeard', extraColor: '#ffffff', cloth: '#c9c4e8' },
  'おかみさん':   { skin: '#ffd9b8', hair: '#2b2745', style: 'bun', cloth: '#ff5a6a' },
  'かじやさん':   { skin: '#d9986a', hair: '#2b2745', style: 'spiky', hat: 'headband', hatColor: '#ff5a5a', cloth: '#5a5a6a' },
  'こびと':       { skin: '#ffd9b8', hair: '#ffffff', style: 'none', hat: 'pointy', hatColor: '#4d9de0', hatColor2: '#ffffff', extra: 'beard', extraColor: '#ffffff', cloth: '#4d9de0' },
  'ほしよみさん': { skin: '#ffe4d0', hair: '#9b6fd6', style: 'long', hat: 'pointy', hatColor: '#2b3a6a', hatColor2: '#ffd23f', cloth: '#2b3a6a' },
  'たびびと':     { skin: '#e8b48a', hair: '#3a8a6a', style: 'long', hat: 'bandana', hatColor: '#ffa63b', cloth: '#3a8a6a' },
};

// ぬし（景品のドット絵を使う話す人）
const QUEST_NUSHI_SPEAKERS = ['たこの ぬし', 'くじらの ぬし', 'かにの ぬし', 'ドラゴンの ぬし', 'ほうおうの ぬし'];

// おねがいを かなえたときに もらえる おみやげ（js/quest.js の おねがいの名前ごと）
const QUEST_SOUVENIRS = {
  c0r0: { name: 'かいがら', sym: true, colors: { a: '#ffd0d8', b: '#ff8fa8' }, rows: [
    '......', '....ab', '...aba', '..abaa', '.abaab', '.abaab', 'abaaba', 'abaaba', '.aaaaa', '..aaaa', '...bbb', '....bb'] },
  c0r1: { name: 'メロンパン', sym: true, colors: { a: '#f2c94c', b: '#d99a00' }, rows: [
    '......', '......', '...aaa', '.aabaa', '.abaab', 'aaabaa', 'abaaba', 'aaabaa', '.aaaaa', '..aaaa', '......', '......'] },
  c0r2: { name: 'ミニとうだい', sym: true, colors: { a: '#f4f1ea', b: '#ff5a5a', c: '#ffe066' }, rows: [
    '.....c', '....cc', '....bb', '....aa', '....bb', '...aaa', '...bbb', '...aaa', '...bbb', '..aaaa', '.bbbbb', '......'] },
  c1r0: { name: 'しんじゅ', sym: true, colors: { a: '#f4f1ff', b: '#b8b0e0', c: '#ffffff' }, rows: [
    '......', '......', '....aa', '...caa', '..acaa', '..aaaa', '..aaab', '..aabb', '...abb', '....bb', '......', '......'] },
  c1r1: { name: 'いかり', sym: true, colors: { a: '#8f9ab8' }, rows: [
    '....aa', '...a..', '....aa', '.....a', '..aaaa', '.....a', '.....a', 'a....a', 'aa...a', '.aa..a', '..aaaa', '...aaa'] },
  c1r2: { name: 'みかん', sym: true, colors: { a: '#ff9d3b', b: '#6cc24a', c: '#ffc27a' }, rows: [
    '......', '.....b', '....bb', '...aaa', '..acaa', '.aaaaa', '.aaaaa', '.aaaaa', '..aaaa', '...aaa', '......', '......'] },
  c2r0: { name: 'たからの ちず', colors: { a: '#e8d2b0', b: '#8a5a2b', c: '#ff5a5a' }, rows: [
    '............', '.aaaaaaaaaa.', '.abaaaaaaba.', '.aabaaaaaaa.', '.aaabbaaaaa.', '.aaaaabacac.',
    '.aaaaaaacaa.', '.aaaaaacaca.', '.abaaaaaaba.', '.aaaaaaaaaa.', '............', '............'] },
  c2r1: { name: 'キャンディ', sym: true, colors: { a: '#ff7aa8', b: '#fff3a8', c: '#ffffff' }, rows: [
    '......', '......', '......', 'b.....', 'bb..aa', 'bbbaac', 'bbbaaa', 'bb..aa', 'b.....', '......', '......', '......'] },
  c2r2: { name: 'ほうせき', sym: true, colors: { a: '#6fd3ff', b: '#2f8fd1', c: '#ffffff' }, rows: [
    '......', '......', '...aaa', '..acaa', '.aaaaa', 'aaaaab', '.baaaa', '..baaa', '...baa', '....ba', '.....b', '......'] },
  c3r0: { name: 'ひょうたん', sym: true, colors: { a: '#e0a840', b: '#8a5a2b', c: '#ff5a5a' }, rows: [
    '.....b', '....aa', '...aaa', '....aa', '....cc', '...aaa', '..aaaa', '.aaaaa', '.aaaaa', '.aaaaa', '..aaaa', '......'] },
  c3r1: { name: 'おんせん たまご', sym: true, colors: { a: '#fbfbf5', c: '#8a6a4a', d: '#c9e4ff' }, rows: [
    '....d.', '.....d', '....aa', '...aaa', '..aaaa', '..aaaa', '.ccccc', '.ccccc', '..cccc', '...ccc', '......', '......'] },
  c3r2: { name: 'かなづち', colors: { a: '#8f9ab8', b: '#8a5a2b', c: '#c9d0e0' }, rows: [
    '............', '..aaaaaaaa..', '..acccccca..', '..aaaaaaaa..', '.....bb.....', '.....bb.....',
    '.....bb.....', '.....bb.....', '.....bb.....', '.....bb.....', '.....bb.....', '............'] },
  c4r0: { name: 'くもの わたあめ', sym: true, colors: { a: '#ffffff', b: '#c9e4ff', c: '#c98a5a' }, rows: [
    '......', '......', '....aa', '..aaaa', '.aaaaa', 'aaaaaa', 'abaaaa', '.bbbbb', '.....c', '.....c', '.....c', '......'] },
  c4r1: { name: 'ほしの かけら', sym: true, colors: { a: '#ffd23f', b: '#fff3a8' }, rows: [
    '.....a', '.....a', '....aa', 'aaaaab', '.aaaab', '..aaaa', '..aaaa', '.aaa.a', '.aa...', '.a....', '......', '......'] },
  c4r2: { name: 'ほうおうの はね', colors: { a: '#ff7a3a', b: '#ffd9a0' }, rows: [
    '.........aa.', '........aba.', '.......abaa.', '......abaa..', '.....abaa...', '....abaa....',
    '...abaa.....', '..abaa......', '..baa.......', '.b..........', 'b...........', '............'] },
};

const QuestArt = {
  cache: {},

  // 色の文字のマスに、まわりのふちどり（k）を足す。足すために、上下左右に 1 マスずつ広げる
  outline(grid) {
    const h = grid.length + 2;
    const w = grid[0].length + 2;
    const out = [];
    for (let y = 0; y < h; y++) {
      out.push([]);
      for (let x = 0; x < w; x++) out[y].push((grid[y - 1] && grid[y - 1][x - 1]) || '.');
    }
    const filled = (y, x) => out[y] && out[y][x] && out[y][x] !== '.' && out[y][x] !== 'K';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (out[y][x] !== '.') continue;
        if (filled(y - 1, x) || filled(y + 1, x) || filled(y, x - 1) || filled(y, x + 1)) out[y][x] = 'K';
      }
    }
    return out.map((row) => row.join('').replace(/K/g, 'k'));
  },

  // 顔の部品を塗り重ねて、16×16 のマスを作る
  faceRows(f) {
    const g = [];
    for (let y = 0; y < 16; y++) g.push('................'.split(''));
    const fill = (y, x0, x1, ch) => { for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < 16) g[y][x] = ch; };
    const dot = (y, x, ch) => fill(y, x, x, ch);
    // 体（肩）と首
    fill(14, 3, 12, 'c');
    fill(15, 2, 13, 'c');
    fill(13, 6, 9, 's');
    // 頭
    fill(4, 5, 10, 's');
    fill(5, 4, 11, 's');
    for (let y = 6; y <= 11; y++) fill(y, 3, 12, 's');
    fill(12, 4, 11, 's');
    // かみ
    const st = f.style;
    if (st === 'short' || st === 'spiky' || st === 'long' || st === 'bun') {
      fill(3, 5, 10, 'h');
      fill(4, 4, 11, 'h');
      fill(5, 3, 12, 'h');
      fill(6, 3, 12, 'h');
      dot(7, 3, 'h'); dot(7, 12, 'h');
      if (st === 'spiky') { dot(2, 4, 'h'); dot(2, 7, 'h'); dot(2, 10, 'h'); dot(3, 3, 'h'); dot(3, 12, 'h'); }
      if (st === 'long') for (let y = 6; y <= 13; y++) { fill(y, 1, 3, 'h'); fill(y, 12, 14, 'h'); }
      if (st === 'bun') { fill(0, 6, 9, 'h'); fill(1, 5, 10, 'h'); fill(2, 6, 9, 'h'); }
    } else if (st === 'side') {
      // はげ頭で、横だけ かみがある
      for (let y = 6; y <= 9; y++) { fill(y, 2, 3, 'h'); fill(y, 12, 13, 'h'); }
    }
    // ぼうし
    switch (f.hat) {
      case 'cap':
        fill(2, 5, 10, 't'); fill(3, 4, 11, 't'); fill(4, 3, 12, 't');
        fill(5, 2, 13, 'u');
        dot(3, 7, 'u'); dot(3, 8, 'u');
        break;
      case 'chef':
        fill(0, 4, 11, 't'); fill(1, 3, 12, 't'); fill(2, 3, 12, 't'); fill(3, 4, 11, 't');
        fill(4, 4, 11, 't'); fill(5, 3, 12, 't');
        break;
      case 'bandana':
        fill(3, 5, 10, 't'); fill(4, 4, 11, 't'); fill(5, 3, 12, 't');
        dot(5, 13, 't'); dot(6, 14, 't'); dot(4, 14, 't');
        break;
      case 'headband':
        fill(6, 2, 13, 't');
        dot(5, 14, 't'); dot(7, 14, 't');
        break;
      case 'sailor':
        fill(2, 5, 10, 't'); fill(3, 4, 11, 't'); fill(4, 4, 11, 'u');
        break;
      case 'kerchief':
        fill(2, 5, 10, 't'); fill(3, 4, 11, 't'); fill(4, 3, 12, 't'); fill(5, 3, 12, 't');
        for (let y = 6; y <= 10; y++) { dot(y, 2, 't'); dot(y, 13, 't'); }
        break;
      case 'helmet':
        fill(1, 6, 9, 't'); fill(2, 4, 11, 't'); fill(3, 3, 12, 't'); fill(4, 3, 12, 't');
        fill(5, 2, 13, 't');
        dot(2, 7, 'u'); dot(2, 8, 'u'); dot(3, 7, 'u'); dot(3, 8, 'u');
        break;
      case 'batHood':
        fill(3, 4, 11, 't'); fill(4, 3, 12, 't'); fill(5, 3, 12, 't');
        for (let y = 6; y <= 11; y++) { dot(y, 2, 't'); dot(y, 13, 't'); }
        // こうもりの耳
        dot(0, 3, 't'); fill(1, 3, 4, 't'); fill(2, 3, 5, 't');
        dot(0, 12, 't'); fill(1, 11, 12, 't'); fill(2, 10, 12, 't');
        break;
      case 'pointy':
        fill(0, 8, 9, 't'); fill(1, 7, 9, 't'); fill(2, 6, 10, 't'); fill(3, 5, 10, 't');
        fill(4, 4, 11, 't'); fill(5, 2, 13, 't');
        dot(2, 8, 'u');
        break;
    }
    // 目・ほっぺ・口
    dot(8, 5, 'k'); dot(9, 5, 'k'); dot(8, 10, 'k'); dot(9, 10, 'k');
    dot(10, 4, 'p'); dot(10, 11, 'p');
    fill(11, 7, 8, 'k');
    // ひげ・めがね
    switch (f.extra) {
      case 'mustache':
        fill(10, 6, 9, 'e'); dot(11, 5, 'e'); dot(11, 10, 'e');
        break;
      case 'beard':
        fill(10, 6, 9, 'e'); fill(11, 3, 6, 'e'); fill(11, 9, 12, 'e'); fill(12, 4, 11, 'e'); fill(13, 5, 10, 'e');
        break;
      case 'longBeard':
        fill(10, 6, 9, 'e'); fill(11, 3, 6, 'e'); fill(11, 9, 12, 'e'); fill(12, 4, 11, 'e');
        fill(13, 5, 10, 'e'); fill(14, 6, 9, 'e'); fill(15, 6, 9, 'e');
        break;
      case 'glasses':
        fill(7, 4, 6, 'e'); fill(7, 9, 11, 'e'); dot(8, 4, 'e'); dot(8, 6, 'e'); dot(8, 9, 'e'); dot(8, 11, 'e');
        dot(8, 7, 'e'); dot(8, 8, 'e');
        break;
    }
    return g;
  },

  // 話す人の顔のキャンバス（1 ドット 1px。描くときに拡大する）。知らない人は null
  face(name) {
    if (this.cache['f:' + name]) return this.cache['f:' + name];
    let canvas = null;
    const f = QUEST_FACES[name];
    if (f) {
      const rows = this.outline(this.faceRows(f));
      canvas = buildSprite({ rows, colors: { s: f.skin, h: f.hair, t: f.hatColor, u: f.hatColor2 || f.hatColor, c: f.cloth, e: f.extraColor } });
    } else if (QUEST_NUSHI_SPEAKERS.includes(name)) {
      canvas = buildSprite(PRIZE_SPRITES.find((s) => s.name === name));
    }
    this.cache['f:' + name] = canvas;
    return canvas;
  },

  // 話す人の名前の札の色（顔の服の色。ぬしは金色）
  color(name) {
    const f = QUEST_FACES[name];
    return f ? f.cloth : '#ffd23f';
  },

  // おみやげのキャンバス。silhouette が true のときは、まだ もらっていない影の絵
  souvenir(id, silhouette) {
    const key = 's:' + id + (silhouette ? ':x' : '');
    if (this.cache[key]) return this.cache[key];
    const s = QUEST_SOUVENIRS[id];
    // 左右対称のものは、左半分を反対向きにして右半分を作る
    const rows = s.sym ? s.rows.map((r) => r + r.split('').reverse().join('')) : s.rows;
    const canvas = buildSprite({ rows: this.outline(rows.map((r) => r.split(''))), colors: s.colors }, silhouette);
    this.cache[key] = canvas;
    return canvas;
  },
};
