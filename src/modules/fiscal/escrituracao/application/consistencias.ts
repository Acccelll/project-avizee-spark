import type { DocumentoConsolidado, InconsistenciaFiscal, RegimeTributario } from '../domain/entities';
import { detectarInconsistencias } from '../domain/rules';
import type { EscrituracaoDeps } from './contracts';

export class ConsistenciasFiscais {
  constructor(private readonly deps: Pick<EscrituracaoDeps, 'inconsistencias' | 'documentos' | 'regime'>) {}

  async analisar(periodoId: string, empresaId: string): Promise<InconsistenciaFiscal[]> {
    const [docs, regime] = await Promise.all([
      this.deps.documentos.listarPorPeriodo(periodoId),
      this.deps.regime.regimeDe(empresaId, new Date().toISOString()),
    ]);
    const items = docs.flatMap((d) => detectarInconsistencias(d, regime));
    if (items.length) await this.deps.inconsistencias.registrarLote(items);
    return items;
  }

  detectarLote(docs: DocumentoConsolidado[], regime: RegimeTributario): InconsistenciaFiscal[] {
    return docs.flatMap((d) => detectarInconsistencias(d, regime));
  }
}
