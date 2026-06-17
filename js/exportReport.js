import { groupByCategory, resolveCategoryId, splitExpenseGroups } from './categories.js';
import { loadExpenses } from './store.js';
import { formatMoney } from './format.js';

const PAGE_W = 842;
const PAGE_H = 595;
const SCALE = 2;
const CANVAS_W = PAGE_W * SCALE;
const CANVAS_H = PAGE_H * SCALE;

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

const COLORS = {
  bg: '#FFFFFF',
  title: '#5A9A6E',
  section: '#2563EB',
  text: '#1E293B',
  muted: '#64748B',
  line: '#E2E8F0',
  totalBg: '#F0FDF4',
  totalBorder: '#5A9A6E',
  savingsBg: '#FFF7ED',
  savingsBorder: '#D97706',
  debtsBg: '#F1F5F9',
  debtsBorder: '#64748B',
  rowAlt: '#F8FAFC',
  headerBg: '#E8ECE9',
};

function colorForCategory(id, index) {
  return CATEGORY_COLORS[id] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function monthName(monthIndex, year) {
  const s = new Date(year, monthIndex, 1).toLocaleDateString('ru-RU', { month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function shortMonthName(monthIndex) {
  return new Date(2024, monthIndex, 1).toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');
}

function getYearExpenses(year) {
  return loadExpenses().filter((e) => new Date(e.createdAt).getFullYear() === year);
}

function buildMonthlyTotals(year, expenses) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    index: i,
    name: monthName(i, year),
    shortName: shortMonthName(i),
    total: 0,
  }));
  for (const e of expenses) {
    const d = new Date(e.createdAt);
    months[d.getMonth()].total += e.amount;
  }
  return months;
}

function buildMonthlyCategoryMatrix(year, expenses, groups) {
  const categories = groups.map((g) => g.category);
  const catIds = categories.map((c) => c.id);
  const rows = Array.from({ length: 12 }, (_, i) => ({
    monthIndex: i,
    name: monthName(i, year),
    shortName: shortMonthName(i),
    byCategory: Object.fromEntries(catIds.map((id) => [id, 0])),
    total: 0,
  }));

  for (const e of expenses) {
    const d = new Date(e.createdAt);
    if (d.getFullYear() !== year) continue;
    const catId = resolveCategoryId(e.categoryId, e.description, true);
    const key = catIds.includes(catId) ? catId : 'other';
    rows[d.getMonth()].byCategory[key] = (rows[d.getMonth()].byCategory[key] || 0) + e.amount;
    rows[d.getMonth()].total += e.amount;
  }

  const colTotals = Object.fromEntries(catIds.map((id) => [id, 0]));
  for (const row of rows) {
    for (const id of catIds) {
      colTotals[id] += row.byCategory[id] || 0;
    }
  }

  return { categories, rows, colTotals };
}

function buildAnnualStats(year) {
  const expenses = getYearExpenses(year);
  const groups = groupByCategory(expenses, true)
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total);
  const total = groups.reduce((s, g) => s + g.total, 0);
  const months = buildMonthlyTotals(year, expenses);
  const matrix = buildMonthlyCategoryMatrix(year, expenses, groups);
  const { savings, debts, savingsTotal, debtsTotal } = splitExpenseGroups(groups);
  return {
    year, groups, total, months, expenses, matrix,
    savingsTotal, debtsTotal, savingsGroups: savings, debtGroups: debts,
  };
}

function createPageCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  return { canvas, ctx };
}

