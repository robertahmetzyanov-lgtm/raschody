import { parseExpenseInput } from './parser.js';
import { getAllCategories, groupByCategory, splitExpenseGroups, detectCategory, getCategory } from './categories.js';
import {
  loadCustomCategories,
  addCustomCategory,
  deleteCustomCategory,
} from './customCategories.js';
import { deleteCategoryRulesForCategory } from './categoryRules.js';
import {
  addExpense,
  updateExpense,
  deleteExpense,
  reassignCategory,
  loadSettings,
  saveSettings,
  getExpensesForPeriod,
  sumAmount,
  canAddToday,
  countTodayExpenses,
  exportCsv,
  FREE_DAILY_LIMIT,
} from './store.js';
import {
  formatMoney,
  formatTime,
  formatMonthYear,
  dayOfMonth,
} from './format.js';

let currentPeriod = 'today';
let editingId = null;
let settings = loadSettings();

const els = {
  periodLabel: document.getElementById('period-label'),
  periodTotal: document.getElementById('period-total'),
  summarySub: document.getElementById('summary-sub'),
  limitWarning: document.getElementById('limit-warning'),
  expenseList: document.getElementById('expense-list'),
  categoryBreakdown: document.getElementById('category-breakdown'),
  savingsPanel: document.getElementById('savings-panel'),
  savingsTotal: document.getElementById('savings-total'),
  savingsSub: document.getElementById('savings-sub'),
  savingsRows: document.getElementById('savings-rows'),
  debtsPanel: document.getElementById('debts-panel'),
  debtsTotal: document.getElementById('debts-total'),
  debtsSub: document.getElementById('debts-sub'),
  expenseForm: document.getElementById('expense-form'),
  expenseInput: document.getElementById('expense-input'),
  limitHint: document.getElementById('limit-hint'),
  editDialog: document.getElementById('edit-dialog'),
  editForm: document.getElementById('edit-form'),
  editDesc: document.getElementById('edit-desc'),
  editAmount: document.getElementById('edit-amount'),
  editCategory: document.getElementById('edit-category'),
  btnDelete: document.getElementById('btn-delete'),
  settingsDialog: document.getElementById('settings-dialog'),
  btnSettings: document.getElementById('btn-settings'),
  darkTheme: document.getElementById('dark-theme'),
  proMode: document.getElementById('pro-mode'),
  monthlyBudget: document.getElementById('monthly-budget'),
  budgetLabel: document.getElementById('budget-label'),
  budgetHint: document.getElementById('budget-hint'),
  btnExport: document.getElementById('btn-export'),
  newCatName: document.getElementById('new-cat-name'),
  newCatIcon: document.getElementById('new-cat-icon'),
  newCatKeywords: document.getElementById('new-cat-keywords'),
  newCatSavings: document.getElementById('new-cat-savings'),
  newCatDebt: document.getElementById('new-cat-debt'),
  btnAddCategory: document.getElementById('btn-add-category'),
  customCatList: document.getElementById('custom-cat-list'),
};

init();

function init() {
  populateCategorySelect();
  applyTheme();
  bindEvents();
  render();
  registerServiceWorker();
}

function bindEvents() {
  document.querySelectorAll('.period-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.period-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentPeriod = tab.dataset.period;
      render();
    });
  });

  els.expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleAdd();
  });

  els.btnSettings.addEventListener('click', () => {
    els.darkTheme.checked = settings.darkTheme;
    els.proMode.checked = settings.isPro;
    els.monthlyBudget.value = settings.monthlyBudget ?? '';
    updateBudgetFieldsVisibility();
    renderCustomCategoryList();
    els.settingsDialog.showModal();
  });

  els.darkTheme.addEventListener('change', () => {
    settings.darkTheme = els.darkTheme.checked;
    saveSettings(settings);
    applyTheme();
  });

  els.proMode.addEventListener('change', () => {
    settings.isPro = els.proMode.checked;
    saveSettings(settings);
    updateBudgetFieldsVisibility();
    render();
  });

  els.monthlyBudget.addEventListener('change', () => {
    const val = parseInt(els.monthlyBudget.value, 10);
    settings.monthlyBudget = val > 0 ? val : null;
    saveSettings(settings);
    render();
  });

  els.btnExport.addEventListener('click', () => {
    if (!settings.isPro) {
      alert('Экспорт CSV — функция Pro. Включите Pro в настройках для теста.');
      return;
    }
    exportCsv();
  });

  els.editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!editingId) return;
    const desc = els.editDesc.value.trim();
    updateExpense(
      editingId,
      desc,
      parseInt(els.editAmount.value, 10),
      els.editCategory.value,
    );
    els.editDialog.close();
    editingId = null;
    render();
  });

  els.btnDelete.addEventListener('click', () => {
    if (!editingId) return;
    deleteExpense(editingId);
    els.editDialog.close();
    editingId = null;
    render();
  });

  els.editDesc.addEventListener('input', () => {
    if (!editingId) return;
    els.editCategory.value = detectCategory(els.editDesc.value.trim());
  });

  els.btnAddCategory.addEventListener('click', handleAddCategory);
}

