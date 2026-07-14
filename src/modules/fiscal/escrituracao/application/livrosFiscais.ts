import type { DocumentoConsolidado, LivroFiscal } from '../domain/entities';

export type LayoutLivro = 'entradas_v1' | 'saidas_v1' | 'apuracao_icms_v1' | 'apuracao_ipi_v1' | 'inventario_v1';

/**
 * Geração de livros fiscais orientada por layouts parametrizáveis.
 * Cada layout define quais colunas extrair; layouts adicionais são plugáveis.
 */
export class LivrosFiscais {
  gerarEntradas(periodoId: string, empresaId: string, docs: DocumentoConsolidado[]): LivroFiscal {
    return this.gerar('entradas', 'entradas_v1', periodoId, empresaId, docs.filter((d) => d.operacao === 'entrada'));
  }

  gerarSaidas(periodoId: string, empresaId: string, docs: DocumentoConsolidado[]): LivroFiscal {
    return this.gerar('saidas', 'saidas_v1', periodoId, empresaId, docs.filter((d) => d.operacao === 'saida'));
  }

  gerarApuracaoIcms(periodoId: string, empresaId: string, docs: DocumentoConsolidado[]): LivroFiscal {
    const linhas = docs.filter((d) => d.situacao === 'valido').map((d) => ({
      chave: d.chave,
      cfop: d.cfop,
      cst: d.cst,
      base: d.baseIcms ?? 0,
      valor: d.valorIcms ?? 0,
      tipo: d.operacao === 'saida' ? 'debito' : 'credito',
    }));
    return {
      tipo: 'apuracao_icms',
      layout: 'apuracao_icms_v1',
      periodoId,
      empresaId,
      linhas,
      geradoEm: new Date().toISOString(),
    };
  }

  private gerar(
    tipo: LivroFiscal['tipo'],
    layout: LayoutLivro,
    periodoId: string,
    empresaId: string,
    docs: DocumentoConsolidado[],
  ): LivroFiscal {
    return {
      tipo,
      layout,
      periodoId,
      empresaId,
      geradoEm: new Date().toISOString(),
      linhas: docs.map((d) => ({
        chave: d.chave,
        numero: d.numero,
        serie: d.serie,
        data: d.dataEmissao,
        cfop: d.cfop,
        cst: d.cst ?? d.csosn,
        ncm: d.ncm,
        valor: d.valorTotal,
        icms: d.valorIcms ?? 0,
        ipi: d.valorIpi ?? 0,
        pis: d.valorPis ?? 0,
        cofins: d.valorCofins ?? 0,
        situacao: d.situacao,
      })),
    };
  }
}
