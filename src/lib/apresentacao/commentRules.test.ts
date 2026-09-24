import { describe, expect, it } from 'vitest';
import { buildAutomaticComment } from './commentRules';
import { pickEditedComment } from './utils';

describe('commentRules', () => {
  it('gera comentário determinístico para faturamento', () => {
    const comment = buildAutomaticComment('faturamento', { valor_atual: 1000, valor_anterior: 800 });
    expect(comment).toContain('Valor atual');
    expect(comment).toContain('R$');
  });

  it('prioriza comentario_editado quando existir', () => {
    expect(pickEditedComment('auto', 'editado')).toBe('editado');
    expect(pickEditedComment('auto', '')).toBe('auto');
  });

  it('usa o motivo específico quando o slide está indisponível', () => {
    const comment = buildAutomaticComment('fopag', { indisponivel: true, motivo: 'sem retiradas de sócios nem folha de pagamento no período' });
    expect(comment).toBe('Sem dados neste período: sem retiradas de sócios nem folha de pagamento no período.');
  });

  it('cai no texto genérico quando não há motivo informado', () => {
    const comment = buildAutomaticComment('fopag', { indisponivel: true });
    expect(comment).toBe('Sem dados neste período: dados indisponíveis ou não automatizados nesta fase.');
  });
});