function handleAdd() {
  const parsed = parseExpenseInput(els.expenseInput.value);
  if (!parsed) {
    shakeInput();
    return;
  }

  if (!canAddToday(settings)) {
    const msg = `Лимит ${FREE_DAILY_LIMIT} записей в день исчерпан. Pro — без ограничений.`;
    els.limitHint.textContent = msg;
    els.limitHint.classList.add('visible', 'error');
    els.limitWarning.textContent = msg;
    els.limitWarning.hidden = false;
    els.limitWarning.classList.add('limit-warning--error');
    return;
  }

  addExpense(parsed.description, parsed.amount);
  els.expenseInput.value = '';
  els.limitHint.classList.remove('error');
  render();
  els.expenseInput.focus();
}

function shakeInput() {
  els.expenseInput.classList.add('shake');
  setTimeout(() => els.expenseInput.classList.remove('shake'), 400);
}

function render() {
  const expenses = getExpensesForPeriod(currentPeriod);
  const total = sumAmount(expenses);
  const groups = groupByCategory(expenses);
  const { savings, debts, regular, savingsTotal, debtsTotal } = splitExpenseGroups(groups);

  renderSummary(total, expenses.length, savingsTotal, debtsTotal);
  renderDebtsPanel(debts, debtsTotal, total);
  renderSavingsPanel(savings, savingsTotal, total);
  renderCategoryBreakdown(regular, total - savingsTotal - debtsTotal);
  renderList(expenses);
  renderLimitHint();
  checkBudgetWarning();
}

function renderSummary(total, count, savingsTotal, debtsTotal) {
  const labels = { today: 'Сегодня', week: 'Неделя', month: 'Месяц' };
  els.periodLabel.textContent = labels[currentPeriod];
  els.periodTotal.textContent = formatMoney(total);

  let sub = '';
  if (currentPeriod === 'month') {
    const avg = Math.round(total / dayOfMonth());
    sub = `${formatMonthYear()} · ~${formatMoney(avg)}/день · ${count} записей`;
  } else if (currentPeriod === 'week') {
    sub = `${count} ${plural(count, 'запись', 'записи', 'записей')}`;
  } else {
    sub = count ? `${count} ${plural(count, 'запись', 'записи', 'записей')}` : '';
  }
  const parts = [];
  if (debtsTotal > 0 && total > 0) {
    parts.push(`долги ${Math.round((debtsTotal / total) * 100)}%`);
  }
  if (savingsTotal > 0 && total > 0) {
    parts.push(`привычки ${Math.round((savingsTotal / total) * 100)}%`);
  }
  if (parts.length) {
    sub = sub ? `${sub} · ${parts.join(' · ')}` : parts.join(' · ');
  }
  els.summarySub.textContent = sub;
}

function renderDebtsPanel(debtGroups, debtsTotal, periodTotal) {
  if (!debtGroups.length || debtsTotal === 0) {
    els.debtsPanel.hidden = true;
    return;
  }

  els.debtsPanel.hidden = false;
  els.debtsTotal.textContent = formatMoney(debtsTotal);

  const pct = periodTotal > 0 ? Math.round((debtsTotal / periodTotal) * 100) : 0;
  els.debtsSub.textContent = `${pct}% всех трат за период`;
}

function renderSavingsPanel(savingsGroups, savingsTotal, periodTotal) {
  if (!savingsGroups.length || savingsTotal === 0) {
    els.savingsPanel.hidden = true;
    return;
  }

  els.savingsPanel.hidden = false;
  els.savingsTotal.textContent = formatMoney(savingsTotal);

  const pct = periodTotal > 0 ? Math.round((savingsTotal / periodTotal) * 100) : 0;
  els.savingsSub.textContent = `${pct}% всех трат за период`;

  els.savingsRows.innerHTML = '';
  for (const { category, total: catTotal } of savingsGroups) {
    const row = document.createElement('div');
    row.className = 'savings-row';
    row.innerHTML = `
      <span class="savings-row-label">${category.icon} ${category.name}</span>
      <span class="savings-row-amount">${formatMoney(catTotal)}</span>
    `;
    els.savingsRows.appendChild(row);
  }
}

