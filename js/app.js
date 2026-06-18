import { parseExpenseInput } from './parser.js';
import {
  getCategoriesForTier,
  groupByCategory,
  splitExpenseGroups,
  detectCategory,
  resolveCategoryId,
  getCategory,
} from './categories.js';
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
  importExpensesFromSeed,
} from './store.js';
import { exportProData } from './exportReport.js';
import {
  DEFAULT_CATEGORY_ICON,
  suggestCategoryIcon,
  getNextCategoryIcon,
} from './categoryIcons.js';
import {
  refreshWordDictionary,
  getTypingWord,
  getWordSuggestions,
  fixExpenseInput,
  applyWordSuggestion,
} from './wordSuggest.js';
import {
  formatMoney,
  formatTime,
  formatMonthYear,
  dayOfMonth,
} from './format.js';
import {
  applyFreeTierSplit,
  canAddCustomDebtCategory,
  canAddCustomSavingsCategory,
  getDebtPickerOptions,
  getSavingsPickerOptions,
  DEFAULT_FREE_DEBT_ID,
  DEFAULT_FREE_SAVINGS_ID,
} from './tierLimits.js';
import {
  markApkContext,
  syncNativePro,
  requestProPurchase,
  isRuStoreApk,
} from './rustoreBridge.js';

let currentPeriod = 'today';
let editingId = null;
let settings = loadSettings();
let expenseComposing = false;
let iconManualOverride = false;
let freeIconManualOverride = false;
let pendingSubmit = false;
let inputPeakValue = '';
let lastCompositionData = '';

const els = {
  periodLabel: document.getElementById('period-label'),
  periodTotal: document.getElementById('period-total'),
  summarySub: document.getElementById('summary-sub'),
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
  inputSuggestions: document.getElementById('input-suggestions'),
  editDialog: document.getElementById('edit-dialog'),
  editForm: document.getElementById('edit-form'),
  editDesc: document.getElementById('edit-desc'),
  editAmount: document.getElementById('edit-amount'),
  editCategory: document.getElementById('edit-category'),
  btnDelete: document.getElementById('btn-delete'),
  settingsDialog: document.getElementById('settings-dialog'),
  btnSettings: document.getElementById('btn-settings'),
  monthlyBudget: document.getElementById('monthly-budget'),
  budgetLabel: document.getElementById('budget-label'),
  budgetHint: document.getElementById('budget-hint'),
  btnExport: document.getElementById('btn-export'),
  freeBlocksSection: document.getElementById('free-blocks-section'),
  freeSavingsPick: document.getElementById('free-savings-pick'),
  freeDebtPick: document.getElementById('free-debt-pick'),
  freeCatSection: document.getElementById('free-cat-section'),
  freeNewCatName: document.getElementById('free-new-cat-name'),
  freeNewCatIcon: document.getElementById('free-new-cat-icon'),
  freeSelectedCatIcon: document.getElementById('free-selected-cat-icon'),
  freeIconCycleBtn: document.getElementById('free-icon-cycle-btn'),
  freeNewCatKeywords: document.getElementById('free-new-cat-keywords'),
  freeNewCatSavings: document.getElementById('free-new-cat-savings'),
  freeNewCatDebt: document.getElementById('free-new-cat-debt'),
  btnAddFreeCategory: document.getElementById('btn-add-free-category'),
  freeCustomCatList: document.getElementById('free-custom-cat-list'),
  submitBtn: document.getElementById('submit-btn'),
  newCatName: document.getElementById('new-cat-name'),
  newCatIcon: document.getElementById('new-cat-icon'),
  selectedCatIcon: document.getElementById('selected-cat-icon'),
  iconCycleBtn: document.getElementById('icon-cycle-btn'),
  newCatKeywords: document.getElementById('new-cat-keywords'),
  newCatSavings: document.getElementById('new-cat-savings'),
  newCatDebt: document.getElementById('new-cat-debt'),
  btnAddCategory: document.getElementById('btn-add-category'),
  customCatSection: document.getElementById('custom-cat-section'),
  customCatForm: document.getElementById('custom-cat-form'),
  customCatHint: document.getElementById('custom-cat-hint'),
  customCatList: document.getElementById('custom-cat-list'),
  proBuySection: document.getElementById('pro-buy-section'),
  proStatus: document.getElementById('pro-status'),
  btnBuyPro: document.getElementById('btn-buy-pro'),
};

