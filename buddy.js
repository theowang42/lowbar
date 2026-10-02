// 养成小人：1-bit 像素画（Playdate 式）。剪影自动描边，背光侧网点阴影，两帧逐帧动画。
// 场景里有一根矮单杠。只返回 SVG 字符串，不访问 DOM；颜色全部来自 CSS。

// 姿势用 44×36 的设计坐标写，渲染时放大 K 倍到 66×54 像素
const K = 1.5;
const W = 66;
const H = 54;
const GROUND = 33;
const BAR_Y = 11;
const BAR_L = 22.5;
const BAR_R = 42.5;

// 像素值：0 透明，1 墨色，2 强调色，3 地面，4 灰，5 底色（用来遮住后面的东西）
const INK = 1;
const ACC = 2;
const GND = 3;
const GRAY = 4;
const PAPER = 5;

// 不同阶段的身材：arm/leg 四肢半径，tw 躯干半宽，sw 肩半宽
const BUILDS = [
  { arm: 1.1, leg: 1.3, tw: 2.6, sw: 2.6 },
  { arm: 1.4, leg: 1.6, tw: 3.0, sw: 3.0 },
  { arm: 1.7, leg: 1.8, tw: 3.4, sw: 3.5 },
  { arm: 2.0, leg: 2.0, tw: 3.8, sw: 4.2 },
  { arm: 2.4, leg: 2.2, tw: 4.3, sw: 5.0 },
  { arm: 2.4, leg: 2.2, tw: 4.3, sw: 5.0 },
];

// ---------- 几何 ----------

function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

const k = ([x, y]) => [x * K, y * K];
const capsule = (a, b, r) => { const A = k(a); const B = k(b); return (x, y) => segDist(x + 0.5, y + 0.5, A, B) <= r * K; };
const circle = (c, r) => { const [cx, cy] = k(c); return (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r * K; };
const union = (...fs) => (x, y) => fs.some((f) => f(x, y));
const add = ([x, y], [dx, dy]) => [x + dx, y + dy];

// ---------- 画布 ----------

function canvas() {
  const g = Array.from({ length: H }, () => new Array(W).fill(0));
  const set = (x, y, v) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = v; };
  // 一个部件：剪影边缘描墨线，内部按 fill 上色；shade 时背光（右下）一侧打网点
  const part = (mask, fill, shade = true) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!mask(x, y)) continue;
      const edge = !mask(x - 1, y) || !mask(x + 1, y) || !mask(x, y - 1) || !mask(x, y + 1);
      if (edge) { set(x, y, INK); continue; }
      const dark = shade && (!mask(x + 3, y + 1) || !mask(x + 1, y + 3) || !mask(x + 2, y + 2));
      set(x, y, dark && (x + y) % 2 === 0 ? INK : fill(x, y));
    }
  };
  return { g, set, part };
}

const PLAIN = () => PAPER;
const SOLID = () => INK;

// ---------- 场景 ----------

function scenery(c) {
  const gy = Math.round((GROUND + 0.6) * K);
  for (let x = 1; x < W - 1; x += 2) c.set(x, gy, GND);
  // 矮单杠放在右边：两根柱子和一根横杠，画在小人后面
  c.part(union(capsule([BAR_L, BAR_Y], [BAR_L, GROUND + 0.3], 0.8), capsule([BAR_R, BAR_Y], [BAR_R, GROUND + 0.3], 0.8)), SOLID, false);
  c.part(capsule([BAR_L - 1.4, BAR_Y], [BAR_R + 1.4, BAR_Y], 0.9), SOLID, false);
}

const SPARK = [[0, -2], [0, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [0, 1], [0, 2]];
const ZED = [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]];
const stamp = (c, pts, at, v) => { const [x, y] = k(at).map(Math.round); pts.forEach(([dx, dy]) => c.set(x + dx, y + dy, v)); };

// ---------- 小人 ----------