function renderCategoryBreakdown(groups, regularTotal) {
  els.categoryBreakdown.innerHTML = '';
  if (!groups.length || regularTotal === 0) return;

  for (const { category, total: catTotal } of groups) {
    const pct = Math.round((catTotal / regularTotal) * 100);
    const chip = document.createElement('div');
    chip.className = 'cat-chip';
    chip.innerHTML = `
      <span class="cat-chip-icon">${category.icon}</span>
      <span class="cat-chip-name">${category.name}</span>
      <span class="cat-chip-amount">${formatMoney(catTotal)}</span>
      <span class="cat-chip-pct">${pct}%</span>
    `;
    els.categoryBreakdown.appendChild(chip);
  }
}

function renderList(expenses) {
  els.expenseList.innerHTML = '';
  if (!expenses.length) return;

  const items = [...expenses].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
  els.expenseList.appendChild(createExpenseList(items));
}

function createExpenseList(items) {
  const list = document.createElement('ul');
  list.className = 'category-items';

  for (const e of items) {
    const cat = getCategory(e.categoryId);
    const li = document.createElement('li');
    li.className = 'expense-item';
    li.innerHTML = `
      <span class="expense-time">${formatTime(e.createdAt)}</span>
      <span class="expense-desc">${cat.icon} ${escapeHtml(e.description)}</span>
      <span class="expense-amount">${formatMoney(e.amount)}</span>
    `;
    li.addEventListener('click', () => openEdit(e));
    list.appendChild(li);
  }

  return list;
}

function populateCategorySelect() {
  let html = '';
  const all = getAllCategories();
  const builtin = all.filter((c) => !c.custom);
  const custom = all.filter((c) => c.custom);

  for (const c of builtin) {
    html += `<option value="${c.id}">${c.icon} ${c.name}</option>`;
  }
  if (custom.length) {
    html += '<optgroup label="Мои категории">';
    for (const c of custom) {
      html += `<option value="${c.id}">${c.icon} ${c.name}</option>`;
    }
    html += '</optgroup>';
  }
  els.editCategory.innerHTML = html;
}

function renderCustomCategoryList() {
  const cats = loadCustomCategories();
  els.customCatList.innerHTML = '';

  if (!cats.length) {
    const empty = document.createElement('li');
    empty.className = 'custom-cat-empty';
    empty.textContent = 'Пока нет своих категорий';
    els.customCatList.appendChild(empty);
    return;
  }

  for (const cat of cats) {
    const li = document.createElement('li');
    li.className = 'custom-cat-item';
    const tags = [];
    if (cat.savings) tags.push('привычка');
    if (cat.debt) tags.push('долг');
    const tagStr = tags.length ? ` · ${tags.join(', ')}` : '';
    const kw = cat.keywords.length ? cat.keywords.join(', ') : 'без автоопределения';
    li.innerHTML = `
      <div class="custom-cat-info">
        <span class="custom-cat-name">${cat.icon} ${escapeHtml(cat.name)}</span>
        <span class="custom-cat-meta">${escapeHtml(kw)}${tagStr}</span>
      </div>
      <button type="button" class="btn-icon-danger" data-id="${cat.id}" aria-label="Удалить">✕</button>
    `;
    li.querySelector('button').addEventListener('click', () => handleDeleteCategory(cat.id, cat.name));
    els.customCatList.appendChild(li);
  }
}

function handleAddCategory() {
  const name = els.newCatName.value.trim();
  if (!name) {
    els.newCatName.focus();
    return;
  }

  if (els.newCatSavings.checked && els.newCatDebt.checked) {
    alert('Категория не может быть одновременно привычкой и долгом.');
    return;
  }

  addCustomCategory({
    name,
    icon: els.newCatIcon.value.trim() || '📌',
    keywords: els.newCatKeywords.value,
    savings: els.newCatSavings.checked,
    debt: els.newCatDebt.checked,
  });

  els.newCatName.value = '';
  els.newCatIcon.value = '📌';
  els.newCatKeywords.value = '';
  els.newCatSavings.checked = false;
  els.newCatDebt.checked = false;

  populateCategorySelect();
  renderCustomCategoryList();
  render();
}

