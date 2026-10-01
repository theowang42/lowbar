import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toISODate, addDays, weekday, dayType, todayPlan, calcStreak, weekDone, weekView, countDone, latestWeight,
  clampTarget, progress, completeDay, climbOf, totalClimb, journey, startTarget, initialProfile, normalizeProfile, mergeHistory,
} from '../core.js';
import { EXERCISES, TIMEZONE, LANDMARKS } from '../plan.js';

const done = () => ({ type: 'train', done: true, exercises: {} });
const historyOf = (...dates) => Object.fromEntries(dates.map((d) => [d, done()]));

test('toISODate 按指定时区计算日期', () => {
  const t = new Date('2026-10-01T17:30:00Z');
  assert.equal(toISODate(t, 'Asia/Shanghai'), '2026-10-02');
  assert.equal(toISODate(t, 'America/New_York'), '2026-10-01');
  assert.match(toISODate(t, TIMEZONE), /^\d{4}-\d{2}-\d{2}$/);
});

test('addDays 跨月、跨年、闰年', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('周一到周六训练，周日休息', () => {
  // 2026-09-27 是周日
  const week = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];
  assert.deepEqual(week.map(weekday), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(week.map(dayType), ['rest', 'train', 'train', 'train', 'train', 'train', 'train']);
});

test('todayPlan 每个训练日都是同样的动作，深蹲可选', () => {
  const p = initialProfile({ pull: 5 }, '2026-10-01');
  const t = todayPlan(p, '2026-09-28');
  assert.equal(t.type, 'train');
  assert.deepEqual(t.items.map((i) => i.id), ['pull', 'push', 'crunch', 'squat']);
  assert.deepEqual(t.items.map((i) => i.optional), [false, false, false, true]);
  assert.equal(t.items[0].name, '引体向上');
  assert.equal(t.items[0].target, 3);
  assert.deepEqual(todayPlan(p, '2026-10-01').items, t.items);
  assert.deepEqual(todayPlan(p, '2026-09-27'), { type: 'rest', items: [] });
});

test('连续天数：空历史为 0', () => {
  assert.equal(calcStreak({}, '2026-10-01'), 0);
});

test('连续天数：今天未完成从昨天算起，完成后 +1', () => {
  const h = historyOf('2026-09-29', '2026-09-30');
  assert.equal(calcStreak(h, '2026-10-01'), 2);
  h['2026-10-01'] = done();
  assert.equal(calcStreak(h, '2026-10-01'), 3);
});

test('连续天数：漏练一个训练日就断', () => {
  const h = historyOf('2026-09-28', '2026-09-30');
  assert.equal(calcStreak(h, '2026-10-01'), 1);
  assert.equal(calcStreak(h, '2026-10-02'), 0);
});

test('连续天数：周日不打断连续', () => {
  // 周四到周六 + 下周一
  const h = historyOf('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05');
  assert.equal(calcStreak(h, '2026-10-04'), 3); // 周日当天
  assert.equal(calcStreak(h, '2026-10-05'), 4);
  assert.equal(calcStreak(h, '2026-10-06'), 4); // 周二还没练
});

test('连续天数：跨月', () => {
  // 2026-01-29 周四 … 2026-02-02 周一
  const h = historyOf('2026-01-29', '2026-01-30', '2026-01-31', '2026-02-02');
  assert.equal(calcStreak(h, '2026-02-02'), 4);
});

test('连续天数：跨年', () => {
  const h = historyOf('2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-04');
  assert.equal(calcStreak(h, '2027-01-04'), 6);
  assert.equal(calcStreak(h, '2027-01-03'), 5);
});

test('连续天数：只认 done 为 true 的记录', () => {
  const h = { '2026-09-30': { type: 'A', done: false, exercises: {} } };
  assert.equal(calcStreak(h, '2026-10-01'), 0);
});

test('本周完成数、累计数、最新体重', () => {
  const h = historyOf('2026-09-26', '2026-09-28', '2026-09-30', '2026-10-01');
  assert.equal(weekDone(h, '2026-10-01'), 3);
  assert.equal(weekDone(h, '2026-09-27'), 1); // 周日属于上一周
  assert.equal(countDone(h), 4);
  assert.equal(latestWeight({ '2026-09-01': 70, '2026-10-01': 68.5, '2026-08-01': 72 }), 68.5);
  assert.equal(latestWeight({}), null);
});

test('clampTarget 上下限边界', () => {
  assert.equal(clampTarget('push', 3), 5);
  assert.equal(clampTarget('push', 5), 5);
  assert.equal(clampTarget('push', 40), 40);
  assert.equal(clampTarget('push', 99), 40);
  assert.equal(clampTarget('pull', 0), 1);
  assert.equal(clampTarget('crunch', 'abc'), 10);
});

test('进阶：连续 3 次完成目标 +1', () => {
  let r = progress('push', { target: 10, streak: 0 }, true);
  assert.deepEqual(r, { state: { target: 10, streak: 1 }, change: null });
  r = progress('push', r.state, true);
  assert.equal(r.change, null);
  r = progress('push', r.state, true);
  assert.deepEqual(r.state, { target: 11, streak: 0 });
  assert.deepEqual(r.change, { id: 'push', from: 10, to: 11 });
});

test('进阶：没完成计数清零，目标不变', () => {
  const r = progress('pull', { target: 6, streak: 2 }, false);
  assert.deepEqual(r, { state: { target: 6, streak: 0 }, change: null });
});

test('进阶：到上限后保持不变', () => {
  const r = progress('pull', { target: 20, streak: 2 }, true);
  assert.deepEqual(r, { state: { target: 20, streak: 0 }, change: null });
});

test('completeDay 写入记录并更新进阶状态', () => {
  const p = initialProfile({}, '2026-09-28');
  p.exercises.push.streak = 2;
  const r = completeDay(p, {}, '2026-09-28', { pull: 3, push: 3, crunch: 2 });
  assert.deepEqual(r.entry, {
    type: 'train',
    done: true,
    exercises: { pull: true, push: true, crunch: false, squat: false },
    reps: { pull: 3, push: 15, crunch: 20 }, // 组数 × 当时的目标
  });
  assert.equal(r.profile.exercises.push.target, 6);
  assert.equal(r.profile.exercises.pull.streak, 1);
  assert.equal(r.profile.exercises.crunch.streak, 0);
  assert.equal(p.exercises.push.target, 5); // 不修改入参
  assert.deepEqual(r.changes, [{ id: 'push', from: 5, to: 6 }]);
});

test('completeDay：没做满 3 组也算完成打卡', () => {
  const r = completeDay(initialProfile({}, '2026-09-28'), {}, '2026-09-28', {});
  assert.equal(r.entry.done, true);
});

test('completeDay：休息日或已有记录时返回 null（只追加不覆盖）', () => {
  const p = initialProfile({}, '2026-09-27');
  assert.equal(completeDay(p, {}, '2026-09-27', {}), null);
  assert.equal(completeDay(p, historyOf('2026-09-28'), '2026-09-28', {}), null);
});

test('首次引导：起始目标 = 最大值 60%，限制在上下限之间', () => {
  assert.equal(startTarget('push', 20), 12);
  assert.equal(startTarget('push', 4), 5);
  assert.equal(startTarget('push', 100), 40);
  assert.equal(startTarget('pull', 1), 1);
  const p = initialProfile({ weight: 70, pull: 6, push: 25, crunch: 30, squat: '' }, '2026-10-01');
  assert.deepEqual(p.weights, { '2026-10-01': 70 });
  assert.deepEqual(p.exercises, {
    pull: { target: 4, streak: 0 },
    push: { target: 15, streak: 0 },
    crunch: { target: 18, streak: 0 },
    squat: { target: EXERCISES.squat.min, streak: 0 }, // 没测的从下限开始
  });
});

test('首次引导：没填体重时不记录', () => {
  assert.deepEqual(initialProfile({ weight: '' }, '2026-10-01').weights, {});
});

test('normalizeProfile 补全缺失并修正越界', () => {
  const p = normalizeProfile({
    weights: { '2026-10-01': '68', bad: 1 },
    exercises: { push: { level: 2, target: 100, streak: 1 }, legs: { target: 12 } },
  });
  assert.deepEqual(p.weights, { '2026-10-01': 68 });
  assert.deepEqual(p.exercises, {
    pull: { target: 1, streak: 0 },
    push: { target: 40, streak: 1 },
    crunch: { target: 10, streak: 0 },
    squat: { target: 10, streak: 0 },
  });
});

test('mergeHistory 只追加，已有日期不被覆盖', () => {
  const base = { '2026-10-01': done() };
  const merged = mergeHistory(base, {
    '2026-10-01': { type: 'train', done: false, exercises: {} },
    '2026-09-30': done(),
    junk: done(),
  });
  assert.deepEqual(Object.keys(merged).sort(), ['2026-09-30', '2026-10-01']);
  assert.equal(merged['2026-10-01'].done, true);
});

test('weekView 给出本周每天的状态', () => {
  const h = historyOf('2026-09-28', '2026-09-30');
  const w = weekView(h, '2026-10-01'); // 周四
  assert.deepEqual(w.map((d) => d.label).join(''), '一二三四五六日');
  assert.deepEqual(w.map((d) => d.status), ['done', 'missed', 'done', 'today', 'future', 'future', 'rest']);
  assert.deepEqual(w.map((d) => d.isToday), [false, false, false, true, false, false, false]);
  h['2026-10-01'] = done();
  assert.equal(weekView(h, '2026-10-01')[3].status, 'done');
  // 跨月的一周
  assert.deepEqual(weekView({}, '2026-02-01').map((d) => d.date.slice(5)), ['01-26', '01-27', '01-28', '01-29', '01-30', '01-31', '02-01']);
});

test('爬升：每天的米数 = 次数 × 每次抬起的高度', () => {
  const e = { reps: { pull: 10, push: 10, crunch: 20, squat: 10 } };
  assert.equal(climbOf(e), 10 * 0.5 + 10 * 0.3 + 20 * 0.15 + 10 * 0.4);
  assert.equal(climbOf({ type: 'train', done: true, exercises: { push: true } }), 0); // 旧记录没有 reps
  assert.equal(climbOf(undefined), 0);
  assert.equal(totalClimb({ a: e, b: e }), 2 * climbOf(e));
});

test('爬升：地标位置与进度', () => {
  assert.deepEqual(journey(0), { meters: 0, passed: null, next: LANDMARKS[0], progress: 0 });
  const j = journey(43);
  assert.equal(j.passed.name, '天安门城楼');
  assert.equal(j.next.name, '黄鹤楼');
  assert.equal(j.progress, 0.5);
  assert.equal(journey(35).passed.name, '天安门城楼'); // 正好到达也算越过
  const top = journey(10000);
  assert.equal(top.passed.name, '珠穆朗玛峰');
  assert.equal(top.next, null);
  assert.equal(top.progress, 1);
});

test('completeDay 算出今天的爬升和越过的地标', () => {
  const p = initialProfile({}, '2026-09-28'); // pull 1, push 5, crunch 10, squat 10
  const history = { '2026-09-26': { type: 'train', done: true, exercises: {}, reps: { pull: 60 } } }; // 30 m
  const r = completeDay(p, history, '2026-09-28', { pull: 3, push: 3, crunch: 3 });
  // 3 × 0.5 + 15 × 0.3 + 30 × 0.15 = 10.5
  assert.equal(r.climb, 10.5);
  assert.deepEqual(r.reached.map((l) => l.name), ['天安门城楼']);
  const r2 = completeDay(p, {}, '2026-09-28', { push: 3 });
  assert.deepEqual(r2.reached.map((l) => l.name), ['一层楼']);
});
