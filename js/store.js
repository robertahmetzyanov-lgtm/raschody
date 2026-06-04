import { detectCategory, getCategory, resolveCategoryId } from './categories.js';
import { saveCategoryRule } from './categoryRules.js';

const STORAGE_KEY = 'raschody_expenses_v1';
const SETTINGS_KEY = 'raschody_settings_v1';
const FREE_DAILY_LIMIT = 5;

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function defaultSettings() {
  return {
    darkTheme: true,
    isPro: false,
    monthlyBudget: null,
  };
}

export function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map(normalizeExpense);
  } catch {
    return [];
  }
}

export function saveExpenses(expenses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function normalizeExpense(e) {
  const description = e.description;
  return {
    id: e.id,
    description,
    amount: e.amount,
    createdAt: e.createdAt,
    categoryId: resolveCategoryId(e.categoryId, description),
  };
}

export function addExpense(description, amount, categoryId) {
  const expenses = loadExpenses();
  const expense = {
    id: crypto.randomUUID(),
    description,
    amount,
    createdAt: new Date().toISOString(),
    categoryId: categoryId || detectCategory(description),
  };
  expenses.unshift(expense);
  saveExpenses(expenses);
  return expense;
}

export function updateExpense(id, description, amount, categoryId) {
  const expenses = loadExpenses();
  const idx = expenses.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  expenses[idx] = {
    ...expenses[idx],
    description,
    amount,
    categoryId: categoryId || detectCategory(description),
  };
  if (categoryId) {
    saveCategoryRule(description, categoryId);
  }
  saveExpenses(expenses);
  return expenses[idx];
}

export function deleteExpense(id) {
  const expenses = loadExpenses().filter((e) => e.id !== id);
  saveExpenses(expenses);
}

export function reassignCategory(fromId, toId = 'other') {
  const expenses = loadExpenses();
  let changed = false;
  for (const e of expenses) {
    if (e.categoryId === fromId) {
      e.categoryId = toId;
      changed = true;
    }
  }
  if (changed) saveExpenses(expenses);
}

export function countTodayExpenses() {
  const start = startOfDay(new Date());
  return loadExpenses().filter((e) => new Date(e.createdAt) >= start).length;
}

export function canAddToday(settings) {
  if (settings.isPro) return true;
  return countTodayExpenses() < FREE_DAILY_LIMIT;
}

export function getExpensesForPeriod(period) {
  const now = new Date();
  const start = periodStart(period, now);
  return loadExpenses().filter((e) => new Date(e.createdAt) >= start);
}

function periodStart(period, now) {
  if (period === 'today') return startOfDay(now);
  if (period === 'week') return startOfWeek(now);
  return startOfMonth(now);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d) {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function sumAmount(expenses) {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

export function exportCsv() {
  const rows = [['Дата', 'Время', 'Категория', 'Описание', 'Сумма']];
  for (const e of loadExpenses()) {
    const d = new Date(e.createdAt);
    rows.push([
      d.toLocaleDateString('ru-RU'),
      d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      getCategory(e.categoryId).name,
      e.description,
      String(e.amount),
    ]);
  }
  const bom = '\uFEFF';
  const csv = bom + rows.map((r) => r.map(escapeCsv).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `raschody_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(val) {
  const s = String(val);
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export { FREE_DAILY_LIMIT };
