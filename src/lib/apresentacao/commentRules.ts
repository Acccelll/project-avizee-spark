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

    if (slide.codigo === 'cover') {
      comment = `Relatório de fechamento gerencial referente ao período de ${params.competenciaInicial} a ${params.competenciaFinal}.`;
    } else if (slide.codigo === 'highlights_financeiros') {
      const last = data.highlights[data.highlights.length - 1];
      if (last) {
        const resultado = last.resultado_bruto >= 0 ? 'positivo' : 'negativo';
        comment = `O resultado bruto do último mês foi de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(last.resultado_bruto)}, caracterizando um saldo ${resultado}.`;
      }
    } else if (slide.codigo === 'faturamento') {
      const last = data.faturamento[data.faturamento.length - 1];
      if (last) {
        comment = `Faturamento total de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(last.total_faturado)} com ${last.quantidade_nfs} notas emitidas.`;
      }
    } else if (slide.codigo === 'despesas') {
      const last = data.despesas[data.despesas.length - 1];
      if (last) {
        comment = `Total de despesas no período: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(last.total_despesa)}.`;
      }
    } else {
      // Regras genéricas para V1 ou placeholder para outros slides
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
