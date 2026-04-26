import type { WorkbookGeracao } from '@/types/workbook';

const ABAS_LABELS: Record<string, string> = {
  capa: 'Capa',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
  operacional: 'Operacional',
  logistica_fiscal: 'Log/Fiscal',
  raw: 'RAW',
};

/**
 * Gera o conteúdo CSV (string) para o histórico de gerações do Workbook Gerencial.
 * Usa `;` como separador (compatível com Excel pt-BR) e RFC 4180 escaping.
 * O BOM UTF-8 deve ser adicionado ao montar o Blob.
 */
export function buildHistoricoCsv(rows: WorkbookGeracao[]): string {
  const header = [
    'gerado_em',
    'template',
    'competencia_inicial',
    'competencia_final',
    'modo_geracao',
    'abas',
    'status',
    'hash_geracao',
    'observacoes',
  ];
  const data = rows.map((r) => {
    const params = (r.parametros_json ?? {}) as { abasSelecionadas?: string[] };
    const abas = (params.abasSelecionadas ?? [])
      .map((a) => ABAS_LABELS[a] ?? a)
      .join('|');
    return [
      r.gerado_em ?? '',
      r.workbook_templates?.nome ?? '',
      r.competencia_inicial ?? '',
      r.competencia_final ?? '',
      r.modo_geracao ?? '',
      abas,
      r.status ?? '',
      r.hash_geracao ?? '',
      r.observacoes ?? '',
    ];
  });
  return [header, ...data]
    .map((r) =>
      r
        .map((cell) => {
          const v = String(cell ?? '');
          return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(';'),
    )
    .join('\n');
}