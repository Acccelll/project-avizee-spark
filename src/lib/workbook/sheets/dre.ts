import ExcelJS from 'exceljs';
import { applyNumberFormat, FORMATS, getOrCreate, setColumnWidths, styleHeaderRow, styleTotalRow, COLORS } from '../styles';
import type { WorkbookRawData } from '../fetchWorkbookData';
import { monthLabel, monthRange, priorYearMonth, variation } from '../comparators';

/** Aba 01_DRE — DRE gerencial mensal com PY/Δ. */
export function buildDre(
  wb: ExcelJS.Workbook,
  data: WorkbookRawData,
  competenciaInicial: string,
  competenciaFinal: string,
): void {
  const ws = getOrCreate(wb, '01_DRE');
  const months = monthRange(competenciaInicial, competenciaFinal);
  const dreByMonth: Record<string, WorkbookRawData['dre'][number]> = {};
  for (const d of data.dre) dreByMonth[d.competencia] = d;

  const headers = ['Linha', ...months.map(monthLabel), 'Total', 'Δ vs PY %'];
  setColumnWidths(ws, [28, ...months.map(() => 14), 16, 12]);
  ws.addRow(headers);
  styleHeaderRow(ws, 1, headers.length);

  type Linha = { label: string; pick: (d?: WorkbookRawData['dre'][number]) => number; bold?: boolean };
  const linhas: Linha[] = [
    { label: 'Receita Bruta', pick: d => d?.receita_bruta ?? 0 },
    { label: '(−) Deduções', pick: d => -(d?.deducoes ?? 0) },
    { label: 'Receita Líquida', pick: d => d?.receita_liquida ?? 0, bold: true },
    { label: '(−) FOPAG', pick: d => -(d?.fopag ?? 0) },
    { label: '(−) Despesa Operacional', pick: d => -(d?.despesa_operacional ?? 0) },
    { label: 'EBITDA', pick: d => d?.ebitda ?? 0, bold: true },
  ];

  for (const ln of linhas) {
    const valores = months.map(m => ln.pick(dreByMonth[m]));
    const total = valores.reduce((a, b) => a + b, 0);
    const py = months.reduce((s, m) => s + ln.pick(dreByMonth[priorYearMonth(m)]), 0);
    const r = ws.addRow([ln.label, ...valores, total, variation(total, py)]);
    if (ln.bold) {
      r.font = { bold: true };
      r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ACCENT_BG } }; });
    }
  }
  applyNumberFormat(ws, 2, 2, headers.length - 1, FORMATS.CURRENCY);
  applyNumberFormat(ws, 3, 2, headers.length - 1, FORMATS.CURRENCY);
  applyNumberFormat(ws, 4, 2, headers.length - 1, FORMATS.CURRENCY);
  applyNumberFormat(ws, 5, 2, headers.length - 1, FORMATS.CURRENCY);
  applyNumberFormat(ws, 6, 2, headers.length - 1, FORMATS.CURRENCY);
  applyNumberFormat(ws, 7, 2, headers.length - 1, FORMATS.CURRENCY);
  for (let r = 2; r <= 7; r++) ws.getRow(r).getCell(headers.length).numFmt = FORMATS.PCT;
  styleTotalRow(ws, 7, headers.length);

  if (months.length === 0 || data.dre.length === 0) {
    ws.addRow([]);
    ws.addRow(['Sem dados de DRE para o período selecionado.']);
    ws.getCell('A9').font = { italic: true, color: { argb: COLORS.MUTED } };
  }
}