import { describe, it, expect } from 'vitest';
import {
  calcularTotalNF,
  calcularValorParcela,
  calcularVencimentoParcela,
  calcularImposto,
  calcularBaseReducao,
  calcularCfopDevolucao,
  calcularStatusFaturamentoOV,
} from '@/lib/fiscal';

describe('calcularTotalNF', () => {
  it('retorna total de produtos quando não há ajustes', () => {
    expect(calcularTotalNF(1000, 0, 0, 0, 0, 0)).toBe(1000);
  });

  it('subtrai desconto corretamente', () => {
    expect(calcularTotalNF(1000, 100, 0, 0, 0, 0)).toBe(900);
  });

  it('adiciona ST ao total', () => {
    expect(calcularTotalNF(1000, 0, 50, 0, 0, 0)).toBe(1050);
  });

  it('adiciona IPI ao total', () => {
    expect(calcularTotalNF(1000, 0, 0, 30, 0, 0)).toBe(1030);
  });

  it('adiciona frete ao total', () => {
    expect(calcularTotalNF(1000, 0, 0, 0, 25, 0)).toBe(1025);
  });

  it('adiciona outras despesas ao total', () => {
    expect(calcularTotalNF(1000, 0, 0, 0, 0, 15)).toBe(1015);
  });

  it('aplica todos os componentes corretamente', () => {
    // 2000 - 200 (desc) + 100 (ST) + 80 (IPI) + 50 (frete) + 20 (outras) = 2050
    expect(calcularTotalNF(2000, 200, 100, 80, 50, 20)).toBe(2050);
  });

  it('retorna zero quando total de produtos é zero e sem acréscimos', () => {
    expect(calcularTotalNF(0, 0, 0, 0, 0, 0)).toBe(0);
  });
});

describe('calcularValorParcela', () => {
  it('divide igualmente em parcelas', () => {
    expect(calcularValorParcela(900, 3)).toBe(300);
  });

  it('arredonda para 2 casas decimais', () => {
    // 100 / 3 = 33.333... → 33.33
    expect(calcularValorParcela(100, 3)).toBe(33.33);
  });

  it('retorna o valor total para 1 parcela', () => {
    expect(calcularValorParcela(750, 1)).toBe(750);
  });

  it('retorna o valor total quando numParcelas é zero', () => {
    expect(calcularValorParcela(500, 0)).toBe(500);
  });
});

describe('calcularVencimentoParcela', () => {
  it('calcula vencimento da 1ª parcela (30 dias)', () => {
    expect(calcularVencimentoParcela('2026-01-01', 1)).toBe('2026-01-31');
  });

  it('calcula vencimento da 2ª parcela (60 dias)', () => {
    expect(calcularVencimentoParcela('2026-01-01', 2)).toBe('2026-03-02');
  });

  it('calcula vencimento da 3ª parcela (90 dias)', () => {
    expect(calcularVencimentoParcela('2026-01-01', 3)).toBe('2026-04-01');
  });

  it('retorna formato ISO YYYY-MM-DD', () => {
    const result = calcularVencimentoParcela('2026-06-15', 1);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe('2026-07-15');
  });
});

describe('calcularImposto', () => {
  it('calcula ICMS de 12% sobre 1000', () => {
    expect(calcularImposto(1000, 12)).toBe(120);
  });

  it('calcula IPI de 5% sobre 500', () => {
    expect(calcularImposto(500, 5)).toBe(25);
  });

  it('retorna zero quando alíquota é zero', () => {
    expect(calcularImposto(1000, 0)).toBe(0);
  });

  it('retorna zero quando base de cálculo é zero', () => {
    expect(calcularImposto(0, 12)).toBe(0);
  });

  it('arredonda para 2 casas decimais', () => {
    // 333.33 × 7% = 23.3331 → 23.33
    expect(calcularImposto(333.33, 7)).toBe(23.33);
  });
});

describe('calcularBaseReducao', () => {
  it('reduz a base em 30%', () => {
    expect(calcularBaseReducao(1000, 30)).toBe(700);
  });

  it('retorna a base integral quando redução é zero', () => {
    expect(calcularBaseReducao(500, 0)).toBe(500);
  });

  it('retorna zero quando redução é 100%', () => {
    expect(calcularBaseReducao(800, 100)).toBe(0);
  });

  it('arredonda para 2 casas decimais', () => {
    // 333.33 × (1 - 33.33/100) = 333.33 × 0.6667 = 222.23
    expect(calcularBaseReducao(333.33, 33.33)).toBeCloseTo(222.23, 2);
  });
});

describe('calcularCfopDevolucao', () => {
  it('retorna 5201 para CFOP de operação intraestadual (começa com 5)', () => {
    expect(calcularCfopDevolucao('5102')).toBe('5201');
    expect(calcularCfopDevolucao('5101')).toBe('5201');
  });

  it('retorna 6201 para CFOP de operação interestadual (começa com 6)', () => {
    expect(calcularCfopDevolucao('6102')).toBe('6201');
    expect(calcularCfopDevolucao('6101')).toBe('6201');
  });

  it('retorna 5201 para CFOP de entrada (começa com 1)', () => {
    expect(calcularCfopDevolucao('1102')).toBe('5201');
  });

  it('retorna 5201 quando CFOP é null', () => {
    expect(calcularCfopDevolucao(null)).toBe('5201');
  });

  it('retorna 5201 quando CFOP é undefined', () => {
    expect(calcularCfopDevolucao(undefined)).toBe('5201');
  });

  it('retorna 5201 quando CFOP é string vazia', () => {
    expect(calcularCfopDevolucao('')).toBe('5201');
  });
});

describe('calcularStatusFaturamentoOV', () => {
  it('retorna "total" quando todo o pedido foi faturado', () => {
    expect(calcularStatusFaturamentoOV(100, 100)).toBe('total');
  });

  it('retorna "total" quando faturado supera o pedido', () => {
    expect(calcularStatusFaturamentoOV(100, 110)).toBe('total');
  });

  it('retorna "parcial" quando parte do pedido foi faturado', () => {
    expect(calcularStatusFaturamentoOV(100, 50)).toBe('parcial');
    expect(calcularStatusFaturamentoOV(100, 1)).toBe('parcial');
  });

  it('retorna "aguardando" quando nenhum item foi faturado', () => {
    expect(calcularStatusFaturamentoOV(100, 0)).toBe('aguardando');
  });

  it('retorna "total" quando tanto qtd total quanto faturado são zero', () => {
    // Matematicamente 0 >= 0 → "total". Na prática, OVs sem itens não devem
    // existir (validação em nível de formulário), portanto este caso borda não
    // representa um estado de negócio válido e o comportamento é documentado
    // apenas para cobertura da função.
    expect(calcularStatusFaturamentoOV(0, 0)).toBe('total');
  });
});
