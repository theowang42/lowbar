// 只负责界面和事件。业务逻辑在 core.js，数据读写在 storage.js。
import { EXERCISES, SETS, STRETCHES } from './plan.js';
import {
  toISODate, todayPlan, calcStreak, countDone, latestWeight, totalClimb, journey,
  completeDay, initialProfile, clampTarget, weekView,
} from './core.js';
import * as storage from './storage.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const state = { view: 'home', today: '', profile: null, history: {}, sets: {} };

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

const totalSets = () => Object.values(state.sets).reduce((a, n) => a + n, 0);

const pad = (i) => String(i + 1).padStart(2, '0');
const meters = (m) => Math.floor(m).toLocaleString('zh-CN');

function dots(n) {
  return Array.from({ length: SETS }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
}

function renderHome() {
  const { profile, history, today } = state;
  const plan = todayPlan(profile, today);
  const entry = history[today];

  if (plan.type === 'rest') {
    $('title').textContent = '休息日';
    $('focus').textContent = '今天不练。拉伸一下，明天继续。休息不会打断连续。';
    $('list').innerHTML = STRETCHES.map((s, i) => {
      const [name, how] = s.split('：');
      return `<li><div class="row-item static"><span class="idx">${pad(i)}</span>
        <span class="main"><span class="name">${esc(name)}</span><span class="cue">${esc(how)}</span></span></div></li>`;
    }).join('');
    $('action').innerHTML = '';
  } else {
    $('title').textContent = entry ? '今天练完了' : '今天练';
    $('focus').textContent = entry ? '' : '每做完一组，点一下这一行。';
    $('list').innerHTML = plan.items.map((item, i) => {
      const n = entry ? (entry.exercises?.[item.id] ? SETS : 0) : state.sets[item.id] || 0;
      const cls = ['row-item', n >= SETS && 'full', entry && 'locked'].filter(Boolean).join(' ');
      // 已完成的那天显示当天实际做的次数，而不是进阶后的新目标
      const target = entry?.exercises?.[item.id] && entry.reps?.[item.id] ? entry.reps[item.id] / SETS : item.target;
      return `<li><button type="button" class="${cls}" data-id="${item.id}"${entry ? ' disabled' : ''}
          aria-label="${esc(item.name)}，已做 ${n} / ${SETS} 组">
        <span class="idx">${pad(i)}</span>
        <span class="main">
          <span class="name">${esc(item.name)}${item.optional ? '<span class="tag">可选</span>' : ''}</span>
          <span class="cue">${esc(item.cue)}</span>
          <span class="sets">${dots(n)}<span>${n >= SETS ? '完成' : `${n} / ${SETS} 组`}</span></span>
        </span>
        <span class="target"><b>${target}</b><small>${item.unit} × ${SETS}</small></span>
      </button></li>`;
    }).join('');
    if (entry) {
      $('action').innerHTML = `<div class="done">
        <span class="mark" aria-hidden="true"></span>
        <span>今天完成了</span>
        <button id="undo-btn" class="text-btn" type="button">撤销</button>
      </div>`;
    } else {
      const ready = totalSets() > 0;
      $('action').innerHTML = `<button id="complete-btn" class="btn big" type="button"${ready ? '' : ' disabled'}>完成今天</button>
        <p class="note">${ready ? '没做满的动作不影响打卡，只是目标不加。' : '至少做完一组才能打卡。'}</p>`;
    }
  }
  renderStats();
}

function renderStats() {
  const { history, today, profile } = state;
  const w = latestWeight(profile.weights);
  const j = journey(totalClimb(history));
  $('streak').textContent = calcStreak(history, today);
  $('week').innerHTML = weekView(history, today).map((d) =>
    `<li class="day-${d.status}${d.isToday ? ' now' : ''}" title="${d.date}"><i></i><span>${d.label}</span></li>`).join('');
  $('climb').textContent = meters(j.meters);
  $('climb-bar').style.width = `${(j.progress * 100).toFixed(1)}%`;
  $('climb-next').innerHTML = j.next
    ? `下一站 <b>${esc(j.next.name)}</b> ${j.next.height} 米 · 还差 ${Math.ceil(j.next.height - j.meters)} 米`
    : `已越过 <b>${esc(j.passed.name)}</b>，你站在世界之巅`;
  $('stat-total').textContent = `${countDone(history)} 天`;
  $('stat-weight').textContent = w ? `${w} kg` : '—';
}

function changeText(c) {
  const ex = EXERCISES[c.id];
  return `${ex.name}目标 ${c.from} → ${c.to} ${ex.unit}`;
}

async function complete() {
  if (totalSets() === 0) return;
  const r = completeDay(state.profile, state.history, state.today, state.sets);
  if (!r) return;
  const before = calcStreak(state.history, state.today);
  await storage.saveUndo(state.today, state.profile);
  if (!(await storage.appendHistory(state.today, r.entry))) return;
  await storage.saveProfile(r.profile);
  state.profile = r.profile;
  state.history = { ...state.history, [state.today]: r.entry };
  renderHome();
  const after = calcStreak(state.history, state.today);
  const lines = [
    `连续 ${after} 天${after > before ? '，+1' : ''}。今天爬升 ${r.climb.toFixed(1)} 米。`,
    ...r.reached.map((l) => `你爬过了${l.name}的高度（${l.height} 米）。`),
    ...r.changes.map(changeText),
  ];
  $('feedback').innerHTML = lines.map(esc).join('<br>');
}

async function undo() {
  await storage.undoDay(state.today);
  await load();
  $('feedback').textContent = '';
  renderHome();
}

// 点一下记一组，满 3 组后再点归零
async function bump(id) {
  if (state.history[state.today]) return;
  const n = state.sets[id] || 0;
  state.sets = { ...state.sets, [id]: n >= SETS ? 0 : n + 1 };
  await storage.saveDraft(state.today, state.sets);
  renderHome();
  $('list').querySelector(`[data-id="${id}"]`)?.focus({ preventScroll: true });
}

// ---------- 首次引导 ----------

function renderOnboarding() {
  $('title').textContent = '开始之前';
  const tests = Object.values(EXERCISES).map((ex, i) => {
    return `<label class="row">
      <span><span><b>${i + 2}. ${esc(ex.name)}</b>：一组最多几次${ex.optional ? '（可不填）' : ''}</span><small>${esc(ex.cue)}</small></span>
      <input name="${ex.id}" type="number" inputmode="numeric" min="0" max="999"${ex.optional ? '' : ' required'}>
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
    return `<fieldset class="ex">
      <legend>${esc(ex.name)}</legend>
      <label>每组 <input name="${ex.id}-target" type="number" inputmode="numeric" min="${ex.min}" max="${ex.max}" step="1" value="${s.target}"> ${ex.unit}
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
    const target = clampTarget(ex.id, f[`${ex.id}-target`].value);
    exercises[ex.id] = { target, streak: target === old.target ? old.streak : 0 };
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
  state.sets = await storage.loadDraft(state.today);
}

function onKey(e) {
  if (state.view !== 'home' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (e.target.matches?.('input, select, textarea')) return;
  if (e.key === ' ') {
    e.preventDefault();
    complete();
  } else if (/^[1-9]$/.test(e.key)) {
    const card = $('list').querySelectorAll('button.row-item')[Number(e.key) - 1];
    if (card && !card.disabled) bump(card.dataset.id);
  }
}

// 页面一直开着跨过午夜时，回到前台就切到新的一天
function onVisible() {
  if (document.visibilityState !== 'visible' || !state.profile) return;
  if (toISODate() !== state.today) {
    load().then(() => {
      $('feedback').textContent = '';
      if (state.view === 'home') show('home');
    });
  }
}

async function init() {
  await load();
  $('list').addEventListener('click', (e) => {
    const card = e.target.closest('button.row-item');
    if (card) bump(card.dataset.id);
  });
  $('action').addEventListener('click', (e) => {
    if (e.target.id === 'complete-btn') complete();
    if (e.target.id === 'undo-btn') undo();
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

  if ('serviceWorker' in navigator) {
    // 新版本的 service worker 接管时自动刷新一次，让页面用上新代码
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
