/**
 * Serviço de cálculos financeiros puros.
 *
 * Todas as funções são determinísticas e livres de efeitos colaterais,
 * facilitando testes unitários e reutilização em componentes e serviços.
 *
 * Convenções:
 * - Juros simples com base em ano comercial de 360 dias.
 * - Valores arredondados para 2 casas decimais.
 * - Percentuais informados como número inteiro (ex.: 2 = 2%).
 */

export type {
  // Re-exportar types para facilitar uso externo
} from "@/lib/financeiro";

// Re-exportar funções já existentes em lib/financeiro para centralizar imports
export {
  calcularValorLiquido,
  calcularNovoSaldo,
  calcularJurosDiarios,
  calcularMulta,
  calcularPagamentoParcialLote,
  statusPosBaixa,
  getEffectiveStatus,
} from "@/lib/financeiro";

/** Representa uma parcela gerada pelo serviço de parcelamento. */
export interface Parcela {
  numero: number;
  dataVencimento: string; // ISO 8601 "YYYY-MM-DD"
  valor: number;
}

/**
 * Calcula juros simples sobre um valor em atraso.
 *
 * Utiliza ano comercial de 360 dias. Para juros mensais, converter a taxa
 * para diária antes de chamar esta função: `taxaMensal / 30`.
 *
 * @param valor       Valor principal (base de cálculo).
 * @param taxa        Taxa de juros em percentual ao dia (ex.: 0.033 para 0,033%/dia).
 * @param diasAtraso  Número de dias de atraso.
 * @returns Valor dos juros arredondado para 2 casas decimais.
 */
export function calcularJuros(
  valor: number,
  taxa: number,
  diasAtraso: number,
): number {
  if (diasAtraso <= 0 || taxa <= 0 || valor <= 0) return 0;
  return Math.round(valor * (taxa / 100) * diasAtraso * 100) / 100;
}

/**
 * Calcula desconto sobre um valor.
 *
 * @param valor       Valor sobre o qual o desconto será aplicado.
 * @param percentual  Percentual de desconto (ex.: 5 para 5%).
 * @returns Valor do desconto arredondado para 2 casas decimais.
 */
export function calcularDesconto(valor: number, percentual: number): number {
  if (percentual <= 0 || valor <= 0) return 0;
  return Math.round(valor * (percentual / 100) * 100) / 100;
}

/**
 * Gera parcelas distribuindo o valor total em `numParcelas` prestações.
 *
 * Quando o valor não é divisível exatamente, o centavo residual é adicionado
 * à primeira parcela, mantendo a soma igual ao `valorTotal`.
 *
 * @param valorTotal               Valor total a ser parcelado.
 * @param numParcelas              Número de parcelas (mínimo 1).
 * @param dataPrimeiroVencimento   Data de vencimento da primeira parcela.
 * @param intervaloDias            Intervalo em dias entre vencimentos (padrão: 30).
 * @returns Array de parcelas ordenadas por número.
 */
export function gerarParcelas(
  valorTotal: number,
  numParcelas: number,
  dataPrimeiroVencimento: Date,
  intervaloDias = 30,
): Parcela[] {
  if (numParcelas < 1) return [];

  const valorBase = Math.floor((valorTotal / numParcelas) * 100) / 100;
  const residuo = Math.round((valorTotal - valorBase * numParcelas) * 100) / 100;

  return Array.from({ length: numParcelas }, (_, i) => {
    const vencimento = new Date(dataPrimeiroVencimento);
    vencimento.setDate(vencimento.getDate() + intervaloDias * i);

    return {
      numero: i + 1,
      dataVencimento: vencimento.toISOString().split("T")[0],
      valor: i === 0 ? Math.round((valorBase + residuo) * 100) / 100 : valorBase,
    };
  });
}
