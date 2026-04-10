/**
 * Validação e extração de informações da Chave de Acesso de documentos fiscais.
 *
 * Estrutura da chave (44 dígitos):
 *  cUF(2) | AAMM(4) | CNPJ(14) | mod(2) | serie(3) | nNF(9) | tpEmis(1) | cNF(8) | cDV(1)
 */

export interface ChaveAcessoInfo {
  uf: string;
  anoMes: string;
  cnpj: string;
  modelo: string;
  serie: string;
  numero: string;
  tipoEmissao: string;
  codigoNumerico: string;
  digitoVerificador: string;
}

/** Mapa de código IBGE de UF para sigla. */
const CODIGO_UF: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
  "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE",
  "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE",
  "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
  "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT",
  "52": "GO", "53": "DF",
};

/**
 * Calcula o dígito verificador de uma chave de acesso usando o algoritmo MOD11.
 * Recebe os 43 primeiros dígitos como string.
 */
function calcularDigitoVerificador(chave43: string): number {
  const digits = chave43.split("").map(Number);
  let peso = 2;
  let soma = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    soma += digits[i] * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Valida uma chave de acesso de documento fiscal (44 dígitos).
 * Verifica comprimento, apenas dígitos e o dígito verificador MOD11.
 */
export function validarChaveAcesso(chave: string): boolean {
  const limpo = chave.replace(/\D/g, "");
  if (limpo.length !== 44) return false;
  const cd = calcularDigitoVerificador(limpo.slice(0, 43));
  return parseInt(limpo[43]) === cd;
}

/**
 * Extrai as informações contidas na chave de acesso.
 * Lança erro se a chave não tiver 44 dígitos.
 */
export function extrairInformacoesChave(chave: string): ChaveAcessoInfo {
  const limpo = chave.replace(/\D/g, "");
  if (limpo.length !== 44) {
    throw new Error("Chave de acesso deve ter 44 dígitos");
  }
  const codigoUF = limpo.slice(0, 2);
  return {
    uf: CODIGO_UF[codigoUF] ?? codigoUF,
    anoMes: limpo.slice(2, 6),
    cnpj: limpo.slice(6, 20),
    modelo: limpo.slice(20, 22),
    serie: limpo.slice(22, 25),
    numero: limpo.slice(25, 34),
    tipoEmissao: limpo.slice(34, 35),
    codigoNumerico: limpo.slice(35, 43),
    digitoVerificador: limpo.slice(43, 44),
  };
}
