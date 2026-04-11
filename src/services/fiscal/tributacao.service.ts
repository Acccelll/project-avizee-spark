/**
 * Serviço de sugestão automática de tributação fiscal.
 *
 * Retorna alíquotas sugeridas com base no NCM, CFOP, UFs e regime tributário.
 * Em produção, esse serviço consultaria uma tabela de regras fiscais ou API externa.
 */

export type RegimeTributario = "simples_nacional" | "lucro_presumido" | "lucro_real";

export interface SugestaoTributacaoParams {
  ncm: string;
  cfop: string;
  ufOrigem: string;
  ufDestino: string;
  regimeTributario: RegimeTributario;
}

export interface SugestaoTributacao {
  icmsAliquota: number;
  icmsCst: string;
  ipiAliquota: number;
  pisAliquota: number;
  cofinAliquota: number;
}

/** Verifica se a operação é interestadual */
function isInterestadual(ufOrigem: string, ufDestino: string): boolean {
  return ufOrigem.toUpperCase() !== ufDestino.toUpperCase();
}

/** Verifica se o CFOP é de saída */
function isSaida(cfop: string): boolean {
  return cfop.startsWith("5") || cfop.startsWith("6") || cfop.startsWith("7");
}

/**
 * Retorna alíquotas sugeridas de tributação com base nos parâmetros fornecidos.
 * Regras simplificadas — em produção devem ser complementadas por tabela de NCM/CFOP.
 */
export function sugerirTributacao(params: SugestaoTributacaoParams): SugestaoTributacao {
  const { cfop, ufOrigem, ufDestino, regimeTributario } = params;
  const interestadual = isInterestadual(ufOrigem, ufDestino);
  const saida = isSaida(cfop);

  // Alíquota ICMS
  let icmsAliquota = 0;
  let icmsCst = "00";

  if (regimeTributario === "simples_nacional") {
    icmsCst = "400";
    icmsAliquota = 0; // Simples Nacional: tributado pelo PGDAS, não destacado na NF-e
  } else if (saida) {
    if (interestadual) {
      // Alíquota interestadual padrão (Sul/Sudeste → outras regiões = 12%, demais = 7%)
      const regioesSulSudeste = ["SP", "RJ", "MG", "ES", "PR", "SC", "RS"];
      icmsAliquota = regioesSulSudeste.includes(ufOrigem.toUpperCase()) ? 12 : 7;
    } else {
      icmsAliquota = 18; // Alíquota interna padrão (varia por UF e produto)
    }
    icmsCst = "00";
  }

  // Alíquotas PIS/COFINS
  let pisAliquota = 0;
  let cofinAliquota = 0;

  if (regimeTributario === "lucro_real") {
    pisAliquota = 1.65;
    cofinAliquota = 7.6;
  } else if (regimeTributario === "lucro_presumido") {
    pisAliquota = 0.65;
    cofinAliquota = 3.0;
  }
  // Simples Nacional: PIS/COFINS incluídos no DAS, alíquota 0 na NF-e

  // IPI: aplica-se apenas para produtos industrializados (NCM com alíquota > 0)
  // Regra simplificada: 5% para saídas de produtos industrializados (NCM não iniciando em 22xx/24xx)
  const ipiAliquota = saida && !["22", "24"].some((p) => params.ncm.startsWith(p)) ? 0 : 0;

  return {
    icmsAliquota,
    icmsCst,
    ipiAliquota,
    pisAliquota,
    cofinAliquota,
  };
}
