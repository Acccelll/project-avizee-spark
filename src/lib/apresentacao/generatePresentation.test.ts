import { describe, expect, it } from 'vitest';
import { generatePresentation } from './generatePresentation';
import type { ApresentacaoDataBundle } from '@/types/apresentacao';

describe('generatePresentation', () => {
  it('gera arquivo pptx válido (zip)', async () => {
    const bundle: ApresentacaoDataBundle = {
      periodo: { competenciaInicial: '2026-03', competenciaFinal: '2026-03' },
      slides: {
        cover: {},
        highlights_financeiros: {},
        faturamento: {},
        despesas: {},
        rol_caixa: {},
        receita_vs_despesa: {},
        fopag: {},
        fluxo_caixa: {},
        lucro_produto_cliente: {},
        variacao_estoque: {},
        venda_estado: {},
        redes_sociais: { indisponivel: true },
      },
    };

    const blob = await generatePresentation(bundle, {});
    expect(blob.type).toContain('application/zip');
    expect(blob.size).toBeGreaterThan(1000);
  });
});
