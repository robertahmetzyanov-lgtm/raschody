import { groupByCategory, getCategory } from './categories.js';
import { loadExpenses } from './store.js';

const CATEGORY_COLORS = {
  groceries: '#5A9A6E',
  coffee: '#D97706',
  eating_out: '#EA580C',
  cigarettes: '#78716C',
  debts: '#64748B',
  housing: '#2563EB',
  clothing: '#9333EA',
  transport: '#0891B2',
  shopping: '#DB2777',
  health: '#16A34A',
  entertainment: '#7C3AED',
  other: '#94A3B8',
};

const FALLBACK_COLORS = [
  '#5A9A6E', '#2563EB', '#D97706', '#DB2777', '#0891B2',
  '#9333EA', '#16A34A', '#EA580C', '#64748B', '#7C3AED',
];

const BAR_SEGMENTS = 20;

function colorForCategory(id, index) {
  if (CATEGORY_COLORS[id]) return CATEGORY_COLORS[id];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getYearExpenses(year) {
  return loadExpenses().filter((e) => new Date(e.createdAt).getFullYear() === year);
}

function buildAnnualStats(year) {
  const expenses = getYearExpenses(year);
  const groups = groupByCategory(expenses, true)
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total);
  const total = groups.reduce((s, g) => s + g.total, 0);
  return { year, groups, total };
}

function styleBlock(id, rules) {
  return `<Style ss:ID="${id}">${rules}</Style>`;
}

function buildStyles(groups) {
  const styles = [
    styleBlock('Default', '<Alignment ss:Vertical="Center"/>'),
    styleBlock('title', '<Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="14" ss:Color="#FFFFFF"/><Interior ss:Color="#5A9A6E" ss:Pattern="Solid"/>'),
    styleBlock('section', '<Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="12" ss:Color="#FFFFFF"/><Interior ss:Color="#2563EB" ss:Pattern="Solid"/>'),
    styleBlock('section2', '<Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:Bold="1" ss:Size="12" ss:Color="#FFFFFF"/><Interior ss:Color="#64748B" ss:Pattern="Solid"/>'),
    styleBlock('header', '<Font ss:Bold="1"/><Interior ss:Color="#E8ECE9" ss:Pattern="Solid"/>'),
    styleBlock('bold', '<Font ss:Bold="1"/>'),
    styleBlock('money', '<NumberFormat ss:Format="#,##0"/><Alignment ss:Horizontal="Right"/>'),
    styleBlock('pct', '<NumberFormat ss:Format="0%"/><Alignment ss:Horizontal="Center"/>'),
    styleBlock('bar_empty', '<Interior ss:Color="#F1F5F3" ss:Pattern="Solid"/>'),
  ];

  groups.forEach((g, i) => {
    const hex = colorForCategory(g.category.id, i).replace('#', '');
    styles.push(styleBlock(`cat_${i}`, `<Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#${hex}" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/>`));
    styles.push(styleBlock(`cat_val_${i}`, `<Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#${hex}" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0"/><Alignment ss:Horizontal="Right"/>`));
    styles.push(styleBlock(`cat_pct_${i}`, `<Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#${hex}" ss:Pattern="Solid"/><NumberFormat ss:Format="0.0%"/><Alignment ss:Horizontal="Center"/>`));
    styles.push(styleBlock(`bar_${i}`, `<Interior ss:Color="#${hex}" ss:Pattern="Solid"/>`));
  });

  return styles.join('\n');
}

function cell(value, styleId, type = 'String', mergeAcross = 0) {
  const merge = mergeAcross > 0 ? ` ss:MergeAcross="${mergeAcross}"` : '';
  const style = styleId ? ` ss:StyleID="${styleId}"` : '';
  return `<Cell${style}${merge}><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`;
}

function numCell(value, styleId, mergeAcross = 0) {
  const merge = mergeAcross > 0 ? ` ss:MergeAcross="${mergeAcross}"` : '';
  const style = styleId ? ` ss:StyleID="${styleId}"` : '';
  return `<Cell${style}${merge}><Data ss:Type="Number">${value}</Data></Cell>`;
}

