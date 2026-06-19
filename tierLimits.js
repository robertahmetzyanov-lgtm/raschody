import {
  SAVINGS_CATEGORY_IDS,
  DEBT_CATEGORY_IDS,
  getCategory,
} from './categories.js';
import { loadCustomCategories } from './customCategories.js';

export const DEFAULT_FREE_SAVINGS_ID = 'coffee';
export const DEFAULT_FREE_DEBT_ID = 'debts';

export function getSavingsPickerOptions() {
  const options = [];
  for (const id of SAVINGS_CATEGORY_IDS) {
    const cat = getCategory(id);
    options.push({ id, label: `${cat.icon} ${cat.name}` });
  }
  for (const c of loadCustomCategories().filter((x) => x.savings)) {
    options.push({ id: c.id, label: `${c.icon} ${c.name}` });
  }
  return options;
}

export function getDebtPickerOptions() {
  const options = [];
  for (const id of DEBT_CATEGORY_IDS) {
    const cat = getCategory(id);
    options.push({ id, label: `${cat.icon} ${cat.name}` });
  }
  for (const c of loadCustomCategories().filter((x) => x.debt)) {
    options.push({ id: c.id, label: `${c.icon} ${c.name}` });
  }
  return options;
}

export function countCustomSavingsCategories() {
  return loadCustomCategories().filter((c) => c.savings).length;
}

export function countCustomDebtCategories() {
  return loadCustomCategories().filter((c) => c.debt).length;
}

export function canAddCustomSavingsCategory(isPro) {
  if (isPro) return true;
  return countCustomSavingsCategories() < 1;
}

export function canAddCustomDebtCategory(isPro) {
  if (isPro) return true;
  return countCustomDebtCategories() < 1;
}

/** Free: одна категория в «Можно сэкономить» и одна в «Долги»; остальное — в обычный список */
export function applyFreeTierSplit(split, settings, isPro) {
  if (isPro) return split;

  const savingsId = settings.freeSavingsCategoryId || DEFAULT_FREE_SAVINGS_ID;
  const debtId = settings.freeDebtCategoryId || DEFAULT_FREE_DEBT_ID;

  const shownSavings = split.savings.filter((g) => g.category.id === savingsId);
  const shownDebts = split.debts.filter((g) => g.category.id === debtId);
  const hidden = [
    ...split.savings.filter((g) => g.category.id !== savingsId),
    ...split.debts.filter((g) => g.category.id !== debtId),
  ];

  const regular = [...split.regular, ...hidden];
  regular.sort((a, b) => b.total - a.total);

  return {
    savings: shownSavings,
    debts: shownDebts,
    regular,
    savingsTotal: shownSavings.reduce((s, g) => s + g.total, 0),
    debtsTotal: shownDebts.reduce((s, g) => s + g.total, 0),
  };
}
