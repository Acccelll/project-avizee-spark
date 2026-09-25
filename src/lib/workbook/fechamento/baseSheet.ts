/**
 * Monta a aba oculta BASE do Workbook de Fechamento. As abas visíveis do
 * modelo (public/workbook_fechamento_v1.xlsx) leem tudo daqui por fórmula; o
 * layout abaixo precisa bater com scripts/workbook/build_fechamento_template.py.
 */
import { AGING_FAIXAS, type FechamentoDados, type FechamentoMetrica } from './types';

export const BASE_PRIMEIRA_LINHA = 2;
export const BASE_MESES = 37;
/** Quantos sócios o modelo comporta (linhas fixas da aba FOPAG). */
export const BASE_SLOTS_SOCIOS = 4;

const COLUNAS_METRICAS: Array<[string, FechamentoMetrica]> = [
  ['C', 'receita_caixa'],
  ['D', 'despesa_caixa'],
  ['E', 'faturamento'],
  ['F', 'bloqueado'],
  ['G', 'estoque_materiais'],
  ['H', 'estoque_produtos'],
  ...AGING_FAIXAS.map((f, i) => [colLetter(9 + i), `aging_cr_${f}`] as [string, FechamentoMetrica]),
  ...AGING_FAIXAS.map((f, i) => [colLetter(20 + i), `aging_cp_${f}`] as [string, FechamentoMetrica]),
];
/** Métricas sem valor ficam em branco (o modelo mostra vazio, não zero). */
const COLUNAS_OPCIONAIS: Array<[string, FechamentoMetrica]> = [
  ['AE', 'seguidores_linkedin'],
  ['AF', 'seguidores_instagram'],
];
const COL_SALDO_SOCIO = 33; // AG
const COL_RETIRADA_SOCIO = 37; // AK

export function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Número de série do Excel (sistema 1900) para uma data AAAA-MM-DD. */
export function excelSerial(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

type Cell = number | string | null | undefined;

function cellXml(ref: string, v: Cell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    return Number.isFinite(v) ? `<c r="${ref}"><v>${v}</v></c>` : '';
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
}

function rowXml(r: number, cells: Array<[string, Cell]>): string {
  const body = cells.map(([c, v]) => cellXml(`${c}${r}`, v)).join('');
  return body ? `<row r="${r}">${body}</row>` : '';
}

export function buildBaseSheetXml(dados: FechamentoDados): string {
  if (dados.meses.length !== BASE_MESES) {
    throw new Error(`Workbook de Fechamento: esperados ${BASE_MESES} meses, recebidos ${dados.meses.length}.`);
  }
  const [anoSel, mesSel] = dados.competencia.split('-').map(Number);
  const socios = dados.socios.slice(0, BASE_SLOTS_SOCIOS);
  const param = (ano: number) => dados.parametros[String(ano)];
  const extras = new Map<number, Array<[string, Cell]>>();
  const addExtra = (r: number, c: string, v: Cell) => {
    if (!extras.has(r)) extras.set(r, []);
    extras.get(r)!.push([c, v]);
  };

  addExtra(1, 'AP', 'Parâmetro');
  addExtra(1, 'AQ', 'Valor');
  addExtra(2, 'AP', 'Competência');
  addExtra(2, 'AQ', excelSerial(`${dados.competencia}-01`));
  addExtra(3, 'AP', 'Ano');
  addExtra(3, 'AQ', anoSel);
  addExtra(4, 'AP', 'Crescimento da meta (ano)');
  addExtra(4, 'AQ', param(anoSel)?.crescimento_meta ?? 0);
  addExtra(5, 'AP', 'Crescimento da meta (ano anterior)');
  addExtra(5, 'AQ', param(anoSel - 1)?.crescimento_meta ?? 0);
  addExtra(6, 'AP', 'Limite de faturamento (ano-2)');
  addExtra(6, 'AQ', param(anoSel - 2)?.limite_faturamento ?? 0);
  addExtra(7, 'AP', 'Limite de faturamento (ano-1)');
  addExtra(7, 'AQ', param(anoSel - 1)?.limite_faturamento ?? 0);
  addExtra(8, 'AP', 'Limite de faturamento (ano)');
  addExtra(8, 'AQ', param(anoSel)?.limite_faturamento ?? 0);
  addExtra(9, 'AP', 'Resultado de caixa anterior à janela');
  addExtra(9, 'AQ', dados.saldo_caixa_anterior ?? 0);
  addExtra(10, 'AP', 'Mês da competência');
  addExtra(10, 'AQ', mesSel);
  addExtra(11, 'AP', 'Sócio');
  addExtra(11, 'AQ', 'Participação');
  for (let k = 0; k < BASE_SLOTS_SOCIOS; k++) {
    const s = socios[k];
    addExtra(12 + k, 'AP', s?.nome_exibicao ?? '');
    addExtra(12 + k, 'AQ', s ? Number(s.percentual) / 100 : 0);
  }

  const header: Array<[string, Cell]> = [
    ['A', 'Competência'], ['B', 'Fechado'],
    ...COLUNAS_METRICAS.map(([c, m]) => [c, m] as [string, Cell]),
    ...COLUNAS_OPCIONAIS.map(([c, m]) => [c, m] as [string, Cell]),
    ...Array.from({ length: BASE_SLOTS_SOCIOS }, (_, k) => [colLetter(COL_SALDO_SOCIO + k), `saldo_socio_${k + 1}`] as [string, Cell]),
    ...Array.from({ length: BASE_SLOTS_SOCIOS }, (_, k) => [colLetter(COL_RETIRADA_SOCIO + k), `retirada_socio_${k + 1}`] as [string, Cell]),
  ];

  const rows: string[] = [rowXml(1, [...header, ...(extras.get(1) ?? [])])];
  dados.meses.forEach((mes, i) => {
    const r = BASE_PRIMEIRA_LINHA + i;
    const cells: Array<[string, Cell]> = [
      ['A', excelSerial(`${mes.competencia}-01`)],
      ['B', mes.fechado ? 1 : 0],
    ];
    if (mes.fechado) {
      for (const [c, m] of COLUNAS_METRICAS) cells.push([c, Number(mes.valores[m] ?? 0)]);
    }
    for (const [c, m] of COLUNAS_OPCIONAIS) {
      const v = mes.valores[m];
      if (mes.fechado && v !== undefined && v !== null) cells.push([c, Number(v)]);
    }
    if (mes.fechado) {
      socios.forEach((s, k) => {
        const sm = mes.socios?.[s.id];
        cells.push([colLetter(COL_SALDO_SOCIO + k), Number(sm?.saldo ?? 0)]);
        cells.push([colLetter(COL_RETIRADA_SOCIO + k), Number(sm?.prolabore ?? 0)]);
      });
    }
    rows.push(rowXml(r, [...cells, ...(extras.get(r) ?? [])]));
  });
  for (const [r, cells] of extras) {
    if (r > BASE_PRIMEIRA_LINHA + BASE_MESES - 1) rows.push(rowXml(r, cells));
  }

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${rows.join('')}</sheetData></worksheet>`
  );
}
