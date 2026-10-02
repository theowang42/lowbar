// 养成小人：24×24 的像素画，两帧交替做出 Game Boy 式的逐帧动画。
// 只返回 SVG 字符串，不访问 DOM；颜色全部来自 CSS（currentColor / --accent / --faint / --muted）。

const W = 24;

// 不同阶段的身材：tw 躯干半宽，sw 肩半宽，t 四肢粗细
const BUILDS = [
  { tw: 2, sw: 2, t: 1 },
  { tw: 2, sw: 3, t: 1 },
  { tw: 2, sw: 3, t: 2 },
  { tw: 3, sw: 4, t: 2 },
  { tw: 3, sw: 5, t: 2 },
  { tw: 3, sw: 5, t: 2 },
];

// 像素值：1 主色，2 强调色（橙），3 地面（极淡），4 次要（灰）
function canvas() {
  const g = Array.from({ length: W }, () => new Array(W).fill(0));
  const set = (x, y, v = 1) => { if (x >= 0 && x < W && y >= 0 && y < W) g[y][x] = v; };
  const rect = (x, y, w, h, v = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, v); };
  const draw = (rows, x, y, v = 1) => rows.forEach((r, j) => [...r].forEach((c, i) => { if (c === '#') set(x + i, y + j, v); }));
  return { g, set, rect, draw };
}

const HEAD = ['..####..', '.######.', '########', '########', '########', '.######.', '..####..'];

// 脸是在实心头上挖出的空像素
const FACES = {
  open: [[2, 3], [5, 3]],
  blink: [[2, 4], [5, 4]],
  smile: [[2, 3], [5, 3], [3, 5], [4, 5]],
  closed: [[1, 4], [2, 4], [5, 4], [6, 4]],
  joy: [[2, 2], [1, 3], [3, 3], [5, 2], [4, 3], [6, 3], [3, 5], [4, 5]],
};

function head(c, x, y, face, band) {
  c.draw(HEAD, x, y);
  for (const [i, j] of FACES[face]) c.set(x + i, y + j, 0);
  if (band) c.rect(x, y + 1, 8, 1, 2);
}

const Z = ['####', '..#.', '.#..', '####'];
const SPARK = ['.#.', '###', '.#.'];

function ground(c, from = 2, to = 21) {
  for (let x = from; x <= to; x += 2) c.set(x, 22, 3);
}

// 站姿。arms: 'down' | 'wave' | 'v' | 'flex' | 'flexHigh'；dy 整体上移；tuck 收腿（跳起）
function standing(c, b, { face, arms, dy = 0, tuck = false, band }) {
  const cx = 12;
  const y = (n) => n - dy;
  head(c, cx - 4, y(2), face, band);
  c.rect(cx - 1, y(9), 2, 1);
  c.rect(cx - b.sw, y(10), b.sw * 2, 1 + (b.t > 1 ? 1 : 0));
  c.rect(cx - b.tw, y(11), b.tw * 2, 5);
  // 两腿之间留两格空隙
  const legEnd = tuck ? 18 : 20;
  const lx = cx - 1 - b.t;
  const rx = cx + 1;
  c.rect(lx, y(16), b.t, legEnd - 16 + 1);
  c.rect(rx, y(16), b.t, legEnd - 16 + 1);
  c.rect(lx - 1, y(legEnd + 1), b.t + 1, 1);
  c.rect(rx, y(legEnd + 1), b.t + 1, 1);

  const L = cx - b.sw - b.t;
  const R = cx + b.sw;
  const armDown = (x) => c.rect(x, y(10), b.t, 6);
  if (arms === 'down') { armDown(L); armDown(R); }
  if (arms === 'wave') { armDown(L); c.rect(R, y(4), b.t, 7); c.rect(R + b.t, y(3), 1, 2); }
  if (arms === 'v') {
    for (let k = 0; k < 6; k++) {
      c.rect(L - Math.floor(k / 2), y(10 - k), b.t, 1);
      c.rect(R + Math.floor(k / 2), y(10 - k), b.t, 1);
    }
  }
  if (arms === 'flex' || arms === 'flexHigh') {
    const up = arms === 'flexHigh' ? 4 : 3;
    c.rect(L - 2, y(10), b.t + 2, b.t);
    c.rect(R, y(10), b.t + 2, b.t);
    c.rect(L - 2, y(10 - up), b.t, up);
    c.rect(R + 2, y(10 - up), b.t, up);
    c.rect(L - 3, y(10 - up - 1), b.t + 2, 2);
    c.rect(R + 1, y(10 - up - 1), b.t + 2, 2);
  }
}

