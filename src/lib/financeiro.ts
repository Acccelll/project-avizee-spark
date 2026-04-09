/**
 * Funções puras de cálculo financeiro.
 *
 * Todas as funções aqui são determinísticas e livres de efeitos colaterais,
 * facilitando testes unitários e reutilização em componentes e serviços.
 */

// ── Baixa / Pagamento ─────────────────────────────────────────────────────────

/**
 * Calcula o valor líquido a pagar numa baixa, considerando descontos,
 * juros, multa e abatimentos.
 *
 * @param valorPago    Valor informado pelo usuário para pagamento.
 * @param desconto     Desconto concedido (reduz o valor líquido).
 * @param juros        Juros cobrados (aumenta o valor líquido).
 * @param multa        Multa cobrada (aumenta o valor líquido).
 * @param abatimento   Abatimento adicional (reduz o valor líquido).
 * @returns Valor líquido resultante.
 */
export function calcularValorLiquido(
  valorPago: number,
  desconto: number,
  juros: number,
  multa: number,
  abatimento: number,
): number {
  return valorPago - desconto + juros + multa - abatimento;
}

/**
 * Calcula o saldo restante de um lançamento após uma baixa parcial.
 *
 * @param saldoAtual   Saldo devedor antes do pagamento.
 * @param valorPago    Valor efetivamente pago nesta baixa.
 * @param abatimento   Abatimento adicional aplicado.
 * @returns Novo saldo devedor (nunca negativo).
 */
export function calcularNovoSaldo(
  saldoAtual: number,
  valorPago: number,
  abatimento: number,
): number {
  return Math.max(0, saldoAtual - valorPago - abatimento);
}

/**
 * Determina o status efetivo de um lançamento, considerando vencimento.
 * Lançamentos "aberto" com data de vencimento no passado tornam-se "vencido".
 *
 * @param status           Status armazenado no banco.
 * @param dataVencimento   Data de vencimento (ISO 8601, ex.: "2026-03-01").
 * @param hoje             Data de referência para comparação.
 * @returns Status efetivo: "aberto", "vencido", "pago", "parcial", etc.
 */
export function getEffectiveStatus(
  status: string,
  dataVencimento: string,
  hoje: Date,
): string {
  const s = (status || '').toLowerCase();
  if (s === 'aberto' && dataVencimento) {
    const vencimento = new Date(dataVencimento);
    vencimento.setHours(0, 0, 0, 0);
    if (vencimento < hoje) return 'vencido';
  }
  return s || 'aberto';
}

// ── Juros e Multa ─────────────────────────────────────────────────────────────

/**
 * Calcula juros simples diários sobre um valor.
 *
 * @param valor       Valor principal.
 * @param taxaDiaria  Taxa diária em percentual (ex.: 0.033 para 0,033% ao dia).
 * @param dias        Número de dias de atraso.
 * @returns Valor dos juros (arredondado para 2 casas decimais).
 */
export function calcularJurosDiarios(
  valor: number,
  taxaDiaria: number,
  dias: number,
): number {
  return Math.round(valor * (taxaDiaria / 100) * dias * 100) / 100;
}

/**
 * Calcula multa por atraso sobre um valor.
 *
 * @param valor             Valor principal.
 * @param percentualMulta   Percentual de multa (ex.: 2 para 2%).
 * @returns Valor da multa (arredondado para 2 casas decimais).
 */
export function calcularMulta(valor: number, percentualMulta: number): number {
  return Math.round(valor * (percentualMulta / 100) * 100) / 100;
}

// ── Baixa em Lote ─────────────────────────────────────────────────────────────

/**
 * Calcula o valor pago proporcional para uma baixa parcial em lote.
 * A proporção é calculada sobre o total do lote e aplicada ao saldo
 * de cada lançamento individual.
 *
 * @param saldo       Saldo devedor do lançamento individual.
 * @param ratio       Razão valorPago / totalDoBatch (0 a 1).
 * @returns Valor a ser pago para este lançamento (arredondado para 2 casas).
 */
export function calcularPagamentoParcialLote(saldo: number, ratio: number): number {
  return Math.round(saldo * ratio * 100) / 100;
}

/**
 * Determina o status pós-baixa de um lançamento com base no novo saldo.
 *
 * @param novoSaldo   Saldo após o pagamento.
 * @returns "pago" se saldo ≤ 0,01; "parcial" caso contrário.
 */
export function statusPosBaixa(novoSaldo: number): 'pago' | 'parcial' {
  return novoSaldo <= 0.01 ? 'pago' : 'parcial';
}
