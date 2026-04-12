import { describe, expect, it } from 'vitest';
import { APRESENTACAO_SLIDES_V2 } from './slideDefinitions';

describe('slideDefinitions', () => {
  it('contém V1 + slides avançados da fase 2', () => {
    expect(APRESENTACAO_SLIDES_V2.length).toBeGreaterThanOrEqual(28);
    expect(APRESENTACAO_SLIDES_V2.map((s) => s.codigo)).toContain('bridge_ebitda');
    expect(APRESENTACAO_SLIDES_V2.map((s) => s.codigo)).toContain('closing');
  });
});
