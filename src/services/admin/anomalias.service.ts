/**
 * Serviço de detecção de anomalias para a área Admin → Auditoria.
 *
 * Consome as RPCs determinísticas criadas em
 * `detectar_divergencia_preco_compra`, `detectar_nf_duplicada` e
 * `detectar_gasto_fora_padrao`. Apenas admin executa (gate dentro das RPCs).
 */
import { supabase } from "@/integrations/supabase/client";

export interface AnomaliaDivergenciaPreco {
  compra_item_id: string;
  compra_id: string;
  produto_id: string;
  fornecedor_id: string | null;
  data_compra: string | null;
  valor_unitario: number;
  mediana: number;
  desvio_percentual: number;
}

export interface AnomaliaNfDuplicada {
  motivo: "fornecedor_numero_serie" | "chave_acesso";
  fornecedor_id: string | null;
  numero: string | null;
  serie: string | null;
  chave_acesso: string | null;
  quantidade: number;
  nota_ids: string[];
  valor_total: number;
  data_emissao_min: string | null;
  data_emissao_max: string | null;
}

export interface AnomaliaGastoForaPadrao {
  lancamento_id: string;
  conta_contabil_id: string;
  fornecedor_id: string | null;
  descricao: string | null;
  valor: number;
  data_vencimento: string;
  media: number;
  desvio: number;
  z_score: number | null;
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function listarDivergenciaPreco(): Promise<AnomaliaDivergenciaPreco[]> {
  const { data, error } = await supabase.rpc("detectar_divergencia_preco_compra" as never);
  if (error) throw error;
  return (data as unknown as AnomaliaDivergenciaPreco[] | null ?? []).map((r) => ({
    ...r,
    valor_unitario: toNumber(r.valor_unitario),
    mediana: toNumber(r.mediana),
    desvio_percentual: toNumber(r.desvio_percentual),
  }));
}

export async function listarNfDuplicada(): Promise<AnomaliaNfDuplicada[]> {
  const { data, error } = await supabase.rpc("detectar_nf_duplicada" as never);
  if (error) throw error;
  return (data as unknown as AnomaliaNfDuplicada[] | null ?? []).map((r) => ({
    ...r,
    quantidade: Number(r.quantidade) || 0,
    valor_total: toNumber(r.valor_total),
    nota_ids: Array.isArray(r.nota_ids) ? r.nota_ids : [],
  }));
}

export async function listarGastoForaPadrao(): Promise<AnomaliaGastoForaPadrao[]> {
  const { data, error } = await supabase.rpc("detectar_gasto_fora_padrao" as never);
  if (error) throw error;
  return (data as unknown as AnomaliaGastoForaPadrao[] | null ?? []).map((r) => ({
    ...r,
    valor: toNumber(r.valor),
    media: toNumber(r.media),
    desvio: toNumber(r.desvio),
    z_score: r.z_score == null ? null : toNumber(r.z_score),
  }));
}