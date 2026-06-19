/**
 * Paginação server-side de `notas_fiscais` — RPC `listar_notas_fiscais_ids`
 * + reidratação por `IN (ids)`. Extraído de `useNotasFiscaisPaged` para
 * manter a camada `src/services/` como única autoridade de I/O
 * (mem://tech/camada-services-unica).
 */
import { supabase } from "@/integrations/supabase/client";
import type { NotaFiscal } from "@/types/domain";

export interface NotasFiscaisPagedParams {
  dateFrom?: string | null;
  dateTo?: string | null;
  tipos?: string[] | null;
  status?: string[] | null;
  statusSefaz?: string[] | null;
  modelos?: string[] | null;
  origens?: string[] | null;
  fornecedores?: string[] | null;
  clientes?: string[] | null;
  search?: string | null;
  orderBy: "data_emissao" | "numero" | "valor_total" | "created_at";
  ascending: boolean;
  offset: number;
  limit: number;
  signal?: AbortSignal;
}

const SELECT_RELATIONAL =
  "*, fornecedores(nome_razao_social, cpf_cnpj), clientes(nome_razao_social), ordens_venda(numero)";

export async function fetchNotasFiscaisPaged(
  params: NotasFiscaisPagedParams,
): Promise<{ rows: NotaFiscal[]; totalCount: number }> {
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "listar_notas_fiscais_ids",
    {
      p_date_from: params.dateFrom ?? undefined,
      p_date_to: params.dateTo ?? undefined,
      p_tipos: params.tipos?.length ? params.tipos : undefined,
      p_status: params.status?.length ? params.status : undefined,
      p_status_sefaz: params.statusSefaz?.length ? params.statusSefaz : undefined,
      p_modelos: params.modelos?.length ? params.modelos : undefined,
      p_origens: params.origens?.length ? params.origens : undefined,
      p_fornecedores: params.fornecedores?.length ? params.fornecedores : undefined,
      p_clientes: params.clientes?.length ? params.clientes : undefined,
      p_search: params.search?.trim() || undefined,
      p_order_by: params.orderBy,
      p_ascending: params.ascending,
      p_offset: params.offset,
      p_limit: params.limit,
    },
  );
  if (rpcError) throw rpcError;
  const payload = (rpcData ?? {}) as { ids?: string[] | null; total_count?: number };
  const ids = payload.ids ?? [];
  const totalCount = Number(payload.total_count ?? 0);
  if (ids.length === 0) return { rows: [], totalCount };

  let q = supabase.from("notas_fiscais").select(SELECT_RELATIONAL).in("id", ids);
  if (params.signal) q = q.abortSignal(params.signal);
  const { data: rows, error } = await q;
  if (error) throw error;

  const byId = new Map<string, NotaFiscal>();
  ((rows ?? []) as unknown as NotaFiscal[]).forEach((r) => byId.set(r.id, r));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as NotaFiscal[];
  return { rows: ordered, totalCount };
}