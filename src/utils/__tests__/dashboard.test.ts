import { describe, it, expect } from 'vitest';
import { calcularCrescimentoPercentual, agregarVendasPorDia } from '../dashboard';

describe('calcularCrescimentoPercentual', () => {
  it('returns positive percentage for growth', () => {
    expect(calcularCrescimentoPercentual(110, 100)).toBeCloseTo(10);
  });

  it('returns negative percentage for decline', () => {
    expect(calcularCrescimentoPercentual(90, 100)).toBeCloseTo(-10);
  });

  it('returns 0 when both values are 0', () => {
    expect(calcularCrescimentoPercentual(0, 0)).toBe(0);
  });

  it('returns 100 when anterior is 0 and atual is positive', () => {
    expect(calcularCrescimentoPercentual(50, 0)).toBe(100);
  });

  it('returns 0 when anterior is 0 and atual is also 0', () => {
    expect(calcularCrescimentoPercentual(0, 0)).toBe(0);
  });

  it('handles same value (0% growth)', () => {
    expect(calcularCrescimentoPercentual(200, 200)).toBeCloseTo(0);
  });
});

describe('agregarVendasPorDia', () => {
  it('sums rows on the same day', () => {
    const rows = [
      { data_emissao: '2026-01-01', valor_total: 100 },
      { data_emissao: '2026-01-01', valor_total: 200 },
    ];
    const result = agregarVendasPorDia(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ data: '2026-01-01', total: 300 });
  });

  it('sorts results ascending by date', () => {
    const rows = [
      { data_emissao: '2026-01-03', valor_total: 10 },
      { data_emissao: '2026-01-01', valor_total: 20 },
      { data_emissao: '2026-01-02', valor_total: 30 },
    ];
    const result = agregarVendasPorDia(rows);
    expect(result.map((r) => r.data)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });

  it('handles null valor_total as 0', () => {
    const rows = [{ data_emissao: '2026-01-05', valor_total: null }];
    const result = agregarVendasPorDia(rows);
    expect(result[0].total).toBe(0);
  });

  it('handles string valor_total', () => {
    const rows = [{ data_emissao: '2026-01-07', valor_total: '99.99' }];
    const result = agregarVendasPorDia(rows);
    expect(result[0].total).toBeCloseTo(99.99);
  });

  it('returns empty array for empty input', () => {
    expect(agregarVendasPorDia([])).toEqual([]);
  });
});
