// 数据读写的唯一入口。v0.1 使用 localStorage；接口都是 async，方便 v0.2 加 GitHub 同步。
import { mergeHistory, normalizeProfile } from './core.js';
import { EXERCISES } from './plan.js';

const KEYS = { profile: 'lowbar.profile', history: 'lowbar.history' };

function read(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// 还没完成首次引导时返回 null；训练计划换了动作（缺少某个动作）时也返回 null，重新引导
export async function loadProfile() {
  const p = read(KEYS.profile, null);
  if (!p || !Object.keys(EXERCISES).every((id) => p.exercises?.[id])) return null;
  return normalizeProfile(p);
}

export async function saveProfile(profile) {
  write(KEYS.profile, profile);
}

export async function loadHistory() {
  return read(KEYS.history, {});
}

// 只追加：该日期已有记录时不写入，返回 false
export async function appendHistory(iso, entry) {
  const history = read(KEYS.history, {});
  if (history[iso]) return false;
  history[iso] = entry;
  write(KEYS.history, history);
  return true;
}

export async function exportData() {
  return {
    app: 'lowbar',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: read(KEYS.profile, null),
    history: read(KEYS.history, {}),
  };
}

// profile 整体替换；history 合并，已有日期保留
export async function importData(data) {
  if (!data || typeof data !== 'object' || !data.profile || typeof data.history !== 'object') {
    throw new Error('不是有效的 lowbar 导出文件');
  }
  write(KEYS.profile, normalizeProfile(data.profile));
  write(KEYS.history, mergeHistory(read(KEYS.history, {}), data.history));
}
