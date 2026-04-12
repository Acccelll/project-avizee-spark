import { describe, expect, it } from 'vitest';
import { activeSlides, resolveSlideConfig } from './templateResolver';

describe('templateResolver', () => {
  it('aplica configurações de template e geração para opcionais', () => {
    const config = resolveSlideConfig({
      id: '1', nome: 'T', codigo: 'T1', versao: '1.0', ativo: true, descricao: null,
      config_json: { slides: [{ codigo: 'bridge_ebitda', enabled: true, order: 14 }] },
      arquivo_path: null, created_at: '', updated_at: '',
    } as any, [{ codigo: 'top_clientes', enabled: true, order: 20 } as any]);

    const actives = activeSlides(config);
    expect(actives).toContain('bridge_ebitda');
    expect(actives).toContain('top_clientes');
  });
});