// p：姿势（各关节坐标）；face：open | smile | blink | joy | grit | sleep
function person(c, b, p, face, stage) {
  const axis = [p.pelvis[0] - p.neck[0], p.pelvis[1] - p.neck[1]];
  const len = Math.hypot(...axis) || 1;
  const u = [axis[0] / len, axis[1] / len];
  const n = [-u[1], u[0]];
  const sh = add(p.neck, [u[0] * 1.5, u[1] * 1.5]);
  const shL = add(sh, [n[0] * b.sw, n[1] * b.sw]);
  const shR = add(sh, [-n[0] * b.sw, -n[1] * b.sw]);
  const hipL = add(p.pelvis, [n[0] * 1.6, n[1] * 1.6]);
  const hipR = add(p.pelvis, [-n[0] * 1.6, -n[1] * 1.6]);

  // 脚下一块网点影子
  if (p.shadow !== false) {
    const sx = Math.round(p.shadow?.[0] ?? p.pelvis[0] * K);
    const w = Math.round(p.shadow?.[1] ?? 7 * K);
    const gy = Math.round((GROUND + 0.6) * K);
    for (let x = sx - w; x <= sx + w; x++) {
      c.set(x, gy, INK);
      if (Math.abs(x - sx) < w - 2 && x % 2 === 0) c.set(x, gy - 1, INK);
    }
  }

  const leg = (hip, [knee, foot, toe]) => union(capsule(hip, knee, b.leg), capsule(knee, foot, b.leg), capsule(foot, toe, b.leg * 0.8));
  const arm = (s, [elbow, hand]) => union(capsule(s, elbow, b.arm), capsule(elbow, hand, b.arm), circle(hand, b.arm + 0.5));

  c.part(leg(hipL, p.legL), PLAIN, false);
  c.part(leg(hipR, p.legR), PLAIN, false);
  const torso = capsule(sh, add(p.pelvis, [-u[0] * 1.5, -u[1] * 1.5]), b.tw);
  c.part(p.lying ? torso : union(torso, capsule(shL, shR, b.arm + 0.6)), PLAIN, false);
  c.part(capsule(hipL, hipR, Math.min(b.tw - 0.6, 2.4)), SOLID, false);
  if (p.armsBehind && !p.noArms) {
    c.part(arm(shL, p.armL), PLAIN, false);
    c.part(arm(shR, p.armR), PLAIN, false);
  }

  // 头：大圆脸，上半部是头发，左上一道高光
  const r = 5.6;
  const head = circle(p.head, r);
  c.part(head, PLAIN, false);
  const [hx, hy] = k(p.head);
  const hair = (x, y) => head(x, y) && y + 0.5 < hy - 1 + (Math.abs(x + 0.5 - hx) > 5.5 ? 3 : 0);
  c.part(hair, SOLID, false);
  const X = Math.round(hx);
  const Y = Math.round(hy);
  [[-4, -6], [-3, -6], [-5, -5]].forEach(([dx, dy]) => c.set(X + dx, Y + dy, PAPER));
  if (stage >= 5) for (let x = X - 9; x <= X + 9; x++) if (head(x, Y - 2)) c.set(x, Y - 2, ACC);

  const px = (pts, v = INK) => pts.forEach(([dx, dy]) => c.set(X + dx, Y + dy, v));
  if (face === 'open' || face === 'smile') px([[-3, 1], [-3, 2], [-3, 3], [2, 1], [2, 2], [2, 3]]);
  if (face === 'blink' || face === 'sleep') px([[-4, 3], [-3, 3], [-2, 3], [1, 3], [2, 3], [3, 3]]);
  if (face === 'joy') px([[-4, 3], [-3, 2], [-2, 3], [1, 3], [2, 2], [3, 3]]);
  if (face === 'grit') px([[-4, 1], [-3, 2], [-2, 3], [3, 1], [2, 2], [1, 3], [-2, 6], [-1, 6], [0, 6], [1, 6]]);
  if (face === 'smile' || face === 'joy') px([[-2, 5], [1, 5], [-1, 6], [0, 6]]);
  if (face === 'joy') px([[-6, 5], [-5, 5], [4, 5], [5, 5]], ACC);
  if (face === 'sleep') px([[-1, 6], [0, 6]]);

  if (!p.armsBehind && !p.noArms) {
    c.part(arm(shL, p.armL), PLAIN, false);
    c.part(arm(shR, p.armR), PLAIN, false);
  }
  if (stage >= 5) {
    for (const hand of [p.armL[1], p.armR[1]]) {
      const [x, y] = k(hand).map(Math.round);
      c.set(x - 1, y + 2, ACC); c.set(x, y + 2, ACC); c.set(x + 1, y + 2, ACC);
    }
  }
}

// ---------- 姿势 ----------

const CX = 11.5; // 平时站在单杠左边
const BX = (BAR_L + BAR_R) / 2; // 引体向上时站到杠下

function standPose(b, { dy = 0, arms = 'down', tuck = false }) {
  const y = (v) => v - dy;
  const p = {
    head: [CX, y(9)],
    neck: [CX, y(14.6)],
    pelvis: [CX, y(23)],
    legL: tuck ? [[CX - 3, y(26)], [CX - 2.5, y(29)], [CX - 4, y(29)]] : [[CX - 2, y(28)], [CX - 2, y(32.5)], [CX - 3.5, y(32.5)]],
    legR: tuck ? [[CX + 3, y(26)], [CX + 2.5, y(29)], [CX + 4, y(29)]] : [[CX + 2, y(28)], [CX + 2, y(32.5)], [CX + 3.5, y(32.5)]],
  };
  const s = b.sw;
  if (arms === 'down') { p.armL = [[CX - s - 1, y(20)], [CX - s - 1.5, y(24)]]; p.armR = [[CX + s + 1, y(20)], [CX + s + 1.5, y(24)]]; }
  if (arms === 'wave') { p.armL = [[CX - s - 1, y(20)], [CX - s - 1.5, y(24)]]; p.armR = [[CX + s + 3, y(15)], [CX + s + 4, y(9)]]; }
  if (arms === 'v') { p.armL = [[CX - s - 3, y(14)], [CX - s - 5, y(9)]]; p.armR = [[CX + s + 3, y(14)], [CX + s + 5, y(9)]]; }
  return p;
}

