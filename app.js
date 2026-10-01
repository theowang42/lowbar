// 只负责界面和事件。业务逻辑在 core.js，数据读写在 storage.js。
import { EXERCISES, DAYS, SETS, STRETCHES, TESTS } from './plan.js';
import {
  toISODate, todayPlan, calcStreak, weekDone, countDone, latestWeight,
  completeDay, initialProfile, clampTarget,
} from './core.js';
import * as storage from './storage.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const state = { view: 'home', today: '', profile: null, history: {}, checks: {} };

// ---------- 视图切换 ----------

function show(view) {
  state.view = view;
  for (const v of ['home', 'onboarding', 'settings']) $(v).hidden = v !== view;
  $('settings-btn').hidden = view !== 'home';
  $('back-btn').hidden = view !== 'settings';
  $('date').textContent = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
  if (view === 'home') renderHome();
  if (view === 'onboarding') renderOnboarding();
  if (view === 'settings') renderSettings();
}

// ---------- 首页 ----------

function dose(item) {
  return `${SETS} × ${item.target} ${item.unit}${item.perSide ? '（每侧）' : ''}`;
}

function renderHome() {
  const { profile, history, today } = state;
  const plan = todayPlan(profile, today);
  const entry = history[today];

  if (plan.type === 'rest') {
    $('title').textContent = '休息日';
    $('focus').textContent = '今天不练。做几个拉伸，明天继续。休息不会打断连续。';
    $('list').innerHTML = STRETCHES.map((s) => `<li class="item stretch">${esc(s)}</li>`).join('');
    $('action').innerHTML = '';
  } else {
    $('title').textContent = DAYS[plan.type].label;
    $('focus').textContent = DAYS[plan.type].focus;
    $('list').innerHTML = plan.items.map((item, i) => {
      const checked = entry ? entry.exercises?.[item.id] : state.checks[item.id];
      return `<li>
        <label class="item">
          <input type="checkbox" data-id="${item.id}"${checked ? ' checked' : ''}${entry ? ' disabled' : ''}>
          <span class="body">
            <span class="name">${esc(item.levelName)}${item.levelCount > 1 ? `<span class="tag">等级 ${item.level}</span>` : ''}</span>
            <span class="dose">${esc(dose(item))}</span>
            <span class="cue">${esc(item.cue)}</span>
          </span>
          <kbd>${i + 1}</kbd>
        </label>
      </li>`;
    }).join('');
    $('action').innerHTML = entry
      ? '<p class="done">今天已完成 ✓</p>'
      : '<button id="complete-btn" class="btn big" type="button">完成今天</button>';
  }
  renderStats();
}

function renderStats() {
  const { history, today, profile } = state;
  const w = latestWeight(profile.weights);
  $('streak').textContent = calcStreak(history, today);
  $('stat-week').textContent = `${weekDone(history, today)} / 6`;
  $('stat-total').textContent = `${countDone(history)} 次`;
  $('stat-weight').textContent = w ? `${w} kg` : '—';
}

function changeText(c) {
  const ex = EXERCISES[c.id];
  if (c.kind === 'target') return `${ex.name}：目标 ${c.from} → ${c.to} ${ex.unit}`;
  return `${ex.name}：升到等级 ${c.to} · ${ex.levels[c.to - 1].name}`;
}

async function complete() {
  const r = completeDay(state.profile, state.history, state.today, state.checks);
  if (!r) return;
  const before = calcStreak(state.history, state.today);
  if (!(await storage.appendHistory(state.today, r.entry))) return;
  await storage.saveProfile(r.profile);
  state.profile = r.profile;
  state.history = { ...state.history, [state.today]: r.entry };
  state.checks = {};
  renderHome();
  const after = calcStreak(state.history, state.today);
  const lines = [`连续 ${after} 天${after > before ? '，+1' : ''}。明天见。`, ...r.changes.map(changeText)];
  $('feedback').innerHTML = lines.map(esc).join('<br>');
}

function toggle(id, value) {
  if (state.history[state.today]) return;
  state.checks[id] = value;
  const box = $('list').querySelector(`input[data-id="${id}"]`);
  if (box) box.checked = value;
}

// ---------- 首次引导 ----------

function renderOnboarding() {
  $('title').textContent = '开始之前';
  const tests = TESTS.map((id, i) => {
    const ex = EXERCISES[id];
    const lv = ex.levels[0];
    const unit = ex.unit === '秒' ? '最多坚持几秒' : '一组最多几次';
    return `<label class="row">
      <span><span><b>${i + 2}. ${esc(lv.name)}</b>：${unit}</span><small>${esc(lv.cue)}</small></span>
      <input name="${id}" type="number" inputmode="numeric" min="0" max="999" required>
    </label>`;
  }).join('');
  $('onboarding-form').innerHTML = `
    <label class="row"><span><span><b>1. 体重</b>（kg）</span></span>
      <input name="weight" type="number" inputmode="decimal" step="0.1" min="20" max="300" required></label>
    ${tests}
    <p class="muted">起始目标取最大值的 60%。以后都可以在设置里修改。</p>
    <button class="btn big" type="submit">开始</button>`;
}

