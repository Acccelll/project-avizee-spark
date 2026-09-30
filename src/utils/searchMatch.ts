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
const SO_NUMEROS_E_SEPARADORES = /^[\d.\-/\s]+$/;

/** Texto só com dígitos e separadores de documento (`.`, `/`, `-`, espaço). */
function pareceDocumento(texto: string): boolean {
  return /\d/.test(texto) && SO_NUMEROS_E_SEPARADORES.test(texto);
}

/**
 * Busca textual (sem diferenciar maiúsculas) em uma lista de campos, tolerante
 * à máscara de documentos: "12.345.678/0001-99", "12345678000199" e
 * "12345678" encontram o mesmo CNPJ, esteja ele gravado com ou sem pontuação.
 * A comparação só por dígitos vale apenas entre termo e campo que sejam
 * documentos (só números e separadores), para não casar números soltos em
 * nomes ou descrições.
 */
export function matchesSearch(
  campos: ReadonlyArray<string | null | undefined>,
  termo: string | null | undefined,
): boolean {
  const q = (termo ?? "").trim().toLowerCase();
  if (!q) return true;
  const qDigitos = pareceDocumento(q) ? onlyDigits(q) : "";
  return campos.some((campo) => {
    if (!campo) return false;
    const texto = campo.toLowerCase();
    if (texto.includes(q)) return true;
    return qDigitos.length > 0 && pareceDocumento(texto) && onlyDigits(texto).includes(qDigitos);
  });
}

/**
 * Filtro `.or(...)` do PostgREST para buscar por nome e por CPF/CNPJ, com o
 * documento aceito com ou sem pontuação. Vírgulas e parênteses do termo são
 * descartados (são separadores na sintaxe do `.or`).
 */
export function buildNomeDocumentoOrFilter(
  termo: string,
  colunasTexto: string[],
  colunaDocumento = "cpf_cnpj",
): string {
  const limpo = (termo ?? "").replace(/[,()]/g, " ").trim();
  if (!limpo) return "";
  const partes = colunasTexto.map((c) => `${c}.ilike.%${limpo}%`);
  for (const v of buildDocSearchVariants(limpo)) partes.push(`${colunaDocumento}.ilike.%${v}%`);
  return partes.join(",");
}
