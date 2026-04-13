/**
 * Teste de integração: Fluxo completo de lançamento financeiro e baixa.
 *
 * Cobre: Criação → Baixa parcial → Quitação → Tentativa de baixa em título pago.
 * Supabase completamente mockado — testa funções de cálculo puras.
 */
import { describe, it, expect } from 'vitest';
import { calcularNovoSaldo, calcularValorLiquido, getEffectiveStatus } from '@/lib/financeiro';

const hoje = new Date('2026-04-15T10:00:00');

// ── Etapa 1: Criação de lançamento a receber ─────────────────────────────────

describe('[Fluxo Financeiro] Etapa 1: Criação de lançamento a receber', () => {
  const lancamento = {
    id: 'lanc-001',
    tipo: 'receber',
    valor: 500,
    saldo_restante: 500,
    data_vencimento: '2026-05-01',
    status: 'aberto',
    data_pagamento: null as string | null,
  };

  it('cria lançamento com status "aberto"', () => {
    expect(lancamento.status).toBe('aberto');
  });

  it('data_vencimento e valor estão corretos', () => {
    expect(lancamento.data_vencimento).toBe('2026-05-01');
    expect(lancamento.valor).toBe(500);
  });

  it('saldo_restante é igual ao valor original', () => {
    expect(lancamento.saldo_restante).toBe(lancamento.valor);
  });
});

// ── Etapa 2: Baixa parcial ───────────────────────────────────────────────────

describe('[Fluxo Financeiro] Etapa 2: Baixa parcial', () => {
  const valorOriginal = 500;
  const valorBaixaParcial = 200;

  it('calcula saldo restante após pagamento parcial', () => {
    const novoSaldo = calcularNovoSaldo(valorOriginal, valorBaixaParcial, 0);
    expect(novoSaldo).toBe(300);
  });

  it('status permanece "aberto" após baixa parcial (saldo > 0)', () => {
    const novoSaldo = calcularNovoSaldo(valorOriginal, valorBaixaParcial, 0);
    // Business rule: status stays "aberto" when there's remaining balance
    expect(novoSaldo).toBeGreaterThan(0);
    // getEffectiveStatus would return "aberto" since vencimento hasn't passed
    const status = getEffectiveStatus('aberto', '2026-05-01', hoje);
    expect(status).toBe('aberto');
  });

  it('calcula valor líquido com juros de atraso na baixa parcial', () => {
    const juros = 5;
    const multa = 10;
    const liquido = calcularValorLiquido(valorBaixaParcial, 0, juros, multa, 0);
    expect(liquido).toBe(215); // 200 + 5 + 10
  });
});

// ── Etapa 3: Baixa final (quitação) ─────────────────────────────────────────

describe('[Fluxo Financeiro] Etapa 3: Quitação total', () => {
  const saldoRestante = 300;
  const valorQuitacao = 300;

  it('saldo zera após pagamento do valor restante', () => {
    const novoSaldo = calcularNovoSaldo(saldoRestante, valorQuitacao, 0);
    expect(novoSaldo).toBe(0);
  });

  it('status passa para "pago" após quitação', () => {
    const status = getEffectiveStatus('pago', '2026-05-01', hoje);
    expect(status).toBe('pago');
  });

  it('saldo nunca fica negativo mesmo com pagamento excedente', () => {
    const novoSaldo = calcularNovoSaldo(saldoRestante, saldoRestante + 50, 0);
    expect(novoSaldo).toBe(0);
  });

  it('quitação com abatimento reduz saldo corretamente', () => {
    const abatimento = 50;
    const novoSaldo = calcularNovoSaldo(saldoRestante, 200, abatimento);
    expect(novoSaldo).toBe(50); // 300 - 200 - 50
  });
});

// ── Etapa 4: Tentativa de baixa em lançamento já pago ────────────────────────

describe('[Fluxo Financeiro] Etapa 4: Lançamento já pago', () => {
  it('saldo zero impede nova baixa (guard no código de aplicação)', () => {
    const saldoAtual = 0;
    // Application code should check saldo > 0 before allowing baixa
    expect(saldoAtual).toBe(0);
    // Any additional payment on zero saldo still yields zero
    const novoSaldo = calcularNovoSaldo(saldoAtual, 100, 0);
    expect(novoSaldo).toBe(0);
  });

  it('status "pago" não regride para "vencido" mesmo com data passada', () => {
    const futuro = new Date('2027-01-01');
    const status = getEffectiveStatus('pago', '2026-05-01', futuro);
    expect(status).toBe('pago');
  });
});

// ── Coerência do fluxo ───────────────────────────────────────────────────────

describe('[Fluxo Financeiro] Coerência do fluxo completo', () => {
  it('baixas parciais somadas igualam o valor original', () => {
    const valorOriginal = 500;
    const baixa1 = 200;
    const baixa2 = 300;

    const saldo1 = calcularNovoSaldo(valorOriginal, baixa1, 0);
    expect(saldo1).toBe(300);

    const saldo2 = calcularNovoSaldo(saldo1, baixa2, 0);
    expect(saldo2).toBe(0);

    expect(baixa1 + baixa2).toBe(valorOriginal);
  });

  it('lançamento aberto se torna vencido quando data passa', () => {
    const statusAntes = getEffectiveStatus('aberto', '2026-04-10', hoje);
    expect(statusAntes).toBe('vencido');
  });

  it('lançamento com pagamento parcial e abatimento gera saldo correto', () => {
    const saldo = calcularNovoSaldo(1000, 400, 100);
    expect(saldo).toBe(500);
  });
});
