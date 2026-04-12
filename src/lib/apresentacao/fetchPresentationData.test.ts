import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { fetchPresentationData } from './fetchPresentationData';

function chainWithData(data: unknown[], error: unknown = null) {
  return {
    select: vi.fn(() => ({
      gte: vi.fn(() => ({ lte: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data, error })) })) })),
      eq: vi.fn(() => Promise.resolve({ data, error })),
    })),
  };
}

describe('fetchPresentationData', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('bloqueia modo fechado sem fechamento', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'fechamentos_mensais') return chainWithData([]);
      return chainWithData([{ competencia: '2026-03', valor_atual: 10 }]);
    });

    await expect(fetchPresentationData('2026-03-01', '2026-03-01', 'fechado')).rejects.toThrow(/Modo fechado/);
  });

  it('retorna bundle no modo dinâmico', async () => {
    fromMock.mockImplementation(() => chainWithData([{ competencia: '2026-03', valor_atual: 10 }]));
    const result = await fetchPresentationData('2026-03-01', '2026-03-01', 'dinamico');
    expect(result.slides.faturamento).toBeTruthy();
  });
});
