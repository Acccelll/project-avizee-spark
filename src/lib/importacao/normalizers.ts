import { UNIDADE_MEDIDA_ALIASES, STATUS_IMPORTACAO_ALIASES } from './aliases';

/**
 * Normaliza uma string de texto qualquer para o sistema.
 */
export function normalizeText(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Normaliza código de produto (SKU/Ref).
 */
export function normalizeCodigoProduto(value: any): string {
  if (!value) return '';
  return String(value).trim().toUpperCase().replace(/\s+/g, '-');
}

/**
 * Normaliza CPF ou CNPJ (apenas números).
 */
export function normalizeCpfCnpj(value: any): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

/**
 * Normaliza E-mail.
 */
export function normalizeEmail(value: any): string {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

/**
 * Normaliza Telefone.
 */
export function normalizePhone(value: any): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

/**
 * Normaliza CEP.
 */
export function normalizeCep(value: any): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '').padStart(8, '0').slice(0, 8);
}

/**
 * Normaliza valor monetário em formato brasileiro string para número.
 * Ex: "R$ 1.250,50" -> 1250.5
 */
export function normalizeMoneyBR(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const clean = String(value)
    .replace('R$', '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(clean) || 0;
}

/**
 * Converte data no formato string BR (dd/mm/aaaa) para ISO.
 */
export function normalizeDateBR(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();

  const str = String(value).trim();
  const match = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);

  if (match) {
    const d = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    let y = match[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }

  // Tenta parse nativo se falhar Regex
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

/**
 * Normaliza valores booleanos ou similares ("S", "N", "1", "0", "true", "ativo").
 */
export function normalizeBooleanLike(value: any): boolean {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  if (!value) return false;

  const str = String(value).trim().toUpperCase();
  return ['S', 'SIM', 'TRUE', 'VERDADEIRO', 'ATIVO', 'OK'].includes(str);
}

/**
 * Normaliza unidade de medida usando aliases.
 */
export function normalizeUnidadeMedida(value: any): string {
  if (!value) return 'UN';
  const str = String(value).trim().toUpperCase();
  return UNIDADE_MEDIDA_ALIASES[str] || str;
}

/**
 * Normaliza status da importação.
 */
export function normalizeStatusImportacao(value: any): string {
  if (!value) return 'pendente';
  const str = String(value).trim().toUpperCase();
  return STATUS_IMPORTACAO_ALIASES[str] || 'pendente';
}
