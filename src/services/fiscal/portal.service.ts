/**
 * Portal Fiscal — service que encapsula todo I/O da página `PortalFiscal.tsx`
 * (RPC `buscar_nfe_portal`, `excluir_nfe_distribuicao_alheias` e leituras
 * em `nfe_distribuicao`, `nfe_distdfe_sync`, `empresa_config`).
 *
 * Mantém a camada `src/services/` como única autoridade de I/O
 * (mem://tech/camada-services-unica).
 */
import { supabase } from "@/integrations/supabase/client";

export interface PortalRow {
  id: string;
  chave_acesso: string;
  cnpj_emitente: string | null;
  nome_emitente: string | null;
  numero: string | null;
  serie: string | null;
  data_emissao: string | null;
  valor_total: number | null;
  protocolo_autorizacao: string | null;
  status_manifestacao: string;
  tipo_documento?: string | null;
  xml_importado?: boolean;
}

export interface PortalRpcFiltros {
  data_inicio?: string;
  data_fim?: string;
  chave?: string;
  cnpj_emitente?: string;
  emitente?: string;
  uf?: string;
  serie?: string;
  numero_ini?: string;
  numero_fim?: string;
  status_manifestacao?: string;
  tipo_documento?: string;
  incluir_outros_destinatarios?: string;
}

export interface PortalPageResult {
  rows: PortalRow[];
  total: number;
}

export async function buscarNfePortal(
  filtros: PortalRpcFiltros,
  page: number,
  pageSize: number,
): Promise<PortalPageResult> {
  const { data, error } = await supabase.rpc("buscar_nfe_portal", {
    p_filtros: filtros as unknown as never,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  if (error) throw error;
  const r = (data as unknown as PortalPageResult | null) ?? { rows: [], total: 0 };
  return { rows: r.rows ?? [], total: Number(r.total ?? 0) };
}

export async function excluirNfeDistribuicaoAlheias(): Promise<number> {
  const { data, error } = await supabase.rpc("excluir_nfe_distribuicao_alheias");
  if (error) throw error;
  return Number(data ?? 0);
}

export async function getEmpresaIdent(): Promise<{ cnpj: string | null; razao: string | null }> {
  const { data } = await supabase
    .from("empresa_config")
    .select("cnpj, razao_social")
    .limit(1)
    .maybeSingle();
  const c = data as { cnpj?: string | null; razao_social?: string | null } | null;
  const digits = c?.cnpj ? c.cnpj.replace(/\D/g, "") : null;
  return { cnpj: digits, razao: c?.razao_social ?? null };
}

export interface DistDFeSyncRow {
  ultimo_nsu?: string | null;
  max_nsu?: string | null;
  ultima_sync_at?: string | null;
  ultima_resposta_cstat?: string | null;
  ultima_resposta_xmotivo?: string | null;
}

export async function carregarStatusDistDFe(): Promise<{
  sync: DistDFeSyncRow | null;
  porTipo: Record<string, number>;
}> {
  const [{ data: sync }, { data: tipos }] = await Promise.all([
    supabase
      .from("nfe_distdfe_sync")
      .select("ultimo_nsu, max_nsu, ultima_sync_at, ultima_resposta_cstat, ultima_resposta_xmotivo")
      .order("ultima_sync_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("nfe_distribuicao").select("tipo_documento"),
  ]);

  const porTipo: Record<string, number> = {};
  for (const row of tipos ?? []) {
    const t = (row as { tipo_documento?: string }).tipo_documento ?? "outros";
    porTipo[t] = (porTipo[t] ?? 0) + 1;
  }
  return { sync: (sync as DistDFeSyncRow | null) ?? null, porTipo };
}

export async function getXmlNfeDistribuicao(id: string): Promise<string | null> {
  const { data } = await supabase
    .from("nfe_distribuicao")
    .select("xml_nfe")
    .eq("id", id)
    .maybeSingle();
  return (data as { xml_nfe?: string | null } | null)?.xml_nfe ?? null;
}