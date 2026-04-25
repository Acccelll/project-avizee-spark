import ExcelJS from 'exceljs';
import { applyNumberFormat, FORMATS, getOrCreate, setColumnWidths, styleHeaderRow, styleTotalRow, COLORS, addDataBar } from '../styles';
import type { WorkbookRawData } from '../fetchWorkbookData';
import { monthLabel, monthRange } from '../comparators';

function emptyMessage(ws: ExcelJS.Worksheet, msg: string) {
  ws.addRow([]);
  ws.addRow([msg]);
  ws.getCell(`A${ws.rowCount}`).font = { italic: true, color: { argb: COLORS.MUTED } };
}

/** Aba 09_Vendas_Vendedor — ranking + ticket médio. */
export function buildVendasVendedor(wb: ExcelJS.Workbook, data: WorkbookRawData): void {
  const ws = getOrCreate(wb, '09_Vendas_Vendedor');
  const headers = ['Vendedor', 'Pedidos', 'Faturamento', 'Ticket Médio'];
  setColumnWidths(ws, [32, 12, 18, 18]);
  ws.addRow(headers);
  styleHeaderRow(ws, 1, headers.length);

  // agrega por vendedor (somando todos os meses)
  const map: Record<string, { qtd: number; fat: number }> = {};
  for (const v of data.vendasVendedor) {
    if (!map[v.vendedor_nome]) map[v.vendedor_nome] = { qtd: 0, fat: 0 };
    map[v.vendedor_nome].qtd += v.qtd_pedidos;
    map[v.vendedor_nome].fat += v.faturamento;
  }
  const linhas = Object.entries(map).sort((a, b) => b[1].fat - a[1].fat);
  for (const [nome, agg] of linhas) {
    ws.addRow([nome, agg.qtd, agg.fat, agg.qtd ? agg.fat / agg.qtd : 0]);
  }
  if (linhas.length === 0) emptyMessage(ws, 'Sem vendas registradas no período.');
  else {
    applyNumberFormat(ws, 2, 2, 2, FORMATS.INT);
    for (let r = 2; r <= ws.rowCount; r++) {
      ws.getRow(r).getCell(2).numFmt = FORMATS.INT;
      ws.getRow(r).getCell(3).numFmt = FORMATS.CURRENCY;
      ws.getRow(r).getCell(4).numFmt = FORMATS.CURRENCY;
    }
    const totQtd = linhas.reduce((s, [, v]) => s + v.qtd, 0);
    const totFat = linhas.reduce((s, [, v]) => s + v.fat, 0);
    ws.addRow(['TOTAL', totQtd, totFat, totQtd ? totFat / totQtd : 0]);
    styleTotalRow(ws, ws.rowCount, headers.length);
    ws.getRow(ws.rowCount).getCell(2).numFmt = FORMATS.INT;
    ws.getRow(ws.rowCount).getCell(3).numFmt = FORMATS.CURRENCY;
    ws.getRow(ws.rowCount).getCell(4).numFmt = FORMATS.CURRENCY;
  }
  // Data bar no faturamento (excluindo linha TOTAL)
  if (linhas.length > 1) addDataBar(ws, `C2:C${ws.rowCount - 1}`, COLORS.HEADER_BG);
}

/** Aba 10_Vendas_Cliente_ABC — top 50 com curva ABC. */
export function buildVendasClienteAbc(wb: ExcelJS.Workbook, data: WorkbookRawData): void {
  const ws = getOrCreate(wb, '10_Vendas_Cliente_ABC');
  const headers = ['Cliente', 'NFs', 'Faturamento', 'Participação %', 'Acumulado %', 'Curva'];
  setColumnWidths(ws, [40, 10, 18, 14, 14, 8]);
  ws.addRow(headers);
  styleHeaderRow(ws, 1, headers.length);
  for (const c of data.vendasClienteAbc) {
    ws.addRow([c.cliente_nome, c.qtd_nfs, c.faturamento, c.participacao / 100, c.participacao_acum / 100, c.curva_abc]);
  }
  if (data.vendasClienteAbc.length === 0) emptyMessage(ws, 'Sem clientes faturados no período.');
  else {
    for (let r = 2; r <= ws.rowCount; r++) {
      ws.getRow(r).getCell(2).numFmt = FORMATS.INT;
      ws.getRow(r).getCell(3).numFmt = FORMATS.CURRENCY;
      ws.getRow(r).getCell(4).numFmt = FORMATS.PCT;
      ws.getRow(r).getCell(5).numFmt = FORMATS.PCT;
    }
    addDataBar(ws, `C2:C${ws.rowCount}`, COLORS.HEADER_BG);
    addDataBar(ws, `E2:E${ws.rowCount}`, COLORS.POSITIVE);
  }
}

