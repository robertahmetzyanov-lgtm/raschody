/** Основные категории и автоопределение по описанию */
import { loadCustomCategories } from './customCategories.js';

/** «Привычки» — отдельный блок «можно сэкономить» */
export const SAVINGS_CATEGORY_IDS = [
  'cigarettes',
  'coffee',
  'eating_out',
];

/** Обязательные платежи — отдельный блок «Долги» */
export const DEBT_CATEGORY_IDS = ['debts'];

/** Встроенные категории */
export const BUILTIN_CATEGORIES = [
  {
    id: 'groceries',
    name: 'Продукты',
    icon: '🛍️',
    savings: false,
    keywords: [
      'продукт', 'продукты', 'молоко', 'хлеб', 'мясо', 'рыба', 'овощ', 'фрукт', 'сыр',
      'колбас', 'крупа', 'макарон', 'масло', 'яйц', 'картоф', 'лук', 'морков',
      'перекресток', 'пятёрочка', 'пятерочка', 'магнит', 'ашан', 'лента', 'вкусвилл',
      'дикси', 'spar', 'metro', 'метро кэш', 'супермаркет', 'гипермаркет', 'продуктовый',
      'бакалея', 'кулинария', 'замороз', 'сок дом', 'вода питьевая', 'чай пакет',
      'сахар', 'соль', 'мука', 'йогурт', 'творог', 'сметан', 'кефир', 'банан',
      'яблок', 'помидор', 'огур', 'куриц', 'свинин', 'говядин',
    ],
  },
  {
    id: 'coffee',
    name: 'Кофе',
    icon: '☕',
    savings: true,
    keywords: [
      'кофе', 'coffee', 'латte', 'латте', 'cappuccino', 'капучино', 'americano',
      'америкano', 'раф', 'эспрессо', 'espresso', 'starbucks', 'cofix', 'surf coffee',
      'double b', 'шоколадница', 'кофейня', 'кофе с собой', 'cofe',
    ],
  },
  {
    id: 'eating_out',
    name: 'Еда вне дома',
    icon: '🍽️',
    savings: true,
    keywords: [
      'обед', 'завтрак', 'ужин', 'ресторан', 'кафе', 'пицца', 'бургер',
      'суши', 'ролл', 'перекус', 'столовая', 'блин', 'суп', 'салат', 'лапша',
      'доширак', 'макдонald', 'mcdonald', 'kfc', 'додо', 'dodo', 'burger king',
      'доставка еды', 'delivery', 'самокат еда', 'яндекс еда', 'обед в', 'ланч',
      'фастфуд', 'fast food', 'шаверма', 'шаурма', 'кебаб', 'doner', 'донер',
      'стритфуд', 'бизнес-ланч', 'меню', 'официант', 'обед в столовой',
    ],
  },
  {
    id: 'cigarettes',
    name: 'Сигареты',
    icon: '🚬',
    savings: true,
    keywords: [
      'сигарет', 'сиги', 'табак', 'стики', 'iqos', 'айкос', 'айqos', 'glo', 'глo',
      'вейп', 'vape', 'puff', 'pod', 'pod-систем', 'никотин', 'marlboro', 'мarlboro',
      'parliament', 'winston', 'camel', 'lucky strike', 'philip morris', 'kent',
      'ld', 'bond', 'next', 'chesterfield', 'sobranie', 'собрание', 'прима', 'yava',
      'tabacco', 'табач', 'курить', 'пачка сиг', 'стик',
    ],
  },
  {
    id: 'debts',
    name: 'Долги',
    icon: '🏦',
    savings: false,
    debt: true,
    keywords: [
      'ипотека', 'ипотеч', 'кредит', 'кредитн', 'займ', 'микрозайм', 'микрокредит',
      'рассрочк', 'loan', 'рефинанс', 'автокредит', 'потребительск',
      'платёж по кредит', 'платеж по кредит', 'погашение кредит', 'взнос по ипотек',
      'ежемесячный платёж банк', 'аннуитет', 'проценты по кредит',
    ],
  },
  {
    id: 'housing',
    name: 'Квартира',
    icon: '🏠',
    savings: false,
    keywords: [
      'аренда', 'жкх', 'коммунал', 'квартира', 'квартплата', 'электричество',
      'газ', 'вода', 'отопление', 'домофон', 'управляющая', 'ремонт квартир',
      'обои', 'плитка', 'сантехник',
      'мебель', 'диван', 'кровать', 'матрас', 'шкаф', 'стол', 'стул', 'комод',
      'тумба', 'кухонный гарнитур', 'гарнитур', 'полка', 'стеллаж', 'кресло',
      'тумбочка', 'журнальный стол', 'шифоньер', 'ikea', 'икеа', 'hoff', 'хофф',
      'leroy merlin', 'леруа',
      'техника', 'бытовая техника', 'быттехник', 'холодильник', 'морозилка',
      'стиральн', 'стиралка', 'посудомой', 'микроволнов', 'микроволновка',
      'плита', 'духовка', 'варочная', 'вытяжка', 'кондиционер', 'пылесос',
      'утюг', 'бойлер', 'водонагреватель', 'телевизор', 'tv', 'роутер',
      'dns', 'мвидео', 'эльдорадо', 'mvideo', 'citilink', 'ситилинк',
    ],
  },
  {
    id: 'clothing',
    name: 'Одежда',
    icon: '👕',
    savings: false,
    keywords: [
      'одежда', 'обувь', 'куртка', 'джинсы', 'футболка', 'рубашка', 'брюки', 'штаны',
      'платье', 'юбка', 'свитер', 'кофта', 'худи', 'пальто', 'пуховик', 'ветровка',
      'кроссовки', 'ботинки', 'сапоги', 'туфли', 'шлёпан', 'шлепан', 'сандал',
      'носки', 'бельё', 'белье', 'трусы', 'лифчик', 'шapка', 'шапка', 'шарф', 'перчатки',
      'сумка', 'рюкзак', 'ремень', 'костюм', 'пиджак', 'жилет',
      'lamoda', 'zara', 'uniqlo', 'reserved', 'ostin', 'остин',
      'gloria jeans', 'incity', 'befree', 'sela', 'oodji', 'оджи', 'cropp',
    ],
  },
  {
    id: 'transport',
    name: 'Транспорт',
    icon: '🚗',
    savings: false,
    keywords: [
      'такси', 'метро', 'автобус', 'трамвай', 'бензин', 'заправка', 'азс', 'топливо',
      'каршеринг', 'парковка', 'проезд', 'билет', 'электричка', 'uber', 'яндекс go',
      'ситимобил', 'самокат', 'велосипед', 'машина', 'авто', 'шиномонтаж', 'мойка',
      'гараж', 'тол', 'платная дорога',
    ],
  },
  {
    id: 'shopping',
    name: 'Покупки',
    icon: '🛒',
    savings: false,
    keywords: [
      'покупка', 'канцтовар', 'подарок', 'магазин', 'косметика', 'парфюм',
      'ozon', 'озон', 'wildberries', 'вайлдберриз', 'wb', 'aliexpress', 'али',
      'маркетплейс', 'яндекс маркет', 'yandex market',
      'сбермегамаркет', 'megamarket', 'avito доставка',
    ],
  },
  {
    id: 'health',
    name: 'Здоровье',
    icon: '💊',
    savings: false,
    keywords: [
      'аптека', 'врач', 'лекарств', 'таблетк', 'стоматолог', 'больница', 'анализ',
      'клиника', 'мед', 'поликлиник', 'оптика', 'линзы', 'очки', 'массаж', 'фитнес',
      'спортзал', 'абонемент зал',
    ],
  },
  {
    id: 'entertainment',
    name: 'Развлечения',
    icon: '🎬',
    savings: false,
    keywords: [
      'кино', 'театр', 'концерт', 'подписка', 'netflix', 'spotify', 'кинопоиск',
      'игр', 'steam', 'playstation', 'развлечен', 'бар', 'клуб', 'боулинг', 'бильярд',
      'книга', 'музей', 'выставка', 'отпуск', 'отель', 'гостиница', 'авиабилет',
      'самолёт', 'поезд', 'тур',
    ],
  },
  {
    id: 'other',
    name: 'Прочее',
    icon: '📋',
    savings: false,
    keywords: [],
  },
];

