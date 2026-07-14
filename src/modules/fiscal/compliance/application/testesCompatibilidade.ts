import type { CompatibilidadeEngine, AmbienteFiscalRef } from './compatibilidadeEngine';

/**
 * Suíte reutilizável para validar coexistência de versões antigas/atuais/novas
 * em múltiplas empresas e ambientes. Cada cenário é serializável e pode ser
 * reexecutado quando uma nova NT ou layout for publicado.
 */
export interface CenarioCompatibilidade {
  id: string;
  descricao: string;
  ambientes: AmbienteFiscalRef[];
  refIso?: string;
}
export interface ResultadoCenario {
  cenarioId: string;
  totalAmbientes: number;
  criticos: number;
  altos: number;
  medios: number;
  detalhes: Array<{ ambiente: AmbienteFiscalRef; alertas: number }>;
}

export class SuiteCompatibilidade {
  constructor(private readonly engine: CompatibilidadeEngine) {}

  async executar(cenario: CenarioCompatibilidade): Promise<ResultadoCenario> {
    let criticos = 0, altos = 0, medios = 0;
    const detalhes: ResultadoCenario['detalhes'] = [];
    for (const amb of cenario.ambientes) {
      const alertas = await this.engine.validar(amb, cenario.refIso);
      criticos += alertas.filter((a) => a.nivel === 'critico').length;
      altos += alertas.filter((a) => a.nivel === 'alto').length;
      medios += alertas.filter((a) => a.nivel === 'medio').length;
      detalhes.push({ ambiente: amb, alertas: alertas.length });
    }
    return {
      cenarioId: cenario.id,
      totalAmbientes: cenario.ambientes.length,
      criticos, altos, medios, detalhes,
    };
  }
}
