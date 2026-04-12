import ExcelJS from 'exceljs';
import { supabase } from '@/integrations/supabase/client';
import { hashParametros } from './utils';
import { SHEET_NAMES } from './templateMap';
import type { WorkbookParametros } from '@/types/workbook';

export interface GenerateWorkbookOptions {
  parametros: WorkbookParametros;
  geracaoId: string;
}

/* ───────── helpers ───────── */

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function monthRange(inicio: string, fim: string): string[] {
  const [yi, mi] = inicio.slice(0, 7).split('-').map(Number);
  const [yf, mf] = fim.slice(0, 7).split('-').map(Number);
  const months: string[] = [];
  let y = yi, m = mi;
  while (y < yf || (y === yf && m <= mf)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MESES_PT[m - 1]}-${String(y).slice(2)}`;
}

function toMil(v: number): number {
  return Math.round((v / 1000) * 100) / 100;
}

function styleHeader(ws: ExcelJS.Worksheet, row: number, cols: number) {
  const r = ws.getRow(row);
  for (let c = 1; c <= cols; c++) {
    const cell = r.getCell(c);
    cell.font = { bold: true, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center' };
  }
}

function numFmt(ws: ExcelJS.Worksheet, row: number, startCol: number, endCol: number, fmt = '#,##0.0') {
  const r = ws.getRow(row);
  for (let c = startCol; c <= endCol; c++) {
    r.getCell(c).numFmt = fmt;
  }
}

/* ───────── main ───────── */

export async function generateWorkbook(options: GenerateWorkbookOptions): Promise<Blob> {
  const { parametros, geracaoId } = options;
  const { competenciaInicial, competenciaFinal } = parametros;
  const months = monthRange(competenciaInicial, competenciaFinal);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ERP AviZee';
  workbook.created = new Date();

  /* ──── fetch data ──── */
  const { data: lancamentos } = await supabase
    .from('financeiro_lancamentos')
    .select('id, tipo, data_vencimento, valor, valor_pago, saldo_restante, status, cliente_id, fornecedor_id, descricao, data_pagamento')
    .eq('ativo', true);

  const { data: nfs } = await supabase
    .from('notas_fiscais')
    .select('id, numero, data_emissao, valor_total, tipo, status')
    .eq('ativo', true);

  const { data: contasBancarias } = await supabase
    .from('contas_bancarias')
    .select('id, descricao, saldo_atual, bancos(nome)')
    .eq('ativo', true);

  const { data: fopagData } = await supabase
    .from('folha_pagamento')
    .select('id, competencia, salario_base, proventos, descontos, valor_liquido, status, funcionarios(nome)')
    .gte('competencia', months[0])
    .lte('competencia', months[months.length - 1]);

  const { data: produtosData } = await supabase
    .from('produtos')
    .select('id, nome, sku, estoque_atual, preco_custo, grupo_id, grupos_produto(nome)')
    .eq('ativo', true);

  const allLanc = (lancamentos ?? []) as Record<string, unknown>[];
  const allNfs = (nfs ?? []) as Record<string, unknown>[];
  const allFopag = (fopagData ?? []) as Record<string, unknown>[];
  const allProdutos = (produtosData ?? []) as Record<string, unknown>[];
  const allContas = (contasBancarias ?? []) as Record<string, unknown>[];

  /* ──── aggregate by month ──── */
  const receitaPorMes: Record<string, number> = {};
  const despesaPorMes: Record<string, number> = {};
  const fatPorMes: Record<string, number> = {};

  for (const m of months) { receitaPorMes[m] = 0; despesaPorMes[m] = 0; fatPorMes[m] = 0; }

  for (const l of allLanc) {
    const venc = String(l.data_vencimento ?? '').slice(0, 7);
    const valor = Number(l.valor ?? 0);
    if (String(l.tipo) === 'receber' && receitaPorMes[venc] !== undefined) {
      receitaPorMes[venc] += valor;
    }
    if (String(l.tipo) === 'pagar' && despesaPorMes[venc] !== undefined) {
      despesaPorMes[venc] += valor;
    }
  }

  for (const nf of allNfs) {
    const dt = String(nf.data_emissao ?? '').slice(0, 7);
    if (fatPorMes[dt] !== undefined && String(nf.tipo) === 'saida') {
      fatPorMes[dt] += Number(nf.valor_total ?? 0);
    }
  }

  /* ──── 1. CONFRONTO ──── */
  const wsConf = workbook.addWorksheet(SHEET_NAMES.CONFRONTO);
  wsConf.getColumn(1).width = 14;
  const confHeaders = ['Confronto', ...months.map(monthLabel)];
  wsConf.addRow(confHeaders);
  styleHeader(wsConf, 1, confHeaders.length);

  const recRow = ['Receita', ...months.map(m => toMil(receitaPorMes[m] ?? 0))];
  const despRow = ['Despesa', ...months.map(m => toMil(-(despesaPorMes[m] ?? 0)))];
  const resRow = ['RESULTADO', ...months.map(m => toMil((receitaPorMes[m] ?? 0) - (despesaPorMes[m] ?? 0)))];
  wsConf.addRow(recRow);
  wsConf.addRow(despRow);
  const rRes = wsConf.addRow(resRow);
  rRes.font = { bold: true };
  numFmt(wsConf, 2, 2, confHeaders.length);
  numFmt(wsConf, 3, 2, confHeaders.length);
  numFmt(wsConf, 4, 2, confHeaders.length);
  for (let c = 2; c <= confHeaders.length; c++) wsConf.getColumn(c).width = 12;

  /* ──── 2. CAIXA ──── */
  const wsCaixa = workbook.addWorksheet(SHEET_NAMES.CAIXA);
  wsCaixa.getColumn(1).width = 12;
  const caixaHeaders = ['', 'Mês', 'Ano', 'Data', 'Saldo Atual'];
  wsCaixa.addRow(caixaHeaders);
  styleHeader(wsCaixa, 1, caixaHeaders.length);

  // Show current bank balances as summary
  for (const cb of allContas) {
    const banco = (cb.bancos as Record<string, unknown>)?.nome ?? '';
    wsCaixa.addRow([
      String(cb.descricao ?? ''),
      '',
      '',
      String(banco),
      toMil(Number(cb.saldo_atual ?? 0)),
    ]);
  }
  const totalSaldo = allContas.reduce((s, cb) => s + Number((cb as Record<string, unknown>).saldo_atual ?? 0), 0);
  const rTotal = wsCaixa.addRow(['TOTAL', '', '', '', toMil(totalSaldo)]);
  rTotal.font = { bold: true };
  for (let c = 1; c <= 5; c++) wsCaixa.getColumn(c).width = 16;

  /* ──── 3. DESPESA ──── */
  const wsDesp = workbook.addWorksheet(SHEET_NAMES.DESPESA);
  wsDesp.getColumn(1).width = 16;
  const despHeaders = ['Despesa', ...months.map(monthLabel)];
  wsDesp.addRow(despHeaders);
  styleHeader(wsDesp, 1, despHeaders.length);

  let acum = 0;
  const acumRow = ['Total (Acum.)', ...months.map(m => { acum += despesaPorMes[m] ?? 0; return toMil(-acum); })];
  const despMRow = ['Despesa', ...months.map(m => toMil(-(despesaPorMes[m] ?? 0)))];
  const varRow: (string | number)[] = ['Variação'];
  for (let i = 0; i < months.length; i++) {
    if (i === 0) { varRow.push('-'); continue; }
    const curr = despesaPorMes[months[i]] ?? 0;
    const prev = despesaPorMes[months[i - 1]] ?? 0;
    varRow.push(toMil(prev - curr));
  }
  wsDesp.addRow(acumRow);
  wsDesp.addRow(despMRow);
  wsDesp.addRow(varRow);
  for (let c = 2; c <= despHeaders.length; c++) wsDesp.getColumn(c).width = 12;

  /* ──── 4. FOPAG ──── */
  const wsFopag = workbook.addWorksheet(SHEET_NAMES.FOPAG);
  wsFopag.getColumn(1).width = 4;
  wsFopag.getColumn(2).width = 20;

  const fopagHeaders = ['', 'FOPAG', ...months.map(m => monthLabel(m).toLowerCase()), 'Total'];
  wsFopag.addRow(fopagHeaders);
  styleHeader(wsFopag, 1, fopagHeaders.length);

  // Group by employee
  const empMap: Record<string, Record<string, number>> = {};
  for (const fp of allFopag) {
    const nome = ((fp.funcionarios as Record<string, unknown>)?.nome ?? 'Sem Nome') as string;
    const comp = String(fp.competencia ?? '');
    if (!empMap[nome]) empMap[nome] = {};
    empMap[nome][comp] = (empMap[nome][comp] ?? 0) + Number(fp.valor_liquido ?? 0);
  }

  const totaisFopag = months.map(() => 0);
  for (const [nome, compMap] of Object.entries(empMap)) {
    const vals = months.map((m, i) => {
      const v = toMil(compMap[m] ?? 0);
      totaisFopag[i] += v;
      return v;
    });
    const total = vals.reduce((a, b) => a + b, 0);
    wsFopag.addRow(['', nome, ...vals, Math.round(total * 100) / 100]);
  }
  const fTotal = wsFopag.addRow(['', 'Total', ...totaisFopag.map(v => Math.round(v * 100) / 100), Math.round(totaisFopag.reduce((a, b) => a + b, 0) * 100) / 100]);
  fTotal.font = { bold: true };
  for (let c = 3; c <= fopagHeaders.length; c++) wsFopag.getColumn(c).width = 10;

  /* ──── 5. FATURAMENTO NFs ──── */
  const wsFat = workbook.addWorksheet(SHEET_NAMES.FATURAMENTO);
  wsFat.getColumn(1).width = 12;
  const fatHeaders = ['', 'Mês', 'Ano', 'Data', 'Faturado', '', 'Total Faturado', '', 'Variação'];
  wsFat.addRow(fatHeaders);
  styleHeader(wsFat, 1, fatHeaders.length);

  let fatAcum = 0;
  let fatPrev = 0;
  for (const m of months) {
    const [y, mm] = m.split('-').map(Number);
    const faturado = fatPorMes[m] ?? 0;
    fatAcum += faturado;
    const variacao = faturado - fatPrev;
    const lastDay = new Date(y, mm, 0).getDate();
    wsFat.addRow([
      `${mm}/${lastDay}/${String(y).slice(2)}`,
      MESES_PT[mm - 1],
      y,
      monthLabel(m),
      toMil(faturado),
      '',
      toMil(fatAcum),
      '',
      toMil(variacao),
    ]);
    fatPrev = faturado;
  }
  for (let c = 1; c <= 9; c++) wsFat.getColumn(c).width = 14;

  /* ──── 6. ESTOQUE ──── */
  const wsEst = workbook.addWorksheet(SHEET_NAMES.ESTOQUE);
  const estHeaders = ['', 'Saldo Materiais', 'Saldo Produtos', 'Estoque Total'];
  wsEst.addRow(estHeaders);
  styleHeader(wsEst, 1, estHeaders.length);

  // Separate insumos (grupo INSUMOS) vs products
  let totalMat = 0, totalProd = 0;
  for (const p of allProdutos) {
    const grupo = String((p.grupos_produto as Record<string, unknown>)?.nome ?? '').toUpperCase();
    const val = Number(p.estoque_atual ?? 0) * Number(p.preco_custo ?? 0);
    if (grupo.includes('INSUMO') || grupo.includes('MATERIAL') || grupo.includes('MATERIA')) {
      totalMat += val;
    } else {
      totalProd += val;
    }
  }
  wsEst.addRow(['Atual', toMil(totalMat), toMil(totalProd), toMil(totalMat + totalProd)]);
  for (let c = 1; c <= 4; c++) wsEst.getColumn(c).width = 18;

  /* ──── 7. AGING CR ──── */
  buildAgingSheet(workbook, SHEET_NAMES.AGING_CR, 'Clientes', allLanc, 'receber', months);

  /* ──── 8. AGING CP ──── */
  buildAgingSheet(workbook, SHEET_NAMES.AGING_CP, 'Fornecedores', allLanc, 'pagar', months);

  /* ──── 9. PARÂMETROS ──── */
  const wsParam = workbook.addWorksheet(SHEET_NAMES.PARAMETROS);
  wsParam.addRow(['Chave', 'Valor']);
  styleHeader(wsParam, 1, 2);
  wsParam.addRow(['competencia_inicial', competenciaInicial]);
  wsParam.addRow(['competencia_final', competenciaFinal]);
  wsParam.addRow(['modo_geracao', parametros.modoGeracao]);
  wsParam.addRow(['gerado_em', new Date().toISOString()]);
  wsParam.addRow(['geracao_id', geracaoId]);
  wsParam.addRow(['hash', hashParametros({ ...parametros })]);
  wsParam.getColumn(1).width = 22;
  wsParam.getColumn(2).width = 40;

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/* ──── aging helper ──── */

function buildAgingSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  label: string,
  allLanc: Record<string, unknown>[],
  tipo: string,
  months: string[],
) {
  const ws = workbook.addWorksheet(sheetName);
  const faixasVencer = ['A vencer', '0 a 30', '30 a 60', '60 a 90', '90+'];
  const faixasVencido = ['Vencido', '0 a 30', '30 a 60', '60 a 90', '90 a 120', '120 a 180', '180 a 360', '360+'];
  const allFaixas = [...faixasVencer, ...faixasVencido];

  const headers = [label, ...months.map(monthLabel)];
  ws.addRow(headers);
  styleHeader(ws, 1, headers.length);
  ws.addRow(['R$', ...months.map(() => 'Saldo')]);

  // For each month, compute aging snapshot
  const hoje = new Date();
  for (const faixa of allFaixas) {
    const row: (string | number)[] = [faixa];
    for (const m of months) {
      const [y, mm] = m.split('-').map(Number);
      const endOfMonth = new Date(y, mm, 0);
      const refDate = endOfMonth > hoje ? hoje : endOfMonth;

      let total = 0;
      for (const l of allLanc) {
        if (String(l.tipo) !== tipo) continue;
        if (String(l.status) === 'pago') continue;
        const venc = new Date(String(l.data_vencimento ?? ''));
        const saldo = Number(l.saldo_restante ?? l.valor ?? 0);
        if (saldo <= 0) continue;

        const diffDays = Math.floor((refDate.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));

        if (faixa === 'A vencer' && diffDays < 0) total += saldo;
        else if (faixa === '0 a 30' && diffDays >= 0 && diffDays < 30) total += saldo;
        else if (faixa === '30 a 60' && diffDays >= 30 && diffDays < 60) total += saldo;
        else if (faixa === '60 a 90' && diffDays >= 60 && diffDays < 90) total += saldo;
        else if (faixa === '90+' && diffDays >= 90) total += saldo;
        else if (faixa === '90 a 120' && diffDays >= 90 && diffDays < 120) total += saldo;
        else if (faixa === '120 a 180' && diffDays >= 120 && diffDays < 180) total += saldo;
        else if (faixa === '180 a 360' && diffDays >= 180 && diffDays < 360) total += saldo;
        else if (faixa === '360+' && diffDays >= 360) total += saldo;
        // 'Vencido' is a header row - show sum of all overdue
        else if (faixa === 'Vencido' && diffDays >= 0) total += saldo;
      }
      row.push(toMil(total));
    }
    ws.addRow(row);
  }

  // Total row
  const totalRow: (string | number)[] = ['TOTAL'];
  for (let i = 0; i < months.length; i++) {
    let t = 0;
    for (const l of allLanc) {
      if (String(l.tipo) !== tipo) continue;
      if (String(l.status) === 'pago') continue;
      const saldo = Number(l.saldo_restante ?? l.valor ?? 0);
      if (saldo > 0) t += saldo;
    }
    totalRow.push(toMil(t));
  }
  const rTot = ws.addRow(totalRow);
  rTot.font = { bold: true };

  ws.getColumn(1).width = 14;
  for (let c = 2; c <= headers.length; c++) ws.getColumn(c).width = 10;
}
