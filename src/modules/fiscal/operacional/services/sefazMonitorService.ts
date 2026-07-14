import type { SefazServicoSnapshot, SefazStatus } from '../types';

export interface SefazPing {
  uf: string;
  ambiente: 'producao' | 'homologacao';
  servico: string;
  latenciaMs?: number;
  sucesso: boolean;
  breaker: 'closed' | 'open' | 'half_open';
  timestamp: string;
}

/**
 * Avalia disponibilidade da SEFAZ a partir de pings coletados pelo transporte HTTP/SOAP.
 * Reutiliza o `circuitBreaker` já existente (Etapa 5) apenas como fonte de estado.
 */
export class SefazMonitorService {
  private thresholdLento = 1500;
  private janelaFalhas = 5;

  agregar(pings: SefazPing[]): SefazServicoSnapshot[] {
    const buckets = new Map<string, SefazPing[]>();
    for (const p of pings) {
      const key = `${p.uf}|${p.ambiente}|${p.servico}`;
      const list = buckets.get(key) ?? [];
      list.push(p);
      buckets.set(key, list);
    }
    return [...buckets.entries()].map(([key, list]) => {
      const [uf, ambiente, servico] = key.split('|');
      const ultimos = list.slice(-this.janelaFalhas);
      const falhas = ultimos.filter((p) => !p.sucesso).length;
      const latencias = list.map((p) => p.latenciaMs).filter((v): v is number => typeof v === 'number');
      const latencia = latencias.length ? Math.round(latencias.reduce((a, b) => a + b, 0) / latencias.length) : undefined;
      const ultimo = list[list.length - 1];
      return {
        uf,
        ambiente: ambiente as 'producao' | 'homologacao',
        servico,
        status: this.classificar(falhas, latencia, ultimo?.breaker),
        latenciaMs: latencia,
        ultimaVerificacao: ultimo?.timestamp ?? new Date().toISOString(),
        falhasRecentes: falhas,
        circuitBreaker: ultimo?.breaker ?? 'closed',
      };
    });
  }

  private classificar(falhas: number, latencia: number | undefined, breaker?: string): SefazStatus {
    if (breaker === 'open') return 'indisponivel';
    if (falhas >= this.janelaFalhas) return 'indisponivel';
    if (falhas > 0) return 'lento';
    if (typeof latencia === 'number' && latencia > this.thresholdLento) return 'lento';
    if (typeof latencia === 'number') return 'disponivel';
    return 'desconhecido';
  }
}
