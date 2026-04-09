import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  calcularValorLiquido,
  calcularNovoSaldo,
  calcularJurosDiarios,
  calcularMulta,
  calcularPagamentoParcialLote,
  statusPosBaixa,
  getEffectiveStatus,
} from '@/lib/financeiro';

describe('calcularValorLiquido', () => {
  it('retorna valorPago quando não há ajustes', () => {
    expect(calcularValorLiquido(100, 0, 0, 0, 0)).toBe(100);
  });

  it('subtrai desconto do valor líquido', () => {
    expect(calcularValorLiquido(100, 10, 0, 0, 0)).toBe(90);
  });

  it('adiciona juros ao valor líquido', () => {
    expect(calcularValorLiquido(100, 0, 5, 0, 0)).toBe(105);
  });

  it('adiciona multa ao valor líquido', () => {
    expect(calcularValorLiquido(100, 0, 0, 2, 0)).toBe(102);
  });

  it('subtrai abatimento do valor líquido', () => {
    expect(calcularValorLiquido(100, 0, 0, 0, 8)).toBe(92);
  });

  it('aplica todos os ajustes corretamente', () => {
    // 500 - 20 (desconto) + 15 (juros) + 10 (multa) - 5 (abatimento) = 500
    expect(calcularValorLiquido(500, 20, 15, 10, 5)).toBe(500);
  });

  it('pode resultar em valor negativo quando descontos superam o pagamento', () => {
    expect(calcularValorLiquido(50, 100, 0, 0, 0)).toBe(-50);
  });
});

describe('calcularNovoSaldo', () => {
  it('subtrai pagamento do saldo', () => {
    expect(calcularNovoSaldo(200, 50, 0)).toBe(150);
  });

  it('subtrai abatimento junto com o pagamento', () => {
    expect(calcularNovoSaldo(200, 50, 10)).toBe(140);
  });

  it('nunca retorna valor negativo', () => {
    expect(calcularNovoSaldo(100, 200, 0)).toBe(0);
    expect(calcularNovoSaldo(100, 50, 80)).toBe(0);
  });

  it('retorna zero quando saldo é quitado exatamente', () => {
    expect(calcularNovoSaldo(100, 100, 0)).toBe(0);
  });
});

describe('calcularJurosDiarios', () => {
  it('calcula juros simples diários corretamente', () => {
    // R$1000 × 0,033% × 10 dias = R$3,30
    expect(calcularJurosDiarios(1000, 0.033, 10)).toBe(3.3);
  });

  it('retorna zero para zero dias de atraso', () => {
    expect(calcularJurosDiarios(1000, 0.033, 0)).toBe(0);
  });

  it('retorna zero quando taxa é zero', () => {
    expect(calcularJurosDiarios(1000, 0, 30)).toBe(0);
  });

  it('arredonda para 2 casas decimais', () => {
    // 500 × 0.01% × 3 = 0.15
    expect(calcularJurosDiarios(500, 0.01, 3)).toBe(0.15);
  });
});

describe('calcularMulta', () => {
  it('calcula 2% de multa sobre o valor', () => {
    expect(calcularMulta(1000, 2)).toBe(20);
  });

  it('retorna zero quando percentual é zero', () => {
    expect(calcularMulta(1000, 0)).toBe(0);
  });

  it('arredonda para 2 casas decimais', () => {
    expect(calcularMulta(333.33, 2)).toBe(6.67);
  });
});

describe('calcularPagamentoParcialLote', () => {
  it('calcula pagamento proporcional ao ratio', () => {
    // saldo 200, ratio 0.5 → paga 100
    expect(calcularPagamentoParcialLote(200, 0.5)).toBe(100);
  });

  it('arredonda para 2 casas decimais', () => {
    // saldo 100, ratio 1/3 ≈ 0.3333 → paga 33.33
    expect(calcularPagamentoParcialLote(100, 1 / 3)).toBe(33.33);
  });

  it('retorna o saldo completo quando ratio é 1', () => {
    expect(calcularPagamentoParcialLote(750.50, 1)).toBe(750.50);
  });

  it('retorna zero quando ratio é zero', () => {
    expect(calcularPagamentoParcialLote(500, 0)).toBe(0);
  });
});

describe('statusPosBaixa', () => {
  it('retorna "pago" quando saldo é zero', () => {
    expect(statusPosBaixa(0)).toBe('pago');
  });

  it('retorna "pago" quando saldo é 0,01 (tolerância)', () => {
    expect(statusPosBaixa(0.01)).toBe('pago');
  });

  it('retorna "parcial" quando ainda há saldo', () => {
    expect(statusPosBaixa(0.02)).toBe('parcial');
    expect(statusPosBaixa(100)).toBe('parcial');
  });
});

describe('getEffectiveStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna "aberto" para lançamento não vencido', () => {
    const hoje = new Date('2026-03-01');
    expect(getEffectiveStatus('aberto', '2026-12-31', hoje)).toBe('aberto');
  });

  it('retorna "vencido" quando data de vencimento é anterior a hoje', () => {
    const hoje = new Date('2026-03-01');
    expect(getEffectiveStatus('aberto', '2026-02-28', hoje)).toBe('vencido');
  });

  it('retorna "vencido" quando o vencimento é hoje mas o horário é passado', () => {
    // A lógica normaliza o vencimento para 00:00:00 do dia, portanto qualquer
    // hora posterior à meia-noite (ex.: 10:00) coloca "hoje" depois do
    // vencimento normalizado, resultando em status "vencido".
    const hoje = new Date('2026-03-01');
    hoje.setHours(10, 0, 0, 0);
    expect(getEffectiveStatus('aberto', '2026-03-01', hoje)).toBe('vencido');
  });

  it('preserva status "pago" independente da data', () => {
    const hoje = new Date('2026-03-01');
    expect(getEffectiveStatus('pago', '2025-01-01', hoje)).toBe('pago');
  });

  it('preserva status "parcial" independente da data', () => {
    const hoje = new Date('2026-03-01');
    expect(getEffectiveStatus('parcial', '2025-01-01', hoje)).toBe('parcial');
  });

  it('normaliza status para lowercase', () => {
    const hoje = new Date('2026-03-01');
    expect(getEffectiveStatus('ABERTO', '2026-12-31', hoje)).toBe('aberto');
    expect(getEffectiveStatus('PAGO', '2025-01-01', hoje)).toBe('pago');
  });

  it('retorna "aberto" quando status é vazio', () => {
    const hoje = new Date('2026-03-01');
    expect(getEffectiveStatus('', '2026-12-31', hoje)).toBe('aberto');
  });
});
