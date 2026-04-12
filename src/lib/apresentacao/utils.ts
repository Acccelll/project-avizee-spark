/**
 * Utility functions shared across the Apresentação Gerencial module.
 */
import type { ApresentacaoParametros } from '@/types/apresentacao';

export function formatCurrencyBR(value: number | null | undefined): string {
  const v = Number(value ?? 0);
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatCurrencyBRNumber(value: number | null | undefined): number {
  return Number((value ?? 0).toFixed(2));
}

export function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function formatCompetencia(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function calcularVariacaoPercent(
  valorAtual: number,
  valorAnterior: number
): number | null {
  if (!valorAnterior || valorAnterior === 0) return null;
  return ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100;
}

export function hashParametros(params: Record<string, unknown>): string {
  return btoa(JSON.stringify(params)).slice(0, 32);
}

export function serializeToJsonb(params: ApresentacaoParametros): Record<string, unknown> {
  return {
    templateId: params.templateId,
    competenciaInicial: params.competenciaInicial,
    competenciaFinal: params.competenciaFinal,
    modoGeracao: params.modoGeracao,
  };
}

export function sumValues(arr: number[]): number {
  return arr.reduce((acc, v) => acc + (v ?? 0), 0);
}

export function topN<T>(arr: T[], key: keyof T, n: number): T[] {
  return [...arr]
    .sort((a, b) => Number(b[key]) - Number(a[key]))
    .slice(0, n);
}

export function labelVariacao(pct: number | null): string {
  if (pct === null) return '';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
