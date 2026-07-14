import type { ApuracaoPeriodo, DocumentoConsolidado, InconsistenciaFiscal } from '../domain/entities';

export interface IndicadoresFiscais {
  documentosEmitidos: number;
  documentosRecebidos: number;
  totalDebitos: number;
  totalCreditos: number;
  totalAPagar: number;
  inconsistenciasAltas: number;
  documentosPendentes: number;
  tributosPorTipo: Record<string, number>;
}

export class DashboardsFiscais {
  gerar(
    docs: DocumentoConsolidado[],
    apuracao: ApuracaoPeriodo | null,
    inconsistencias: InconsistenciaFiscal[],
  ): IndicadoresFiscais {
    const emitidos = docs.filter((d) => d.operacao === 'saida').length;
    const recebidos = docs.filter((d) => d.operacao === 'entrada').length;
    const pendentes = docs.filter((d) => d.situacao === 'valido' && !d.chave).length;
    const tributosPorTipo: Record<string, number> = {};
    for (const t of apuracao?.tributos ?? []) tributosPorTipo[t.tributo] = t.saldoAPagar;
    return {
      documentosEmitidos: emitidos,
      documentosRecebidos: recebidos,
      totalDebitos: apuracao?.totalDebitos ?? 0,
      totalCreditos: apuracao?.totalCreditos ?? 0,
      totalAPagar: apuracao?.totalAPagar ?? 0,
      inconsistenciasAltas: inconsistencias.filter((i) => ['alta', 'critica'].includes(i.severidade)).length,
      documentosPendentes: pendentes,
      tributosPorTipo,
    };
  }
}
