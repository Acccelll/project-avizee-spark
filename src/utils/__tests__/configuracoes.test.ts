import { describe, it, expect } from 'vitest';
import {
  mergeConfiguracoes,
  validarEmailConfig,
  formatarConfigParaAPI,
  type ConfigEmail,
} from '../configuracoes';

describe('mergeConfiguracoes', () => {
  it('returns default config when saved is empty', () => {
    const defaults = { a: 1, b: 'hello', c: true };
    const result = mergeConfiguracoes(defaults, {});
    expect(result).toEqual(defaults);
  });

  it('substitutes only defined fields from saved config', () => {
    const defaults = { a: 1, b: 'hello', c: true };
    const result = mergeConfiguracoes(defaults, { b: 'world' });
    expect(result).toEqual({ a: 1, b: 'world', c: true });
  });

  it('ignores undefined values in saved config', () => {
    const defaults = { a: 1, b: 'hello' };
    const result = mergeConfiguracoes(defaults, { a: undefined });
    expect(result.a).toBe(1);
  });

  it('ignores null values in saved config', () => {
    const defaults = { a: 1, b: 'hello' };
    const result = mergeConfiguracoes(defaults, { a: null as unknown as number });
    expect(result.a).toBe(1);
  });
});

describe('validarEmailConfig', () => {
  const validConfig: ConfigEmail = {
    smtp_host: 'smtp.example.com',
    smtp_porta: 587,
    smtp_usuario: 'user@example.com',
    smtp_senha: 'secret',
    smtp_ssl: true,
    remetente_nome: 'Avizee',
    remetente_email: 'no-reply@example.com',
  };

  it('returns valid for a correct config', () => {
    const result = validarEmailConfig(validConfig);
    expect(result.valido).toBe(true);
    expect(result.erros).toHaveLength(0);
  });

  it('returns error for missing smtp_host', () => {
    const result = validarEmailConfig({ ...validConfig, smtp_host: '' });
    expect(result.valido).toBe(false);
    expect(result.erros.length).toBeGreaterThan(0);
  });

  it('returns error for invalid smtp_porta', () => {
    const result = validarEmailConfig({ ...validConfig, smtp_porta: 99999 });
    expect(result.valido).toBe(false);
    expect(result.erros.length).toBeGreaterThan(0);
  });

  it('returns error for invalid remetente_email', () => {
    const result = validarEmailConfig({ ...validConfig, remetente_email: 'not-an-email' });
    expect(result.valido).toBe(false);
    expect(result.erros.length).toBeGreaterThan(0);
  });
});

describe('formatarConfigParaAPI', () => {
  it('removes null values', () => {
    const result = formatarConfigParaAPI({ a: 1, b: null });
    expect(result).not.toHaveProperty('b');
  });

  it('removes undefined values', () => {
    const result = formatarConfigParaAPI({ a: 1, b: undefined });
    expect(result).not.toHaveProperty('b');
  });

  it('keeps non-null/undefined values', () => {
    const result = formatarConfigParaAPI({ a: 1, b: 'hello', c: false, d: 0 });
    expect(result).toEqual({ a: 1, b: 'hello', c: false, d: 0 });
  });
});
