import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { generatePresentation } from './generatePresentation';
import type { ApresentacaoDataBundle } from '@/types/apresentacao';

async function unzip(blob: Blob) {
  // jsdom's Blob.arrayBuffer() can return empty data; Response handles it correctly.
  const buf = await new Response(blob).arrayBuffer();
  return JSZip.loadAsync(buf);
}

async function allSlideXml(zip: JSZip): Promise<string[]> {
  const slideFiles = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort();
  return Promise.all(slideFiles.map((p) => zip.file(p)!.async('text')));
}

describe('generatePresentation', () => {
  it('gera arquivo pptx válido com charts nativos', async () => {
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
    expect(blob.size).toBeGreaterThan(1000);

    const zip = await unzip(blob);
    expect(zip.file('ppt/presentation.xml')).toBeTruthy();
    const slideXmls = await allSlideXml(zip);
    expect(slideXmls.length).toBe(12);

    // pelo menos um chart nativo gerado
    const chartFiles = Object.keys(zip.files).filter((p) => p.startsWith('ppt/charts/chart'));
    expect(chartFiles.length).toBeGreaterThan(0);
  });

  it('renderiza box de indisponibilidade para slide indisponível', async () => {
    const bundle: ApresentacaoDataBundle = {
      periodo: { competenciaInicial: '2026-03', competenciaFinal: '2026-03' },
      slides: {
        redes_sociais: { indisponivel: true, motivo: 'não automatizado no modo fechado' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    };

    const blob = await generatePresentation(bundle, {});
    const zip = await unzip(blob);
    const xml = (await allSlideXml(zip))[0];
    expect(xml).toContain('Dados indisponíveis nesta fase');
    expect(xml).toContain('não automatizado no modo fechado');
  });

  it('comentário editado prevalece sobre automático', async () => {
    const bundle: ApresentacaoDataBundle = {
      periodo: { competenciaInicial: '2026-03', competenciaFinal: '2026-03' },
      slides: {
        rol_caixa: { valor_atual: 1000, total_entradas: 3000, total_saidas: 2000 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    };

    const blob = await generatePresentation(bundle, { rol_caixa: 'Comentário editado final' });
    const zip = await unzip(blob);
    const xml = (await allSlideXml(zip))[0];
    expect(xml).toContain('Comentário executivo');
    expect(xml).toContain('Comentário editado final');
  });

  it('gera layout de cover e closing com metadata discreta', async () => {
    const bundle: ApresentacaoDataBundle = {
      periodo: { competenciaInicial: '2026-03', competenciaFinal: '2026-03' },
      slides: {
        cover: {},
        closing: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    };

    const blob = await generatePresentation(bundle, {}, { metadata: { empresaId: 'e1', modo: 'fechado', usuario: 'u1', extra: 'x' } });
    const zip = await unzip(blob);
    const [coverXml, closingXml] = await allSlideXml(zip);
    expect(coverXml).toContain('AviZee | Apresentação Gerencial');
    expect(coverXml).toContain('Período: 2026-03 a 2026-03');
    expect(closingXml).toContain('Base: empresaId, modo, usuario');
    expect(closingXml).not.toContain('{&quot;empresaId&quot;');
  });

  it('renderiza cards e tabela com valores formatados', async () => {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    };

    const blob = await generatePresentation(bundle, {});
    const zip = await unzip(blob);
    const [cardsXml, tableXml] = await allSlideXml(zip);
    expect(cardsXml).toContain('R$');
    expect(tableXml).toContain('Banco A');
    expect(tableXml).toContain('Banco B');
  });
});
