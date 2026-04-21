/**
 * Utilitários de matching de produtos para migração com preservação histórica.
 *
 * `normalizarDescricao` deve produzir EXATAMENTE o mesmo resultado que a função
 * SQL `public.normalizar_descricao(text)`:
 *   - lowercase
 *   - remoção de acentos (NFD + remove diacríticos)
 *   - colapsa whitespace múltiplo em um único espaço
 *   - trim final
 */
export function normalizarDescricao(texto: string | null | undefined): string {
  if (!texto) return "";
  return texto
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type MatchStatus = "vinculado" | "nao_vinculado" | "manual" | "duvidoso";
export type MatchTipo = "exato_codigo" | "exato_descricao" | "manual" | "aproximado" | "nao_vinculado";

export interface PreviewMatchCounts {
  vinculado: number;
  duvidoso: number;
  nao_vinculado: number;
  criar_descontinuado: number;
}

export interface RelatorioMigracaoFaturamento {
  total_itens: number;
  vinculados: number;
  duvidosos: number;
  nao_vinculados: number;
  pct_vinculados: number;
  pct_duvidosos: number;
  pct_nao_vinculados: number;
  produtos_descontinuados_criados: number;
  amostra_nao_vinculados: Array<{ codigo: string | null; descricao: string | null; qtd: number }>;
  amostra_descontinuados: Array<{ produto_id: string; codigo: string | null; descricao: string | null; descontinuado_em: string | null }>;
}
