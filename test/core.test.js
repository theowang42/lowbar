import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toISODate, addDays, weekday, dayType, todayPlan, calcStreak, weekDone, countDone, latestWeight,
  clampTarget, progress, completeDay, startTarget, initialProfile, normalizeProfile, mergeHistory,
} from '../core.js';
import { EXERCISES, TIMEZONE } from '../plan.js';

const done = (type = 'A') => ({ type, done: true, exercises: {} });
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

test('A/B/休息日判断', () => {
  // 2026-09-27 是周日
  const week = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'];
  assert.deepEqual(week.map(weekday), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(week.map(dayType), ['rest', 'A', 'B', 'A', 'B', 'A', 'B']);
});

test('todayPlan 给出动作、等级与目标', () => {
  const p = initialProfile({}, '2026-10-01');
  const a = todayPlan(p, '2026-09-28');
  assert.equal(a.type, 'A');
  assert.deepEqual(a.items.map((i) => i.id), ['push', 'legs', 'core']);
  assert.equal(a.items[0].levelName, '上斜俯卧撑');
  assert.equal(a.items[2].unit, '秒');
  const b = todayPlan(p, '2026-09-29');
  assert.deepEqual(b.items.map((i) => i.id), ['row', 'pull', 'deadbug', 'bridge']);
  assert.equal(b.items[2].perSide, true);
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
  assert.equal(clampTarget('push', 3), 8);
  assert.equal(clampTarget('push', 8), 8);
  assert.equal(clampTarget('push', 15), 15);
  assert.equal(clampTarget('push', 99), 15);
  assert.equal(clampTarget('core', 'abc'), 20);
});

test('进阶：连续 3 次完成目标 +1', () => {
  let s = { level: 1, target: 10, streak: 0 };
  let r = progress('push', s, true);
  assert.deepEqual(r, { state: { level: 1, target: 10, streak: 1 }, change: null });
  r = progress('push', r.state, true);
  assert.equal(r.change, null);
  r = progress('push', r.state, true);
  assert.deepEqual(r.state, { level: 1, target: 11, streak: 0 });
  assert.deepEqual(r.change, { id: 'push', kind: 'target', from: 10, to: 11 });
});

test('进阶：按秒计的动作 +5 秒，且不超过上限', () => {
  let r = progress('core', { level: 1, target: 30, streak: 2 }, true);
  assert.equal(r.state.target, 35);
  r = progress('core', { level: 1, target: 58, streak: 2 }, true);
  assert.equal(r.state.target, 60);
});

test('进阶：没完成清零计数，不降级', () => {
  const r = progress('push', { level: 2, target: 12, streak: 2 }, false);
  assert.deepEqual(r, { state: { level: 2, target: 12, streak: 0 }, change: null });
});

test('升级：达到上限后再满足条件进入下一等级，目标回到下限', () => {
  const r = progress('row', { level: 1, target: 15, streak: 2 }, true);
  assert.deepEqual(r.state, { level: 2, target: 8, streak: 0 });
  assert.deepEqual(r.change, { id: 'row', kind: 'level', from: 1, to: 2 });
});

test('升级：最高等级的上限保持不变', () => {
  const r = progress('pull', { level: 3, target: 10, streak: 2 }, true);
  assert.deepEqual(r, { state: { level: 3, target: 10, streak: 0 }, change: null });
  const r2 = progress('bridge', { level: 1, target: 20, streak: 2 }, true);
  assert.equal(r2.state.level, 1);
  assert.equal(r2.change, null);
});

test('completeDay 写入记录并更新进阶状态', () => {
  const p = initialProfile({}, '2026-09-28');
  p.exercises.push.streak = 2;
  const r = completeDay(p, {}, '2026-09-28', { push: true, core: true });
  assert.deepEqual(r.entry, { type: 'A', done: true, exercises: { push: true, legs: false, core: true } });
  assert.equal(r.profile.exercises.push.target, 9);
  assert.equal(r.profile.exercises.legs.streak, 0);
  assert.equal(r.profile.exercises.core.streak, 1);
  assert.equal(r.profile.exercises.row, p.exercises.row); // B 天动作不受影响
  assert.equal(p.exercises.push.target, 8); // 不修改入参
  assert.deepEqual(r.changes, [{ id: 'push', kind: 'target', from: 8, to: 9 }]);
});

test('completeDay：休息日或已有记录时返回 null（只追加不覆盖）', () => {
  const p = initialProfile({}, '2026-09-27');
  assert.equal(completeDay(p, {}, '2026-09-27', {}), null);
  assert.equal(completeDay(p, historyOf('2026-09-28'), '2026-09-28', {}), null);
});

test('首次引导：起始目标 = 最大值 60%，限制在上下限之间', () => {
  assert.equal(startTarget('push', 20), 12);
  assert.equal(startTarget('push', 5), 8);
  assert.equal(startTarget('push', 40), 15);
  assert.equal(startTarget('core', 45), 27);
  const p = initialProfile({ weight: 70, push: 20, legs: 20, row: 10, pull: 3, core: 100 }, '2026-10-01');
  assert.deepEqual(p.weights, { '2026-10-01': 70 });
  assert.deepEqual(p.exercises.push, { level: 1, target: 12, streak: 0 });
  assert.deepEqual(p.exercises.legs, { level: 1, target: 12, streak: 0 });
  assert.deepEqual(p.exercises.row, { level: 1, target: 8, streak: 0 });
  assert.deepEqual(p.exercises.pull, { level: 1, target: 4, streak: 0 });
  assert.deepEqual(p.exercises.core, { level: 1, target: 60, streak: 0 });
  // 未测试的动作从等级 1 下限开始
  assert.deepEqual(p.exercises.deadbug, { level: 1, target: EXERCISES.deadbug.min, streak: 0 });
  assert.deepEqual(p.exercises.bridge, { level: 1, target: EXERCISES.bridge.min, streak: 0 });
});

test('首次引导：腿部测试值超过上限直接从等级 2 开始', () => {
  const p = initialProfile({ legs: 21 }, '2026-10-01');
  assert.deepEqual(p.exercises.legs, { level: 2, target: EXERCISES.legs.min, streak: 0 });
  const q = initialProfile({ legs: 20 }, '2026-10-01');
  assert.equal(q.exercises.legs.level, 1);
});

test('首次引导：没填体重时不记录', () => {
  assert.deepEqual(initialProfile({ weight: '' }, '2026-10-01').weights, {});
});

test('normalizeProfile 补全缺失并修正越界', () => {
  const p = normalizeProfile({
    weights: { '2026-10-01': '68', bad: 1 },
    exercises: { push: { level: 9, target: 100, streak: 1 }, legs: { level: 0, target: 1 } },
  });
  assert.deepEqual(p.weights, { '2026-10-01': 68 });
  assert.deepEqual(p.exercises.push, { level: 3, target: 15, streak: 1 });
  assert.deepEqual(p.exercises.legs, { level: 1, target: 10, streak: 0 });
  assert.deepEqual(p.exercises.bridge, { level: 1, target: 12, streak: 0 });
});

test('mergeHistory 只追加，已有日期不被覆盖', () => {
  const base = { '2026-10-01': done('B') };
  const merged = mergeHistory(base, {
    '2026-10-01': { type: 'B', done: false, exercises: {} },
    '2026-09-30': done('A'),
    junk: done(),
  });
  assert.deepEqual(Object.keys(merged).sort(), ['2026-09-30', '2026-10-01']);
  assert.equal(merged['2026-10-01'].done, true);
});
