// 纯函数：今日计划、连续天数、进阶判断。不访问 DOM，不访问存储。
import { EXERCISES, WEEK, PROGRESS_AFTER, SETS, LANDMARKS } from './plan.js';

const IDS = Object.keys(EXERCISES);

// ---------- 日期（YYYY-MM-DD） ----------

// 把 Date 转成 YYYY-MM-DD。timeZone 省略时用运行环境的本地时区。
export function toISODate(date = new Date(), timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso, n) {
  return new Date(parseISO(iso) + n * 86400000).toISOString().slice(0, 10);
}

// 0 = 周日 … 6 = 周六
export function weekday(iso) {
  return new Date(parseISO(iso)).getUTCDay();
}

// ---------- 今日计划 ----------

// 'train' | 'rest'
export function dayType(iso) {
  return WEEK[weekday(iso)];
}

// 今天要练的动作，带当前目标
export function todayPlan(profile, iso) {
  const type = dayType(iso);
  if (type === 'rest') return { type, items: [] };
  const items = IDS.map((id) => {
    const ex = EXERCISES[id];
    return { id, name: ex.name, unit: ex.unit, cue: ex.cue, optional: !!ex.optional, target: profile.exercises[id].target };
  });
  return { type, items };
}

// 现在该做哪个动作：按顺序第一个没做满的必做动作；必做的都做满了，再轮到可选动作
export function currentExercise(items, sets) {
  const open = items.filter((i) => (sets[i.id] || 0) < SETS);
  return (open.find((i) => !i.optional) || open[0])?.id ?? null;
}

// ---------- 连续天数 ----------

// 从今天往回数连续完成的训练日。周日不练不算断，也不计数。
// 今天还没完成时从昨天开始数，所以白天还没练不会显示断了。
export function calcStreak(history, today) {
  let d = history[today]?.done ? today : addDays(today, -1);
  let n = 0;
  for (;;) {
    if (dayType(d) === 'rest') {
      d = addDays(d, -1);
    } else if (history[d]?.done) {
      n++;
      d = addDays(d, -1);
    } else {
      return n;
    }
  }
}

export function countDone(history) {
  return Object.values(history).filter((e) => e?.done).length;
}

// 本周（周一到周六）已完成的训练天数
export function weekDone(history, today) {
  const monday = addDays(today, -((weekday(today) + 6) % 7));
  let n = 0;
  for (let d = monday; d <= today; d = addDays(d, 1)) {
    if (history[d]?.done) n++;
  }
  return n;
}

// 本周一到周日每天的状态：done / missed / today / future / rest
export function weekView(history, today) {
  const monday = addDays(today, -((weekday(today) + 6) % 7));
  return [...'一二三四五六日'].map((label, i) => {
    const date = addDays(monday, i);
    let status;
    if (history[date]?.done) status = 'done';
    else if (dayType(date) === 'rest') status = 'rest';
    else if (date === today) status = 'today';
    else status = date < today ? 'missed' : 'future';
    return { date, label, status, isToday: date === today };
  });
}

export function latestWeight(weights = {}) {
  const dates = Object.keys(weights).sort();
  return dates.length ? weights[dates[dates.length - 1]] : null;
}

// ---------- 进阶 ----------

export function clampTarget(id, value) {
  const { min, max } = EXERCISES[id];
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

// 一次训练后某个动作的新状态。done = 3 组都达到目标。
// 连续 PROGRESS_AFTER 次完成 → 目标 +1（不超过上限）；没完成 → 计数清零，目标不变。
// 返回 { state, change }，change 为 null 或 { id, from, to }。
export function progress(id, state, done) {
  if (!done) return { state: { ...state, streak: 0 }, change: null };
  const streak = (state.streak || 0) + 1;
  if (streak < PROGRESS_AFTER) return { state: { ...state, streak }, change: null };
  const to = Math.min(EXERCISES[id].max, state.target + 1);
  return {
    state: { target: to, streak: 0 },
    change: to > state.target ? { id, from: state.target, to } : null,
  };
}

// 完成今天。sets = { 动作 id: 做了几组 }，做满 SETS 组算该动作完成。
// 返回 { entry, profile, changes, climb, reached }；今天已有记录或是休息日时返回 null（history 只追加不覆盖）。
// climb：今天爬升的米数；reached：今天越过的地标。
export function completeDay(profile, history, iso, sets) {
  const type = dayType(iso);
  if (type === 'rest' || history[iso]) return null;

  const exercises = {};
  const reps = {};
  const states = { ...profile.exercises };
  const changes = [];
  for (const id of IDS) {
    const n = Math.min(SETS, Math.max(0, sets[id] || 0));
    exercises[id] = n >= SETS;
    if (n > 0) reps[id] = n * states[id].target;
    const r = progress(id, states[id], exercises[id]);
    states[id] = r.state;
    if (r.change) changes.push(r.change);
  }
  const entry = { type, done: true, exercises, reps };
  const before = totalClimb(history);
  const climb = climbOf(entry);
  return {
    entry,
    profile: { ...profile, exercises: states },
    changes,
    climb,
    reached: LANDMARKS.filter((l) => before < l.height && before + climb >= l.height),
  };
}

// ---------- 累计爬升 ----------

// 一天爬升的米数 = 每个动作的次数 × 每次抬起的高度
export function climbOf(entry) {
  return Object.entries(entry?.reps || {}).reduce((m, [id, n]) => m + (EXERCISES[id]?.lift || 0) * n, 0);
}

export function totalClimb(history) {
  return Object.values(history).reduce((m, e) => m + climbOf(e), 0);
}

// 当前高度在地标路线上的位置。progress：从上一个地标到下一个地标走了多少（0–1）
export function journey(meters) {
  let passed = null;
  let next = null;
  for (const l of LANDMARKS) {
    if (meters >= l.height) passed = l;
    else { next = l; break; }
  }
  const from = passed ? passed.height : 0;
  return { meters, passed, next, progress: next ? (meters - from) / (next.height - from) : 1 };
}

// ---------- 首次引导 ----------

// 起始目标 = 最大值的 60%，限制在上下限之间
export function startTarget(id, max) {
  return clampTarget(id, Number(max) * 0.6);
}

// tests = { weight, pull, push, crunch, squat }，均为测试的最大值；没填的从下限开始
export function initialProfile(tests, iso) {
  const exercises = {};
  for (const id of IDS) {
    const max = Number(tests[id]);
    exercises[id] = { target: max > 0 ? startTarget(id, max) : EXERCISES[id].min, streak: 0 };
  }
  const weight = Number(tests.weight);
  return {
    weights: weight > 0 ? { [iso]: weight } : {},
    exercises,
  };
}

// 补全缺失字段、修正越界值（用于导入和读取旧数据）
export function normalizeProfile(p) {
  const out = { weights: {}, exercises: {} };
  for (const [d, kg] of Object.entries(p?.weights || {})) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && Number(kg) > 0) out.weights[d] = Number(kg);
  }
  for (const id of IDS) {
    const s = p?.exercises?.[id] || {};
    out.exercises[id] = {
      target: s.target === undefined ? EXERCISES[id].min : clampTarget(id, s.target),
      streak: Math.max(0, Math.round(Number(s.streak)) || 0),
    };
  }
  return out;
}

// 合并历史：已有的日期保留，只追加新日期
export function mergeHistory(base, incoming) {
  const out = { ...base };
  for (const [d, e] of Object.entries(incoming || {})) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && e && typeof e === 'object' && !(d in out)) out[d] = e;
  }
  return out;
}
