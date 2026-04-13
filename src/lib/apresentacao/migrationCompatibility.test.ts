import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = 'supabase/migrations/20260412203000_apresentacao_pr42_corretiva.sql';

describe('apresentacao migration compatibility (PR42 corretiva)', () => {
  it('não referencia colunas legadas inexistentes dos snapshots', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    expect(sql).not.toMatch(/\bfcs\.competencia\b/);
    expect(sql).not.toMatch(/\bfcs\.saldo\b/);
    expect(sql).not.toMatch(/\bfes\.competencia\b/);
    expect(sql).not.toMatch(/\bfes\.valor_custo\b/);
    expect(sql).not.toMatch(/\bsaldo_total\b/);
  });

  it('usa campo real de ordens_venda no backorder', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    expect(sql).toContain('COALESCE(ov.data_aprovacao, ov.data_emissao)');
    expect(sql).not.toContain('ov.data_pedido');
  });
});
