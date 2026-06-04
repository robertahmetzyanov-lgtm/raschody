const STORAGE_KEY = 'raschody_category_rules_v1';

export function normalizeDescriptionKey(description) {
  return (description || '').toLowerCase().trim();
}

export function loadCategoryRules() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Запомнить: это название → эта категория */
export function saveCategoryRule(description, categoryId) {
  const key = normalizeDescriptionKey(description);
  if (!key || key === '—' || !categoryId) return;
  const rules = loadCategoryRules();
  rules[key] = categoryId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

export function getCategoryRule(description) {
  const key = normalizeDescriptionKey(description);
  if (!key) return null;
  return loadCategoryRules()[key] || null;
}

export function deleteCategoryRulesForCategory(categoryId) {
  const rules = loadCategoryRules();
  let changed = false;
  for (const [key, id] of Object.entries(rules)) {
    if (id === categoryId) {
      delete rules[key];
      changed = true;
    }
  }
  if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}
