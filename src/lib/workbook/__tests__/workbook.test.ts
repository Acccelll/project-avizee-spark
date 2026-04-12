import { describe, it, expect } from 'vitest';
import { calcularFaixaAging, hashParametros, formatCurrencyBR, formatDateBR } from '../utils';
import { SHEET_NAMES } from '../templateMap';

describe('workbook utils', () => {
  describe('calcularFaixaAging', () => {
    it('returns a_vencer for future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      expect(calcularFaixaAging(future.toISOString())).toBe('a_vencer');
    });

    it('returns 1_30 for dates 1-30 days ago', () => {
      const past = new Date();
      past.setDate(past.getDate() - 15);
      expect(calcularFaixaAging(past.toISOString())).toBe('1_30');
    });

    it('returns 31_60 for dates 31-60 days ago', () => {
      const past = new Date();
      past.setDate(past.getDate() - 45);
      expect(calcularFaixaAging(past.toISOString())).toBe('31_60');
    });

    it('returns 61_90 for dates 61-90 days ago', () => {
      const past = new Date();
      past.setDate(past.getDate() - 75);
      expect(calcularFaixaAging(past.toISOString())).toBe('61_90');
    });

    it('returns acima_90 for dates more than 90 days ago', () => {
      const past = new Date();
      past.setDate(past.getDate() - 120);
      expect(calcularFaixaAging(past.toISOString())).toBe('acima_90');
    });
  });

  describe('hashParametros', () => {
    it('returns a string', () => {
      expect(typeof hashParametros({ a: 1 })).toBe('string');
    });

    it('returns same hash for same params', () => {
      const params = { templateId: 'abc', periodo: '2024-01' };
      expect(hashParametros(params)).toBe(hashParametros(params));
    });

    it('returns different hash for different params', () => {
      expect(hashParametros({ a: 1 })).not.toBe(hashParametros({ a: 2 }));
    });
  });

  describe('formatCurrencyBR', () => {
    it('formats number to 2 decimal places', () => {
      expect(formatCurrencyBR(1234.567)).toBe(1234.57);
    });

    it('handles null/undefined', () => {
      expect(formatCurrencyBR(null)).toBe(0);
      expect(formatCurrencyBR(undefined)).toBe(0);
    });
  });

  describe('formatDateBR', () => {
    it('returns empty string for null', () => {
      expect(formatDateBR(null)).toBe('');
    });

    it('returns formatted date string for valid date', () => {
      const result = formatDateBR('2024-01-15');
      expect(result).toContain('15');
    });
  });

  describe('SHEET_NAMES', () => {
    it('has all required analytical sheets', () => {
      expect(SHEET_NAMES.CONFRONTO).toBe('Confronto');
      expect(SHEET_NAMES.CAIXA).toBe('Caixa');
      expect(SHEET_NAMES.DESPESA).toBe('Despesa');
      expect(SHEET_NAMES.FOPAG).toBe('FOPAG');
      expect(SHEET_NAMES.FATURAMENTO).toBe('Faturamento NFs');
      expect(SHEET_NAMES.ESTOQUE).toBe('Estoque');
      expect(SHEET_NAMES.AGING_CR).toBe('Aging CR');
      expect(SHEET_NAMES.AGING_CP).toBe('Aging CP');
      expect(SHEET_NAMES.PARAMETROS).toBe('Parâmetros');
    });
  });
});
