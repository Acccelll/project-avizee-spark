import { describe, it, expect } from 'vitest';
import { buildTelemetriaCsv, type SlideUsoRow } from './telemetriaCsv';

describe('buildTelemetriaCsv', () => {
  it('inclui o header esperado na primeira linha', () => {
    const csv = buildTelemetriaCsv([]);
    expect(csv.split('\n')[0]).toBe(
      'slide_codigo;titulo;total_selecionado;total_desselecionado;total_gerado;ultimo_uso_em',
    );
  });

  it('serializa uma linha com separador ; e mapeia título quando o slide é conhecido', () => {
    const rows: SlideUsoRow[] = [
      {
        slide_codigo: 'capa',
        total_selecionado: 10,
        total_desselecionado: 2,
        total_gerado: 8,
        ultimo_uso_em: '2026-04-25T10:00:00Z',
      },
    ];
    const csv = buildTelemetriaCsv(rows);
    const linha = csv.split('\n')[1];
    expect(linha.startsWith('capa;')).toBe(true);
    expect(linha.endsWith(';2026-04-25T10:00:00Z')).toBe(true);
    expect(linha.split(';')).toHaveLength(6);
  });

  it('mantém o slide_codigo como título quando o código é desconhecido', () => {
    const rows: SlideUsoRow[] = [
      {
        slide_codigo: 'inexistente_xyz',
        total_selecionado: 1,
        total_desselecionado: 0,
        total_gerado: 1,
        ultimo_uso_em: null,
      },
    ];
    const csv = buildTelemetriaCsv(rows);
    const linha = csv.split('\n')[1];
    // título == slide_codigo quando não mapeado, e ultimo_uso_em vira string vazia
    expect(linha).toBe('inexistente_xyz;inexistente_xyz;1;0;1;');
  });

  it('escapa valores que contêm separador, aspas ou quebra de linha', () => {
    const rows: SlideUsoRow[] = [
      {
        slide_codigo: 'a;b"c\nd',
        total_selecionado: 0,
        total_desselecionado: 0,
        total_gerado: 0,
        ultimo_uso_em: null,
      },
    ];
    const csv = buildTelemetriaCsv(rows);
    const linha = csv.split('\n')[1];
    // Primeiro campo precisa estar entre aspas e ter aspas duplicadas
    expect(linha.startsWith('"a;b""c\nd";')).toBe(true);
  });

  it('lida com lista vazia retornando apenas o header', () => {
    const csv = buildTelemetriaCsv([]);
    expect(csv.split('\n')).toHaveLength(1);
  });
});