/** @deprecated используйте getAllCategories() */
export const CATEGORIES = BUILTIN_CATEGORIES;

export function getAllCategories() {
  return [...BUILTIN_CATEGORIES, ...loadCustomCategories()];
}

function getCategoryMap() {
  const map = Object.fromEntries(BUILTIN_CATEGORIES.map((c) => [c.id, c]));
  for (const cat of loadCustomCategories()) {
    map[cat.id] = cat;
  }
  return map;
}

/** Мебель и техника — всегда «Квартира», даже если куплено онлайн */
const HOUSING_ITEM_KEYWORDS = [
  'мебель', 'диван', 'кровать', 'матрас', 'шкаф', 'стол', 'стул', 'комод',
  'гарнитур', 'холодильник', 'стиральн', 'стиралка', 'посудомой', 'микроволнов',
  'плита', 'духовка', 'вытяжка', 'кондиционер', 'пылесос', 'утюг', 'бойлер',
  'водонагреватель', 'телевизор', 'ikea', 'икеа', 'dns', 'мвидео', 'эльдорадо',
  'бытовая техника', 'быттехник',
];

function isHousingItem(text) {
  return HOUSING_ITEM_KEYWORDS.some((kw) => text.includes(kw));
}

/** Одежда — всегда «Одежда», даже если куплено онлайн */
const CLOTHING_ITEM_KEYWORDS = [
  'одежда', 'обувь', 'куртка', 'джинсы', 'футболка', 'рубашка', 'брюки', 'штаны',
  'платье', 'юбка', 'свитер', 'кофта', 'худи', 'пальто', 'пуховик', 'ветровка',
  'кроссовки', 'ботинки', 'сапоги', 'туфли', 'шлепан', 'шлёпан', 'сандал',
  'носки', 'бельё', 'белье', 'трусы', 'лифчик', 'шапка', 'шарф', 'перчатки',
  'сумка', 'рюкзак', 'ремень', 'костюм', 'пиджак', 'жилет',
  'lamoda', 'zara', 'uniqlo', 'reserved', 'ostin', 'остин', 'gloria jeans',
  'incity', 'befree', 'sela', 'oodji', 'оджи', 'cropp',
];

