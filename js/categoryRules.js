import { parseExpenseInput } from './parser.js';

const STORAGE_KEY = 'raschody_user_keywords_v2';
const LEGACY_KEY = 'raschody_category_rules_v1';

export function normalizeDescriptionKey(description) {
  return (description || '').toLowerCase().trim();
}

/** Слова из описания для обучения (без суммы) */
export function extractLearnableKeywords(description) {
  let text = (description || '').trim();
  const parsed = parseExpenseInput(text);
  if (parsed?.description && parsed.description !== '—') {
    text = parsed.description;
  }

  text = text.toLowerCase().replace(/[₽руб.]+/gi, ' ').trim();
  if (!text || text === '—') return [];

  const words = text
    .split(/[\s,;·]+/)
    .map((w) => w.replace(/^[^a-zа-яё0-9]+|[^a-zа-яё0-9]+$/gi, ''))
    .filter((w) => w.length >= 2 && !/^\d+$/.test(w));

  return [...new Set(words)];
}

export function loadCategoryRules() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return {};

    const migrated = {};
    for (const [key, categoryId] of Object.entries(JSON.parse(legacy))) {
      for (const kw of extractLearnableKeywords(key)) {
        migrated[kw] = categoryId;
      }
    }
    if (Object.keys(migrated).length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return {};
  }
}

/** Запомнить слова из описания → категория (работает без Pro) */
export function saveCategoryRule(description, categoryId) {
  if (!categoryId) return;

  const keywords = extractLearnableKeywords(description);
  if (!keywords.length) return;

  const rules = loadCategoryRules();
  for (const kw of keywords) {
    rules[kw] = categoryId;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

/** Найти категорию по выученным словам пользователя */
export function matchUserKeywordCategory(description) {
  const text = normalizeDescriptionKey(description);
  if (!text) return null;

  const rules = loadCategoryRules();
  let bestId = null;
  let bestLen = 0;

  for (const [keyword, categoryId] of Object.entries(rules)) {
    if (text.includes(keyword) && keyword.length > bestLen) {
      bestLen = keyword.length;
      bestId = categoryId;
    }
  }

  return bestId;
}

/** @deprecated используйте matchUserKeywordCategory */
export function getCategoryRule(description) {
  return matchUserKeywordCategory(description);
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
