/**
 * Fills RAW data sheets in the workbook template with fetched data.
 * The RAW sheets serve as data source for visual/formula sheets.
 */
import ExcelJS from 'exceljs';
import { RAW_SHEET_NAMES } from './templateMap';
import type { WorkbookRawData } from './fetchWorkbookData';
import type { WorkbookParametros } from '@/types/workbook';
import { hashParametros } from './utils';

function clearAndFill(ws: ExcelJS.Worksheet, rows: unknown[][]) {
  // Keep header row (row 1), remove all data rows
  const rowCount = ws.rowCount;
  if (rowCount > 1) {
    ws.spliceRows(2, rowCount - 1);
  }
  for (const row of rows) {
    ws.addRow(row);
  }
}

function getOrCreateSheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  return wb.getWorksheet(name) ?? wb.addWorksheet(name);
}

export function fillRawSheets(
  wb: ExcelJS.Workbook,
  data: WorkbookRawData,
  parametros: WorkbookParametros,
  geracaoId: string,
): void {
  // 1. RAW_Receita
  const wsRec = getOrCreateSheet(wb, RAW_SHEET_NAMES.RECEITA);
  clearAndFill(wsRec, data.receita.map(r => [r.competencia, r.total_receita, r.total_recebido, r.quantidade]));

  // 2. RAW_Despesa
  const wsDesp = getOrCreateSheet(wb, RAW_SHEET_NAMES.DESPESA);
  clearAndFill(wsDesp, data.despesa.map(r => [r.competencia, r.total_despesa, r.total_pago, r.quantidade]));

  // 3. RAW_Faturamento
  const wsFat = getOrCreateSheet(wb, RAW_SHEET_NAMES.FATURAMENTO);
  clearAndFill(wsFat, data.faturamento.map(r => [r.competencia, r.total_faturado, r.quantidade_nfs]));

  // 4. RAW_FOPAG
  const wsFopag = getOrCreateSheet(wb, RAW_SHEET_NAMES.FOPAG);
  clearAndFill(wsFopag, data.fopag.map(r => [r.competencia, r.funcionario_nome, r.salario_base, r.proventos, r.descontos, r.valor_liquido]));

  // 5. RAW_Caixa
  const wsCaixa = getOrCreateSheet(wb, RAW_SHEET_NAMES.CAIXA);
  clearAndFill(wsCaixa, data.caixa.map(r => [r.conta_descricao, r.banco_nome, r.agencia, r.conta, r.saldo_atual]));

  // 6. RAW_Estoque
  const wsEst = getOrCreateSheet(wb, RAW_SHEET_NAMES.ESTOQUE);
  clearAndFill(wsEst, data.estoque.map(r => [r.produto_nome, r.sku, r.grupo_nome, r.quantidade, r.custo_unitario, r.valor_total]));

  // 7. RAW_AgingCR
  const wsCR = getOrCreateSheet(wb, RAW_SHEET_NAMES.AGING_CR);
  clearAndFill(wsCR, data.agingCR.map(r => [r.id, r.data_vencimento, r.valor, r.valor_pago, r.saldo_aberto, r.status, r.cliente_id, r.descricao]));

  // 8. RAW_AgingCP
  const wsCP = getOrCreateSheet(wb, RAW_SHEET_NAMES.AGING_CP);
  clearAndFill(wsCP, data.agingCP.map(r => [r.id, r.data_vencimento, r.valor, r.valor_pago, r.saldo_aberto, r.status, r.fornecedor_id, r.descricao]));

  // 9. RAW_Parametros
  const wsParam = getOrCreateSheet(wb, RAW_SHEET_NAMES.PARAMETROS);
  clearAndFill(wsParam, [
    ['competencia_inicial', parametros.competenciaInicial],
    ['competencia_final', parametros.competenciaFinal],
    ['modo_geracao', parametros.modoGeracao],
    ['template_id', parametros.templateId],
    ['gerado_em', new Date().toISOString()],
    ['geracao_id', geracaoId],
    ['hash', hashParametros(parametros as unknown as Record<string, unknown>)],
  ]);
}