function handleDeleteCategory(id, name) {
  if (!confirm(`Удалить категорию «${name}»? Траты перейдут в «Прочее».`)) return;
  deleteCustomCategory(id);
  deleteCategoryRulesForCategory(id);
  reassignCategory(id, 'other');
  populateCategorySelect();
  renderCustomCategoryList();
  render();
}

function openEdit(expense) {
  editingId = expense.id;
  els.editDesc.value = expense.description === '—' ? '' : expense.description;
  els.editAmount.value = expense.amount;
  els.editCategory.value = expense.categoryId || detectCategory(expense.description);
  els.editDialog.showModal();
}

function renderLimitHint() {
  if (settings.isPro) {
    els.limitHint.classList.remove('visible', 'error', 'warn');
    els.limitWarning.hidden = true;
    return;
  }

  const used = countTodayExpenses();
  const left = FREE_DAILY_LIMIT - used;
  const limitText = `${FREE_DAILY_LIMIT} ${plural(FREE_DAILY_LIMIT, 'запись', 'записи', 'записей')} в день`;

  if (left <= 0) {
    const msg = `Лимит исчерпан: ${used} из ${FREE_DAILY_LIMIT} сегодня. Pro — без ограничений.`;
    els.limitWarning.textContent = msg;
    els.limitWarning.hidden = false;
    els.limitWarning.classList.add('limit-warning--error');
    els.limitWarning.classList.remove('limit-warning--warn');
    els.limitHint.textContent = msg;
    els.limitHint.classList.add('visible', 'error');
    els.limitHint.classList.remove('warn');
    return;
  }

  if (used >= 2) {
    const msg =
      left === 1
        ? `⚠ Сегодня ${used} из ${FREE_DAILY_LIMIT}. Осталась 1 запись — лимит ${limitText}.`
        : `⚠ Сегодня ${used} из ${FREE_DAILY_LIMIT}. Осталось ${left} — бесплатный лимит ${limitText}.`;
    els.limitWarning.textContent = msg;
    els.limitWarning.hidden = false;
    els.limitWarning.classList.add('limit-warning--warn');
    els.limitWarning.classList.remove('limit-warning--error');
    els.limitHint.textContent = msg;
    els.limitHint.classList.add('visible', 'warn');
    els.limitHint.classList.remove('error');
    return;
  }

  els.limitWarning.hidden = true;
  els.limitWarning.classList.remove('limit-warning--warn', 'limit-warning--error');
  els.limitHint.classList.remove('visible', 'error', 'warn');
}

const BUDGET_WARN_RATIO = 0.85;

function checkBudgetWarning() {
  els.periodTotal.classList.remove('budget-ok', 'budget-warn', 'budget-over', 'over-budget');
  els.summarySub.classList.remove('summary-sub--budget-warn', 'summary-sub--budget-over');

  if (!settings.isPro || !settings.monthlyBudget) return;

  const budget = settings.monthlyBudget;
  const monthTotal = sumAmount(getExpensesForPeriod('month'));
  const ratio = monthTotal / budget;
  const left = budget - monthTotal;

  let status = 'ok';
  if (monthTotal > budget) status = 'over';
  else if (ratio >= BUDGET_WARN_RATIO) status = 'warn';

  els.periodTotal.classList.add(`budget-${status}`);

  if (status === 'over') {
    const line = `⚠ Превышен бюджет на ${formatMoney(monthTotal - budget)}`;
    prependSummarySub(line);
    els.summarySub.classList.add('summary-sub--budget-over');
  } else if (status === 'warn') {
    const line = `⚠ Близко к лимиту: осталось ${formatMoney(left)} из ${formatMoney(budget)}`;
    prependSummarySub(line);
    els.summarySub.classList.add('summary-sub--budget-warn');
  }
}

function prependSummarySub(line) {
  const existing = els.summarySub.textContent.trim();
  els.summarySub.textContent = existing ? `${line} · ${existing}` : line;
}

function updateBudgetFieldsVisibility() {
  const pro = settings.isPro;
  els.budgetLabel.style.display = pro ? '' : 'none';
  els.budgetHint.style.display = pro ? '' : 'none';
  els.btnExport.disabled = !pro;
}

function applyTheme() {
  document.documentElement.dataset.theme = settings.darkTheme ? 'dark' : 'light';
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch {
      /* offline optional */
    }
  }
}
