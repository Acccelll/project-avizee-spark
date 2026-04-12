import { describe, expect, it } from 'vitest';
import { APRESENTACAO_SLIDES_V1 } from './slideDefinitions';

describe('slideDefinitions', () => {
  it('contém os 12 slides mínimos da V1', () => {
    expect(APRESENTACAO_SLIDES_V1).toHaveLength(12);
    expect(APRESENTACAO_SLIDES_V1.map((s) => s.codigo)).toContain('redes_sociais');
  });
});
