/**
 * Helper de paginação universal — wrapper que re-exporta a implementação
 * canônica em `services/relatorios/lib/fetchAllPages` para uso em qualquer
 * service. Resolve o teto silencioso de 1000 linhas do PostgREST sem
 * forçar callers a inventarem `.limit(N)` arbitrários.
 *
 * Uso:
 * ```ts
 * const rows = await fetchAllPages<Row>(() =>
 *   supabase.from("tabela").select("*").eq("ativo", true).order("nome"),
 * );
 * ```
 *
 * Veja `relatorios/lib/fetchAllPages` para detalhes (page size 1000,
 * hard cap 50k, callback de truncamento).
 */
export {
  fetchAllPages,
  SUPABASE_PAGE_SIZE,
  REPORT_HARD_CAP,
  type FetchAllPagesOptions,
} from "@/services/relatorios/lib/fetchAllPages";