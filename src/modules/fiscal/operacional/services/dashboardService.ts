import type { CentralFiscalResumo } from '../types';

export interface DashboardMetricasInput {
  documentos: {
    emitidos: number;
    recebidos: number;
    autorizadas: number;
    rejeitadas: number;
    canceladas: number;
  };
  distDFe: { pendentes: number };
  escrituracao: { inconsistencias: number };
  processamento: { pendentes: number };
}

export class FiscalDashboardService {
  resumir(input: DashboardMetricasInput): CentralFiscalResumo {
    return {
      emitidos: input.documentos.emitidos,
      recebidos: input.documentos.recebidos,
      autorizadas: input.documentos.autorizadas,
      rejeitadas: input.documentos.rejeitadas,
      canceladas: input.documentos.canceladas,
      distDFePendentes: input.distDFe.pendentes,
      inconsistencias: input.escrituracao.inconsistencias,
      processamentoPendente: input.processamento.pendentes,
      atualizadoEm: new Date().toISOString(),
    };
  }

  taxaAutorizacao(input: DashboardMetricasInput): number {
    const total = input.documentos.autorizadas + input.documentos.rejeitadas;
    if (!total) return 0;
    return +(input.documentos.autorizadas / total).toFixed(4);
  }
}
