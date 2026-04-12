/**
 * Deterministic comment generation engine.
 * Rules are auditable and data-driven — no LLM or invented text.
 */
import type {
  ApresentacaoRawData,
  SlideComentarioInput,
} from '@/types/apresentacao';
import {
  formatCurrencyBR,
  formatCompetencia,
  calcularVariacaoPercent,
  labelVariacao,
  topN,
  sumValues,
} from './utils';
import { SLIDE_DEFINITIONS } from './slideDefinitions';

export function gerarComentariosAutomaticos(
  data: ApresentacaoRawData,
  competenciaInicial: string,
  competenciaFinal: string
): SlideComentarioInput[] {
  const periodo = `${formatCompetencia(competenciaInicial)} a ${formatCompetencia(competenciaFinal)}`;
  const results: SlideComentarioInput[] = [];

  SLIDE_DEFINITIONS.forEach((slide, idx) => {
    const comentario = buildComentario(slide.codigo, data, periodo);
    results.push({
      codigo: slide.codigo,
      titulo: slide.titulo,
      comentario_automatico: comentario,
      ordem: idx,
    });
  });

  return results;
}

function buildComentario(
  codigo: string,
  data: ApresentacaoRawData,
  periodo: string
): string {
  switch (codigo) {
    case 'cover':
      return `Apresentação gerencial referente ao período ${periodo}.`;

    case 'highlights_financeiros': {
      const last = data.highlights[data.highlights.length - 1];
      const prev = data.highlights[data.highlights.length - 2];
      if (!last) return 'Dados de highlights financeiros indisponíveis para o período.';
      const varReceita = prev ? calcularVariacaoPercent(last.total_receita, prev.total_receita) : null;
      const varDespesa = prev ? calcularVariacaoPercent(last.total_despesa, prev.total_despesa) : null;
      return (
        `Receita: R$ ${formatCurrencyBR(last.total_receita)}${varReceita !== null ? ` (${labelVariacao(varReceita)} vs mês anterior)` : ''}. ` +
        `Despesa: R$ ${formatCurrencyBR(last.total_despesa)}${varDespesa !== null ? ` (${labelVariacao(varDespesa)} vs mês anterior)` : ''}. ` +
        `Resultado bruto: R$ ${formatCurrencyBR(last.resultado_bruto)}.`
      );
    }

    case 'faturamento': {
      const last = data.faturamento[data.faturamento.length - 1];
      const prev = data.faturamento[data.faturamento.length - 2];
      if (!last) return 'Dados de faturamento indisponíveis para o período.';
      const varFat = prev ? calcularVariacaoPercent(last.total_faturado, prev.total_faturado) : null;
      return (
        `Faturamento de R$ ${formatCurrencyBR(last.total_faturado)} com ${last.quantidade_nfs} notas emitidas.` +
        (varFat !== null ? ` Variação vs mês anterior: ${labelVariacao(varFat)}.` : '')
      );
    }

    case 'despesas': {
      const porCategoria = data.despesas.reduce<Record<string, number>>((acc, d) => {
        acc[d.categoria] = (acc[d.categoria] ?? 0) + d.total_despesa;
        return acc;
      }, {});
      const maiorCat = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0];
      const total = sumValues(Object.values(porCategoria));
      if (total === 0) return 'Dados de despesas indisponíveis para o período.';
      return (
        `Total de despesas no período: R$ ${formatCurrencyBR(total)}.` +
        (maiorCat ? ` Maior categoria: "${maiorCat[0]}" com R$ ${formatCurrencyBR(maiorCat[1])}.` : '')
      );
    }

    case 'rol_caixa': {
      const total = sumValues(data.rolCaixa.map((c) => c.saldo_atual));
      const qtd = data.rolCaixa.length;
      if (qtd === 0) return 'Posição de caixa indisponível.';
      return `Saldo total em caixa: R$ ${formatCurrencyBR(total)} distribuído em ${qtd} conta(s).`;
    }

    case 'receita_vs_despesa': {
      const last = data.receitaVsDespesa[data.receitaVsDespesa.length - 1];
      if (!last) return 'Dados de receita vs despesa indisponíveis.';
      return (
        `Receita R$ ${formatCurrencyBR(last.total_receita)} vs Despesa R$ ${formatCurrencyBR(last.total_despesa)}. ` +
        `Resultado: R$ ${formatCurrencyBR(last.resultado_bruto)}.`
      );
    }

    case 'fopag': {
      const total = sumValues(data.fopag.map((f) => f.valor_liquido));
      const qtdFunc = new Set(data.fopag.map((f) => f.funcionario_nome)).size;
      if (qtdFunc === 0) return 'Dados de folha de pagamento indisponíveis.';
      return `Folha de pagamento: ${qtdFunc} funcionário(s), total líquido R$ ${formatCurrencyBR(total)}.`;
    }

    case 'fluxo_caixa': {
      const totalEnt = sumValues(data.fluxoCaixa.map((f) => f.total_entradas));
      const totalSai = sumValues(data.fluxoCaixa.map((f) => f.total_saidas));
      const saldo = totalEnt - totalSai;
      if (data.fluxoCaixa.length === 0) return 'Dados de fluxo de caixa indisponíveis.';
      return `Entradas R$ ${formatCurrencyBR(totalEnt)}, saídas R$ ${formatCurrencyBR(totalSai)}. Saldo: R$ ${formatCurrencyBR(saldo)}.`;
    }

    case 'lucro_produto_cliente': {
      if (data.lucro.length === 0) return 'Dados de lucro por produto/cliente indisponíveis.';
      const topProd = topN(data.lucro, 'margem_bruta', 1)[0];
      const topCliente = data.lucro.reduce<Record<string, number>>((acc, l) => {
        acc[l.cliente_nome] = (acc[l.cliente_nome] ?? 0) + l.margem_bruta;
        return acc;
      }, {});
      const topCli = Object.entries(topCliente).sort((a, b) => b[1] - a[1])[0];
      return (
        `Maior margem por produto: ${topProd.produto_nome} (R$ ${formatCurrencyBR(topProd.margem_bruta)}).` +
        (topCli ? ` Maior margem por cliente: ${topCli[0]} (R$ ${formatCurrencyBR(topCli[1])}).` : '')
      );
    }

    case 'variacao_estoque': {
      const valorTotal = sumValues(data.estoque.map((e) => e.valor_total));
      const qtd = data.estoque.length;
      if (qtd === 0) return 'Dados de estoque indisponíveis.';
      return `Estoque valorizado em R$ ${formatCurrencyBR(valorTotal)} com ${qtd} item(ns) ativo(s).`;
    }

    case 'venda_estado': {
      if (data.vendaEstado.length === 0) return 'Dados de venda por estado indisponíveis.';
      const top = topN(data.vendaEstado, 'total_vendas', 1)[0];
      const totalEstados = new Set(data.vendaEstado.map((v) => v.estado)).size;
      return `Principal mercado: ${top.estado} (R$ ${formatCurrencyBR(top.total_vendas)}). Total de ${totalEstados} estado(s) atendido(s).`;
    }

    case 'redes_sociais': {
      if (data.redesSociais.length === 0) return 'Dados de redes sociais indisponíveis para o período.';
      const plats = [...new Set(data.redesSociais.map((r) => r.plataforma))].join(', ');
      return `Dados disponíveis para: ${plats}.`;
    }

    default:
      return 'Comentário automático não definido para este slide.';
  }
}

/**
 * Returns the effective comment: edited if available, else automatic.
 */
export function getEfectiveComentario(
  comentarioAutomatico: string | null | undefined,
  comentarioEditado: string | null | undefined
): string {
  if (comentarioEditado && comentarioEditado.trim().length > 0) {
    return comentarioEditado.trim();
  }
  return comentarioAutomatico?.trim() ?? '';
}