function pullPose(b, up) {
  const hands = [[BX - 6.8, BAR_Y], [BX + 6.8, BAR_Y]];
  if (up) {
    return {
      head: [BX, 6], neck: [BX, 11.6], pelvis: [BX, 19.5], armsBehind: true,
      armL: [[BX - b.sw - 3, 15], hands[0]], armR: [[BX + b.sw + 3, 15], hands[1]],
      legL: [[BX - 3, 24], [BX - 2.5, 28], [BX - 4, 28]], legR: [[BX + 3, 24], [BX + 2.5, 28], [BX + 4, 28]],
    };
  }
  return {
    head: [BX, 17], neck: [BX, 22.6], pelvis: [BX, 29], armsBehind: true,
    armL: [[BX - 7.6, 19], hands[0]], armR: [[BX + 7.6, 19], hands[1]],
    legL: [[BX - 5, 30.5], [BX - 3.5, 32.5], [BX - 5, 32.5]], legR: [[BX + 5, 30.5], [BX + 3.5, 32.5], [BX + 5, 32.5]],
  };
}

// 伸腿坐着，双手放在腿上，歪头打瞌睡
function dozePose(b, nod) {
  return {
    head: [CX - 1 + nod * 0.8, 17 + nod * 1.2], neck: [CX - 1, 22.4], pelvis: [CX - 1, 30.2],
    armL: [[CX - b.sw - 1.5, 27.5], [CX + 1, 30.5]], armR: [[CX + b.sw + 1, 27.5], [CX + 4, 30.5]],
    legL: [[CX + 4, 31.4], [CX + 9, 31.6], [CX + 9.5, 29.8]], legR: [[CX + 4, 32.2], [CX + 9.5, 32.4], [CX + 10, 30.6]],
    shadow: [(CX + 3) * K, 9 * K],
  };
}

function lyingPose(breathe) {
  return {
    lying: true, noArms: true,
    head: [11, 27.8], neck: [16.4, 29.6 - breathe], pelvis: [25, 30 - breathe],
    armL: [[20, 30], [24, 30]], armR: [[20, 30], [24, 30]], shadow: [19 * K, 14 * K],
    legL: [[30.5, 31], [36, 31.4], [36.5, 29.6]], legR: [[30.5, 31], [36, 31.4], [36.5, 29.6]],
  };
}

function stretchPose(b, lean) {
  return {
    head: [CX + lean, 15.5], neck: [CX + lean * 0.5, 21], pelvis: [CX, 29],
    armL: [[CX - b.sw - 3 + lean, 19 - lean], [CX - b.sw - 6 + lean, 14 - lean * 2]], armR: [[CX + b.sw + 3 + lean, 19 + lean], [CX + b.sw + 6 + lean, 14 + lean * 2]],
    legL: [[CX - 6, 30.5], [CX - 1, 32.5], [CX + 0.5, 32.5]], legR: [[CX + 6, 30.5], [CX + 1, 32.5], [CX - 0.5, 32.5]],
  };
}

function frame(stage, mood, n) {
  const b = BUILDS[stage];
  const c = canvas();
  scenery(c);
  if (mood === 'waiting') {
    person(c, b, standPose(b, { arms: n ? 'wave' : 'down' }), n ? 'smile' : 'open', stage);
  } else if (mood === 'working') {
    person(c, b, pullPose(b, !!n), 'grit', stage);
  } else if (mood === 'happy') {
    person(c, b, standPose(b, { arms: 'v', dy: n ? 3 : 0, tuck: !!n }), 'joy', stage);
    stamp(c, SPARK, n ? [3, 10] : [4, 4], ACC);
    stamp(c, SPARK, n ? [23, 3] : [22, 9], ACC);
  } else if (mood === 'sleepy') {
    person(c, b, dozePose(b, n), 'sleep', stage);
    stamp(c, ZED, n ? [19, 6] : [17, 10], GRAY);
  } else if (mood === 'down') {
    person(c, b, lyingPose(n), 'sleep', stage);
    stamp(c, ZED, n ? [11, 15] : [9, 19], GRAY);
    if (n) stamp(c, ZED, [16, 11], GRAY);
  } else {
    person(c, b, stretchPose(b, n ? 1 : 0), 'blink', stage);
  }
  return c.g;
}

// ---------- 输出 ----------

const CLASSES = ['', 'p', 'a', 'g', 'm', 'b'];

// 同色横向连续像素合并成一个 rect
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
  return `<svg class="buddy-svg mood-${mood}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true">
    <g class="f1">${toRects(frame(stage, mood, 0))}</g>
    <g class="f2">${toRects(frame(stage, mood, 1))}</g>
  </svg>`;
}
