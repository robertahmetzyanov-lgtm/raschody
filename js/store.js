import { detectCategory, resolveCategoryId } from './categories.js';
import { saveCategoryRule } from './categoryRules.js';
import { fixExpenseDescription, fixExpenseInput } from './textFix.js';

const STORAGE_KEY = 'raschody_expenses_v1';
const SETTINGS_KEY = 'raschody_settings_v1';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const merged = { ...defaultSettings(), ...JSON.parse(raw) };
    merged.darkTheme = false;
    return merged;
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function defaultSettings() {
  return {
    darkTheme: false,
    isPro: false,
    monthlyBudget: null,
    freeSavingsCategoryId: 'coffee',
    freeDebtCategoryId: 'debts',
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

const SEED_IMPORT_KEY = 'raschody_excel_seed_v2';

/** Загрузить расходы из data/expenses-seed.json (импорт из Excel) */
export async function importExpensesFromSeed(force = false) {
  if (!force && localStorage.getItem(SEED_IMPORT_KEY) === '1') return false;
  try {
    const res = await fetch('./data/expenses-seed.json');
    if (!res.ok) return false;
    const items = await res.json();
    if (!Array.isArray(items) || !items.length) return false;
    saveExpenses(items);
    localStorage.setItem(SEED_IMPORT_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

function normalizeExpense(e) {
  const description = fixExpenseDescription(e.description);
  const isPro = loadSettings().isPro;
  return {
    id: e.id,
    description,
    amount: e.amount,
    createdAt: e.createdAt,
    categoryId: resolveCategoryId(e.categoryId, description, isPro),
  };
}

export function addExpense(description, amount, categoryId) {
  const isPro = loadSettings().isPro;
  description = fixExpenseDescription(description);
  const expenses = loadExpenses();
  const expense = {
    id: crypto.randomUUID(),
    description,
    amount,
    createdAt: new Date().toISOString(),
    categoryId: categoryId || detectCategory(description, isPro),
  };
  expenses.unshift(expense);
  saveExpenses(expenses);
  return expense;
}

export function updateExpense(id, description, amount, categoryId) {
  const isPro = loadSettings().isPro;
  description = fixExpenseDescription(description);
  const expenses = loadExpenses();
  const idx = expenses.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  expenses[idx] = {
    ...expenses[idx],
    description,
    amount,
    categoryId: categoryId || detectCategory(description, isPro),
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
