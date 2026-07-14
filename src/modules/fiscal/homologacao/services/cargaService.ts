import type { CargaResultado } from '../types';

export interface CargaConfig<T> {
  total: number;
  concorrencia: number;
  fabrica: (indice: number) => T;
  executar: (entrada: T) => Promise<void>;
}

/**
 * Executor de carga simples com concorrência limitada.
 * Mede throughput e falhas — não pretende substituir k6/artillery,
 * mas oferece um baseline reprodutível dentro do próprio Node.
 */
export class CargaService {
  async executar<T>(cfg: CargaConfig<T>): Promise<CargaResultado> {
    const inicio = Date.now();
    let falhas = 0;
    let cursor = 0;
    const worker = async () => {
      while (cursor < cfg.total) {
        const i = cursor++;
        try { await cfg.executar(cfg.fabrica(i)); }
        catch { falhas++; }
      }
    };
    const workers = Array.from({ length: cfg.concorrencia }, () => worker());
    await Promise.all(workers);
    const duracaoTotalMs = Math.max(1, Date.now() - inicio);
    return {
      totalDocumentos: cfg.total,
      concorrencia: cfg.concorrencia,
      duracaoTotalMs,
      throughputPorSegundo: +(cfg.total / (duracaoTotalMs / 1000)).toFixed(2),
      falhas,
    };
  }
}