init();

async function init() {
  markApkContext();
  syncNativePro(settings, saveSettings);
  const reimport = new URLSearchParams(location.search).has('reimport');
  await importExpensesFromSeed(reimport);
  refreshWordDictionary();
  populateCategorySelect();
  applyTheme();
  updateProFieldsVisibility();
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
    queueExpenseSubmit();
  });

  els.submitBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
  });

  els.submitBtn.addEventListener('click', () => {
    queueExpenseSubmit();
  });

  els.expenseInput.addEventListener('compositionstart', () => {
    expenseComposing = true;
    lastCompositionData = '';
  });

  els.expenseInput.addEventListener('compositionupdate', (e) => {
    if (e.data) lastCompositionData = e.data;
  });

  els.expenseInput.addEventListener('compositionend', (e) => {
    expenseComposing = false;
    if (e.data) lastCompositionData = e.data;
    syncInputPeak();
    if (pendingSubmit) {
      pendingSubmit = false;
      queueExpenseSubmit();
    } else {
      updateInputSuggestions();
    }
  });

  els.expenseInput.addEventListener('input', () => {
    syncInputPeak();
    updateInputSuggestions();
  });

  els.expenseInput.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey && pickFirstSuggestion()) {
      e.preventDefault();
      return;
    }
    if (e.key !== 'Enter') return;
    if (e.isComposing || expenseComposing) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    queueExpenseSubmit();
  });

  bindImeSafeInput(els.expenseInput);

  els.btnSettings.addEventListener('click', () => {
    els.monthlyBudget.value = settings.monthlyBudget ?? '';
    updateProFieldsVisibility();
    populateFreeBlockPickers();
    if (settings.isPro) {
      renderCustomCategoryList();
      iconManualOverride = false;
      resetCategoryIcon();
    } else {
      freeIconManualOverride = false;
      resetFreeCategoryIcon();
      renderFreeCustomCategoryList();
    }
    els.settingsDialog.showModal();
  });

  els.freeSavingsPick.addEventListener('change', () => {
    settings.freeSavingsCategoryId = els.freeSavingsPick.value || DEFAULT_FREE_SAVINGS_ID;
    saveSettings(settings);
    render();
  });

  els.freeDebtPick.addEventListener('change', () => {
    settings.freeDebtCategoryId = els.freeDebtPick.value || DEFAULT_FREE_DEBT_ID;
    saveSettings(settings);
    render();
  });

  els.monthlyBudget.addEventListener('change', () => {
    const val = parseInt(els.monthlyBudget.value, 10);
    settings.monthlyBudget = val > 0 ? val : null;
    saveSettings(settings);
    render();
  });

  els.btnExport.addEventListener('click', async () => {
    if (!settings.isPro) return;
    const label = els.btnExport.textContent;
    els.btnExport.disabled = true;
    els.btnExport.textContent = 'Формирование…';
    try {
      await exportProData();
    } finally {
      els.btnExport.disabled = false;
      els.btnExport.textContent = label;
    }
  });

  els.editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!editingId) return;
    const desc = fixExpenseInput(els.editDesc.value.trim());
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
    els.editCategory.value = detectCategory(els.editDesc.value.trim(), settings.isPro);
  });

  bindImeSafeInput(els.editDesc);

  els.newCatName.addEventListener('input', updateSuggestedIcon);
  els.newCatKeywords.addEventListener('input', updateSuggestedIcon);
  els.iconCycleBtn.addEventListener('click', cycleCategoryIcon);
  els.freeNewCatName.addEventListener('input', updateFreeSuggestedIcon);
  els.freeNewCatKeywords.addEventListener('input', updateFreeSuggestedIcon);
  els.freeIconCycleBtn.addEventListener('click', cycleFreeCategoryIcon);
  els.btnAddCategory.addEventListener('click', handleAddCategory);
  els.btnAddFreeCategory.addEventListener('click', handleAddFreeCategory);

  els.btnBuyPro.addEventListener('click', () => {
    requestProPurchase();
  });
}

