const CUSTOM_KEY = 'raschody_custom_categories_v1';

function normalizeKeywords(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((k) => k.trim().toLowerCase()).filter(Boolean);
  return String(raw)
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeCategory(cat) {
  const name = String(cat.name || '').trim();
  const keywords = normalizeKeywords(cat.keywords);
  const nameKey = name.toLowerCase();
  if (nameKey && !keywords.includes(nameKey)) {
    keywords.unshift(nameKey);
  }
  return {
    id: cat.id,
    name,
    icon: (cat.icon || '📌').trim().slice(0, 4) || '📌',
    keywords,
    savings: Boolean(cat.savings),
    debt: Boolean(cat.debt),
    custom: true,
  };
}

export function loadCustomCategories() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map(normalizeCategory).filter((c) => c.name && c.id);
  } catch {
    return [];
  }
}

export function saveCustomCategories(categories) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(categories.map(normalizeCategory)));
}

export function addCustomCategory({ name, icon, keywords, savings, debt }) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const categories = loadCustomCategories();
  const baseId =
    'custom_' +
    trimmed
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 24);

  let id = baseId || `custom_${Date.now()}`;
  let n = 2;
  while (categories.some((c) => c.id === id)) {
    id = `${baseId}_${n}`;
    n += 1;
  }

  const category = normalizeCategory({
    id,
    name: trimmed,
    icon,
    keywords,
    savings,
    debt,
  });

  categories.push(category);
  saveCustomCategories(categories);
  return category;
}

export function deleteCustomCategory(id) {
  const categories = loadCustomCategories().filter((c) => c.id !== id);
  saveCustomCategories(categories);
}

export function parseKeywordsInput(text) {
  return normalizeKeywords(text);
}
