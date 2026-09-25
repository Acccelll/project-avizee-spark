/**
 * Partes do modelo do Workbook de Fechamento que dependem do ano/competência
 * e não podem ser fórmula: rótulos de texto, cabeçalhos das tabelas da FOPAG,
 * títulos e janelas dos gráficos. As fórmulas das abas vivem no próprio
 * modelo (scripts/workbook/build_fechamento_template.py).
 */

export const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export interface ContextoAno {
  ano: number;
  /** 1..12 */
  mes: number;
}

const yy = (ano: number) => String(ano).slice(-2);

/** Substitui {YY}, {YY-1}, {YY-2}, {YYYY}, {YYYY-1}, {mmm}. */
export function aplicarPlaceholders(texto: string, ctx: ContextoAno): string {
  return texto
    .replace(/\{YY(?:-(\d))?\}/g, (_, n) => yy(ctx.ano - Number(n ?? 0)))
    .replace(/\{YYYY(?:-(\d))?\}/g, (_, n) => String(ctx.ano - Number(n ?? 0)))
    .replace(/\{mmm\}/g, MESES_ABREV[ctx.mes - 1]);
}

export interface TextoCelula {
  aba: string;
  ref: string;
  texto: string;
}

function blocoAnos(aba: string, linhas: Array<[string, string]>): TextoCelula[] {
  return linhas.map(([ref, texto]) => ({ aba, ref, texto }));
}

const trimestres = (aba: string, linha: number, cols: string[], yyTag: string) =>
  cols.map((c, i) => ({ aba, ref: `${c}${linha}`, texto: `${i + 1}Q{${yyTag}}` }));

function cabecalhoFopag(linha: number, yyTag: string, rotuloQ: string): TextoCelula[] {
  const cols = 'EFGHIJKLMNOP'.split('');
  return [
    ...cols.map((c, i) => ({ aba: 'FOPAG', ref: `${c}${linha}`, texto: `${MESES_ABREV[i]}-{${yyTag}}` })),
    { aba: 'FOPAG', ref: `Q${linha}`, texto: rotuloQ },
  ];
}

export const TEXTOS: TextoCelula[] = [
  ...blocoAnos('Confronto', [
    ['B2', 'Receita {YY-2}'], ['B3', 'Despesa {YY-2}'], ['B4', 'RESULTADO {YY-2}'],
    ['B7', 'Receita {YY-1}'], ['B8', 'Despesa {YY-1}'], ['B9', 'RESULTADO {YY-1}'],
    ['B12', 'Receita {YY}'], ['B13', 'Despesa {YY}'], ['B14', 'RESULTADO {YY}'],
  ]),
  ...trimestres('Confronto', 1, ['P', 'Q', 'R', 'S'], 'YY-2'),
  ...trimestres('Confronto', 6, ['P', 'Q', 'R', 'S'], 'YY-1'),
  ...trimestres('Confronto', 11, ['P', 'Q', 'R', 'S'], 'YY'),
  ...blocoAnos('Receita', [
    ['B2', 'Receita {YY-2}'], ['B3', 'Caixa {YY-2}'],
    ['B7', 'Receita {YY-1}'], ['B8', 'Caixa {YY-1}'],
    ['B12', 'Receita {YY}'], ['B13', 'Caixa {YY}'],
  ]),
  ...blocoAnos('Bridge Faturamento', [['A3', 'Inicio {YY-2}'], ['D3', 'Inicio {YY-1}'], ['G3', 'Inicio {YY}']]),
  ...cabecalhoFopag(2, 'YY-1', 'Saldo{YY-1}'),
  ...cabecalhoFopag(10, 'YY-1', 'Retirada{YY-1}'),
  ...cabecalhoFopag(18, 'YY-1', 'Variação'),
  ...cabecalhoFopag(25, 'YY', 'Saldo{YY}'),
  ...cabecalhoFopag(33, 'YY', 'Retirada{YY}'),
  ...cabecalhoFopag(41, 'YY', 'Variação'),
  ...trimestres('Aging CR', 2, ['Q', 'U', 'Y', 'AC'], 'YY'),
  ...trimestres('Aging CP', 2, ['Q', 'U', 'Y', 'AC'], 'YY'),
];

/** Tabelas da FOPAG: a linha do cabeçalho define os nomes das colunas. */
export const TABELAS_FOPAG_LINHAS = [2, 10, 18, 25, 33, 41];

export type PatchGrafico =
  /** Série de jan até o mês da competência nas colunas C..N. */
  | { tipo: 'ytd' }
  /** Últimos 12 meses em linhas: fim = linhaJaneiroAno + mes - 1. */
  | { tipo: 'janela12'; linhaJaneiroAno: number }
  /** Faixa fixa de linhas (corrige intervalo do legado). */
  | { tipo: 'linhas'; de: [number, number]; para: [number, number] };

export interface GraficoSpec {
  arquivo: string;
  titulos?: Array<[string, string]>;
  patches: PatchGrafico[];
}

export const GRAFICOS: GraficoSpec[] = [
  { arquivo: 'xl/charts/chart9.xml', titulos: [[' Faturamento - ME 25 x ME 26', ' Faturamento - ME {YY-1} x ME {YY}']],
    patches: [{ tipo: 'linhas', de: [4, 14], para: [4, 15] }] },
  { arquivo: 'xl/charts/chart10.xml', titulos: [[' 2025 x 2026', ' {YYYY-1} x {YYYY}']], patches: [{ tipo: 'ytd' }] },
  { arquivo: 'xl/charts/chart12.xml', patches: [{ tipo: 'janela12', linhaJaneiroAno: 17 }] },
  { arquivo: 'xl/charts/chart18.xml', titulos: [['Receita e Caixa 25', 'Receita e Caixa {YY-1}'], ['x 26', 'x {YY}']],
    patches: [{ tipo: 'ytd' }] },
  { arquivo: 'xl/charts/chart20.xml', patches: [{ tipo: 'ytd' }] },
  { arquivo: 'xl/charts/chart21.xml', titulos: [['FOPAG - jan/2026', 'FOPAG - {mmm}/{YYYY}']], patches: [] },
  { arquivo: 'xl/charts/chart22.xml', patches: [{ tipo: 'janela12', linhaJaneiroAno: 17 }] },
  { arquivo: 'xl/charts/chart24.xml', patches: [{ tipo: 'janela12', linhaJaneiroAno: 16 }] },
  { arquivo: 'xl/charts/chart25.xml', patches: [{ tipo: 'janela12', linhaJaneiroAno: 17 }] },
];
