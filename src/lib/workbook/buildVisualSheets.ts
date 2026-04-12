/**
 * Builds the visual/analytical sheets from RAW data.
 * In future, these can be replaced by Excel formulas referencing RAW sheets.
 * Currently builds them programmatically for V1.
 */
import ExcelJS from 'exceljs';
import { VISUAL_SHEET_NAMES } from './templateMap';
import type { WorkbookRawData } from './fetchWorkbookData';

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
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center' };
  }
}

function numFmt(ws: ExcelJS.Worksheet, row: number, startCol: number, endCol: number, fmt = '#,##0.00') {
  const r = ws.getRow(row);
  for (let c = startCol; c <= endCol; c++) {
    r.getCell(c).numFmt = fmt;
  }
}

function getOrCreate(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const existing = wb.getWorksheet(name);
  if (existing) {
    existing.spliceRows(1, existing.rowCount);
    return existing;
  }
  return wb.addWorksheet(name);
}

/** Classify a grupo_nome as material/insumo vs product */
function isMaterial(grupoNome: string): boolean {
  const upper = grupoNome.toUpperCase();
  return upper.includes('INSUMO') || upper.includes('MATERIAL') || upper.includes('MATERIA') || upper.includes('EMBALAGEM');
}

export function buildVisualSheets(
  wb: ExcelJS.Workbook,
  data: WorkbookRawData,
  competenciaInicial: string,
  competenciaFinal: string,
): void {
  const months = monthRange(competenciaInicial, competenciaFinal);

  // Index data by month
  const recByMonth: Record<string, number> = {};
  const despByMonth: Record<string, number> = {};
  const fatByMonth: Record<string, number> = {};
  for (const m of months) { recByMonth[m] = 0; despByMonth[m] = 0; fatByMonth[m] = 0; }
  for (const r of data.receita) { if (recByMonth[r.competencia] !== undefined) recByMonth[r.competencia] = r.total_receita; }
  for (const d of data.despesa) { if (despByMonth[d.competencia] !== undefined) despByMonth[d.competencia] = d.total_despesa; }
  for (const f of data.faturamento) { if (fatByMonth[f.competencia] !== undefined) fatByMonth[f.competencia] = f.total_faturado; }

  // ── CONFRONTO ──
  const wsConf = getOrCreate(wb, VISUAL_SHEET_NAMES.CONFRONTO);
  wsConf.getColumn(1).width = 14;
  const confHeaders = ['Confronto', ...months.map(monthLabel)];
  wsConf.addRow(confHeaders);
  styleHeader(wsConf, 1, confHeaders.length);
  wsConf.addRow(['Receita', ...months.map(m => toMil(recByMonth[m]))]);
  wsConf.addRow(['Despesa', ...months.map(m => toMil(-(despByMonth[m])))]);
  const resRow = wsConf.addRow(['RESULTADO', ...months.map(m => toMil(recByMonth[m] - despByMonth[m]))]);
  resRow.font = { bold: true };
  for (let r = 2; r <= 4; r++) numFmt(wsConf, r, 2, confHeaders.length);
  for (let c = 2; c <= confHeaders.length; c++) wsConf.getColumn(c).width = 12;

  // ── CAIXA ──
  const wsCaixa = getOrCreate(wb, VISUAL_SHEET_NAMES.CAIXA);
  wsCaixa.addRow(['Posição de Caixa', '', '', '', 'R$ mil']);
  wsCaixa.addRow(['Conta', 'Banco', 'Agência', 'Conta', 'Saldo']);
  styleHeader(wsCaixa, 2, 5);
  let totalSaldo = 0;
  for (const cb of data.caixa) {
    wsCaixa.addRow([cb.conta_descricao, cb.banco_nome, cb.agencia, cb.conta, toMil(cb.saldo_atual)]);
    totalSaldo += cb.saldo_atual;
  }
  const cTot = wsCaixa.addRow(['TOTAL', '', '', '', toMil(totalSaldo)]);
  cTot.font = { bold: true };
  for (let c = 1; c <= 5; c++) wsCaixa.getColumn(c).width = 16;

  // ── DESPESA ──
  const wsDesp = getOrCreate(wb, VISUAL_SHEET_NAMES.DESPESA);
  wsDesp.getColumn(1).width = 16;
  const despHeaders = ['Despesa', ...months.map(monthLabel)];
  wsDesp.addRow(despHeaders);
  styleHeader(wsDesp, 1, despHeaders.length);
  let acum = 0;
  wsDesp.addRow(['Total (Acum.)', ...months.map(m => { acum += despByMonth[m]; return toMil(-acum); })]);
  wsDesp.addRow(['Despesa', ...months.map(m => toMil(-(despByMonth[m])))]);
  const varRow: (string | number)[] = ['Variação'];
  for (let i = 0; i < months.length; i++) {
    if (i === 0) { varRow.push('-'); continue; }
    varRow.push(toMil(despByMonth[months[i - 1]] - despByMonth[months[i]]));
  }
  wsDesp.addRow(varRow);
  for (let c = 2; c <= despHeaders.length; c++) wsDesp.getColumn(c).width = 12;

  // ── FOPAG ──
  const wsFopag = getOrCreate(wb, VISUAL_SHEET_NAMES.FOPAG);
  wsFopag.getColumn(1).width = 4;
  wsFopag.getColumn(2).width = 20;
  const fopagHeaders = ['', 'FOPAG', ...months.map(m => monthLabel(m).toLowerCase()), 'Total'];
  wsFopag.addRow(fopagHeaders);
  styleHeader(wsFopag, 1, fopagHeaders.length);

  // Group by employee, normalize competencia to YYYY-MM
  const empMap: Record<string, Record<string, number>> = {};
  for (const fp of data.fopag) {
    const comp = fp.competencia.slice(0, 7); // normalize
    if (!empMap[fp.funcionario_nome]) empMap[fp.funcionario_nome] = {};
    empMap[fp.funcionario_nome][comp] = (empMap[fp.funcionario_nome][comp] ?? 0) + fp.valor_liquido;
  }
  const totaisFopag = months.map(() => 0);
  for (const [nome, compMap] of Object.entries(empMap)) {
    const vals = months.map((m, i) => {
      const v = toMil(compMap[m] ?? 0);
      totaisFopag[i] += v;
      return v;
    });
    wsFopag.addRow(['', nome, ...vals, Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100]);
  }
  const fTotal = wsFopag.addRow(['', 'Total', ...totaisFopag.map(v => Math.round(v * 100) / 100), Math.round(totaisFopag.reduce((a, b) => a + b, 0) * 100) / 100]);
  fTotal.font = { bold: true };
  for (let c = 3; c <= fopagHeaders.length; c++) wsFopag.getColumn(c).width = 10;

  // ── FATURAMENTO NFs ──
  const wsFat = getOrCreate(wb, VISUAL_SHEET_NAMES.FATURAMENTO);
  wsFat.getColumn(1).width = 12;
  const fatH = ['', 'Mês', 'Ano', 'Data', 'Faturado', '', 'Total Faturado', '', 'Variação'];
  wsFat.addRow(fatH);
  styleHeader(wsFat, 1, fatH.length);
  let fatAcum = 0, fatPrev = 0;
  for (const m of months) {
    const [y, mm] = m.split('-').map(Number);
    const faturado = fatByMonth[m];
    fatAcum += faturado;
    const variacao = faturado - fatPrev;
    const lastDay = new Date(y, mm, 0).getDate();
    wsFat.addRow([`${mm}/${lastDay}/${String(y).slice(2)}`, MESES_PT[mm - 1], y, monthLabel(m), toMil(faturado), '', toMil(fatAcum), '', toMil(variacao)]);
    fatPrev = faturado;
  }
  for (let c = 1; c <= 9; c++) wsFat.getColumn(c).width = 14;

  // ── ESTOQUE ──
  const wsEst = getOrCreate(wb, VISUAL_SHEET_NAMES.ESTOQUE);
  wsEst.addRow(['', 'Saldo Materiais', 'Saldo Produtos', 'Estoque Total']);
  styleHeader(wsEst, 1, 4);
  let totalMat = 0, totalProd = 0;
  for (const p of data.estoque) {
    if (isMaterial(p.grupo_nome)) {
      totalMat += p.valor_total;
    } else {
      totalProd += p.valor_total;
    }
  }
  wsEst.addRow(['Atual', toMil(totalMat), toMil(totalProd), toMil(totalMat + totalProd)]);
  for (let c = 1; c <= 4; c++) wsEst.getColumn(c).width = 18;

  // ── AGING CR ──
  buildAgingVisual(wb, VISUAL_SHEET_NAMES.AGING_CR, 'Clientes', data.agingCR, months);

  // ── AGING CP ──
  buildAgingVisual(wb, VISUAL_SHEET_NAMES.AGING_CP, 'Fornecedores', data.agingCP, months);
}

