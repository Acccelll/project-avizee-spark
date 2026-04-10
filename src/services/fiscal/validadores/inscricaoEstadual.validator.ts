/**
 * Validação e formatação de Inscrição Estadual (IE) por UF.
 *
 * Suporta todos os estados brasileiros e o caso especial "ISENTO".
 */

function soDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

function mod11(digits: number[], pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i++) {
    soma += digits[i] * pesos[i];
  }
  const resto = soma % 11;
  if (resto < 2) return 0;
  return 11 - resto;
}

function mod10(digits: number[], pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i++) {
    const prod = digits[i] * pesos[i];
    soma += Math.floor(prod / 10) + (prod % 10);
  }
  const resto = soma % 10;
  if (resto === 0) return 0;
  return 10 - resto;
}

// ── Validadores por estado ────────────────────────────────────────────────────

function validarAC(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 13) return false;
  if (!d.startsWith("01")) return false;
  const nums = d.split("").map(Number);
  const cd1 = mod11(nums.slice(0, 11), [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (nums[11] !== cd1) return false;
  const cd2 = mod11([...nums.slice(0, 11), nums[11]], [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[12] === cd2;
}

function validarAL(ie: string): boolean {
  const d = soDigitos(ie);
  return d.length === 9;
}

function validarAP(ie: string): boolean {
  const d = soDigitos(ie);
  return d.length === 9 && d.startsWith("03");
}

function validarAM(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 9) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 8), [9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[8] === cd;
}

function validarBA(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 8 && d.length !== 9) return false;
  const nums = d.split("").map(Number);
  if (d.length === 8) {
    const mod = [0, 1, 2, 3, 4, 5, 6, 7, 8].includes(nums[0]) ? 10 : 11;
    const pesos = [7, 6, 5, 4, 3, 2];
    const cd2 = mod === 10
      ? mod10(nums.slice(0, 6), pesos)
      : mod11(nums.slice(0, 6), pesos);
    if (nums[7] !== cd2) return false;
    const pesos1 = [8, 7, 6, 5, 4, 3, 2];
    const cd1 = mod === 10
      ? mod10(nums.slice(0, 7), pesos1)
      : mod11(nums.slice(0, 7), pesos1);
    return nums[7] === cd2 && nums[6] === cd1;
  }
  // 9 digits
  const mod = [0, 1, 2, 3, 4, 5, 6, 7, 8].includes(nums[0]) ? 10 : 11;
  const pesos2 = [8, 7, 6, 5, 4, 3, 2];
  const cd2 = mod === 10
    ? mod10(nums.slice(0, 7), pesos2)
    : mod11(nums.slice(0, 7), pesos2);
  if (nums[8] !== cd2) return false;
  const pesos1 = [9, 8, 7, 6, 5, 4, 3, 2];
  const cd1 = mod === 10
    ? mod10(nums.slice(0, 8), pesos1)
    : mod11(nums.slice(0, 8), pesos1);
  return nums[7] === cd1;
}

function validarCE(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 9) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 8), [9, 8, 7, 6, 5, 4, 3, 2]);
  const cdFinal = cd === 10 ? 0 : cd;
  return nums[8] === cdFinal;
}

function validarDF(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 13) return false;
  const nums = d.split("").map(Number);
  const cd1 = mod11(nums.slice(0, 11), [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (nums[11] !== cd1) return false;
  const cd2 = mod11([...nums.slice(0, 11), nums[11]], [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[12] === cd2;
}

function validarES(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 9) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 8), [9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[8] === cd;
}

function validarGO(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 9) return false;
  if (!["10", "11", "15"].includes(d.slice(0, 2))) return false;
  const nums = d.split("").map(Number);
  const soma = nums.slice(0, 8).reduce((acc, n, i) => acc + n * (9 - i), 0);
  const resto = soma % 11;
  let cd: number;
  if (resto === 0) {
    cd = 0;
  } else if (resto === 1) {
    const num = parseInt(d.slice(0, 8));
    cd = num >= 10103105 && num <= 10119997 ? 1 : 0;
  } else {
    cd = 11 - resto;
  }
  return nums[8] === cd;
}

function validarMA(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 9) return false;
  if (!d.startsWith("12")) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 8), [9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[8] === cd;
}

function validarMT(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 11) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 10), [3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[10] === cd;
}

function validarMS(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 9) return false;
  if (!d.startsWith("28")) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 8), [9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[8] === cd;
}

function validarMG(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 13) return false;
  // Primeira verificação: inserir zero na posição 3, calcular mod10
  const expandido = d.slice(0, 3) + "0" + d.slice(3, 11);
  const e = expandido.split("").map(Number);
  const pesos1 = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  let cd1calc = 0;
  for (let i = 0; i < 12; i++) {
    const prod = e[i] * pesos1[i];
    cd1calc += Math.floor(prod / 10) + (prod % 10);
  }
  const cd1 = (10 - (cd1calc % 10)) % 10;
  if (parseInt(d[11]) !== cd1) return false;
  // Segunda verificação: mod11
  const nums = d.split("").map(Number);
  const cd2 = mod11(nums.slice(0, 12), [3, 2, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[12] === cd2;
}

function validarPA(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 9) return false;
  if (!d.startsWith("15")) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 8), [9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[8] === cd;
}

