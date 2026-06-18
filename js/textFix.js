import { getAllCategories } from './categories.js';
import { loadCategoryRules } from './categoryRules.js';
import { parseExpenseInput } from './parser.js';

const EXTRA_WORDS = [
  'бензин', 'заправка', 'азс', 'топливо', 'продукты', 'обед', 'ужин', 'завтрак',
  'кофе', 'такси', 'метро', 'аптека', 'лекарства', 'одежда', 'обувь', 'подарок',
  'подписка', 'интернет', 'связь', 'мобильный', 'стрижка', 'маникюр', 'детский',
  'школа', 'садик', 'корм', 'ветеринар', 'аренда', 'коммуналка', 'ипотека',
  'молоко', 'хлеб', 'сигареты', 'сиги', 'пицца', 'суши', 'бургер', 'кино',
  'стоматолог', 'шиномонтаж', 'парковка', 'каршеринг', 'wildberries', 'ozon',
  'ремонт', 'квартира', 'квартиры', 'квартире', 'квартиру', 'квартир',
];

let dictionary = null;
let phrases = null;

function normalizeWord(word) {
  return (word || '').toLowerCase().replace(/[^a-zа-яё0-9-]/gi, '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i += 1) {
    const curr = [i + 1];
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr[j + 1] = Math.min(
        curr[j] + 1,
        prev[j + 1] + 1,
        prev[j] + cost,
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

function maxEditDistance(len) {
  if (len <= 3) return 1;
  if (len <= 6) return 2;
  return 3;
}

function isImeTruncatedWord(word, wordSet) {
  for (const other of wordSet) {
    if (other.length === word.length + 1 && other.slice(1) === word) {
      return true;
    }
  }
  return false;
}

function addKeywordTokens(raw, words, phraseSet) {
  const parts = String(raw || '')
    .toLowerCase()
    .split(/[\s,;·]+/)
    .map(normalizeWord)
    .filter((w) => w.length >= 2);

  if (parts.length > 1) {
    phraseSet.add(parts.join(' '));
  }
  for (const part of parts) {
    words.add(part);
  }
}

export function buildTextDictionary() {
  const words = new Set(EXTRA_WORDS);
  const phraseSet = new Set();

  for (const cat of getAllCategories()) {
    addKeywordTokens(cat.name, words, phraseSet);
    for (const kw of cat.keywords || []) {
      addKeywordTokens(kw, words, phraseSet);
    }
  }

  for (const key of Object.keys(loadCategoryRules())) {
    addKeywordTokens(key, words, phraseSet);
  }

  dictionary = [...words]
    .filter((w) => !isImeTruncatedWord(w, words))
    .sort((a, b) => b.length - a.length);

  phrases = [...phraseSet].sort((a, b) => b.length - a.length);
  return dictionary;
}

function getDictionary() {
  if (!dictionary) buildTextDictionary();
  return dictionary;
}

function getPhrases() {
  if (!phrases) buildTextDictionary();
  return phrases;
}

function pickBestMatch(lower, candidates) {
  return [...candidates].sort((a, b) => {
    const da = levenshtein(lower, a);
    const db = levenshtein(lower, b);
    if (da !== db) return da - db;
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b, 'ru');
  })[0];
}

function findFuzzyMatches(lower) {
  const dict = getDictionary();
  const maxDist = maxEditDistance(lower.length);
  const scored = [];

  for (const candidate of dict) {
    if (Math.abs(candidate.length - lower.length) > maxDist) continue;
    const dist = levenshtein(lower, candidate);
    if (dist > 0 && dist <= maxDist) {
      scored.push({ word: candidate, dist });
    }
  }

  scored.sort((a, b) => a.dist - b.dist || a.word.length - b.word.length);
  if (!scored.length) return [];

  const best = scored[0].dist;
  return scored.filter((s) => s.dist === best).map((s) => s.word);
}

export function fixWord(word) {
  const lower = normalizeWord(word);
  if (!lower || /^\d+$/.test(lower)) return word;
  if (lower.length < 2) return word;

  const dict = getDictionary();
  if (dict.includes(lower)) return lower;

  const dropFirst = dict.filter((w) => w.length === lower.length + 1 && w.slice(1) === lower);
  if (dropFirst.length) return pickBestMatch(lower, dropFirst);

  const prefixMatches = dict.filter((w) => w.startsWith(lower) && w.length > lower.length);
  if (prefixMatches.length === 1) return prefixMatches[0];

  const fuzzy = findFuzzyMatches(lower);
  if (fuzzy.length === 1) return fuzzy[0];
  if (fuzzy.length > 1) return pickBestMatch(lower, fuzzy);

  const sharedRoot = dict.filter(
    (w) => w.length >= lower.length && lower.length >= 3 && w.startsWith(lower.slice(0, 3)),
  );
  if (sharedRoot.length) {
    const close = sharedRoot
      .map((w) => ({ w, d: levenshtein(lower, w) }))
      .filter((x) => x.d <= maxEditDistance(lower.length))
      .sort((a, b) => a.d - b.d || a.w.length - b.w.length);
    if (close.length === 1) return close[0].w;
    if (close.length > 1 && close[1].d - close[0].d >= 1) return close[0].w;
  }

  return word;
}

function tryFixPhrase(text) {
  const rawWords = text.trim().split(/[\s,;·]+/).filter(Boolean);
  if (rawWords.length < 2) return null;

  for (const phrase of getPhrases()) {
    const targetWords = phrase.split(' ');
    if (targetWords.length !== rawWords.length) continue;

    const fixedWords = rawWords.map((raw, i) => fixWordToTarget(raw, targetWords[i]));
    if (fixedWords.every(Boolean)) {
      return fixedWords.join(' ');
    }
  }

  return null;
}

function fixWordToTarget(raw, target) {
  const lower = normalizeWord(raw);
  const goal = normalizeWord(target);
  if (!lower || !goal) return null;

  if (lower === goal) return goal;
  if (goal.length === lower.length + 1 && goal.slice(1) === lower) return goal;

  const dist = levenshtein(lower, goal);
  if (dist <= maxEditDistance(Math.max(lower.length, goal.length))) return goal;

  const viaFix = normalizeWord(fixWord(raw));
  if (viaFix === goal || levenshtein(viaFix, goal) <= 1) return goal;

  return null;
}

function fixTextWords(text) {
  if (!text) return text;

  const phraseFixed = tryFixPhrase(text);
  if (phraseFixed) return phraseFixed;

  return text
    .split(/([\s,;·]+)/)
    .map((token) => (/^[\s,;·]+$/.test(token) ? token : fixWord(token)))
    .join('');
}

/** Исправить описание траты (без суммы) */
export function fixExpenseDescription(description) {
  if (!description || description === '—') return description;
  return fixTextWords(description.trim());
}

/** Исправить строку ввода «слово сумма» */
export function fixExpenseInput(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return trimmed;

  const amountMatch = trimmed.match(/(\d[\d\s]*)/);
  if (!amountMatch) return fixTextWords(trimmed);

  const amountStr = amountMatch[0].replace(/\s/g, '');
  const amountPos = trimmed.indexOf(amountMatch[0]);
  const before = trimmed.slice(0, amountPos).replace(/[₽руб\.]+/gi, '').trim();
  const after = trimmed.slice(amountPos + amountMatch[0].length).replace(/[₽руб\.]+/gi, '').trim();

  const fixedBefore = fixTextWords(before);
  const fixedAfter = fixTextWords(after);

  if (fixedBefore && !fixedAfter) return `${fixedBefore} ${amountStr}`;
  if (!fixedBefore && fixedAfter) return `${amountStr} ${fixedAfter}`;
  if (fixedBefore && fixedAfter) return `${fixedBefore} ${amountStr} ${fixedAfter}`.trim();
  return amountStr;
}

export function getTypingWord(input) {
  const parsed = parseExpenseInput(fixExpenseInput(input));
  if (parsed?.description && parsed.description !== '—') {
    const parts = parsed.description.split(/[\s,;·]+/).filter(Boolean);
    return normalizeWord(parts[parts.length - 1] || '');
  }
  const trimmed = (input || '').trim();
  const withoutAmount = trimmed.replace(/(\d[\d\s]*)/g, ' ').replace(/[₽руб\.]+/gi, ' ').trim();
  const parts = withoutAmount.split(/[\s,;·]+/).filter(Boolean);
  return normalizeWord(parts[parts.length - 1] || '');
}

export function getWordSuggestions(prefix, limit = 5) {
  const needle = normalizeWord(prefix);
  if (needle.length < 2) return [];

  const dict = getDictionary();
  const exact = dict.filter((w) => w.startsWith(needle) && w !== needle);
  const dropFirst = dict.filter((w) => w.length === needle.length + 1 && w.slice(1) === needle);
  const fuzzy = findFuzzyMatches(needle).filter((w) => w !== needle);

  return [...new Set([...dropFirst, ...exact, ...fuzzy])].slice(0, limit);
}

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

/** @deprecated */
export const correctExpenseInput = fixExpenseInput;

export function refreshWordDictionary() {
  return buildTextDictionary();
}