function setFont(ctx, size, weight = 'normal') {
  ctx.font = `${weight} ${size * SCALE}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
}

function drawRoundedRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1 * SCALE;
    ctx.stroke();
  }
}

function drawPieChart(ctx, cx, cy, radius, groups, total) {
  if (!total || !groups.length) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#E2E8F0';
    ctx.fill();
    setFont(ctx, 14);
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'center';
    ctx.fillText('Нет данных', cx, cy + 5 * SCALE);
    return;
  }

  let start = -Math.PI / 2;
  groups.forEach((g, i) => {
    const slice = (g.total / total) * Math.PI * 2;
    if (slice <= 0) return;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = colorForCategory(g.category.id, i);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2 * SCALE;
    ctx.stroke();

    if (slice > 0.12) {
      const mid = start + slice / 2;
      const lx = cx + Math.cos(mid) * radius * 0.62;
      const ly = cy + Math.sin(mid) * radius * 0.62;
      const pct = Math.round((g.total / total) * 100);
      setFont(ctx, 11, 'bold');
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(`${pct}%`, lx, ly + 4 * SCALE);
    }
    start += slice;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.bg;
  ctx.fill();
}

function drawPageFooter(ctx, text, pageNum, pageTotal) {
  setFont(ctx, 9);
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = 'center';
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H - 16 * SCALE);
  if (pageTotal > 1) {
    ctx.textAlign = 'right';
    ctx.fillText(`${pageNum} / ${pageTotal}`, CANVAS_W - 28 * SCALE, CANVAS_H - 16 * SCALE);
  }
}

function drawStatBox(ctx, x, y, w, h, label, amount, pctText, bg, border, accent) {
  drawRoundedRect(ctx, x, y, w, h, 6 * SCALE, bg, border);
  setFont(ctx, 9);
  ctx.fillStyle = COLORS.muted;
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 8 * SCALE, y + 16 * SCALE);
  setFont(ctx, 13, 'bold');
  ctx.fillStyle = accent;
  ctx.fillText(formatMoney(amount), x + 8 * SCALE, y + 34 * SCALE);
  if (pctText) {
    setFont(ctx, 8);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(pctText, x + 8 * SCALE, y + 48 * SCALE);
  }
}

function renderSummaryPage(stats, stamp, pageNum, pageTotal) {
  const { year, groups, total, months, savingsTotal, debtsTotal } = stats;
  const { canvas, ctx } = createPageCanvas();
  const pad = 28 * SCALE;
  const leftW = Math.round(CANVAS_W * 0.42);
  const rightX = pad + leftW + 20 * SCALE;
  const rightW = CANVAS_W - rightX - pad;
  let y = pad;

  drawRoundedRect(ctx, pad, y, CANVAS_W - pad * 2, 44 * SCALE, 8 * SCALE, COLORS.title);
  setFont(ctx, 18, 'bold');
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(`Расходы — ${year} год`, CANVAS_W / 2, y + 30 * SCALE);
  y += 44 * SCALE + 18 * SCALE;

  const statsW = leftW - pad;
  const gap = 8 * SCALE;
  const boxW = (statsW - gap * 2) / 3;
  const boxH = 54 * SCALE;
  const pct = (part) => (total > 0 ? `${Math.round((part / total) * 100)}% трат` : null);

  drawStatBox(ctx, pad, y, boxW, boxH, 'Итого за год', total, null, COLORS.totalBg, COLORS.totalBorder, COLORS.title);
  drawStatBox(ctx, pad + boxW + gap, y, boxW, boxH, 'Можно сэкономить', savingsTotal, pct(savingsTotal), COLORS.savingsBg, COLORS.savingsBorder, COLORS.savingsBorder);
  drawStatBox(ctx, pad + (boxW + gap) * 2, y, boxW, boxH, 'Долги', debtsTotal, pct(debtsTotal), COLORS.debtsBg, COLORS.debtsBorder, COLORS.debtsBorder);
  y += boxH + 14 * SCALE;

  setFont(ctx, 13, 'bold');
  ctx.fillStyle = COLORS.section;
  ctx.textAlign = 'left';
  ctx.fillText('По месяцам', pad, y + 16 * SCALE);
  y += 24 * SCALE;

  const tableW = leftW - pad;
  const colMonth = pad + 10 * SCALE;
  const colSum = pad + tableW - 10 * SCALE;
  const rowH = 22 * SCALE;

  drawRoundedRect(ctx, pad, y, tableW, rowH, 4 * SCALE, COLORS.headerBg);
  setFont(ctx, 10, 'bold');
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'left';
  ctx.fillText('Месяц', colMonth, y + 16 * SCALE);
  ctx.textAlign = 'right';
  ctx.fillText('Сумма', colSum, y + 16 * SCALE);
  y += rowH;

  months.forEach((m, i) => {
    if (i % 2 === 1) {
      ctx.fillStyle = COLORS.rowAlt;
      ctx.fillRect(pad, y, tableW, rowH);
    }
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, y + rowH);
    ctx.lineTo(pad + tableW, y + rowH);
    ctx.stroke();

    setFont(ctx, 10, m.total > 0 ? 'bold' : 'normal');
    ctx.fillStyle = m.total > 0 ? COLORS.text : COLORS.muted;
    ctx.textAlign = 'left';
    ctx.fillText(m.shortName, colMonth, y + 16 * SCALE);
    ctx.textAlign = 'right';
    ctx.fillText(formatMoney(m.total), colSum, y + 16 * SCALE);
    y += rowH;
  });

  setFont(ctx, 13, 'bold');
  ctx.fillStyle = COLORS.section;
  ctx.textAlign = 'left';
  ctx.fillText('По категориям', rightX, pad + 62 * SCALE);

  const chartCx = rightX + rightW * 0.28;
  const chartCy = pad + 200 * SCALE;
  const chartR = 88 * SCALE;
  drawPieChart(ctx, chartCx, chartCy, chartR, groups, total);

  let legendY = pad + 78 * SCALE;
  const legendX = rightX + rightW * 0.62;
  const legendW = rightX + rightW - legendX;

  if (!groups.length) {
    setFont(ctx, 11);
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'left';
    ctx.fillText('Нет трат за год', legendX, legendY);
  } else {
    groups.forEach((g, i) => {
      const pct = total > 0 ? ((g.total / total) * 100).toFixed(1) : '0.0';
      const color = colorForCategory(g.category.id, i);

      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY, 12 * SCALE, 12 * SCALE);

      setFont(ctx, 11, 'bold');
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = 'left';
      ctx.fillText(g.category.name, legendX + 18 * SCALE, legendY + 11 * SCALE);

      setFont(ctx, 10);
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = 'right';
      ctx.fillText(`${pct}%`, legendX + legendW, legendY + 11 * SCALE);

      const share = total > 0 ? g.total / total : 0;
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(legendX + 18 * SCALE, legendY + 16 * SCALE, legendW - 18 * SCALE, 5 * SCALE);
      ctx.fillStyle = color;
      ctx.fillRect(legendX + 18 * SCALE, legendY + 16 * SCALE, (legendW - 18 * SCALE) * share, 5 * SCALE);

      setFont(ctx, 9);
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = 'left';
      ctx.fillText(formatMoney(g.total), legendX + 18 * SCALE, legendY + 28 * SCALE);

      legendY += 32 * SCALE;
    });
  }

  drawPageFooter(ctx, `Сформировано: ${stamp}`, pageNum, pageTotal);
  return canvas;
}

function catColorIndex(stats, catId) {
  const idx = stats.groups.findIndex((g) => g.category.id === catId);
  return idx >= 0 ? idx : 0;
}

function formatCellAmount(value) {
  if (!value) return '—';
  if (value >= 1000) {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
  }
  return String(value);
}

function splitCategoriesForPages(categories, maxCols) {
  if (categories.length <= maxCols) return [categories];
  const chunks = [];
  for (let i = 0; i < categories.length; i += maxCols) {
    chunks.push(categories.slice(i, i + maxCols));
  }
  return chunks;
}

function renderDetailPage(stats, stamp, categories, pageNum, pageTotal, partLabel) {
  const { year, matrix, total } = stats;
  const { rows, colTotals } = matrix;
  const { canvas, ctx } = createPageCanvas();
  const pad = 24 * SCALE;
  let y = pad;

  drawRoundedRect(ctx, pad, y, CANVAS_W - pad * 2, 40 * SCALE, 8 * SCALE, COLORS.section);
  setFont(ctx, 15, 'bold');
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  const title = partLabel
    ? `Расшифровка по категориям — ${partLabel}`
    : 'Расшифровка по категориям';
  ctx.fillText(title, CANVAS_W / 2, y + 27 * SCALE);
  y += 40 * SCALE + 14 * SCALE;

  const tableW = CANVAS_W - pad * 2;
  const monthColW = 72 * SCALE;
  const totalColW = 68 * SCALE;
  const catCount = categories.length;
  const catColW = catCount > 0 ? (tableW - monthColW - totalColW) / catCount : 0;
  const rowH = 26 * SCALE;
  const headerH = 52 * SCALE;

  ctx.fillStyle = COLORS.headerBg;
  ctx.fillRect(pad, y, tableW, headerH);

  setFont(ctx, 9, 'bold');
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'left';
  ctx.fillText('Месяц', pad + 8 * SCALE, y + 20 * SCALE);

  categories.forEach((cat, i) => {
    const cx = pad + monthColW + catColW * i + catColW / 2;
    const color = colorForCategory(cat.id, catColorIndex(stats, cat.id));
    ctx.fillStyle = color;
    ctx.fillRect(cx - catColW / 2 + 4 * SCALE, y + 6 * SCALE, 8 * SCALE, 8 * SCALE);
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    const label = cat.name.length > 9 ? `${cat.name.slice(0, 8)}…` : cat.name;
    setFont(ctx, 8, 'bold');
    ctx.fillText(label, cx, y + 24 * SCALE);
    const share = total > 0 ? ((colTotals[cat.id] / total) * 100).toFixed(0) : '0';
    setFont(ctx, 8);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`${share}%`, cx, y + 38 * SCALE);
  });

  const totalX = pad + monthColW + catColW * catCount + totalColW / 2;
  setFont(ctx, 9, 'bold');
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';
  ctx.fillText('Итого', totalX, y + 28 * SCALE);
  y += headerH;

  rows.forEach((row, ri) => {
    if (ri % 2 === 1) {
      ctx.fillStyle = COLORS.rowAlt;
      ctx.fillRect(pad, y, tableW, rowH);
    }
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, y + rowH);
    ctx.lineTo(pad + tableW, y + rowH);
    ctx.stroke();

    setFont(ctx, 9, row.total > 0 ? 'bold' : 'normal');
    ctx.fillStyle = row.total > 0 ? COLORS.text : COLORS.muted;
    ctx.textAlign = 'left';
    ctx.fillText(row.shortName, pad + 8 * SCALE, y + 17 * SCALE);

    categories.forEach((cat, ci) => {
      const val = row.byCategory[cat.id] || 0;
      const cx = pad + monthColW + catColW * ci + catColW / 2;
      setFont(ctx, 9, val > 0 ? 'bold' : 'normal');
      ctx.fillStyle = val > 0 ? COLORS.text : COLORS.muted;
      ctx.textAlign = 'center';
      ctx.fillText(formatCellAmount(val), cx, y + 17 * SCALE);
    });

    setFont(ctx, 9, row.total > 0 ? 'bold' : 'normal');
    ctx.fillStyle = row.total > 0 ? COLORS.title : COLORS.muted;
    ctx.textAlign = 'center';
    ctx.fillText(formatCellAmount(row.total), totalX, y + 17 * SCALE);
    y += rowH;
  });

  ctx.fillStyle = COLORS.headerBg;
  ctx.fillRect(pad, y, tableW, rowH);
  setFont(ctx, 9, 'bold');
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'left';
  ctx.fillText('За год', pad + 8 * SCALE, y + 17 * SCALE);

  categories.forEach((cat, ci) => {
    const val = colTotals[cat.id] || 0;
    const cx = pad + monthColW + catColW * ci + catColW / 2;
    ctx.textAlign = 'center';
    ctx.fillText(formatCellAmount(val), cx, y + 17 * SCALE);
  });

  ctx.fillStyle = COLORS.title;
  ctx.textAlign = 'center';
  ctx.fillText(formatCellAmount(total), totalX, y + 17 * SCALE);

  drawPageFooter(ctx, `Сформировано: ${stamp} · ${year} год`, pageNum, pageTotal);
  return canvas;
}

function concatBytes(chunks) {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

function buildPdfFromJpegPages(pages) {
  const enc = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let byteOffset = 0;

  function pushStr(s) {
    const b = enc.encode(s);
    chunks.push(b);
    byteOffset += b.length;
  }

  function pushBytes(b) {
    chunks.push(b);
    byteOffset += b.length;
  }

  function markObj(n) {
    offsets[n] = byteOffset;
  }

  const pageCount = pages.length;
  const pageObjStart = 3;
  const imgObjStart = pageObjStart + pageCount;
  const contentObjStart = imgObjStart + pageCount;
  const totalObjs = 2 + pageCount * 3;

  pushStr('%PDF-1.4\n');

  markObj(1);
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const kids = Array.from({ length: pageCount }, (_, i) => `${pageObjStart + i} 0 R`).join(' ');
  markObj(2);
  pushStr(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`);

  for (let i = 0; i < pageCount; i++) {
    const { jpeg, w, h, pdfW, pdfH } = pages[i];
    const pageObj = pageObjStart + i;
    const imgObj = imgObjStart + i;
    const contentObj = contentObjStart + i;

    markObj(pageObj);
    pushStr(
      `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfW.toFixed(2)} ${pdfH.toFixed(2)}] `
      + `/Resources << /XObject << /Im${i} ${imgObj} 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj\n`,
    );

    markObj(imgObj);
    pushStr(
      `${imgObj} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} `
      + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    );
    pushBytes(jpeg);
    pushStr('\nendstream\nendobj\n');

    const stream = `q ${pdfW.toFixed(2)} 0 0 ${pdfH.toFixed(2)} 0 0 cm /Im${i} Do Q\n`;
    markObj(contentObj);
    pushStr(`${contentObj} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);
  }

  const xrefPos = byteOffset;
  pushStr(`xref\n0 ${totalObjs + 1}\n`);
  pushStr('0000000000 65535 f \n');
  for (let i = 1; i <= totalObjs; i++) {
    const off = String(offsets[i] || 0).padStart(10, '0');
    pushStr(`${off} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  return new Blob([concatBytes(chunks)], { type: 'application/pdf' });
}

async function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Не удалось создать изображение отчёта'));
          return;
        }
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
      },
      'image/jpeg',
      0.92,
    );
  });
}

