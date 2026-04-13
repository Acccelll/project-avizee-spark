import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { generatePresentation } from './generatePresentation';
import type { ApresentacaoDataBundle } from '@/types/apresentacao';

async function unzip(blob: Blob) {
  return JSZip.loadAsync(blob as any);
}

describe('generatePresentation', () => {
  it('gera arquivo pptx válido (zip)', async () => {
    const bundle: ApresentacaoDataBundle = {
      periodo: { competenciaInicial: '2026-03', competenciaFinal: '2026-03' },
      slides: {
        cover: {},
        highlights_financeiros: { receita_atual: 120000, despesa_atual: 70000, valor_atual: 50000 },
        faturamento: { jan: 10000, fev: 12000, mar: 15000 },
        despesas: {},
        rol_caixa: {},
        receita_vs_despesa: {},
        fopag: { valor_atual: 25000, funcionarios: 23 },
        fluxo_caixa: {},
        lucro_produto_cliente: { ranking: [{ nome: 'Cliente A', valor: 1000 }] },
        variacao_estoque: { valor_atual: 80000, quantidade_itens: 120, custo_unitario_medio: 36 },
        venda_estado: { ranking: [{ estado: 'SP', valor: 50000 }] },
        redes_sociais: { indisponivel: true, motivo: 'dados indisponíveis' },
      },
    };

    const blob = await generatePresentation(bundle, {});
    expect(blob.type).toContain('application/zip');
    expect(blob.size).toBeGreaterThan(1000);

    const zip = await unzip(blob);
    expect(zip.file('ppt/presentation.xml')).toBeTruthy();
    expect(zip.file('ppt/slides/slide1.xml')).toBeTruthy();
  });

  it('renderiza box de indisponibilidade para slide indisponível', async () => {
    const bundle: ApresentacaoDataBundle = {
      periodo: { competenciaInicial: '2026-03', competenciaFinal: '2026-03' },
      slides: {
        redes_sociais: { indisponivel: true, motivo: 'não automatizado no modo fechado' },
      } as any,
    };

    const blob = await generatePresentation(bundle, {});
    const zip = await unzip(blob);
    const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('text');
    expect(slideXml).toContain('Dados indisponíveis nesta fase');
    expect(slideXml).toContain('não automatizado no modo fechado');
  });

  it('comentário editado prevalece sobre automático', async () => {
    const bundle: ApresentacaoDataBundle = {
      periodo: { competenciaInicial: '2026-03', competenciaFinal: '2026-03' },
      slides: {
        rol_caixa: { valor_atual: 1000, total_entradas: 3000, total_saidas: 2000 },
      } as any,
    };

    const blob = await generatePresentation(bundle, { rol_caixa: 'Comentário editado final' });
    const zip = await unzip(blob);
    const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('text');
    expect(slideXml).toContain('Comentário executivo');
    expect(slideXml).toContain('Comentário editado final');
  });

  it('gera layout de cover e closing com metadata discreta', async () => {
    const bundle: ApresentacaoDataBundle = {
      periodo: { competenciaInicial: '2026-03', competenciaFinal: '2026-03' },
      slides: {
        cover: {},
        closing: {},
      } as any,
    };

    const blob = await generatePresentation(bundle, {}, { metadata: { empresaId: 'e1', modo: 'fechado', usuario: 'u1', extra: 'x' } });
    const zip = await unzip(blob);
    const coverXml = await zip.file('ppt/slides/slide1.xml')!.async('text');
    const closingXml = await zip.file('ppt/slides/slide2.xml')!.async('text');

    expect(coverXml).toContain('AviZee | Apresentação Gerencial');
    expect(coverXml).toContain('Período: 2026-03 a 2026-03');
    expect(closingXml).toContain('Base: empresaId, modo, usuario');
    expect(closingXml).not.toContain('{"empresaId"');
  });

  it('renderiza conteúdo estruturado para slide de cards e de tabela/ranking', async () => {
    const bundle: ApresentacaoDataBundle = {
      periodo: { competenciaInicial: '2026-03', competenciaFinal: '2026-03' },
      slides: {
        highlights_financeiros: { receita_atual: 150000, despesa_atual: 90000, valor_atual: 60000, recebido: 140000 },
        bancos_detalhado: {
          linhas: [
            { banco_nome: 'Banco A', descricao: 'Conta 1', valor_atual: 10000 },
            { banco_nome: 'Banco B', descricao: 'Conta 2', valor_atual: 20000 },
          ],
        },
      } as any,
    };

    const blob = await generatePresentation(bundle, {});
    const zip = await unzip(blob);
    const cardsXml = await zip.file('ppt/slides/slide1.xml')!.async('text');
    const tableXml = await zip.file('ppt/slides/slide2.xml')!.async('text');

    expect(cardsXml).toContain('Card1');
    expect(cardsXml).toContain('R$');
    expect(tableXml).toContain('TableHeader');
    expect(tableXml).toContain('Banco A');
  });

  it('aplica tema dark quando solicitado', async () => {
    const bundle: ApresentacaoDataBundle = {
      periodo: { competenciaInicial: '2026-03', competenciaFinal: '2026-03' },
      slides: { cover: {} } as any,
    };

    const blob = await generatePresentation(bundle, {}, { themePreset: 'dark' });
    const zip = await unzip(blob);
    const themeXml = await zip.file('ppt/theme/theme1.xml')!.async('text');
    expect(themeXml).toContain('60A5FA');
    expect(themeXml).toContain('111827');
  });

  it('aplica override de cor de acento do template', async () => {
    const bundle: ApresentacaoDataBundle = {
      periodo: { competenciaInicial: '2026-03', competenciaFinal: '2026-03' },
      slides: { cover: {} } as any,
    };

    const blob = await generatePresentation(bundle, {}, { themeConfig: { theme: { palette: 'default', accentColor: '#22C55E' } } });
    const zip = await unzip(blob);
    const themeXml = await zip.file('ppt/theme/theme1.xml')!.async('text');
    expect(themeXml).toContain('22C55E');
  });

  it('slides avançados opcionais não quebram a geração', async () => {
    const bundle: ApresentacaoDataBundle = {
      periodo: { competenciaInicial: '2026-03', competenciaFinal: '2026-03' },
      slides: {
        bridge_ebitda: { valor_atual: 12000, impacto_positivo: 20000, impacto_negativo: 8000 },
        bridge_lucro_liquido: { valor_atual: 9000, lucro_operacional: 15000, despesas: 6000 },
      } as any,
    };

    const blob = await generatePresentation(bundle, {});
    const zip = await unzip(blob);
    expect(zip.file('ppt/slides/slide1.xml')).toBeTruthy();
    expect(zip.file('ppt/slides/slide2.xml')).toBeTruthy();
  });
});
