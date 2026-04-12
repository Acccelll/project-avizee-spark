import { describe, it, expect } from 'vitest';
import { generateAutomaticComments } from '@/lib/apresentacao/commentRules';
import { SLIDE_DEFINITIONS } from '@/lib/apresentacao/slideDefinitions';

describe('Apresentacao Gerencial - Regras de Comentário', () => {
  const mockData = {
    highlights: [{ resultado_bruto: 10000, resultado_caixa: 8000 }],
    faturamento: [{ total_faturado: 50000, quantidade_nfs: 10 }],
    despesas: [{ total_despesa: 40000 }],
    rolCaixa: [],
    receitaVsDespesa: [],
    fopag: [],
    fluxoCaixa: [],
    lucroProdutoCliente: [],
    variacaoEstoque: [],
    vendaEstado: [],
    redesSociais: []
  };

  const mockParams = {
    templateId: '1',
    competenciaInicial: '2026-01',
    competenciaFinal: '2026-01',
    modoGeracao: 'dinamico' as const,
    slidesSelecionados: []
  };

  it('deve gerar comentários automáticos para os slides principais', () => {
    const comments = generateAutomaticComments(mockData as any, mockParams);

    expect(comments).toHaveLength(SLIDE_DEFINITIONS.length);

    const coverComment = comments.find(c => c.slide_codigo === 'cover');
    expect(coverComment?.comentario).toContain('2026-01');

    const highlightsComment = comments.find(c => c.slide_codigo === 'highlights_financeiros');
    expect(highlightsComment?.comentario).toContain('10.000,00');
    expect(highlightsComment?.comentario).toContain('positivo');
  });

  it('deve lidar com dados ausentes graciosamente', () => {
    const emptyData = {
      highlights: [],
      faturamento: [],
      despesas: [],
      rolCaixa: [],
      receitaVsDespesa: [],
      fopag: [],
      fluxoCaixa: [],
      lucroProdutoCliente: [],
      variacaoEstoque: [],
      vendaEstado: [],
      redesSociais: []
    };
    const comments = generateAutomaticComments(emptyData as any, mockParams);
    const faturamentoComment = comments.find(c => c.slide_codigo === 'faturamento');
    expect(faturamentoComment?.comentario).toContain('Dados não disponíveis');
  });
});
