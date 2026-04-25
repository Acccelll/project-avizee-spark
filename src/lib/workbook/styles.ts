import ExcelJS from 'exceljs';

/** Visual paleta consistente com a Apresentação Gerencial. */
export const COLORS = {
  HEADER_BG: 'FF1F4E79',
  HEADER_FG: 'FFFFFFFF',
  ACCENT_BG: 'FFE7EEF7',
  POSITIVE: 'FF1B7F3A',
  NEGATIVE: 'FFB22222',
  MUTED: 'FF6B7280',
  KPI_BG: 'FFF2F5F9',
  COVER_BG: 'FF0F2A47',
  COVER_FG: 'FFFFFFFF',
} as const;

export const FORMATS = {
  CURRENCY: 'R$ #,##0.00;[Red](R$ #,##0.00);-',
  CURRENCY_K: '#,##0.0;[Red](#,##0.0);-',
  INT: '#,##0;[Red](#,##0);-',
  PCT: '0.0%;[Red](0.0%);-',
  DATE_BR: 'dd/mm/yyyy',
} as const;

export function styleHeaderRow(ws: ExcelJS.Worksheet, row: number, cols: number) {
  const r = ws.getRow(row);
  for (let c = 1; c <= cols; c++) {
    const cell = r.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.HEADER_BG } };
    cell.font = { bold: true, color: { argb: COLORS.HEADER_FG }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
  }
  r.height = 22;
}

export function styleTotalRow(ws: ExcelJS.Worksheet, row: number, cols: number) {
  const r = ws.getRow(row);
  for (let c = 1; c <= cols; c++) {
    const cell = r.getCell(c);
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ACCENT_BG } };
    cell.border = { top: { style: 'thin', color: { argb: 'FF999999' } } };
  }
}

export function applyNumberFormat(ws: ExcelJS.Worksheet, row: number, startCol: number, endCol: number, fmt: string) {
  const r = ws.getRow(row);
  for (let c = startCol; c <= endCol; c++) r.getCell(c).numFmt = fmt;
}

export function setColumnWidths(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
}

export function getOrCreate(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const existing = wb.getWorksheet(name);
  if (existing) {
    existing.spliceRows(1, existing.rowCount);
    return existing;
  }
  return wb.addWorksheet(name);
}