import { describe, expect, it } from 'vitest';
import { activeSlides, resolveSlideConfig } from './templateResolver';

describe('templateResolver', () => {
  it('interpreta seed em formato objeto (codigo/enabled/order)', () => {
    const config = resolveSlideConfig({
      id: 'seed', nome: 'seed', codigo: 'APRESENTACAO_GERENCIAL_V1', versao: '1.0', ativo: true, descricao: null,
      config_json: { slides: [{ codigo: 'cover', enabled: true, order: 1 }, { codigo: 'bridge_ebitda', enabled: false, order: 21 }] },
      arquivo_path: null, created_at: '', updated_at: '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(config.find((c) => c.codigo === 'cover')?.enabled).toBe(true);
    expect(config.find((c) => c.codigo === 'bridge_ebitda')?.enabled).toBe(false);
  });

  it('aplica configurações de template e geração para opcionais', () => {
    const config = resolveSlideConfig({
      id: '1', nome: 'T', codigo: 'T1', versao: '1.0', ativo: true, descricao: null,
      config_json: { slides: [{ codigo: 'bridge_ebitda', enabled: true, order: 14 }] },
      arquivo_path: null, created_at: '', updated_at: '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any, [{ codigo: 'top_clientes', enabled: true, order: 20 } as any]);

    const actives = activeSlides(config);
    expect(actives).toContain('bridge_ebitda');
    expect(actives).toContain('top_clientes');
  });
});
