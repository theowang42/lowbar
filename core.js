// 纯函数：今日计划、连续天数、进阶判断。不访问 DOM，不访问存储。
import { EXERCISES, DAYS, WEEK, TESTS, PROGRESS_AFTER } from './plan.js';

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

// 'A' | 'B' | 'rest'
export function dayType(iso) {
  return WEEK[weekday(iso)];
}

export function exercisesFor(type) {
  return type === 'rest' ? [] : DAYS[type].exercises;
}

// 今天要练的动作，带当前等级与目标
export function todayPlan(profile, iso) {
  const type = dayType(iso);
  const items = exercisesFor(type).map((id) => {
    const ex = EXERCISES[id];
    const state = profile.exercises[id];
    const level = ex.levels[state.level - 1];
    return {
      id,
      name: ex.name,
      unit: ex.unit,
      level: state.level,
      levelCount: ex.levels.length,
      levelName: level.name,
      cue: level.cue,
      perSide: !!level.perSide,
      target: state.target,
    };
  });
  return { type, items };
}

// ---------- 连续天数 ----------

// 从今天往回数连续完成的训练日。周日不练不算断，也不计数。
// 今天还没完成时从昨天开始数，所以白天还没练不会显示断了。
export function calcStreak(history, today) {
  let d = history[today]?.done ? today : addDays(today, -1);
  let n = 0;
  for (;;) {
    if (weekday(d) === 0) {
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
// 返回 { state, change }，change 为 null 或 { id, kind: 'target' | 'level', from, to }。
export function progress(id, state, done) {
  const ex = EXERCISES[id];
  if (!done) return { state: { ...state, streak: 0 }, change: null };

  const streak = (state.streak || 0) + 1;
  if (streak < PROGRESS_AFTER) return { state: { ...state, streak }, change: null };

  if (state.target < ex.max) {
    const to = Math.min(ex.max, state.target + ex.step);
    return {
      state: { level: state.level, target: to, streak: 0 },
      change: { id, kind: 'target', from: state.target, to },
    };
  }
  if (state.level < ex.levels.length) {
    return {
      state: { level: state.level + 1, target: ex.min, streak: 0 },
      change: { id, kind: 'level', from: state.level, to: state.level + 1 },
    };
  }
  // 已经是最高等级的上限：保持不变
  return { state: { ...state, streak: 0 }, change: null };
}

// 完成今天。checks = { 动作 id: true/false }。
// 返回 { entry, profile, changes }；今天已有记录或是休息日时返回 null（history 只追加不覆盖）。
export function completeDay(profile, history, iso, checks) {
  const type = dayType(iso);
  if (type === 'rest' || history[iso]) return null;

  const exercises = {};
  const states = { ...profile.exercises };
  const changes = [];
  for (const id of exercisesFor(type)) {
    exercises[id] = !!checks[id];
    const r = progress(id, states[id], exercises[id]);
    states[id] = r.state;
    if (r.change) changes.push(r.change);
  }
  return {
    entry: { type, done: true, exercises },
    profile: { ...profile, exercises: states },
    changes,
  };
}

// ---------- 首次引导 ----------

// 起始目标 = 最大值的 60%，限制在上下限之间
export function startTarget(id, max) {
  return clampTarget(id, Number(max) * 0.6);
}

// tests = { weight, push, legs, row, pull, core }，均为测试的最大值
export function initialProfile(tests, iso) {
  const exercises = {};
  for (const id of Object.keys(EXERCISES)) {
    exercises[id] = { level: 1, target: EXERCISES[id].min, streak: 0 };
  }
  for (const id of TESTS) {
    const max = Number(tests[id]);
    if (!(max > 0)) continue;
    if (id === 'legs' && max > EXERCISES.legs.max) {
      exercises.legs = { level: 2, target: EXERCISES.legs.min, streak: 0 };
    } else {
      exercises[id].target = startTarget(id, max);
    }
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
  for (const [id, ex] of Object.entries(EXERCISES)) {
    const s = p?.exercises?.[id] || {};
    const level = Math.min(ex.levels.length, Math.max(1, Math.round(Number(s.level)) || 1));
    out.exercises[id] = {
      level,
      target: s.target === undefined ? ex.min : clampTarget(id, s.target),
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
