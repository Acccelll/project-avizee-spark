/**
 * Validação de CEST (Código Especificador da Substituição Tributária).
 */

/**
 * Conjunto de NCMs que exigem informação do CEST (ST).
 * Lista reduzida dos casos mais comuns conforme Convênio ICMS 92/2015 e posteriores.
 */
const NCM_CEST_OBRIGATORIO = new Set([
  "22021000",
  "22029000",
  "22030000",
  "24022000",
  "24031100",
  "27101259",
  "27102000",
  "30021290",
  "33030010",
  "33051000",
  "34011110",
  "39261000",
  "40111000",
  "61091000",
  "61099000",
  "62052000",
  "84713012",
  "85171231",
  "85258100",
  "87032110",
]);

/**
 * Verifica se o código CEST é válido.
 * Um CEST válido deve conter exatamente 7 dígitos numéricos.
 */
export function validarCEST(cest: string): boolean {
  if (!cest) return false;
  const limpo = cest.replace(/\D/g, "");
  return limpo.length === 7 && /^\d{7}$/.test(limpo);
}

/**
 * Verifica se o CEST é obrigatório para um dado NCM.
 * Baseado no Convênio ICMS 92/2015 e atualizações posteriores.
 */
export function isCESTObrigatorio(ncm: string): boolean {
  const limpo = ncm.replace(/\D/g, "");
  return NCM_CEST_OBRIGATORIO.has(limpo);
}
