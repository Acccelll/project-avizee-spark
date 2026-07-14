/**
 * Máquina de estados da NF-e. Transições explícitas — qualquer transição
 * fora do mapa é rejeitada com FISCAL.INTERNAL para preservar consistência.
 */
import type { NFeStatus } from './entities';
import type { Result } from '../../core/types';
import { ok, fail } from '../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../core/errors';

const TRANSICOES: Record<NFeStatus, NFeStatus[]> = {
  rascunho: ['validada', 'rascunho', 'inutilizada'],
  validada: ['assinada', 'rascunho'],
  assinada: ['transmitida', 'rascunho'],
  transmitida: ['em_processamento', 'rejeitada', 'denegada', 'autorizada'],
  em_processamento: ['autorizada', 'denegada', 'rejeitada'],
  autorizada: ['cancelada', 'arquivada', 'autorizada'],
  denegada: ['arquivada'],
  rejeitada: ['rascunho', 'arquivada'],
  cancelada: ['arquivada'],
  inutilizada: ['arquivada'],
  arquivada: [],
};

export function canTransition(from: NFeStatus, to: NFeStatus): boolean {
  return TRANSICOES[from]?.includes(to) ?? false;
}

export function transition(from: NFeStatus, to: NFeStatus): Result<NFeStatus> {
  if (!canTransition(from, to)) {
    return fail(makeError(
      FISCAL_ERROR_CODES.INTERNAL,
      `transição inválida: ${from} → ${to}`,
    ));
  }
  return ok(to);
}