// 坐姿。pose: 'hug' 抱膝打瞌睡（nod 低头一格）| 'stretch' 伸直腿、双臂上举（lean 左右晃）
function sitting(c, b, { face, pose, nod = 0, lean = 0, band }) {
  const cx = 8;
  head(c, cx - 4 + nod + lean, 8 + nod, face, band);
  c.rect(cx - 1, 15, 2, 1);
  c.rect(cx - b.sw, 16, b.sw * 2, 1);
  c.rect(cx - b.tw, 17, b.tw * 2, 4);
  const hip = cx + b.tw;
  if (pose === 'hug') {
    for (let k = 0; k < 5; k++) c.rect(hip + k, 20 - k, b.t, b.t);
    c.rect(hip + 4, 16, b.t, 5);
    c.rect(hip + 4, 21, 3, 1);
    c.rect(cx + b.sw, 17, hip + 4 - (cx + b.sw), b.t);
  } else {
    c.rect(hip, 21 - b.t, 10, b.t);
    c.rect(hip + 9, 21 - b.t - 2, 1, 2);
    const L = cx - b.sw - b.t;
    const R = cx + b.sw;
    for (let k = 0; k < 6; k++) {
      c.rect(L - Math.floor(k / 3) + lean, 16 - k, b.t, 1);
      c.rect(R + Math.floor(k / 3) + lean, 16 - k, b.t, 1);
    }
  }
}

// 趴下睡着：横躺。breathe 胸口起伏一格
function lying(c, b, { breathe = 0, band }) {
  head(c, 1, 15, 'closed', band);
  const h = b.tw * 2;
  c.rect(9, 22 - h - breathe, 8, h + breathe);
  c.rect(17, 22 - b.t, 5, b.t);
  c.rect(21, 22 - b.t - 2, 1, 2);
}

function frame(stage, mood, n) {
  const b = BUILDS[stage];
  const band = stage >= 5;
  const c = canvas();
  if (mood === 'waiting') {
    ground(c);
    standing(c, b, { face: n ? 'smile' : 'open', arms: n ? 'wave' : 'down', band });
  } else if (mood === 'working') {
    ground(c);
    standing(c, b, { face: 'smile', arms: n ? 'flexHigh' : 'flex', dy: n ? 1 : 0, band });
  } else if (mood === 'happy') {
    ground(c, n ? 6 : 2, n ? 17 : 21);
    standing(c, b, { face: 'joy', arms: 'v', dy: n ? 2 : 0, tuck: !!n, band });
    if (n) { c.draw(SPARK, 1, 3, 2); c.draw(SPARK, 20, 7, 2); }
    else { c.draw(SPARK, 2, 9, 2); c.draw(SPARK, 19, 2, 2); }
  } else if (mood === 'sleepy') {
    ground(c);
    sitting(c, b, { face: 'closed', pose: 'hug', nod: n, band });
    c.draw(Z, 16, n ? 3 : 6, 4);
  } else if (mood === 'down') {
    ground(c, 2, 21);
    lying(c, b, { breathe: n, band });
    c.draw(Z, 6, n ? 6 : 9, 4);
    if (n) c.draw(Z, 11, 3, 4);
  } else {
    ground(c);
    sitting(c, b, { face: 'joy', pose: 'stretch', lean: n ? 1 : 0, band });
  }
  return c.g;
}

const CLASSES = ['', 'p', 'a', 'g', 'm'];

// 把同色的横向连续像素合并成一个 rect，减少节点
function toRects(g) {
  let out = '';
  g.forEach((row, y) => {
    let x = 0;
    while (x < W) {
      const v = row[x];
      let w = 1;
      while (x + w < W && row[x + w] === v) w++;
      if (v) out += `<rect class="${CLASSES[v]}" x="${x}" y="${y}" width="${w}" height="1"/>`;
      x += w;
    }
  });
  return out;
}

// mood: waiting | working | happy | sleepy | down | rest
export function buddySVG(stage, mood) {
  return `<svg class="buddy-svg mood-${mood}" viewBox="0 0 ${W} ${W}" shape-rendering="crispEdges" aria-hidden="true">
    <g class="f1">${toRects(frame(stage, mood, 0))}</g>
    <g class="f2">${toRects(frame(stage, mood, 1))}</g>
  </svg>`;
}
