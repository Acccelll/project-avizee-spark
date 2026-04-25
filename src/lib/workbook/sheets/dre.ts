import ExcelJS from 'exceljs';
import { applyNumberFormat, FORMATS, getOrCreate, setColumnWidths, styleHeaderRow, styleTotalRow, COLORS } from '../styles';
import type { WorkbookRawData } from '../fetchWorkbookData';
import { monthLabel, monthRange, priorYearMonth, variation } from '../comparators';

/** Aba 01_DRE — DRE gerencial mensal com Real, PY, Budget e Δs. */
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

  // Index budget by competencia + categoria (sum over centros de custo)
  // Categoria mapping → DRE line:
  //   'receita'              → Receita Bruta
  //   'deducao'/'deducoes'   → Deduções
  //   'fopag'                → FOPAG
  //   'despesa'/'despesa_op' → Despesa Operacional
  const budgetMap: Record<string, Record<string, number>> = {};
  for (const b of data.budget) {
    const ym = b.competencia.slice(0, 7);
    const cat = b.categoria.toLowerCase();
    budgetMap[ym] ??= {};
    budgetMap[ym][cat] = (budgetMap[ym][cat] ?? 0) + b.valor;
  }
  const sumBudget = (ym: string, keys: string[]) =>
    keys.reduce((s, k) => s + (budgetMap[ym]?.[k] ?? 0), 0);

  const headers = ['Linha', ...months.map(monthLabel), 'Total Real', 'Total Budget', 'Δ vs Budget %', 'Δ vs PY %'];
  setColumnWidths(ws, [28, ...months.map(() => 14), 16, 16, 14, 12]);
  ws.addRow(headers);
  styleHeaderRow(ws, 1, headers.length);

  type Linha = {
    label: string;
    pick: (d?: WorkbookRawData['dre'][number]) => number;
    budgetKeys?: string[]; // categorias do budget que compõem esta linha (sinal já aplicado em pickBudget)
    pickBudget?: (ym: string) => number;
    bold?: boolean;
  };
  const linhas: Linha[] = [
    {
      label: 'Receita Bruta',
      pick: d => d?.receita_bruta ?? 0,
      pickBudget: ym => sumBudget(ym, ['receita']),
    },
    {
      label: '(−) Deduções',
      pick: d => -(d?.deducoes ?? 0),
      pickBudget: ym => -sumBudget(ym, ['deducao', 'deducoes']),
    },
    {
      label: 'Receita Líquida',
      pick: d => d?.receita_liquida ?? 0,
      pickBudget: ym => sumBudget(ym, ['receita']) - sumBudget(ym, ['deducao', 'deducoes']),
      bold: true,
    },
    {
      label: '(−) FOPAG',
      pick: d => -(d?.fopag ?? 0),
      pickBudget: ym => -sumBudget(ym, ['fopag']),
    },
    {
      label: '(−) Despesa Operacional',
      pick: d => -(d?.despesa_operacional ?? 0),
      pickBudget: ym => -sumBudget(ym, ['despesa', 'despesa_op', 'despesa_operacional']),
    },
    {
      label: 'EBITDA',
      pick: d => d?.ebitda ?? 0,
      pickBudget: ym =>
        sumBudget(ym, ['receita'])
        - sumBudget(ym, ['deducao', 'deducoes'])
        - sumBudget(ym, ['fopag'])
        - sumBudget(ym, ['despesa', 'despesa_op', 'despesa_operacional']),
      bold: true,
    },
  ];

  for (const ln of linhas) {
    const valores = months.map(m => ln.pick(dreByMonth[m]));
    const totalReal = valores.reduce((a, b) => a + b, 0);
    const totalBudget = ln.pickBudget ? months.reduce((s, m) => s + (ln.pickBudget!(m)), 0) : 0;
    const py = months.reduce((s, m) => s + ln.pick(dreByMonth[priorYearMonth(m)]), 0);
    const r = ws.addRow([
      ln.label,
      ...valores,
      totalReal,
      totalBudget,
      variation(totalReal, totalBudget),
      variation(totalReal, py),
    ]);
    if (ln.bold) {
      r.font = { bold: true };
      r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ACCENT_BG } }; });
    }
  }
  // Currency: cols 2 .. headers.length-2 (months + Total Real + Total Budget)
  for (let r = 2; r <= 7; r++) {
    applyNumberFormat(ws, r, 2, headers.length - 2, FORMATS.CURRENCY);
    // Δ vs Budget % and Δ vs PY %
    ws.getRow(r).getCell(headers.length - 1).numFmt = FORMATS.PCT;
    ws.getRow(r).getCell(headers.length).numFmt = FORMATS.PCT;
  }
  styleTotalRow(ws, 7, headers.length);

  if (months.length === 0 || data.dre.length === 0) {
    ws.addRow([]);
    ws.addRow(['Sem dados de DRE para o período selecionado.']);
    ws.getCell('A9').font = { italic: true, color: { argb: COLORS.MUTED } };
  }
}