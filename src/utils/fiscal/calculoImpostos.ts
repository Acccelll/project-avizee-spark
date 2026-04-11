/**
 * Funções utilitárias para cálculo de impostos fiscais.
 *
 * Cobertos: ICMS, ICMS-ST, Diferencial de Alíquota (DIFAL), PIS e COFINS.
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ResultadoICMS {
  baseCalculo: number;
  aliquota: number;
  valorICMS: number;
}

export interface ResultadoICMSST {
  baseCalculoST: number;
  aliquotaST: number;
  valorICMSST: number;
  valorICMSRetido: number;
}

export interface ResultadoDifal {
  aliquotaInterestadual: number;
  aliquotaInterna: number;
  valorDifal: number;
  valorPartilhaOrigem: number;
  valorPartilhaDestino: number;
}

export interface ResultadoPisCofins {
  baseCalculo: number;
  pisAliquota: number;
  pisValor: number;
  cofinsAliquota: number;
  cofinsValor: number;
}

// ─── calcularICMS ─────────────────────────────────────────────────────────────

/**
 * Calcula o ICMS normal sobre a base de cálculo informada.
 *
 * @param baseCalculo  Valor da base de cálculo do ICMS (R$)
 * @param aliquota     Alíquota do ICMS (%)
 * @param reducao      Percentual de redução da base (%), padrão 0
 */
export function calcularICMS(
  baseCalculo: number,
  aliquota: number,
  reducao = 0,
): ResultadoICMS {
  const baseReduzida = baseCalculo * (1 - reducao / 100);
  const valorICMS = parseFloat(((baseReduzida * aliquota) / 100).toFixed(2));
  return { baseCalculo: parseFloat(baseReduzida.toFixed(2)), aliquota, valorICMS };
}

// ─── calcularICMSST ───────────────────────────────────────────────────────────

/**
 * Calcula o ICMS Substituição Tributária (ST).
 *
 * @param valorProduto  Valor do produto (R$)
 * @param aliquotaICMS  Alíquota ICMS próprio do remetente (%)
 * @param mva           Margem de Valor Agregado (%)
 * @param aliquotaST    Alíquota do ICMS-ST (%)
 */
export function calcularICMSST(
  valorProduto: number,
  aliquotaICMS: number,
  mva: number,
  aliquotaST: number,
): ResultadoICMSST {
  const icmsProprioValor = (valorProduto * aliquotaICMS) / 100;
  const baseCalculoST = parseFloat((valorProduto * (1 + mva / 100)).toFixed(2));
  const valorICMSST_total = parseFloat(((baseCalculoST * aliquotaST) / 100).toFixed(2));
  const valorICMSRetido = parseFloat((valorICMSST_total - icmsProprioValor).toFixed(2));
  return {
    baseCalculoST,
    aliquotaST,
    valorICMSST: valorICMSST_total,
    valorICMSRetido: Math.max(0, valorICMSRetido),
  };
}

// ─── calcularDiferencialAliquota ──────────────────────────────────────────────

/**
 * Calcula o Diferencial de Alíquota (DIFAL) para operações interestaduais
 * com consumidor final não-contribuinte (EC 87/2015).
 *
 * @param baseCalculo           Valor da base de cálculo (R$)
 * @param aliquotaInterestadual Alíquota ICMS interestadual aplicada pelo remetente (%)
 * @param aliquotaInterna       Alíquota ICMS interna do estado de destino (%)
 * @param partilhaDestino       Percentual do DIFAL destinado ao estado de destino (%, padrão 100)
 */
export function calcularDiferencialAliquota(
  baseCalculo: number,
  aliquotaInterestadual: number,
  aliquotaInterna: number,
  partilhaDestino = 100,
): ResultadoDifal {
  const valorDifal = parseFloat(
    (((aliquotaInterna - aliquotaInterestadual) / 100) * baseCalculo).toFixed(2),
  );
  const valorPartilhaDestino = parseFloat(((valorDifal * partilhaDestino) / 100).toFixed(2));
  const valorPartilhaOrigem = parseFloat((valorDifal - valorPartilhaDestino).toFixed(2));
  return {
    aliquotaInterestadual,
    aliquotaInterna,
    valorDifal: Math.max(0, valorDifal),
    valorPartilhaOrigem: Math.max(0, valorPartilhaOrigem),
    valorPartilhaDestino: Math.max(0, valorPartilhaDestino),
  };
}

// ─── calcularPISCOFINS ────────────────────────────────────────────────────────

/**
 * Calcula PIS e COFINS sobre a base informada.
 *
 * @param baseCalculo    Valor da base de cálculo (R$)
 * @param pisAliquota    Alíquota do PIS (%)
 * @param cofinsAliquota Alíquota do COFINS (%)
 */
export function calcularPISCOFINS(
  baseCalculo: number,
  pisAliquota: number,
  cofinsAliquota: number,
): ResultadoPisCofins {
  const pisValor = parseFloat(((baseCalculo * pisAliquota) / 100).toFixed(2));
  const cofinsValor = parseFloat(((baseCalculo * cofinsAliquota) / 100).toFixed(2));
  return { baseCalculo, pisAliquota, pisValor, cofinsAliquota, cofinsValor };
}
