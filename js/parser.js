/**
 * Парсинг свободного ввода: «кофе 250», «250 кофе», «1500»
 */
export function parseExpenseInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const amountMatch = trimmed.match(/(\d[\d\s]*)/);
  if (!amountMatch) return null;

  const amountStr = amountMatch[1].replace(/\s/g, '');
  const amount = parseInt(amountStr, 10);
  if (!amount || amount <= 0) return null;

  const description = trimmed
    .replace(amountMatch[0], '')
    .replace(/[₽руб\.]+/gi, '')
    .trim();

  return {
    description: description || '—',
    amount,
  };
}