function bindImeSafeInput(input) {
  input.addEventListener('compositionstart', () => {
    input.dataset.composing = '1';
  });
  input.addEventListener('compositionend', () => {
    delete input.dataset.composing;
  });
}

function isInputComposing(input) {
  return input.dataset.composing === '1';
}

function syncInputPeak() {
  const v = els.expenseInput.value;
  if (v.length >= inputPeakValue.length) {
    inputPeakValue = v;
  }
}

function queueExpenseSubmit() {
  if (expenseComposing || isInputComposing(els.expenseInput)) {
    pendingSubmit = true;
    return;
  }
  pendingSubmit = false;
  readExpenseInputStable().then(handleAdd);
}

function readExpenseInputStable() {
  return new Promise((resolve) => {
    const snap = els.expenseInput.value;
    setTimeout(() => {
      const current = els.expenseInput.value;
      const candidates = [snap, current, inputPeakValue, mergeComposition(snap, current)];
      const best = candidates.sort((a, b) => scoreInput(b) - scoreInput(a))[0] || current;
      inputPeakValue = '';
      lastCompositionData = '';
      resolve(best);
    }, 180);
  });
}

function scoreInput(value) {
  const fixed = fixExpenseInput(value || '');
  return (fixed || '').replace(/\s/g, '').length;
}

/** Если в поле нет первой буквы, но composition её знает — склеить */
function mergeComposition(snap, current) {
  const base = current || snap;
  const word = getTypingWord(base);
  if (!word || word.length < 2) return fixExpenseInput(base);
  const data = (lastCompositionData || '').toLowerCase().replace(/[^a-zа-яё0-9-]/gi, '');
  if (data.length === word.length + 1 && data.slice(1) === word) {
    return applyWordSuggestion(base, data);
  }
  return fixExpenseInput(base);
}

function handleAdd(rawInput) {
  let raw = typeof rawInput === 'string' ? rawInput : els.expenseInput.value;
  raw = fixExpenseInput(raw);
  const suggestions = getWordSuggestions(getTypingWord(raw));
  if (suggestions.length === 1) {
    raw = applyWordSuggestion(raw, suggestions[0]);
  }
  raw = fixExpenseInput(raw);
  const parsed = parseExpenseInput(raw);

  if (!parsed) {
    shakeInput();
    return;
  }

  addExpense(parsed.description, parsed.amount);
  refreshWordDictionary();
  els.expenseInput.value = '';
  hideInputSuggestions();
  render();
  els.expenseInput.focus();
}

function updateInputSuggestions() {
  const word = getTypingWord(els.expenseInput.value);
  const suggestions = getWordSuggestions(word);
  if (!word || word.length < 2 || !suggestions.length) {
    hideInputSuggestions();
    return;
  }

  els.inputSuggestions.hidden = false;
  els.inputSuggestions.innerHTML = '';
  for (const suggestion of suggestions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'input-suggestion-btn';
    btn.textContent = suggestion;
    btn.addEventListener('click', () => {
      els.expenseInput.value = applyWordSuggestion(els.expenseInput.value, suggestion);
      hideInputSuggestions();
      els.expenseInput.focus();
    });
    els.inputSuggestions.appendChild(btn);
  }
}

function hideInputSuggestions() {
  els.inputSuggestions.hidden = true;
  els.inputSuggestions.innerHTML = '';
}

function pickFirstSuggestion() {
  const btn = els.inputSuggestions.querySelector('.input-suggestion-btn');
  if (!btn || els.inputSuggestions.hidden) return false;
  els.expenseInput.value = applyWordSuggestion(els.expenseInput.value, btn.textContent);
  hideInputSuggestions();
  return true;
}

function shakeInput() {
  els.expenseInput.classList.add('shake');
  setTimeout(() => els.expenseInput.classList.remove('shake'), 400);
}

