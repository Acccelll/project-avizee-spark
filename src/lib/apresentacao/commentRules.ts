import type { ApresentacaoData, ApresentacaoParametros } from '@/types/apresentacao';
import { SLIDE_DEFINITIONS } from './slideDefinitions';

export interface AutoComment {
  slide_codigo: string;
  titulo: string;
  comentario: string;
}

export function generateAutomaticComments(data: ApresentacaoData, params: ApresentacaoParametros): AutoComment[] {
  const comments: AutoComment[] = [];

  for (const slide of SLIDE_DEFINITIONS) {
    let comment = 'Dados não disponíveis para o período selecionado.';

    // Formatter helpers
    const fmtCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    if (slide.codigo === 'cover') {
      comment = `Relatório de fechamento gerencial referente ao período de ${params.competenciaInicial} a ${params.competenciaFinal}.`;
    }

    else if (slide.codigo === 'highlights_financeiros') {
      const last = data.highlights[data.highlights.length - 1];
      const prev = data.highlights.length > 1 ? data.highlights[data.highlights.length - 2] : null;
      if (last) {
        const resultado = last.resultado_bruto >= 0 ? 'positivo' : 'negativo';
        comment = `O resultado bruto do último mês foi de ${fmtCurrency(last.resultado_bruto)}, saldo ${resultado}.`;
        if (prev) {
          const varPct = ((last.resultado_bruto - prev.resultado_bruto) / Math.abs(prev.resultado_bruto || 1)) * 100;
          comment += ` Variação de ${varPct.toFixed(1)}% em relação ao mês anterior.`;
        }
      }
    }

    else if (slide.codigo === 'dre_gerencial') {
      const ebitda = data.bridgeEbitda?.find(d => d.linha === 'EBITDA')?.valor || 0;
      comment = `EBITDA gerencial do período: ${fmtCurrency(ebitda)}.`;
    }

    else if (slide.codigo === 'capital_giro') {
      const total = data.capitalGiro?.reduce((acc, curr) => acc + curr.valor, 0) || 0;
      comment = `Necessidade de Capital de Giro estimada em ${fmtCurrency(total)}.`;
    }

    else if (slide.codigo === 'top_clientes') {
      if (data.topClientes && data.topClientes.length > 0) {
        comment = `O principal cliente no período foi ${data.topClientes[0].cliente}, representando faturamento de ${fmtCurrency(data.topClientes[0].total_faturamento)}.`;
      }
    }

    else if (slide.codigo === 'inadimplencia') {
      const total = data.inadimplencia?.reduce((acc, curr) => acc + curr.valor_total, 0) || 0;
      if (total > 0) {
        comment = `Total de recebíveis vencidos: ${fmtCurrency(total)}. Atenção à concentração em faixas de longo prazo.`;
      } else {
        comment = 'Inadimplência dentro dos níveis de controle.';
      }
    }

    else if (slide.codigo === 'faturamento') {
      const last = data.faturamento[data.faturamento.length - 1];
      if (last) {
        comment = `Faturamento total de ${fmtCurrency(last.total_faturado)} com ${last.quantidade_nfs} notas emitidas.`;
      }
    }

    else if (slide.codigo === 'despesas') {
      const last = data.despesas[data.despesas.length - 1];
      if (last) {
        comment = `Total de despesas no período: ${fmtCurrency(last.total_despesa)}.`;
      }
    }

    else {
      // Regras genéricas para outros slides
      const dataset = (data as any)[slide.dataset];
      if (dataset && dataset.length > 0) {
        comment = `Análise de ${slide.titulo} baseada em ${dataset.length} registros no período.`;
      }
    }

    comments.push({
      slide_codigo: slide.codigo,
      titulo: slide.titulo,
      comentario: comment
    });
  }

  return comments;
}
