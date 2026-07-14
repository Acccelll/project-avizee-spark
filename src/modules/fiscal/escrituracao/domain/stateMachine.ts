import type { StatusPeriodo } from './entities';

/**
 * Máquina de estados do período fiscal.
 * aberto → em_apuracao → apurado → fechado
 * fechado → reaberto → em_apuracao (controlado, gera nova versão)
 */
const TRANSICOES: Record<StatusPeriodo, StatusPeriodo[]> = {
  aberto: ['em_apuracao'],
  em_apuracao: ['apurado', 'aberto'],
  apurado: ['fechado', 'em_apuracao'],
  fechado: ['reaberto'],
  reaberto: ['em_apuracao'],
};

export function podeTransicionar(de: StatusPeriodo, para: StatusPeriodo): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}

export function assertTransicao(de: StatusPeriodo, para: StatusPeriodo): void {
  if (!podeTransicionar(de, para)) {
    throw new Error(`Transição de período inválida: ${de} → ${para}`);
  }
}
