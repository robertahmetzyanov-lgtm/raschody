import { parseExpenseInput } from './parser.js';
import { getAllCategories } from './categories.js';
import { loadCategoryRules } from './categoryRules.js';
import { loadExpenses } from './store.js';

const EXTRA_WORDS = [
  'бензин', 'заправка', 'азс', 'топливо', 'продукты', 'обед', 'ужин', 'завтрак',
  'кофе', 'такси', 'метро', 'аптека', 'лекарства', 'одежда', 'обувь', 'подарок',
  'подписка', 'интернет', 'связь', 'мобильный', 'стрижка', 'маникюр', 'детский',
  'школа', 'садик', 'корм', 'ветеринар', 'аренда', 'коммуналка', 'ипотека',
];

let dictionary = null;

function normalizeWord(word) {
  return (word || '').toLowerCase().replace(/[^a-zа-яё0-9-]/gi, '');
}

export function refreshWordDictionary() {
  const words = new Set(EXTRA_WORDS);

  for (const cat of getAllCategories()) {
    for (const kw of cat.keywords || []) {
      const w = normalizeWord(kw);
      if (w.length >= 2) words.add(w);
    }
    const name = normalizeWord(cat.name);
    if (name.length >= 2) words.add(name);
  }

  for (const key of Object.keys(loadCategoryRules())) {
    const w = normalizeWord(key);
    if (w.length >= 2) words.add(w);
  }

  for (const expense of loadExpenses()) {
    const parsed = parseExpenseInput(expense.description);
    const desc = parsed?.description && parsed.description !== '—'
      ? parsed.description
      : expense.description;
    for (const part of String(desc).split(/[\s,;·]+/)) {
      const w = normalizeWord(part);
      if (w.length >= 2 && !/^\d+$/.test(w)) words.add(w);
    }
  }

  dictionary = [...words].sort((a, b) => b.length - a.length);
  return dictionary;
}

function getDictionary() {
  if (!dictionary) refreshWordDictionary();
  return dictionary;
}

/** Последнее слово в строке ввода (без суммы) */
export function getTypingWord(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return '';

  const withoutAmount = trimmed
    .replace(/(\d[\d\s]*)/g, ' ')
    .replace(/[₽руб\.]+/gi, ' ')
    .trim();
  if (!withoutAmount) return '';

  const parts = withoutAmount.split(/[\s,;·]+/).filter(Boolean);
  return normalizeWord(parts[parts.length - 1] || '');
}

export function getWordSuggestions(prefix, limit = 5) {
  const needle = normalizeWord(prefix);
  if (needle.length < 2) return [];

  const dict = getDictionary();
  const exact = dict.filter((w) => w.startsWith(needle) && w !== needle);
  const fuzzy = dict.filter((w) => {
    if (w.startsWith(needle) || w === needle) return false;
    if (w.length !== needle.length + 1) return false;
    return w.slice(1) === needle;
  });

  return [...new Set([...exact, ...fuzzy])].slice(0, limit);
}

function fixWord(word) {
  const lower = normalizeWord(word);
  if (!lower || /^\d+$/.test(lower)) return word;

  const dict = getDictionary();
  if (dict.includes(lower)) return lower;

  const prefixMatches = dict.filter((w) => w.startsWith(lower) && w.length > lower.length);
  if (prefixMatches.length === 1) return prefixMatches[0];

  const dropFirstMatches = dict.filter((w) => w.length === lower.length + 1 && w.slice(1) === lower);
  if (dropFirstMatches.length === 1) return dropFirstMatches[0];

  return word;
}

function correctTextWords(text) {
  if (!text) return text;
  return text
    .split(/([\s,;·]+)/)
    .map((token) => (/^[\s,;·]+$/.test(token) ? token : fixWord(token)))
    .join('');
}

/** Исправляет описание: T9-дополнение и потерянная первая буква (Android IME) */
export function correctExpenseInput(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return trimmed;

  const amountMatch = trimmed.match(/(\d[\d\s]*)/);
  if (!amountMatch) return correctTextWords(trimmed);

  const amountStr = amountMatch[0].replace(/\s/g, '');
  const amountPos = trimmed.indexOf(amountMatch[0]);
  const before = trimmed.slice(0, amountPos).replace(/[₽руб\.]+/gi, '').trim();
  const after = trimmed.slice(amountPos + amountMatch[0].length).replace(/[₽руб\.]+/gi, '').trim();

  const fixedBefore = correctTextWords(before);
  const fixedAfter = correctTextWords(after);

  if (fixedBefore && !fixedAfter) {
    return `${fixedBefore} ${amountStr}`;
  }
  if (!fixedBefore && fixedAfter) {
    return `${amountStr} ${fixedAfter}`;
  }
  if (fixedBefore && fixedAfter) {
    return `${fixedBefore} ${amountStr} ${fixedAfter}`.trim();
  }
  return amountStr;
}

/** Подставить подсказку вместо последнего слова */
export function applyWordSuggestion(input, suggestion) {
  const trimmed = (input || '').trim();
  const amountMatch = trimmed.match(/(\d[\d\s]*)/);

  let textPart = trimmed;
  let amountPart = '';
  let amountAtEnd = false;

  if (amountMatch) {
    amountPart = amountMatch[0].replace(/\s/g, '');
    const pos = trimmed.indexOf(amountMatch[0]);
    const before = trimmed.slice(0, pos).trim();
    const after = trimmed.slice(pos + amountMatch[0].length).replace(/[₽руб\.]+/gi, '').trim();
    if (before) {
      textPart = before;
      amountAtEnd = true;
    } else {
      textPart = after;
      amountAtEnd = false;
    }
  }

  const parts = textPart.split(/(\s+)/);
  let replaced = false;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (/^\s+$/.test(parts[i])) continue;
    if (normalizeWord(parts[i])) {
      parts[i] = suggestion;
      replaced = true;
      break;
    }
  }
  if (!replaced) parts.push(suggestion);

  const newText = parts.join('').trim();
  if (!amountPart) return newText;
  return amountAtEnd ? `${newText} ${amountPart}` : `${amountPart} ${newText}`;
}
