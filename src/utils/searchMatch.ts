/**
 * Utilitários de busca tolerantes a máscara.
 *
 * Documentos como CNPJ/CPF podem ser salvos no banco com ou sem máscara
 * (`12.345.678/0001-99` vs `12345678000199`). Estes helpers permitem que o
 * usuário pesquise em qualquer dos dois formatos sem se preocupar com como
 * o registro foi armazenado.
 */
import { cnpjMask, cpfMask } from "@/utils/masks";

/** Remove tudo que não for dígito. */
export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Compara `needle` com `haystack` ignorando máscaras de documento. Quando o
 * termo contém alguma letra ou símbolo, faz comparação textual normal
 * (case-insensitive). Quando o termo é puramente numérico ou misto, também
 * compara contra a versão "somente dígitos" do haystack.
 */
export function matchesDoc(
  haystack: string | null | undefined,
  needle: string | null | undefined,
): boolean {
  const hay = (haystack ?? "").toString();
  const need = (needle ?? "").toString().trim();
  if (!need) return true;
  if (hay.toLowerCase().includes(need.toLowerCase())) return true;
  const needDigits = onlyDigits(need);
  if (!needDigits) return false;
  const hayDigits = onlyDigits(hay);
  return hayDigits.includes(needDigits);
}

/**
 * Para uma coluna de cpf_cnpj e um termo de busca, devolve a lista de
 * variantes a serem usadas com `.ilike` no PostgREST. Inclui o termo cru
 * (para casar com nome/documentos sem máscara), os dígitos puros (DB sem
 * máscara) e a versão formatada (DB com máscara).
 */
export function buildDocSearchVariants(term: string): string[] {
  const raw = (term ?? "").trim();
  if (!raw) return [];
  const variants = new Set<string>();
  variants.add(raw);
  const digits = onlyDigits(raw);
  if (digits) {
    variants.add(digits);
    if (digits.length <= 11) variants.add(cpfMask(digits));
    if (digits.length >= 12) variants.add(cnpjMask(digits));
    // Para termos parciais (ex.: "12345"), tentar também como prefixo de CNPJ.
    if (digits.length < 14) variants.add(cnpjMask(digits));
  }
  return Array.from(variants).filter(Boolean);
}