import type { RecuperacaoResultado } from '../types';

export interface CenarioFalha {
  nome: string;
  falhasIniciais: number; // quantas tentativas devem falhar antes de recuperar
  maxTentativas: number;
  operacao: () => Promise<void>;
  backoffMs?: (tentativa: number) => number;
}

/**
 * Executor de cenários de falha e recuperação.
 * Compatível com a estratégia de retry/backoff da Etapa 5 (retryPolicy).
 */
export class RecuperacaoService {
  async executar(cenario: CenarioFalha): Promise<RecuperacaoResultado> {
    const inicio = Date.now();
    let tentativas = 0;
    let falhasSimuladas = 0;
    let recuperado = false;

    while (tentativas < cenario.maxTentativas) {
      tentativas++;
      try {
        if (falhasSimuladas < cenario.falhasIniciais) {
          falhasSimuladas++;
          throw new Error(`falha simulada #${falhasSimuladas} em ${cenario.nome}`);
        }
        await cenario.operacao();
        recuperado = true;
        break;
      } catch {
        const espera = cenario.backoffMs?.(tentativas) ?? 0;
        if (espera > 0) await new Promise((r) => setTimeout(r, espera));
      }
    }

    return {
      cenario: cenario.nome,
      disparouRetry: tentativas > 1,
      recuperado,
      tentativas,
      duracaoMs: Date.now() - inicio,
    };
  }
}
