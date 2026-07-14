import type { DocumentoConsolidado } from '../domain/entities';
import type { EscrituracaoDeps } from './contracts';

export interface EntradaConsolidacao {
  periodoId: string;
  documentos: DocumentoConsolidado[];
}

/**
 * Consolida documentos emitidos, recebidos e eventos em uma visão fiscal do período.
 * Aplica filtros de situação (canceladas/inutilizadas são mantidas mas marcadas).
 */
export class ConsolidacaoFiscal {
  constructor(private readonly deps: Pick<EscrituracaoDeps, 'documentos'>) {}

  async executar(entrada: EntradaConsolidacao): Promise<number> {
    const validos = entrada.documentos.filter((d) => d.periodoId === entrada.periodoId);
    return this.deps.documentos.upsertLote(validos);
  }

  totalizarPorOperacao(docs: DocumentoConsolidado[]) {
    const acc = { entrada: 0, saida: 0 };
    for (const d of docs) {
      if (d.situacao !== 'valido') continue;
      acc[d.operacao] += d.valorTotal;
    }
    return acc;
  }
}