function buildAgingVisual(
  wb: ExcelJS.Workbook,
  sheetName: string,
  label: string,
  items: Array<{ data_vencimento: string; saldo_aberto: number }>,
  months: string[],
) {
  const ws = getOrCreate(wb, sheetName);
  const faixas = ['A vencer', '0 a 30', '30 a 60', '60 a 90', '90+', 'Vencido'];
  const headers = [label, ...months.map(monthLabel)];
  ws.addRow(headers);
  styleHeader(ws, 1, headers.length);
  ws.addRow(['R$', ...months.map(() => 'Saldo')]);

  for (const faixa of faixas) {
    const row: (string | number)[] = [faixa];
    for (const m of months) {
      const [y, mm] = m.split('-').map(Number);
      const endOfMonth = new Date(y, mm, 0);
      const now = new Date();
      const refDate = endOfMonth > now ? now : endOfMonth;

      let total = 0;
      for (const item of items) {
        const saldo = item.saldo_aberto;
        if (saldo <= 0) continue;
        const venc = new Date(item.data_vencimento);
        const diffDays = Math.floor((refDate.getTime() - venc.getTime()) / (86400000));

        const match =
          (faixa === 'A vencer' && diffDays < 0) ||
          (faixa === '0 a 30' && diffDays >= 0 && diffDays < 30) ||
          (faixa === '30 a 60' && diffDays >= 30 && diffDays < 60) ||
          (faixa === '60 a 90' && diffDays >= 60 && diffDays < 90) ||
          (faixa === '90+' && diffDays >= 90) ||
          (faixa === 'Vencido' && diffDays >= 0);

        if (match) total += saldo;
      }
      row.push(toMil(total));
    }
    ws.addRow(row);
  }

  // TOTAL row - sum unique items (not double-counting Vencido)
  const totalRow: (string | number)[] = ['TOTAL'];
  for (const m of months) {
    const [y, mm] = m.split('-').map(Number);
    const endOfMonth = new Date(y, mm, 0);
    const now = new Date();
    const refDate = endOfMonth > now ? now : endOfMonth;
    // Total = A vencer + all vencido (which is 0-30 + 30-60 + 60-90 + 90+)
    let total = 0;
    for (const item of items) {
      if (item.saldo_aberto > 0) total += item.saldo_aberto;
    }
    totalRow.push(toMil(total));
  }
  const rTot = ws.addRow(totalRow);
  rTot.font = { bold: true };

  ws.getColumn(1).width = 14;
  for (let c = 2; c <= headers.length; c++) ws.getColumn(c).width = 10;
}
