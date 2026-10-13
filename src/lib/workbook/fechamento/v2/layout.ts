/**
 * Endereços do modelo `public/workbook_fechamento_v2.xlsx`. Precisam bater com
 * scripts/workbook/build_fechamento_v2.py: o sistema só escreve a aba Dados e
 * esconde as linhas vazias das listas; as outras abas são fórmulas.
 */

export const MODELO_V2_URL = '/workbook_fechamento_v2.xlsx';

export const ABA_DADOS = 'Dados';

/** Tabela mensal: dez/(ano-3) na linha 5 até dez/(ano) na linha 41. */
export const MENSAL_PRIMEIRA_LINHA = 5;
export const MENSAL_MESES = 37;

/** Colunas da tabela mensal. */
export const COL = {
  mes: 'A',
  rotulo: 'B',
  fechado: 'C',
  recebido: 'D',
  pago: 'E',
  faturamento: 'F',
  caixaFinal: 'G',
  caixaCalculado: 'H',
  ajuste: 'I',
  bloqueado: 'J',
  estoqueProdutos: 'K',
  estoqueMateriais: 'L',
  /** Receber: a vencer até 30, 31–90, >90, vencido até 30, >30. */
  receber: ['M', 'N', 'O', 'P', 'Q'],
  pagar: ['R', 'S', 'T', 'U', 'V'],
  linkedin: 'W',
  instagram: 'X',
  retirada: ['Y', 'Z', 'AA', 'AB'],
  atribuido: ['AC', 'AD', 'AE', 'AF'],
  /** Rendimentos de aplicações do mês (já incluídos no recebido). */
  rendimentos: 'AG',
} as const;

/** Parâmetros: rótulo em AH, valor em AI, a partir da linha 5 nesta ordem. */
export const PARAMETROS = [
  'competencia',
  'mes',
  'ano',
  'periodo',
  'dataBase',
  'geradoEm',
  'metaAno',
  'metaAnoAnterior',
  'limiteAno2',
  'limiteAno1',
  'limiteAno',
  'extratoPendentes',
  'ultimoExtrato',
  'notasSaida',
  'socio1',
  'socio2',
  'socio3',
  'socio4',
  'participacao1',
  'participacao2',
  'participacao3',
  'participacao4',
  'gruposNoAno',
  'gruposNovos',
] as const;
export type Parametro = (typeof PARAMETROS)[number];
export const COL_PARAMETRO = 'AI';
export const PARAMETRO_PRIMEIRA_LINHA = 5;

/** Listas usadas pelas abas (linhas 5..44). */
export const LISTA_PRIMEIRA_LINHA = 5;
export const LISTA = {
  cliente: 'AK',
  primeiraCompra: 'AL',
  uf: 'AN',
  estado: 'AO',
  categoria: 'AQ',
  fornecedor: 'AS',
} as const;

/** Detalhe do mês (formato longo), a partir da linha 47; as fórmulas leem até a 4000. */
export const DETALHE_PRIMEIRA_LINHA = 47;
export const DETALHE_ULTIMA_LINHA = 4000;
export const DETALHE_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type TipoDetalhe = 'Cliente' | 'Estado' | 'Despesa' | 'Fornecedor';

/** Vagas de cada lista nas abas (linhas fixas no modelo). */
export const VAGAS = {
  clientes: 40,
  estados: 28,
  categorias: 25,
  fornecedores: 10,
  socios: 4,
} as const;

/** Linhas das abas que o sistema esconde quando a vaga fica vazia. */
export const LINHAS_ABAS = {
  /** Clientes: grupos nas linhas 5..44; "Outros" na 45. */
  clientes: { primeira: 5, outros: 45 },
  /** Estados: linhas 5..32. */
  estados: { primeira: 5 },
  /** Despesas: categorias nas linhas 5..29; fornecedores do mês nas 35..44. */
  despesas: { primeira: 5, fornecedores: 35 },
  /** Sócios: retiradas nas linhas 6..9; resultado atribuído nas 13..16. */
  socios: { retiradas: 6, atribuido: 13 },
} as const;

/** Nome usado no detalhe quando há mais categorias que vagas. */
export const DEMAIS_CATEGORIAS = 'Demais categorias';
