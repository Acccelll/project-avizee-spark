import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));

import { fetchPresentationData } from './fetchPresentationData';

function closingQuery(data: unknown[], error: unknown = null) {
  return {
    select: vi.fn(() => ({
      gte: vi.fn(() => ({ lte: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data, error })) })) })),
    })),
  };
}

function inQuery(data: unknown[], error: unknown = null) {
  return {
    select: vi.fn(() => ({ in: vi.fn(() => Promise.resolve({ data, error })) })),
  };
}

function dynamicQuery(data: unknown[], error: unknown = null) {
  return {
    select: vi.fn(() => ({ gte: vi.fn(() => ({ lte: vi.fn(() => Promise.resolve({ data, error })) })) })),
  };
}

describe('fetchPresentationData', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('bloqueia modo fechado sem cobertura completa', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'fechamentos_mensais') return closingQuery([{ id: 'f1', competencia: '2026-03-01', status: 'fechado' }]);
      return inQuery([]);
    });

    await expect(fetchPresentationData('2026-03-01', '2026-04-01', 'fechado', ['rol_caixa'])).rejects.toThrow(/cobertura completa/);
  });

  it('retorna fechado por snapshot para slide crítico', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'fechamentos_mensais') return closingQuery([{ id: 'f1', competencia: '2026-03-01', status: 'fechado' }]);
      if (table === 'fechamento_caixa_saldos') return inQuery([{ fechamento_id: 'f1', saldo_final: 500, total_entradas: 1000, total_saidas: 500 }]);
      if (table === 'fechamento_financeiro_saldos') return inQuery([{ fechamento_id: 'f1', tipo: 'receber', saldo_aberto: 1000 }]);
      if (table === 'fechamento_estoque_saldos') return inQuery([]);
      if (table === 'fechamento_fopag_resumo') return inQuery([]);
      return inQuery([]);
    });

    const result = await fetchPresentationData('2026-03-01', '2026-03-01', 'fechado', ['rol_caixa']);
    expect(result.slides.rol_caixa.valor_atual).toBe(500);
  });

  it('retorna bundle no modo dinâmico', async () => {
    fromMock.mockImplementation(() => dynamicQuery([{ competencia: '2026-03', valor_atual: 10 }]));
    const result = await fetchPresentationData('2026-03-01', '2026-03-01', 'dinamico', ['faturamento']);
    expect(result.slides.faturamento).toBeTruthy();
  });

  it('marca como indisponível no fechado quando snapshot não sustenta slide opcional', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'fechamentos_mensais') return closingQuery([{ id: 'f1', competencia: '2026-03-01', status: 'fechado' }]);
      if (table === 'fechamento_caixa_saldos') return inQuery([]);
      if (table === 'fechamento_financeiro_saldos') return inQuery([]);
      if (table === 'fechamento_estoque_saldos') return inQuery([]);
      if (table === 'fechamento_fopag_resumo') return inQuery([]);
      return inQuery([]);
    });

    const result = await fetchPresentationData('2026-03-01', '2026-03-01', 'fechado', ['backorder']);
    expect(result.slides.backorder?.indisponivel).toBe(true);
  });
});