async function canvasesToPdfBlob(canvases) {
  const pages = [];
  for (const canvas of canvases) {
    const jpeg = await canvasToJpeg(canvas);
    pages.push({
      jpeg,
      w: canvas.width,
      h: canvas.height,
      pdfW: PAGE_W,
      pdfH: PAGE_H,
    });
  }
  return buildPdfFromJpegPages(pages);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Pro: PDF — сводка на 1-й странице, расшифровка по месяцам и категориям далее */
export async function exportProData() {
  const year = new Date().getFullYear();
  const stats = buildAnnualStats(year);
  const stamp = new Date().toLocaleString('ru-RU');

  const categoryChunks = stats.groups.length
    ? splitCategoriesForPages(stats.groups.map((g) => g.category), 10)
    : [];

  const pageTotal = 1 + categoryChunks.length;
  const canvases = [
    renderSummaryPage(stats, stamp, 1, pageTotal),
  ];

  categoryChunks.forEach((cats, i) => {
    const partLabel = categoryChunks.length > 1 ? `часть ${i + 1}` : null;
    canvases.push(
      renderDetailPage(stats, stamp, cats, i + 2, pageTotal, partLabel),
    );
  });

  const blob = await canvasesToPdfBlob(canvases);
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `raschody_${year}_${dateStamp}.pdf`);
}
