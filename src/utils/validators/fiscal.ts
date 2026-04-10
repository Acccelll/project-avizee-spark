const ONLY_DIGITS = /\D/g;

function normalizeDigits(value: string): string {
  return value.replace(ONLY_DIGITS, "");
}

export function validateNCM(ncm: string): boolean {
  return /^\d{8}$/.test(normalizeDigits(ncm));
}

export function validateCEST(cest: string): boolean {
  return /^\d{7}$/.test(normalizeDigits(cest));
}

const NCM_WITHOUT_CEST_PREFIXES = ["01"];

export function isCESTRequiredForNCM(ncm: string): boolean {
  const normalizedNcm = normalizeDigits(ncm);

  if (!validateNCM(normalizedNcm)) {
    return false;
  }

  return !NCM_WITHOUT_CEST_PREFIXES.some((prefix) => normalizedNcm.startsWith(prefix));
}
