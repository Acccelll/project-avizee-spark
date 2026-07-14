import type { TributoDefinicao } from '../domain/entities';

/**
 * Motor tributário abstrato — opera sobre componentes tributários genéricos.
 * Cada tributo declara um `calculador` desacoplado (função pura). Não há
 * dependência hard-coded de ICMS/IPI/PIS/COFINS: novos tributos (IBS, CBS, IS,
 * futuros) plugam-se sem reescrever o núcleo.
 */
export interface EntradaCalculo {
  baseCalculo: number;
  quantidade?: number;
  parametros?: Record<string, unknown>;
}
export interface ResultadoCalculo {
  tributoId: string;
  valor: number;
  base: number;
  aliquota?: number;
  detalhes?: Record<string, unknown>;
}
export type Calculador = (t: TributoDefinicao, e: EntradaCalculo) => ResultadoCalculo;

export class MotorTributarioAbstrato {
  private calculadores = new Map<string, Calculador>();

  registrar(tributoId: string, calc: Calculador) {
    this.calculadores.set(tributoId, calc);
  }

  calcular(tributos: TributoDefinicao[], entrada: EntradaCalculo): ResultadoCalculo[] {
    return tributos.map((t) => {
      const calc = this.calculadores.get(t.id);
      if (!calc) {
        return { tributoId: t.id, valor: 0, base: entrada.baseCalculo, detalhes: { motivo: 'calculador_nao_registrado' } };
      }
      return calc(t, entrada);
    });
  }
}

/** Calculador padrão parametrizado por alíquota percentual em `t.parametros.aliquota`. */
export const calculadorAliquotaSimples: Calculador = (t, e) => {
  const aliquota = Number((t.parametros as { aliquota?: number })?.aliquota ?? 0);
  const valor = +(e.baseCalculo * aliquota / 100).toFixed(2);
  return { tributoId: t.id, base: e.baseCalculo, aliquota, valor };
};
