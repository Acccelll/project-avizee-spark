import ExcelJS from 'exceljs';
import { applyNumberFormat, FORMATS, getOrCreate, setColumnWidths, styleHeaderRow, styleTotalRow, COLORS } from '../styles';
import type { WorkbookRawData } from '../fetchWorkbookData';
import { monthLabel, monthRange } from '../comparators';

function emptyMessage(ws: ExcelJS.Worksheet, msg: string) {
  ws.addRow([]);
  ws.addRow([msg]);
  ws.getCell(`A${ws.rowCount}`).font = { italic: true, color: { argb: COLORS.MUTED } };
}

/** 13_Compras_Fornecedor */
export function buildComprasFornecedor(wb: ExcelJS.Workbook, data: WorkbookRawData): void {
  const ws = getOrCreate(wb, '13_Compras_Fornecedor');
  const headers = ['Fornecedor', 'Pedidos', 'Gasto Total', 'Lead Time Médio (dias)'];
  setColumnWidths(ws, [40, 12, 18, 22]);
  ws.addRow(headers);
  styleHeaderRow(ws, 1, headers.length);

  const map: Record<string, { qtd: number; gasto: number; ltSum: number; ltN: number }> = {};
  for (const c of data.comprasFornecedor) {
    if (!map[c.fornecedor_nome]) map[c.fornecedor_nome] = { qtd: 0, gasto: 0, ltSum: 0, ltN: 0 };
    map[c.fornecedor_nome].qtd += c.qtd_pedidos;
    map[c.fornecedor_nome].gasto += c.gasto_total;
    if (c.lead_time_medio_dias > 0) {
      map[c.fornecedor_nome].ltSum += c.lead_time_medio_dias;
      map[c.fornecedor_nome].ltN += 1;
    }
  }
  const linhas = Object.entries(map).sort((a, b) => b[1].gasto - a[1].gasto);
  for (const [nome, agg] of linhas) {
    ws.addRow([nome, agg.qtd, agg.gasto, agg.ltN ? agg.ltSum / agg.ltN : 0]);
  }
  if (linhas.length === 0) emptyMessage(ws, 'Sem compras no período.');
  else {
    for (let r = 2; r <= ws.rowCount; r++) {
      ws.getRow(r).getCell(2).numFmt = FORMATS.INT;
      ws.getRow(r).getCell(3).numFmt = FORMATS.CURRENCY;
      ws.getRow(r).getCell(4).numFmt = '0.0';
    }
  }
}

/** 16_Estoque_Giro */
export function buildEstoqueGiro(wb: ExcelJS.Workbook, data: WorkbookRawData): void {
  const ws = getOrCreate(wb, '16_Estoque_Giro');
  const headers = ['Código', 'Produto', 'Grupo', 'Estoque Atual', 'Saídas 90d', 'Cobertura (dias)', 'Giro 90d', 'Valor Estoque'];
  setColumnWidths(ws, [12, 36, 18, 14, 14, 16, 12, 18]);
  ws.addRow(headers);
  styleHeaderRow(ws, 1, headers.length);
  for (const e of data.estoqueGiro) {
    ws.addRow([e.codigo, e.nome, e.grupo_nome, e.estoque_atual, e.saidas_90d, e.cobertura_dias, e.giro_90d, e.valor_estoque]);
  }
  if (data.estoqueGiro.length === 0) emptyMessage(ws, 'Sem dados de giro de estoque.');
  else {
    for (let r = 2; r <= ws.rowCount; r++) {
      ws.getRow(r).getCell(4).numFmt = '#,##0.00';
      ws.getRow(r).getCell(5).numFmt = '#,##0.00';
      ws.getRow(r).getCell(6).numFmt = '0.0';
      ws.getRow(r).getCell(7).numFmt = '0.00';
      ws.getRow(r).getCell(8).numFmt = FORMATS.CURRENCY;
    }
  }
}

/** 17_Estoque_Critico */
export function buildEstoqueCritico(wb: ExcelJS.Workbook, data: WorkbookRawData): void {
  const ws = getOrCreate(wb, '17_Estoque_Critico');
  const headers = ['Código', 'Produto', 'Grupo', 'Estoque', 'Mínimo', 'Déficit', 'Custo Unit.', 'Valor Reposição'];
  setColumnWidths(ws, [12, 36, 18, 12, 12, 12, 14, 18]);
  ws.addRow(headers);
  styleHeaderRow(ws, 1, headers.length);
  for (const e of data.estoqueCritico) {
    ws.addRow([e.codigo, e.nome, e.grupo_nome, e.estoque_atual, e.estoque_minimo, e.deficit, e.preco_custo, e.valor_reposicao]);
  }
  if (data.estoqueCritico.length === 0) emptyMessage(ws, 'Nenhum item crítico — todos acima do mínimo.');
  else {
    for (let r = 2; r <= ws.rowCount; r++) {
      for (let c = 4; c <= 6; c++) ws.getRow(r).getCell(c).numFmt = '#,##0.00';
      ws.getRow(r).getCell(7).numFmt = FORMATS.CURRENCY;
      ws.getRow(r).getCell(8).numFmt = FORMATS.CURRENCY;
    }
    const totRepos = data.estoqueCritico.reduce((s, e) => s + e.valor_reposicao, 0);
    ws.addRow(['', '', '', '', '', '', 'Total Reposição', totRepos]);
    styleTotalRow(ws, ws.rowCount, headers.length);
    ws.getRow(ws.rowCount).getCell(8).numFmt = FORMATS.CURRENCY;
  }
}

