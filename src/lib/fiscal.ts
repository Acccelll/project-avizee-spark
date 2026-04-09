/**
 * Funções puras de cálculo fiscal.
 *
 * Todas as funções são determinísticas e livres de efeitos colaterais,
 * facilitando testes unitários e reutilização em componentes e serviços.
 */

// ── Totais de Nota Fiscal / Orçamento ─────────────────────────────────────────

/**
 * Calcula o valor total de uma nota fiscal ou orçamento.
 *
 * Fórmula:
 *   total = totalProdutos - desconto + st + ipi + frete + outrasDespesas
 *
 * @param totalProdutos    Soma dos itens (qty × preço unitário).
 * @param desconto         Desconto global a ser subtraído.
 * @param st               Imposto de Substituição Tributária a adicionar.
 * @param ipi              IPI a adicionar.
 * @param frete            Valor de frete a adicionar.
 * @param outrasDespesas   Outras despesas acessórias a adicionar.
 * @returns Valor total da nota/orçamento.
 */
export function calcularTotalNF(
  totalProdutos: number,
  desconto: number,
  st: number,
  ipi: number,
  frete: number,
  outrasDespesas: number,
): number {
  return totalProdutos - desconto + st + ipi + frete + outrasDespesas;
}

// ── Parcelas ──────────────────────────────────────────────────────────────────

/**
 * Calcula o valor de cada parcela (divisão simples, arredondada para 2 casas).
 *
 * @param valorTotal    Valor total a parcelar.
 * @param numParcelas   Número de parcelas.
 * @returns Valor de cada parcela.
 */
export function calcularValorParcela(valorTotal: number, numParcelas: number): number {
  if (numParcelas <= 0) return valorTotal;
  return Math.round((valorTotal / numParcelas) * 100) / 100;
}

/**
 * Calcula a data de vencimento de uma parcela.
 * Cada parcela vence 30 × n dias após a data de emissão (onde n começa em 1).
 *
 * @param dataBase       Data de emissão / referência (ISO "YYYY-MM-DD").
 * @param parcelaNumero  Número da parcela, começando em 1.
 * @returns Data de vencimento no formato ISO "YYYY-MM-DD".
 */
export function calcularVencimentoParcela(dataBase: string, parcelaNumero: number): string {
  const date = new Date(dataBase + 'T00:00:00');
  date.setDate(date.getDate() + 30 * parcelaNumero);
  return date.toISOString().split('T')[0];
}

// ── Impostos ──────────────────────────────────────────────────────────────────

/**
 * Calcula o valor de um imposto genérico (ICMS, PIS, COFINS, etc.)
 * com base na base de cálculo e alíquota percentual.
 *
 * @param baseCalculo   Base de cálculo.
 * @param aliquota      Alíquota em percentual (ex.: 12 para 12%).
 * @returns Valor do imposto (arredondado para 2 casas decimais).
 */
export function calcularImposto(baseCalculo: number, aliquota: number): number {
  return Math.round(baseCalculo * (aliquota / 100) * 100) / 100;
}

/**
 * Calcula a base de cálculo com redução.
 *
 * @param valorProduto          Valor bruto do produto/operação.
 * @param percentualReducao     Percentual de redução da base (ex.: 30 para 30%).
 * @returns Base de cálculo reduzida.
 */
export function calcularBaseReducao(valorProduto: number, percentualReducao: number): number {
  return Math.round(valorProduto * (1 - percentualReducao / 100) * 100) / 100;
}

// ── CFOP ──────────────────────────────────────────────────────────────────────

/**
 * Determina o CFOP de devolução a partir do CFOP original da nota de venda.
 *
 * - Se o CFOP original começa com "6" (operação interestadual): CFOP 6201.
 * - Caso contrário (operação dentro do estado): CFOP 5201.
 *
 * @param cfopOriginal   CFOP da nota fiscal original (ou null/undefined).
 * @returns CFOP de devolução correspondente.
 */
export function calcularCfopDevolucao(cfopOriginal: string | null | undefined): string {
  if (!cfopOriginal) return '5201';
  return cfopOriginal.startsWith('6') ? '6201' : '5201';
}

// ── Status de Faturamento OV ──────────────────────────────────────────────────

/**
 * Calcula o status de faturamento de uma Ordem de Venda com base nas
 * quantidades totais pedidas e faturadas.
 *
 * @param totalQtd       Soma das quantidades de todos os itens da OV.
 * @param totalFaturado  Soma das quantidades já faturadas.
 * @returns "total" | "parcial" | "aguardando"
 */
export function calcularStatusFaturamentoOV(
  totalQtd: number,
  totalFaturado: number,
): 'total' | 'parcial' | 'aguardando' {
  if (totalFaturado >= totalQtd) return 'total';
  if (totalFaturado > 0) return 'parcial';
  return 'aguardando';
}
