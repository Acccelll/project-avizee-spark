import type { PeriodoFiscal } from '../domain/entities';
import { assertTransicao } from '../domain/stateMachine';
import type { EscrituracaoDeps } from './contracts';

/**
 * Motor de fechamento fiscal.
 * Aplica versionamento incremental na reabertura para preservar histórico.
 */
export class FechamentoFiscal {
  constructor(private readonly deps: Pick<EscrituracaoDeps, 'periodos'>) {}

  async abrir(empresaId: string, ano: number, mes: number, id: string): Promise<PeriodoFiscal> {
    const existente = await this.deps.periodos.buscar(empresaId, ano, mes);
    if (existente) return existente;
    return this.deps.periodos.salvar({
      id, empresaId, ano, mes, status: 'aberto', versao: 1,
    });
  }

  async iniciarApuracao(periodo: PeriodoFiscal): Promise<PeriodoFiscal> {
    assertTransicao(periodo.status, 'em_apuracao');
    return this.deps.periodos.atualizarStatus(periodo.id, { status: 'em_apuracao' });
  }

  async marcarApurado(periodo: PeriodoFiscal): Promise<PeriodoFiscal> {
    assertTransicao(periodo.status, 'apurado');
    return this.deps.periodos.atualizarStatus(periodo.id, { status: 'apurado' });
  }

  async fechar(periodo: PeriodoFiscal, usuarioId: string): Promise<PeriodoFiscal> {
    assertTransicao(periodo.status, 'fechado');
    return this.deps.periodos.atualizarStatus(periodo.id, {
      status: 'fechado',
      fechadoEm: new Date().toISOString(),
      fechadoPor: usuarioId,
    });
  }

  async reabrir(periodo: PeriodoFiscal): Promise<PeriodoFiscal> {
    assertTransicao(periodo.status, 'reaberto');
    return this.deps.periodos.atualizarStatus(periodo.id, {
      status: 'reaberto',
      versao: periodo.versao + 1,
    });
  }
}