function isClothingItem(text) {
  return CLOTHING_ITEM_KEYWORDS.some((kw) => text.includes(kw));
}

const LEGACY_CATEGORY_IDS = new Set(['food', 'marketplace']);

const savingsOrder = new Map(SAVINGS_CATEGORY_IDS.map((id, i) => [id, i]));

export function isSavingsCategory(id) {
  if (SAVINGS_CATEGORY_IDS.includes(id)) return true;
  const cat = getCategory(id);
  return Boolean(cat.custom && cat.savings);
}

export function isDebtCategory(id) {
  if (DEBT_CATEGORY_IDS.includes(id)) return true;
  const cat = getCategory(id);
  return Boolean(cat.custom && cat.debt);
}

export function getCategory(id) {
  const map = getCategoryMap();
  if (id === 'food') return map.groceries;
  if (id === 'marketplace') return map.shopping;
  return map[id] || map.other;
}

export function resolveCategoryId(storedId, description) {
  const detected = detectCategory(description);
  const map = getCategoryMap();

  if (!storedId || LEGACY_CATEGORY_IDS.has(storedId)) {
    if (storedId === 'marketplace') {
      if (detected === 'housing' || detected === 'clothing') return detected;
      return 'shopping';
    }
    return detected;
  }
  if (!map[storedId]) return detected;

  // Свои категории — не перезаписываем автоопределением
  if (storedId.startsWith('custom_')) return storedId;

  // Пересчёт после разделения категорий
  if (storedId === 'eating_out' && detected === 'coffee') return 'coffee';
  if (storedId === 'shopping' && detected === 'clothing') return 'clothing';
  if (storedId === 'eating_out' && detected === 'cigarettes') return 'cigarettes';
  if (storedId === 'housing' && detected === 'debts') return 'debts';
  if (storedId === 'shopping' && detected === 'housing') return 'housing';

  return storedId;
}

export function detectCategory(description) {
  const text = (description || '').toLowerCase().trim();
  if (!text || text === '—') return 'other';

  if (isHousingItem(text)) return 'housing';
  if (isClothingItem(text)) return 'clothing';

  let bestId = 'other';
  let bestLen = 0;

  for (const cat of getAllCategories()) {
    if (cat.id === 'other') continue;
    for (const kw of cat.keywords || []) {
      if (text.includes(kw) && kw.length > bestLen) {
        bestLen = kw.length;
        bestId = cat.id;
      }
    }
  }

  return bestId;
}

export function groupByCategory(expenses) {
  const groups = new Map();

  for (const cat of getAllCategories()) {
    groups.set(cat.id, { category: cat, items: [], total: 0 });
  }

  for (const expense of expenses) {
    const catId = resolveCategoryId(expense.categoryId, expense.description);
    const target = groups.get(catId) || groups.get('other');
    target.items.push({ ...expense, categoryId: catId });
    target.total += expense.amount;
  }

  return [...groups.values()]
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      ...g,
      items: g.items.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      ),
    }))
    .sort((a, b) => b.total - a.total);
}

/** Делит группы на «привычки», «долги» и остальное */
export function splitExpenseGroups(groups) {
  const savings = [];
  const debts = [];
  const regular = [];

  for (const g of groups) {
    if (isSavingsCategory(g.category.id)) savings.push(g);
    else if (isDebtCategory(g.category.id)) debts.push(g);
    else regular.push(g);
  }

  savings.sort(
    (a, b) =>
      (savingsOrder.get(a.category.id) ?? 99) -
      (savingsOrder.get(b.category.id) ?? 99),
  );

  const savingsTotal = savings.reduce((s, g) => s + g.total, 0);
  const debtsTotal = debts.reduce((s, g) => s + g.total, 0);
  return { savings, debts, regular, savingsTotal, debtsTotal };
}

/** @deprecated используйте splitExpenseGroups */
export function splitSavingsGroups(groups) {
  const { savings, regular, savingsTotal } = splitExpenseGroups(groups);
  return { savings, regular, savingsTotal };
}