/** Aba 11_Vendas_Regiao — agregado por UF + matriz mês. */
export function buildVendasRegiao(wb: ExcelJS.Workbook, data: WorkbookRawData, ini: string, fim: string): void {
  const ws = getOrCreate(wb, '11_Vendas_Regiao');
  const months = monthRange(ini, fim);
  const headers = ['UF', ...months.map(monthLabel), 'Total', 'NFs'];
  setColumnWidths(ws, [6, ...months.map(() => 12), 14, 8]);
  ws.addRow(headers);
  styleHeaderRow(ws, 1, headers.length);

  const ufMap: Record<string, { meses: Record<string, number>; nfs: number }> = {};
  for (const v of data.vendasRegiao) {
    if (!ufMap[v.uf]) ufMap[v.uf] = { meses: {}, nfs: 0 };
    ufMap[v.uf].meses[v.competencia] = (ufMap[v.uf].meses[v.competencia] ?? 0) + v.faturamento;
    ufMap[v.uf].nfs += v.qtd_nfs;
  }
  const ufs = Object.entries(ufMap).sort((a, b) => {
    const sa = Object.values(a[1].meses).reduce((s, x) => s + x, 0);
    const sb = Object.values(b[1].meses).reduce((s, x) => s + x, 0);
    return sb - sa;
  });
  for (const [uf, agg] of ufs) {
    const vals = months.map(m => agg.meses[m] ?? 0);
    ws.addRow([uf, ...vals, vals.reduce((a, b) => a + b, 0), agg.nfs]);
  }
  if (ufs.length === 0) emptyMessage(ws, 'Sem vendas regionais no período.');
  else {
    for (let r = 2; r <= ws.rowCount; r++) {
      applyNumberFormat(ws, r, 2, headers.length - 1, FORMATS.CURRENCY);
      ws.getRow(r).getCell(headers.length).numFmt = FORMATS.INT;
    }
  }
}

/** Aba 12_Orcamentos_Funil. */
export function buildOrcamentosFunil(wb: ExcelJS.Workbook, data: WorkbookRawData, ini: string, fim: string): void {
  const ws = getOrCreate(wb, '12_Orcamentos_Funil');
  const months = monthRange(ini, fim);
  const headers = ['Mês', 'Abertos', 'Aprovados', 'Perdidos', 'Total', 'Conv. %', 'Valor Aprovado', 'Valor Total'];
  setColumnWidths(ws, [12, 10, 10, 10, 10, 10, 18, 18]);
  ws.addRow(headers);
  styleHeaderRow(ws, 1, headers.length);

  const map: Record<string, WorkbookRawData['orcamentosFunil'][number]> = {};
  for (const o of data.orcamentosFunil) map[o.competencia] = o;

  for (const m of months) {
    const o = map[m];
    const total = o?.total ?? 0;
    const conv = total ? (o?.aprovados ?? 0) / total : 0;
    ws.addRow([
      monthLabel(m),
      o?.abertos ?? 0,
      o?.aprovados ?? 0,
      o?.perdidos ?? 0,
      total,
      conv,
      o?.valor_aprovado ?? 0,
      o?.valor_total ?? 0,
    ]);
  }
  for (let r = 2; r <= ws.rowCount; r++) {
    for (let c = 2; c <= 5; c++) ws.getRow(r).getCell(c).numFmt = FORMATS.INT;
    ws.getRow(r).getCell(6).numFmt = FORMATS.PCT;
    ws.getRow(r).getCell(7).numFmt = FORMATS.CURRENCY;
    ws.getRow(r).getCell(8).numFmt = FORMATS.CURRENCY;
  }
  if (data.orcamentosFunil.length > 0) {
    addDataBar(ws, `F2:F${ws.rowCount}`, COLORS.POSITIVE); // conversão
    addDataBar(ws, `G2:G${ws.rowCount}`, COLORS.HEADER_BG); // valor aprovado
  }
  if (data.orcamentosFunil.length === 0) emptyMessage(ws, 'Sem orçamentos no período.');
}