function emptyRow(cols = 1) {
  return `<Row>${cell('', null)}</Row>`;
}

function buildSpreadsheetXml(stats) {
  const { year, groups, total } = stats;
  const mergeWide = BAR_SEGMENTS + 2;
  let rows = [];

  rows.push(`<Row ss:Height="28">${cell(`Расходы — ${year} год`, 'title', 'String', mergeWide)}</Row>`);
  rows.push(`<Row>${cell('Итого за год', 'bold')}${numCell(total, 'money')}</Row>`);
  rows.push(emptyRow());

  const statHeaders = ['Категория', 'Сумма, ₽', '%'];
  rows.push(`<Row>${statHeaders.map((h) => cell(h, 'header')).join('')}${Array(BAR_SEGMENTS).fill(cell('', 'header')).join('')}</Row>`);

  if (!groups.length) {
    rows.push(`<Row>${cell(`Нет трат за ${year} год`, null, 'String', mergeWide)}</Row>`);
  }

  groups.forEach((g, i) => {
    const pct = total > 0 ? Math.round((g.total / total) * 100) : 0;
    const filled = Math.max(0, Math.min(BAR_SEGMENTS, Math.round(pct / (100 / BAR_SEGMENTS))));
    let barCells = '';
    for (let b = 0; b < BAR_SEGMENTS; b++) {
      barCells += cell(b < filled ? '█' : '', b < filled ? `bar_${i}` : 'bar_empty');
    }
    rows.push(
      `<Row>${cell(`${g.category.icon} ${g.category.name}`)}${numCell(g.total, 'money')}${numCell(pct / 100, 'pct')}${barCells}</Row>`,
    );
  });

  rows.push(emptyRow());
  rows.push(`<Row ss:Height="24">${cell('Диаграмма по категориям', 'section', 'String', 4)}</Row>`);
  rows.push(`<Row>${['Категория', 'Сумма, ₽', 'Доля, %'].map((h) => cell(h, 'header')).join('')}${cell('', 'header')}</Row>`);

  groups.forEach((g, i) => {
    const pct = total > 0 ? g.total / total : 0;
    rows.push(
      `<Row>${cell(`${g.category.icon} ${g.category.name}`, `cat_${i}`)}${numCell(g.total, `cat_val_${i}`)}${numCell(pct, `cat_pct_${i}`)}</Row>`,
    );
  });

  rows.push(emptyRow());
  rows.push(`<Row ss:Height="24">${cell('Все траты', 'section2', 'String', 4)}</Row>`);
  rows.push(`<Row>${['Дата', 'Время', 'Категория', 'Описание', 'Сумма, ₽'].map((h) => cell(h, 'header')).join('')}</Row>`);

  const expenses = [...loadExpenses()].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  for (const e of expenses) {
    const d = new Date(e.createdAt);
    const cat = getCategory(e.categoryId);
    rows.push(
      `<Row>${cell(d.toLocaleDateString('ru-RU'))}${cell(d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))}${cell(`${cat.icon} ${cat.name}`)}${cell(e.description)}${numCell(e.amount, 'money')}</Row>`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
${buildStyles(groups)}
</Styles>
<Worksheet ss:Name="Отчёт">
<Table>
<Column ss:Width="140"/>
<Column ss:Width="90"/>
<Column ss:Width="120"/>
<Column ss:Width="180"/>
<Column ss:Width="90"/>
${Array(BAR_SEGMENTS).fill('<Column ss:Width="18"/>').join('\n')}
${rows.join('\n')}
</Table>
</Worksheet>
</Workbook>`;
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Pro: один Excel-файл — статистика, цветная диаграмма и все траты */
export function exportProData() {
  const year = new Date().getFullYear();
  const stats = buildAnnualStats(year);
  const stamp = new Date().toISOString().slice(0, 10);
  const xml = buildSpreadsheetXml(stats);

  downloadBlob(
    xml,
    `raschody_${year}_${stamp}.xls`,
    'application/vnd.ms-excel;charset=utf-8',
  );
}
