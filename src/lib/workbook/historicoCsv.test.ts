import { describe, it, expect } from 'vitest';
import { buildHistoricoCsv } from './historicoCsv';
import type { WorkbookGeracao } from '@/types/workbook';

function row(overrides: Partial<WorkbookGeracao> = {}): WorkbookGeracao {
  return {
    id: 'id-1',
    template_id: 'tpl-1',
    empresa_id: null,
    competencia_inicial: '2026-04-01',
    competencia_final: '2026-04-01',
    modo_geracao: 'dinamico',
    fechamento_id_inicial: null,
    fechamento_id_final: null,
    status: 'concluido',
    arquivo_path: null,
    hash_geracao: 'abcdef1234',
    parametros_json: { abasSelecionadas: ['capa', 'financeiro'] },
    observacoes: null,
    gerado_por: null,
    gerado_em: '2026-04-25T10:00:00Z',
    created_at: '2026-04-25T10:00:00Z',
    updated_at: '2026-04-25T10:00:00Z',
    workbook_templates: {
      id: 'tpl-1',
      nome: 'Template Padrão',
      codigo: 'WB_V1',
      versao: '1',
      arquivo_path: '',
      estrutura_json: null,
      ativo: true,
      created_at: '',
      updated_at: '',
    },
    ...overrides,
  };
}

describe('buildHistoricoCsv', () => {
  it('inclui o header esperado na primeira linha', () => {
    const csv = buildHistoricoCsv([]);
    expect(csv.split('\n')[0]).toBe(
      'gerado_em;template;competencia_inicial;competencia_final;modo_geracao;abas;status;hash_geracao;observacoes',
    );
  });

  it('serializa uma linha com separador ; e mapeia rótulos de abas', () => {
    const csv = buildHistoricoCsv([row()]);
    const linha = csv.split('\n')[1];
    expect(linha.split(';')).toHaveLength(9);
    expect(linha).toContain('Template Padrão');
    expect(linha).toContain('Capa|Financeiro');
    expect(linha).toContain('dinamico');
    expect(linha).toContain('concluido');
  });

  it('lida com parametros_json ausente e campos nulos', () => {
    const csv = buildHistoricoCsv([
      row({
        parametros_json: null,
        workbook_templates: undefined,
        modo_geracao: null,
        hash_geracao: null,
        observacoes: null,
        competencia_inicial: null,
        competencia_final: null,
      }),
    ]);
    const linha = csv.split('\n')[1];
    // 9 colunas mantidas, com valores vazios entre os ;
    expect(linha.split(';')).toHaveLength(9);
    expect(linha).toBe('2026-04-25T10:00:00Z;;;;;;concluido;;');
  });

  it('escapa valores com separador, aspas ou quebra de linha (RFC 4180)', () => {
    const csv = buildHistoricoCsv([
      row({ observacoes: 'erro: a;b"c\nd' }),
    ]);
    expect(csv).toContain('"erro: a;b""c\nd"');
  });

  it('lida com lista vazia retornando apenas o header', () => {
    const csv = buildHistoricoCsv([]);
    expect(csv.split('\n')).toHaveLength(1);
  });
});