import type { SlideCodigo } from '@/types/apresentacao';
import { calculateVariation, formatCurrency, formatPercent } from './utils';

export interface ExecutiveComment {
  text: string;
  severity: 'info' | 'warning' | 'critical' | 'positive';
  priority: number;
  tags: string[];
}

function buildCoreSummary(slide: SlideCodigo, data: Record<string, unknown>): ExecutiveComment {
  const current = Number(data.valor_atual ?? data.total_atual ?? 0);
  const previous = Number(data.valor_anterior ?? data.total_anterior ?? 0);
  const variation = calculateVariation(current, previous);

  const common: ExecutiveComment = {
    text: `Valor atual ${formatCurrency(current)} e variação ${formatPercent(variation)} vs período anterior.`,
    severity: variation < -10 ? 'warning' : 'info',
    priority: 1,
    tags: [slide, 'variacao'],
  };

  if (slide === 'inadimplencia') {
    return {
      text: `Inadimplência em ${formatCurrency(Number(data.valor_inadimplente ?? 0))}, representando ${formatPercent(Number(data.pct_inadimplencia ?? 0))}.`,
      severity: Number(data.pct_inadimplencia ?? 0) > 15 ? 'critical' : 'warning',
      priority: 1,
      tags: ['risco_caixa', 'recebiveis'],
    };
  }

  if (slide === 'backorder') {
    return {
      text: `Backorder no período: ${Number(data.qtd_pedidos_pendentes ?? 0)} pedidos pendentes e ${formatCurrency(Number(data.valor_backorder ?? 0))}.`,
      severity: Number(data.qtd_pedidos_pendentes ?? 0) > 0 ? 'warning' : 'info',
      priority: 1,
      tags: ['carteira', 'operacional'],
    };
  }

  return common;
}

function buildConcentrationComment(slide: SlideCodigo, data: Record<string, unknown>): ExecutiveComment | null {
  if (slide === 'top_clientes') {
    return {
      text: `Concentração em clientes: líder ${String(data.cliente_lider ?? 'N/I')} com ${formatCurrency(Number(data.valor_lider ?? 0))}.`,
      severity: 'info',
      priority: 2,
      tags: ['concentracao', 'clientes'],
    };
  }
  if (slide === 'top_fornecedores') {
    return {
      text: `Maior fornecedor: ${String(data.fornecedor_lider ?? 'N/I')} com ${formatCurrency(Number(data.valor_lider ?? 0))}.`,
      severity: 'info',
      priority: 2,
      tags: ['concentracao', 'fornecedores'],
    };
  }
  return null;
}

export function buildAutomaticComments(slide: SlideCodigo, data: Record<string, unknown>): ExecutiveComment[] {
  if (data.indisponivel) {
    return [{ text: 'Dados indisponíveis ou não automatizados nesta fase.', severity: 'warning', priority: 1, tags: ['indisponivel'] }];
  }

  const comments: ExecutiveComment[] = [buildCoreSummary(slide, data)];
  const concentration = buildConcentrationComment(slide, data);
  if (concentration) comments.push(concentration);

  if (slide === 'rol_caixa' && Number(data.cobertura_pct ?? 0) < 30) {
    comments.push({ text: 'Alerta de risco de caixa: cobertura de ROL abaixo do limite de atenção.', severity: 'critical', priority: 1, tags: ['risco_caixa'] });
  }

  return comments.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

export function buildAutomaticComment(slide: SlideCodigo, data: Record<string, unknown>): string {
  return buildAutomaticComments(slide, data).map((c) => c.text).join(' | ');
}
