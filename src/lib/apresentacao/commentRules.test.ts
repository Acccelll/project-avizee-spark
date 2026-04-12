import { describe, expect, it } from 'vitest';
import { buildAutomaticComment } from './commentRules';
import { pickEditedComment } from './utils';

describe('commentRules', () => {
  it('gera comentário determinístico para faturamento', () => {
    const comment = buildAutomaticComment('faturamento', { valor_atual: 1000, valor_anterior: 800 });
    expect(comment).toContain('Faturamento do período');
    expect(comment).toContain('R$');
  });

  it('prioriza comentario_editado quando existir', () => {
    expect(pickEditedComment('auto', 'editado')).toBe('editado');
    expect(pickEditedComment('auto', '')).toBe('auto');
  });
});
