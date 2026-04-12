import type { SlideCodigo } from '@/types/apresentacao';
import { calculateVariation, formatCurrency, formatPercent } from './utils';

export function buildAutomaticComment(slide: SlideCodigo, data: Record<string, unknown>): string {
  const current = Number(data.valor_atual ?? data.total_atual ?? 0);
  const previous = Number(data.valor_anterior ?? data.total_anterior ?? 0);
  const variation = calculateVariation(current, previous);

  switch (slide) {
    case 'highlights_financeiros':
      return `Resultado do período em ${formatCurrency(current)}, variação de ${formatPercent(variation)} vs competência anterior.`;
    case 'faturamento':
      return `Faturamento do período em ${formatCurrency(current)} (${formatPercent(variation)} vs mês anterior).`;
    case 'despesas':
      return `Despesas em ${formatCurrency(current)} no período, com variação de ${formatPercent(variation)}.`;
    case 'rol_caixa':
      return `Caixa consolidado em ${formatCurrency(current)} e cobertura sobre ROL de ${formatPercent(Number(data.cobertura_pct ?? 0))}.`;
    case 'receita_vs_despesa':
      return `Receita ${formatCurrency(Number(data.receita_atual ?? 0))} vs despesa ${formatCurrency(Number(data.despesa_atual ?? 0))} no fechamento.`;
    case 'fopag':
      return `Folha líquida do período em ${formatCurrency(current)} para ${Number(data.funcionarios ?? 0)} colaboradores.`;
    case 'fluxo_caixa':
      return `Fluxo líquido do período em ${formatCurrency(Number(data.fluxo_liquido ?? current))}.`;
    case 'lucro_produto_cliente':
      return `Maior cliente do período: ${String(data.maior_cliente ?? 'não identificado')}; maior produto: ${String(data.maior_produto ?? 'não identificado')}.`;
    case 'variacao_estoque':
      return `Estoque avaliado em ${formatCurrency(current)} com variação de ${formatPercent(variation)}.`;
    case 'venda_estado':
      return `Estado líder no período: ${String(data.estado_lider ?? 'não identificado')} com ${formatCurrency(Number(data.valor_lider ?? 0))}.`;
    case 'redes_sociais':
      return data.indisponivel
        ? 'Dados indisponíveis no ERP para automação desta seção na V1.'
        : `Evolução de seguidores no período: ${Number(data.seguidores_novos ?? 0)} novos perfis.`;
    default:
      return 'Slide de abertura do fechamento mensal.';
  }
}
