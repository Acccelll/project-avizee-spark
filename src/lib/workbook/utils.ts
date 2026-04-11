import ExcelJS from 'exceljs';

export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function formatCurrencyBR(value: number | null | undefined): number {
  return Number((value ?? 0).toFixed(2));
}

export function calcularFaixaAging(dataVencimento: string): string {
  const hoje = new Date();
  const venc = new Date(dataVencimento);
  const diffDays = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'a_vencer';
  if (diffDays <= 30) return '1_30';
  if (diffDays <= 60) return '31_60';
  if (diffDays <= 90) return '61_90';
  return 'acima_90';
}

export function hashParametros(params: Record<string, unknown>): string {
  return btoa(JSON.stringify(params)).slice(0, 32);
}

export function clearAndFillSheet(
  worksheet: ExcelJS.Worksheet,
  headers: string[],
  rows: unknown[][]
): void {
  worksheet.spliceRows(1, worksheet.rowCount);
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  rows.forEach((row) => worksheet.addRow(row));
}