async function submitOnboarding(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  state.profile = initialProfile(data, state.today);
  await storage.saveProfile(state.profile);
  show('home');
}

// ---------- 设置 ----------

function renderSettings() {
  $('title').textContent = '设置';
  $('settings-status').textContent = '';
  $('weight-form').weight.value = latestWeight(state.profile.weights) ?? '';
  $('exercise-fields').innerHTML = Object.values(EXERCISES).map((ex) => {
    const s = state.profile.exercises[ex.id];
    const options = ex.levels.map((lv, i) =>
      `<option value="${i + 1}"${s.level === i + 1 ? ' selected' : ''}>等级 ${i + 1} · ${esc(lv.name)}</option>`).join('');
    return `<fieldset class="ex">
      <legend>${esc(ex.name)}</legend>
      <select name="${ex.id}-level"${ex.levels.length === 1 ? ' disabled' : ''}>${options}</select>
      <label><input name="${ex.id}-target" type="number" inputmode="numeric" min="${ex.min}" max="${ex.max}" step="1" value="${s.target}"> ${ex.unit}
        <small>（${ex.min}–${ex.max}）</small></label>
    </fieldset>`;
  }).join('');
}

async function saveWeight(e) {
  e.preventDefault();
  const kg = Number(e.target.weight.value);
  if (!(kg > 0)) return;
  state.profile = { ...state.profile, weights: { ...state.profile.weights, [state.today]: kg } };
  await storage.saveProfile(state.profile);
  $('settings-status').textContent = `已记录 ${kg} kg`;
}

async function saveExercises(e) {
  e.preventDefault();
  const f = e.target;
  const exercises = {};
  for (const ex of Object.values(EXERCISES)) {
    const old = state.profile.exercises[ex.id];
    const level = ex.levels.length === 1 ? 1 : Number(f[`${ex.id}-level`].value);
    const target = clampTarget(ex.id, f[`${ex.id}-target`].value);
    const same = level === old.level && target === old.target;
    exercises[ex.id] = { level, target, streak: same ? old.streak : 0 };
  }
  state.profile = { ...state.profile, exercises };
  await storage.saveProfile(state.profile);
  renderSettings();
  $('settings-status').textContent = '已保存';
}

async function exportJSON() {
  const data = await storage.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `lowbar-${state.today}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importJSON(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!confirm('导入会替换当前设置，并追加训练记录。继续吗？')) return;
    await storage.importData(data);
    await load();
    renderSettings();
    $('settings-status').textContent = '已导入';
  } catch (err) {
    $('settings-status').textContent = `导入失败：${err.message}`;
  }
}

// ---------- 启动与事件 ----------

async function load() {
  state.today = toISODate();
  state.profile = await storage.loadProfile();
  state.history = await storage.loadHistory();
}

function onKey(e) {
  if (state.view !== 'home' || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.matches?.('input:not([type="checkbox"]), select, textarea')) return;
  if (e.key === ' ') {
    e.preventDefault();
    complete();
  } else if (/^[1-6]$/.test(e.key)) {
    const box = $('list').querySelectorAll('input[type="checkbox"]')[Number(e.key) - 1];
    if (box && !box.disabled) toggle(box.dataset.id, !box.checked);
  }
}

// 页面一直开着跨过午夜时，回到前台就切到新的一天
function onVisible() {
  if (document.visibilityState !== 'visible' || !state.profile) return;
  if (toISODate() !== state.today) {
    state.today = toISODate();
    state.checks = {};
    $('feedback').textContent = '';
    if (state.view === 'home') show('home');
  }
}

async function init() {
  await load();
  $('list').addEventListener('change', (e) => {
    if (e.target.dataset.id) toggle(e.target.dataset.id, e.target.checked);
  });
  $('action').addEventListener('click', (e) => {
    if (e.target.id === 'complete-btn') complete();
  });
  $('settings-btn').addEventListener('click', () => show('settings'));
  $('back-btn').addEventListener('click', () => show('home'));
  $('onboarding-form').addEventListener('submit', submitOnboarding);
  $('weight-form').addEventListener('submit', saveWeight);
  $('exercise-form').addEventListener('submit', saveExercises);
  $('export-btn').addEventListener('click', exportJSON);
  $('import-input').addEventListener('change', importJSON);
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisible);
  show(state.profile ? 'home' : 'onboarding');

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