function render() {
  const isPro = settings.isPro;
  const expenses = getExpensesForPeriod(currentPeriod);
  const total = sumAmount(expenses);
  const groups = groupByCategory(expenses, isPro);
  const split = applyFreeTierSplit(splitExpenseGroups(groups), settings, isPro);

  renderSummary(total, expenses.length, split.savingsTotal, split.debtsTotal);
  renderDebtsPanel(split.debts, split.debtsTotal, total);
  renderSavingsPanel(split.savings, split.savingsTotal, total);
  renderCategoryBreakdown(split.regular);
  renderList(expenses);
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

function renderCategoryBreakdown(groups) {
  els.categoryBreakdown.innerHTML = '';
  const shownTotal = groups.reduce((s, g) => s + g.total, 0);
  if (!groups.length || shownTotal === 0) return;

  for (const { category, total: catTotal } of groups) {
    const pct = Math.round((catTotal / shownTotal) * 100);
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
  const all = getCategoriesForTier(settings.isPro);
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

function renderCategoryList(listEl, cats, emptyText = 'Пока нет своих категорий') {
  listEl.innerHTML = '';

  if (!cats.length) {
    const empty = document.createElement('li');
    empty.className = 'custom-cat-empty';
    empty.textContent = emptyText;
    listEl.appendChild(empty);
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
    listEl.appendChild(li);
  }
}

function renderCustomCategoryList() {
  renderCategoryList(els.customCatList, loadCustomCategories());
}

function renderFreeCustomCategoryList() {
  renderCategoryList(els.freeCustomCatList, loadCustomCategories(), 'Нет своих категорий');
}

function handleAddCategory() {
  if (!settings.isPro) return;

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
    icon: els.newCatIcon.value.trim() || DEFAULT_CATEGORY_ICON,
    keywords: els.newCatKeywords.value,
    savings: els.newCatSavings.checked,
    debt: els.newCatDebt.checked,
  });

  els.newCatName.value = '';
  resetCategoryIcon();
  els.newCatKeywords.value = '';
  els.newCatSavings.checked = false;
  els.newCatDebt.checked = false;

  populateCategorySelect();
  refreshWordDictionary();
  renderCustomCategoryList();
  render();
}

function handleAddFreeCategory() {
  if (settings.isPro) return;

  const name = els.freeNewCatName.value.trim();
  if (!name) {
    els.freeNewCatName.focus();
    return;
  }

  if (els.freeNewCatSavings.checked && els.freeNewCatDebt.checked) {
    alert('Категория не может быть одновременно привычкой и долгом.');
    return;
  }
  if (!els.freeNewCatSavings.checked && !els.freeNewCatDebt.checked) {
    alert('Отметьте «Привычка» или «Долг».');
    return;
  }
  if (els.freeNewCatSavings.checked && !canAddCustomSavingsCategory(false)) {
    alert('В бесплатной версии уже есть категория в «Можно сэкономить». Pro — без ограничений.');
    return;
  }
  if (els.freeNewCatDebt.checked && !canAddCustomDebtCategory(false)) {
    alert('В бесплатной версии уже есть категория в «Долги». Pro — без ограничений.');
    return;
  }

  const cat = addCustomCategory({
    name,
    icon: els.freeNewCatIcon.value.trim() || DEFAULT_CATEGORY_ICON,
    keywords: els.freeNewCatKeywords.value,
    savings: els.freeNewCatSavings.checked,
    debt: els.freeNewCatDebt.checked,
  });

  if (cat?.savings) {
    settings.freeSavingsCategoryId = cat.id;
    saveSettings(settings);
  }
  if (cat?.debt) {
    settings.freeDebtCategoryId = cat.id;
    saveSettings(settings);
  }

  els.freeNewCatName.value = '';
  resetFreeCategoryIcon();
  els.freeNewCatKeywords.value = '';
  els.freeNewCatSavings.checked = false;
  els.freeNewCatDebt.checked = false;

  populateCategorySelect();
  populateFreeBlockPickers();
  renderFreeCustomCategoryList();
  refreshWordDictionary();
  render();
}

function handleDeleteCategory(id, name) {
  if (!confirm(`Удалить категорию «${name}»? Траты перейдут в «Прочее».`)) return;
  if (settings.freeSavingsCategoryId === id) {
    settings.freeSavingsCategoryId = DEFAULT_FREE_SAVINGS_ID;
  }
  if (settings.freeDebtCategoryId === id) {
    settings.freeDebtCategoryId = DEFAULT_FREE_DEBT_ID;
  }
  saveSettings(settings);
  deleteCustomCategory(id);
  deleteCategoryRulesForCategory(id);
  reassignCategory(id, 'other');
  populateCategorySelect();
  populateFreeBlockPickers();
  renderCustomCategoryList();
  renderFreeCustomCategoryList();
  render();
}

function openEdit(expense) {
  editingId = expense.id;
  els.editDesc.value = expense.description === '—' ? '' : expense.description;
  els.editAmount.value = expense.amount;
  els.editCategory.value = resolveCategoryId(
    expense.categoryId,
    expense.description,
    settings.isPro,
  );
  els.editDialog.showModal();
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

function updateProFieldsVisibility() {
  const pro = settings.isPro;
  els.budgetLabel.hidden = !pro;
  els.budgetHint.hidden = !pro;
  els.btnExport.hidden = !pro;
  els.customCatSection.hidden = !pro;
  els.freeBlocksSection.hidden = pro;
  els.freeCatSection.hidden = pro;
  renderProBuySection();
}

function renderProBuySection() {
  const inApk = isRuStoreApk();
  els.proBuySection.hidden = !inApk;
  if (!inApk) return;

  if (settings.isPro) {
    els.proStatus.textContent = 'Pro активен';
    els.btnBuyPro.hidden = true;
  } else {
    els.proStatus.textContent = 'Бесплатная версия';
    els.btnBuyPro.hidden = false;
  }
}

function populateFreeBlockPickers() {
  const savingsVal = settings.freeSavingsCategoryId || DEFAULT_FREE_SAVINGS_ID;
  const debtVal = settings.freeDebtCategoryId || DEFAULT_FREE_DEBT_ID;

  els.freeSavingsPick.innerHTML = getSavingsPickerOptions()
    .map((o) => `<option value="${o.id}">${escapeHtml(o.label)}</option>`)
    .join('');
  els.freeDebtPick.innerHTML = getDebtPickerOptions()
    .map((o) => `<option value="${o.id}">${escapeHtml(o.label)}</option>`)
    .join('');

  if ([...els.freeSavingsPick.options].some((o) => o.value === savingsVal)) {
    els.freeSavingsPick.value = savingsVal;
  }
  if ([...els.freeDebtPick.options].some((o) => o.value === debtVal)) {
    els.freeDebtPick.value = debtVal;
  }
}

function applyTheme() {
  document.documentElement.dataset.theme = 'light';
}

function setCategoryIcon(icon) {
  els.newCatIcon.value = icon;
  els.selectedCatIcon.textContent = icon;
}

function updateSuggestedIcon() {
  if (iconManualOverride) return;
  setCategoryIcon(suggestCategoryIcon(els.newCatName.value, els.newCatKeywords.value));
}

function cycleCategoryIcon() {
  iconManualOverride = true;
  setCategoryIcon(getNextCategoryIcon(els.newCatIcon.value));
}

function resetCategoryIcon() {
  iconManualOverride = false;
  updateSuggestedIcon();
}

function setFreeCategoryIcon(icon) {
  els.freeNewCatIcon.value = icon;
  els.freeSelectedCatIcon.textContent = icon;
}

function updateFreeSuggestedIcon() {
  if (freeIconManualOverride) return;
  setFreeCategoryIcon(suggestCategoryIcon(els.freeNewCatName.value, els.freeNewCatKeywords.value));
}

function cycleFreeCategoryIcon() {
  freeIconManualOverride = true;
  setFreeCategoryIcon(getNextCategoryIcon(els.freeNewCatIcon.value));
}

function resetFreeCategoryIcon() {
  freeIconManualOverride = false;
  updateFreeSuggestedIcon();
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
