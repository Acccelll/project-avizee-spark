/**
 * Máquina de estados do documento recebido. Qualquer transição fora
 * do mapa é rejeitada com FISCAL.INTERNAL preservando consistência.
 */
import type { StatusRecebimento } from './entities';
import type { Result } from '../../core/types';
import { ok, fail } from '../../core/types';
import { makeError, FISCAL_ERROR_CODES } from '../../core/errors';

const TRANSICOES: Record<StatusRecebimento, StatusRecebimento[]> = {
  recebido: ['em_validacao', 'duplicado', 'invalido', 'arquivado'],
  em_validacao: ['validado', 'invalido', 'duplicado'],
  validado: ['em_conciliacao', 'pendente_aprovacao', 'integrado', 'arquivado'],
  invalido: ['reprocessando', 'arquivado'],
  duplicado: ['arquivado'],
  em_conciliacao: ['pendente_aprovacao', 'integrado', 'rejeitado'],
  pendente_aprovacao: ['integrado', 'rejeitado', 'reprocessando'],
  integrado: ['arquivado'],
  rejeitado: ['reprocessando', 'arquivado'],
  reprocessando: ['em_validacao', 'validado', 'invalido'],
  arquivado: [],
};

export function canTransition(from: StatusRecebimento, to: StatusRecebimento): boolean {
  return TRANSICOES[from]?.includes(to) ?? false;
}

export function transition(from: StatusRecebimento, to: StatusRecebimento): Result<StatusRecebimento> {
  if (!canTransition(from, to)) {
    return fail(makeError(FISCAL_ERROR_CODES.INTERNAL, `transição inválida: ${from} → ${to}`));
  }
  return ok(to);
}