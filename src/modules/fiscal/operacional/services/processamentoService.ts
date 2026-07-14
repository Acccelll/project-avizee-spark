import type { FilaSnapshot, ProcessamentoJob } from '../types';

export interface IJobRepository {
  listar(filtro?: { status?: ProcessamentoJob['status']; fila?: string }): Promise<ProcessamentoJob[]>;
  atualizar(id: string, patch: Partial<ProcessamentoJob>): Promise<ProcessamentoJob>;
}

export class ProcessamentoService {
  constructor(private readonly repo: IJobRepository) {}

  async snapshotFilas(): Promise<FilaSnapshot[]> {
    const jobs = await this.repo.listar();
    const buckets = new Map<string, ProcessamentoJob[]>();
    for (const j of jobs) {
      const list = buckets.get(j.fila) ?? [];
      list.push(j);
      buckets.set(j.fila, list);
    }
    const agora = Date.now();
    return [...buckets.entries()].map(([nome, list]) => {
      const falhas24h = list.filter(
        (j) => j.status === 'falhou' && agora - new Date(j.atualizadoEm).getTime() < 24 * 3600_000,
      ).length;
      const tempos = list
        .filter((j) => j.status === 'concluido')
        .map((j) => new Date(j.atualizadoEm).getTime() - new Date(j.criadoEm).getTime())
        .filter((v) => v > 0);
      return {
        nome,
        pendentes: list.filter((j) => j.status === 'pendente').length,
        emProcessamento: list.filter((j) => j.status === 'processando').length,
        falhas24h,
        ultimaExecucao: list
          .map((j) => j.atualizadoEm)
          .sort()
          .at(-1),
        tempoMedioMs: tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : undefined,
      };
    });
  }

  async reprocessar(id: string): Promise<ProcessamentoJob> {
    return this.repo.atualizar(id, {
      status: 'reprocessando',
      atualizadoEm: new Date().toISOString(),
      tentativas: undefined,
    });
  }
}