/** 19_Logistica */
export function buildLogistica(wb: ExcelJS.Workbook, data: WorkbookRawData, ini: string, fim: string): void {
  const ws = getOrCreate(wb, '19_Logistica');
  const months = monthRange(ini, fim);
  const headers = ['Mês', 'Remessas', 'No Prazo', 'Atrasadas', 'Devoluções', 'OTIF %', 'Frete Total'];
  setColumnWidths(ws, [12, 12, 12, 12, 12, 10, 18]);
  ws.addRow(headers);
  styleHeaderRow(ws, 1, headers.length);

  const map: Record<string, WorkbookRawData['logistica'][number]> = {};
  for (const l of data.logistica) map[l.competencia] = l;
  for (const m of months) {
    const l = map[m];
    const tot = l?.qtd_remessas ?? 0;
    const otif = tot ? (l?.entregues_no_prazo ?? 0) / tot : 0;
    ws.addRow([
      monthLabel(m),
      tot,
      l?.entregues_no_prazo ?? 0,
      l?.entregues_atraso ?? 0,
      l?.devolucoes ?? 0,
      otif,
      l?.frete_total ?? 0,
    ]);
  }
  for (let r = 2; r <= ws.rowCount; r++) {
    for (let c = 2; c <= 5; c++) ws.getRow(r).getCell(c).numFmt = FORMATS.INT;
    ws.getRow(r).getCell(6).numFmt = FORMATS.PCT;
    ws.getRow(r).getCell(7).numFmt = FORMATS.CURRENCY;
  }
  if (data.logistica.length === 0) emptyMessage(ws, 'Sem remessas no período.');
}

/** 20_Fiscal */
export function buildFiscal(wb: ExcelJS.Workbook, data: WorkbookRawData, ini: string, fim: string): void {
  const ws = getOrCreate(wb, '20_Fiscal');
  const months = monthRange(ini, fim);
  const headers = ['Mês', 'Tipo', 'Confirmadas', 'Canceladas', 'Rascunho', 'Valor Confirm.', 'ICMS', 'PIS', 'COFINS', 'IPI'];
  setColumnWidths(ws, [10, 8, 12, 12, 10, 18, 12, 12, 12, 12]);
  ws.addRow(headers);
  styleHeaderRow(ws, 1, headers.length);

  const sorted = [...data.fiscal].sort((a, b) => a.competencia.localeCompare(b.competencia));
  for (const f of sorted) {
    ws.addRow([
      monthLabel(f.competencia),
      f.tipo,
      f.qtd_confirmadas,
      f.qtd_canceladas,
      f.qtd_rascunho,
      f.valor_confirmado,
      f.icms,
      f.pis,
      f.cofins,
      f.ipi,
    ]);
  }
  for (let r = 2; r <= ws.rowCount; r++) {
    for (let c = 3; c <= 5; c++) ws.getRow(r).getCell(c).numFmt = FORMATS.INT;
    for (let c = 6; c <= 10; c++) ws.getRow(r).getCell(c).numFmt = FORMATS.CURRENCY;
  }
  if (data.fiscal.length === 0) emptyMessage(ws, 'Sem notas fiscais no período.');
  else {
    // Totais agregados
    const tot = data.fiscal.reduce(
      (acc, f) => ({
        conf: acc.conf + f.qtd_confirmadas, can: acc.can + f.qtd_canceladas, ras: acc.ras + f.qtd_rascunho,
        val: acc.val + f.valor_confirmado, icms: acc.icms + f.icms, pis: acc.pis + f.pis,
        cofins: acc.cofins + f.cofins, ipi: acc.ipi + f.ipi,
      }),
      { conf: 0, can: 0, ras: 0, val: 0, icms: 0, pis: 0, cofins: 0, ipi: 0 }
    );
    ws.addRow(['TOTAL', '', tot.conf, tot.can, tot.ras, tot.val, tot.icms, tot.pis, tot.cofins, tot.ipi]);
    styleTotalRow(ws, ws.rowCount, headers.length);
    for (let c = 6; c <= 10; c++) ws.getRow(ws.rowCount).getCell(c).numFmt = FORMATS.CURRENCY;
    for (let c = 3; c <= 5; c++) ws.getRow(ws.rowCount).getCell(c).numFmt = FORMATS.INT;
  }
}

/** 03_Caixa_Evolutivo */
export function buildCaixaEvolutivo(wb: ExcelJS.Workbook, data: WorkbookRawData, ini: string, fim: string): void {
  const ws = getOrCreate(wb, '03_Caixa_Evolutivo');
  const months = monthRange(ini, fim);
  const headers = ['Mês', 'Saldo Inicial', 'Saldo Final', 'Variação'];
  setColumnWidths(ws, [12, 18, 18, 18]);
  ws.addRow(headers);
  styleHeaderRow(ws, 1, headers.length);

  // agrega todas as contas por competência
  const map: Record<string, { ini: number; fim: number; var: number }> = {};
  for (const c of data.caixaEvolutivo) {
    if (!map[c.competencia]) map[c.competencia] = { ini: 0, fim: 0, var: 0 };
    map[c.competencia].ini += c.saldo_inicial;
    map[c.competencia].fim += c.saldo_final;
    map[c.competencia].var += c.variacao_mes;
  }
  for (const m of months) {
    const v = map[m] ?? { ini: 0, fim: 0, var: 0 };
    ws.addRow([monthLabel(m), v.ini, v.fim, v.var]);
  }
  for (let r = 2; r <= ws.rowCount; r++) {
    for (let c = 2; c <= 4; c++) ws.getRow(r).getCell(c).numFmt = FORMATS.CURRENCY;
  }
  if (data.caixaEvolutivo.length === 0) emptyMessage(ws, 'Sem movimentação de caixa registrada.');
}