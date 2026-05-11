import { supabase } from "@/integrations/supabase/client";

/** Filtros + paginação para `listar_financeiro_lancamentos_ids`. */
export interface FinanceiroListarParams {
  dateFrom?: string | null;
  dateTo?: string | null;
  tipos?: string[] | null;
  status?: string[] | null;
  bancos?: string[] | null;
  origens?: string[] | null;
  formas?: string[] | null;
  cartoes?: string[] | null;
  search?: string | null;
  orderBy?: string;
  ascending?: boolean;
  offset: number;
  limit: number;
}

export interface FinanceiroPagedResult {
  ids: string[];
  totalCount: number;
}

/** Filtros para `kpis_financeiro` (sem paginação/ordem). */
export type KpisFinanceiroParams = Omit<
  FinanceiroListarParams,
  "orderBy" | "ascending" | "offset" | "limit"
>;

export interface KpisFinanceiroResult {
  totalCount: number;
  a_vencer: number;
  vence_hoje: number;
  vencido: number;
  pago: number;
  parcial: number;
  total_a_vencer: number;
  total_vencido: number;
  total_pago: number;
  total_parcial: number;
}

const KPIS_EMPTY: KpisFinanceiroResult = {
  totalCount: 0,
  a_vencer: 0,
  vence_hoje: 0,
  vencido: 0,
  pago: 0,
  parcial: 0,
  total_a_vencer: 0,
  total_vencido: 0,
  total_pago: 0,
  total_parcial: 0,
};

function arrOrNull(v: string[] | null | undefined): string[] | null {
  return v && v.length ? v : null;
}

/**
 * RPC `listar_financeiro_lancamentos_ids` — filtros server-side + paginação.
 * Retorna apenas os ids da página + total; o caller reidrata via SELECT relacional.
 */
export async function listarFinanceiroLancamentosIds(
  params: FinanceiroListarParams,
): Promise<FinanceiroPagedResult> {
  const { data, error } = await supabase.rpc("listar_financeiro_lancamentos_ids", {
    p_date_from: params.dateFrom ?? null,
    p_date_to: params.dateTo ?? null,
    p_tipos: arrOrNull(params.tipos ?? null),
    p_status: arrOrNull(params.status ?? null),
    p_bancos: arrOrNull(params.bancos ?? null),
    p_origens: arrOrNull(params.origens ?? null),
    p_formas: arrOrNull(params.formas ?? null),
    p_cartoes: arrOrNull(params.cartoes ?? null),
    p_search: params.search?.trim() || null,
    p_order_by: params.orderBy ?? "data_vencimento",
    p_ascending: params.ascending ?? false,
    p_offset: params.offset,
    p_limit: params.limit,
  });
  if (error) throw error;
  const payload = (data ?? {}) as { ids?: string[] | null; total_count?: number };
  return {
    ids: payload.ids ?? [],
    totalCount: Number(payload.total_count ?? 0),
  };
}

/** RPC `kpis_financeiro` — KPIs com os mesmos filtros da listagem. */
export async function fetchKpisFinanceiro(
  params: KpisFinanceiroParams,
): Promise<KpisFinanceiroResult> {
  const { data, error } = await supabase.rpc("kpis_financeiro", {
    p_date_from: params.dateFrom ?? null,
    p_date_to: params.dateTo ?? null,
    p_tipos: arrOrNull(params.tipos ?? null),
    p_status: arrOrNull(params.status ?? null),
    p_bancos: arrOrNull(params.bancos ?? null),
    p_origens: arrOrNull(params.origens ?? null),
    p_formas: arrOrNull(params.formas ?? null),
    p_cartoes: arrOrNull(params.cartoes ?? null),
    p_search: params.search?.trim() || null,
  });
  if (error) throw error;
  return { ...KPIS_EMPTY, ...((data as Partial<KpisFinanceiroResult>) ?? {}) };
}
