import ExcelJS from 'exceljs';
import { RAW_SHEET_NAMES, RAW_SHEET_HEADERS } from './templateMap';
import { clearAndFillSheet, formatDateBR, formatCurrencyBR } from './utils';
import type {
  RawFinanceiroRow,
  RawCaixaRow,
  RawAgingRow,
  RawEstoqueRow,
  RawFopagRow,
  RawBancosRow,
  RawParametrosRow,
} from '@/types/workbook';

function getOrCreateSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  return workbook.getWorksheet(name) ?? workbook.addWorksheet(name);
}

export function fillRAWFinanceiro(workbook: ExcelJS.Workbook, data: RawFinanceiroRow[]): void {
  const ws = getOrCreateSheet(workbook, RAW_SHEET_NAMES.FINANCEIRO);
  clearAndFillSheet(
    ws,
    RAW_SHEET_HEADERS[RAW_SHEET_NAMES.FINANCEIRO],
    data.map((r) => [
      r.tipo,
      r.competencia,
      formatDateBR(r.data_vencimento),
      formatCurrencyBR(r.valor),
      formatCurrencyBR(r.valor_pago),
      formatCurrencyBR(r.saldo_restante),
      r.status,
      r.conta_contabil_id ?? '',
      r.conta_descricao,
    ])
  );
}

export function fillRAWCaixa(workbook: ExcelJS.Workbook, data: RawCaixaRow[]): void {
  const ws = getOrCreateSheet(workbook, RAW_SHEET_NAMES.CAIXA);
  clearAndFillSheet(
    ws,
    RAW_SHEET_HEADERS[RAW_SHEET_NAMES.CAIXA],
    data.map((r) => [
      r.competencia,
      r.conta_bancaria_id ?? '',
      r.conta_descricao,
      r.tipo,
      formatCurrencyBR(r.total_valor),
      r.qtd_movimentos,
    ])
  );
}

export function fillRAWAgingCR(workbook: ExcelJS.Workbook, data: RawAgingRow[]): void {
  const ws = getOrCreateSheet(workbook, RAW_SHEET_NAMES.AGING_CR);
  clearAndFillSheet(
    ws,
    RAW_SHEET_HEADERS[RAW_SHEET_NAMES.AGING_CR],
    data.map((r) => [
      r.id,
      formatDateBR(r.data_vencimento),
      formatCurrencyBR(r.valor),
      formatCurrencyBR(r.valor_pago),
      formatCurrencyBR(r.saldo_aberto),
      r.status,
      r.parceiro_id ?? '',
      r.faixa_aging,
    ])
  );
}

export function fillRAWAgingCP(workbook: ExcelJS.Workbook, data: RawAgingRow[]): void {
  const ws = getOrCreateSheet(workbook, RAW_SHEET_NAMES.AGING_CP);
  clearAndFillSheet(
    ws,
    RAW_SHEET_HEADERS[RAW_SHEET_NAMES.AGING_CP],
    data.map((r) => [
      r.id,
      formatDateBR(r.data_vencimento),
      formatCurrencyBR(r.valor),
      formatCurrencyBR(r.valor_pago),
      formatCurrencyBR(r.saldo_aberto),
      r.status,
      r.parceiro_id ?? '',
      r.faixa_aging,
    ])
  );
}

export function fillRAWEstoque(workbook: ExcelJS.Workbook, data: RawEstoqueRow[]): void {
  const ws = getOrCreateSheet(workbook, RAW_SHEET_NAMES.ESTOQUE);
  clearAndFillSheet(
    ws,
    RAW_SHEET_HEADERS[RAW_SHEET_NAMES.ESTOQUE],
    data.map((r) => [
      r.produto_id,
      r.nome,
      r.sku ?? '',
      r.quantidade,
      formatCurrencyBR(r.custo_unitario),
      formatCurrencyBR(r.valor_total),
      r.grupo_id ?? '',
      r.grupo_descricao ?? '',
    ])
  );
}

export function fillRAWFopag(workbook: ExcelJS.Workbook, data: RawFopagRow[]): void {
  const ws = getOrCreateSheet(workbook, RAW_SHEET_NAMES.FOPAG);
  clearAndFillSheet(
    ws,
    RAW_SHEET_HEADERS[RAW_SHEET_NAMES.FOPAG],
    data.map((r) => [
      r.id,
      r.competencia,
      r.funcionario_id ?? '',
      r.funcionario_nome ?? '',
      r.cargo ?? '',
      r.departamento ?? '',
      formatCurrencyBR(r.salario_base),
      formatCurrencyBR(r.proventos),
      formatCurrencyBR(r.descontos),
      formatCurrencyBR(r.valor_liquido),
      r.status ?? '',
    ])
  );
}

export function fillRAWBancos(workbook: ExcelJS.Workbook, data: RawBancosRow[]): void {
  const ws = getOrCreateSheet(workbook, RAW_SHEET_NAMES.BANCOS);
  clearAndFillSheet(
    ws,
    RAW_SHEET_HEADERS[RAW_SHEET_NAMES.BANCOS],
    data.map((r) => [
      r.id,
      r.descricao,
      r.agencia ?? '',
      r.conta ?? '',
      formatCurrencyBR(r.saldo_atual),
      r.banco_nome ?? '',
    ])
  );
}

export function fillRAWParametros(workbook: ExcelJS.Workbook, data: RawParametrosRow[]): void {
  const ws = getOrCreateSheet(workbook, RAW_SHEET_NAMES.PARAMETROS);
  clearAndFillSheet(
    ws,
    RAW_SHEET_HEADERS[RAW_SHEET_NAMES.PARAMETROS],
    data.map((r) => [r.chave, r.valor])
  );
}