function validarPB(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 9) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 8), [9, 8, 7, 6, 5, 4, 3, 2]);
  const cdFinal = cd > 9 ? 0 : cd;
  return nums[8] === cdFinal;
}

function validarPR(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 10) return false;
  const nums = d.split("").map(Number);
  const cd1 = mod11(nums.slice(0, 8), [3, 2, 7, 6, 5, 4, 3, 2]);
  if (nums[8] !== cd1) return false;
  const cd2 = mod11([...nums.slice(0, 8), cd1], [4, 3, 2, 7, 6, 5, 4, 3, 2]);
  return nums[9] === cd2;
}

function validarPE(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 9 && d.length !== 14) return false;
  if (d.length === 9) {
    const nums = d.split("").map(Number);
    const cd1 = mod11(nums.slice(0, 7), [8, 7, 6, 5, 4, 3, 2]);
    if (nums[7] !== cd1) return false;
    const cd2 = mod11(nums.slice(0, 8), [9, 8, 7, 6, 5, 4, 3, 2]);
    return nums[8] === cd2;
  }
  // 14 dígitos (novo formato)
  return true;
}

function validarPI(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 9) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 8), [9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[8] === cd;
}

function validarRJ(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 8) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 7), [2, 7, 6, 5, 4, 3, 2]);
  return nums[7] === cd;
}

function validarRN(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 9 && d.length !== 10) return false;
  const nums = d.split("").map(Number);
  const len = nums.length;
  const pesos = Array.from({ length: len - 1 }, (_, i) => len - i);
  const soma = nums.slice(0, len - 1).reduce((acc, n, i) => acc + n * pesos[i], 0);
  const cd = ((soma * 10) % 11) % 10;
  return nums[len - 1] === cd;
}

function validarRS(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 10) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 9), [2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[9] === cd;
}

function validarRO(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 14) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[13] === cd;
}

function validarRR(ie: string): boolean {
  const d = soDigitos(ie);
  return d.length === 9 && d.startsWith("24");
}

function validarSC(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 9) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 8), [9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[8] === cd;
}

function validarSE(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 9) return false;
  const nums = d.split("").map(Number);
  const cd = mod11(nums.slice(0, 8), [9, 8, 7, 6, 5, 4, 3, 2]);
  const cdFinal = cd === 10 ? 0 : cd;
  return nums[8] === cdFinal;
}

function validarSP(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 12) return false;
  const nums = d.split("").map(Number);
  // CD1 na posição 8 (índice 8): pesos para dígitos[0..7]
  const cd1 = mod11(nums.slice(0, 8), [1, 3, 2, 10, 3, 8, 4, 7]);
  if (nums[8] !== (cd1 % 10)) return false;
  // CD2 na posição 11 (índice 11): pesos para dígitos[0..10]
  const cd2 = mod11(nums.slice(0, 11), [3, 2, 10, 3, 8, 4, 7, 5, 6, 1, 2]);
  return nums[11] === (cd2 % 10);
}

function validarTO(ie: string): boolean {
  const d = soDigitos(ie);
  if (d.length !== 11) return false;
  const nums = d.split("").map(Number);
  // Remove dígitos 3 e 4 para o cálculo
  const calc = [...nums.slice(0, 2), ...nums.slice(4, 10)];
  const cd = mod11(calc, [9, 8, 7, 6, 5, 4, 3, 2]);
  return nums[10] === cd;
}

// ── API Pública ───────────────────────────────────────────────────────────────

const VALIDADORES: Record<string, (ie: string) => boolean> = {
  AC: validarAC, AL: validarAL, AP: validarAP, AM: validarAM,
  BA: validarBA, CE: validarCE, DF: validarDF, ES: validarES,
  GO: validarGO, MA: validarMA, MT: validarMT, MS: validarMS,
  MG: validarMG, PA: validarPA, PB: validarPB, PR: validarPR,
  PE: validarPE, PI: validarPI, RJ: validarRJ, RN: validarRN,
  RS: validarRS, RO: validarRO, RR: validarRR, SC: validarSC,
  SE: validarSE, SP: validarSP, TO: validarTO,
};

/**
 * Valida a Inscrição Estadual de acordo com as regras da UF informada.
 * Aceita "ISENTO" (qualquer capitalização) como válido para todos os estados.
 */
export function validarIE(ie: string, uf: string): boolean {
  const normalizado = ie.trim().toUpperCase();
  if (normalizado === "ISENTO") return true;
  const validador = VALIDADORES[uf.toUpperCase()];
  if (!validador) return soDigitos(ie).length > 0;
  return validador(ie);
}

/**
 * Formata a IE removendo caracteres não numéricos.
 * Preserva "ISENTO" sem alteração.
 */
export function formatarIE(ie: string, _uf: string): string {
  const normalizado = ie.trim().toUpperCase();
  if (normalizado === "ISENTO") return "ISENTO";
  return soDigitos(ie);
}
