import { describe, it, expect } from 'vitest';
import { generateAutomaticComments } from '@/lib/apresentacao/commentRules';
import { SLIDE_DEFINITIONS } from '@/lib/apresentacao/slideDefinitions';

describe('Apresentacao Gerencial Fase 2 - Regras de Comentário', () => {
  const mockData = {
    highlights: [
      { resultado_bruto: 8000, resultado_caixa: 6000 },
      { resultado_bruto: 10000, resultado_caixa: 8000 }
    ],
    faturamento: [{ total_faturado: 50000, quantidade_nfs: 10 }],
    despesas: [{ total_despesa: 40000 }],
    rolCaixa: [],
    receitaVsDespesa: [],
    fopag: [],
    fluxoCaixa: [],
    lucroProdutoCliente: [],
    variacaoEstoque: [],
    vendaEstado: [],
    redesSociais: [],
    // Fase 2
    dreGerencial: [],
    bridgeEbitda: [{ linha: 'EBITDA', valor: 15000 }],
    capitalGiro: [{ valor: 25000 }],
    topClientes: [{ cliente: 'Cliente A', total_faturamento: 30000 }],
    inadimplencia: [{ valor_total: 5000 }]
  };

  const mockParams = {
    templateId: '1',
    competenciaInicial: '2026-01',
    competenciaFinal: '2026-02',
    modoGeracao: 'dinamico' as const,
    slidesSelecionados: []
  };

  it('deve gerar comentários avançados da Fase 2', () => {
    const comments = generateAutomaticComments(mockData as any, mockParams);

    const highlightsComment = comments.find(c => c.slide_codigo === 'highlights_financeiros');
    expect(highlightsComment?.comentario).toContain('25.0%'); // Variação de 8000 para 10000

    const ebitdaComment = comments.find(c => c.slide_codigo === 'dre_gerencial');
    expect(ebitdaComment?.comentario).toContain('15.000,00');

    const cgComment = comments.find(c => c.slide_codigo === 'capital_giro');
    expect(cgComment?.comentario).toContain('25.000,00');

    const topClientesComment = comments.find(c => c.slide_codigo === 'top_clientes');
    expect(topClientesComment?.comentario).toContain('Cliente A');

    const inadimplenciaComment = comments.find(c => c.slide_codigo === 'inadimplencia');
    expect(inadimplenciaComment?.comentario).toContain('5.000,00');
  });
});
