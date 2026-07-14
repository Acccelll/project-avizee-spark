import type { FluxoHomologado, ResultadoFluxo } from '../types';

export type FluxoHandler = () => Promise<void>;

/**
 * Runner leve para amarrar fluxos ponta a ponta.
 * Cada fluxo é uma função async que executa o cenário completo
 * usando os serviços já implementados nas Etapas 4–10.
 * Não substitui vitest — complementa como orquestrador de cenários.
 */
export class E2ERunner {
  private fluxos = new Map<FluxoHomologado, FluxoHandler>();

  registrar(fluxo: FluxoHomologado, handler: FluxoHandler): void {
    this.fluxos.set(fluxo, handler);
  }

  async executar(fluxo: FluxoHomologado): Promise<ResultadoFluxo> {
    const handler = this.fluxos.get(fluxo);
    if (!handler) {
      return { fluxo, sucesso: false, duracaoMs: 0, erros: [`Fluxo não registrado: ${fluxo}`] };
    }
    const inicio = Date.now();
    const erros: string[] = [];
    try {
      await handler();
    } catch (err) {
      erros.push(err instanceof Error ? err.message : String(err));
    }
    return {
      fluxo,
      sucesso: erros.length === 0,
      duracaoMs: Date.now() - inicio,
      erros,
    };
  }

  async executarTodos(): Promise<ResultadoFluxo[]> {
    const out: ResultadoFluxo[] = [];
    for (const fluxo of this.fluxos.keys()) out.push(await this.executar(fluxo));
    return out;
  }
}
