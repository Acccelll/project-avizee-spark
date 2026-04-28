import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type NotaFiscalEventoInsert =
  Database["public"]["Tables"]["nota_fiscal_eventos"]["Insert"];
type NotaFiscalUpdate = Database["public"]["Tables"]["notas_fiscais"]["Update"];
type NotaFiscalInsert = Database["public"]["Tables"]["notas_fiscais"]["Insert"];
type NotaFiscalItemInsert =
  Database["public"]["Tables"]["notas_fiscais_itens"]["Insert"];

// ── Event logging ──────────────────────────────────────────────────────────────

export async function registrarEventoFiscal(params: {
  nota_fiscal_id: string;
  tipo_evento: string;
  status_anterior?: string;
  status_novo?: string;
  descricao?: string;
  payload_resumido?: Record<string, unknown>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  const payload: NotaFiscalEventoInsert = {
    nota_fiscal_id: params.nota_fiscal_id,
    tipo_evento: params.tipo_evento,
    status_anterior: params.status_anterior || null,
    status_novo: params.status_novo || null,
    descricao: params.descricao || null,
    payload_resumido: (params.payload_resumido ?? null) as NotaFiscalEventoInsert["payload_resumido"],
    usuario_id: user?.id || null,
  };
  await supabase.from("nota_fiscal_eventos").insert(payload);
}

/**
 * Cancelamento interno da NF (status_sefaz != autorizada).
 * Estorna efeitos automaticamente quando NF estava confirmada.
 * Para NF autorizada na SEFAZ, use `cancelarNotaFiscalSefaz`.
 */
export async function cancelarNotaFiscal(nfId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_nota_fiscal", {
    p_nf_id: nfId,
    p_motivo: motivo,
  });
  if (error) throw error;
}

/**
 * Cancelamento via SEFAZ (somente NFs autorizadas).
 * Atualiza status_sefaz para `cancelada_sefaz` preservando integridade contábil.
 */
export async function cancelarNotaFiscalSefaz(
  nfId: string,
  protocolo: string,
  motivo: string,
): Promise<void> {
  const { error } = await supabase.rpc("cancelar_nota_fiscal_sefaz", {
    p_nf_id: nfId,
    p_protocolo: protocolo,
    p_motivo: motivo,
  });
  if (error) throw error;
}

/**
 * Inutilização de faixa numérica (somente status_sefaz=nao_enviada e
 * status interno em rascunho/cancelada).
 */
export async function inutilizarNotaFiscal(
  nfId: string,
  protocolo: string,
  motivo: string,
): Promise<void> {
  const { error } = await supabase.rpc("inutilizar_nota_fiscal", {
    p_nf_id: nfId,
    p_protocolo: protocolo,
    p_motivo: motivo,
  });
  if (error) throw error;
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
//
// As funções `confirmarNotaFiscal`, `estornarNotaFiscal` e `processarDevolucao`
// foram removidas na Fase 9 do roadmap fiscal. A orquestração manual de estoque,
// financeiro e faturamento foi substituída por RPCs atômicas server-side.
// Use os hooks canônicos:
//   - useConfirmarNotaFiscal   (RPC `confirmar_nota_fiscal`)
//   - useEstornarNotaFiscal    (RPC `estornar_nota_fiscal`)
//   - useGerarDevolucaoNF      (RPC `gerar_devolucao_nota_fiscal`)
// em `src/pages/fiscal/hooks/useNotaFiscalLifecycle.ts`.

/** Re-exported from `@/lib/fiscal` for backward compatibility. */
export { calcularCfopDevolucao } from "@/lib/fiscal";

// ── Duplicate check ────────────────────────────────────────────────────────────

export async function verificarDuplicidadeChave(
  chaveAcesso: string
): Promise<boolean> {
  if (!chaveAcesso || chaveAcesso.length < 44) return false;
  const { data } = await supabase
    .from("notas_fiscais")
    .select("id")
    .eq("chave_acesso", chaveAcesso)
    .limit(1);
  return (data?.length || 0) > 0;
}

// ── Lookups & itens (consumidos pela página Fiscal) ────────────────────────────

export async function listOrdensVendaParaFiscal() {
  const { data, error } = await supabase
    .from("ordens_venda")
    .select("id, numero, cliente_id, clientes(nome_razao_social)")
    .eq("ativo", true)
    .in("status", ["aprovada", "em_separacao"])
    .order("numero");
  if (error) throw error;
  return data || [];
}

export async function listContasContabeisLancaveis() {
  const { data, error } = await supabase
    .from("contas_contabeis")
    .select("id, codigo, descricao")
    .eq("ativo", true)
    .eq("aceita_lancamento", true)
    .order("codigo");
  if (error) throw error;
  return data || [];
}

export async function getPedidoCompraResumo(pedidoId: string) {
  const { data, error } = await supabase
    .from("pedidos_compra")
    .select("numero, fornecedor_id")
    .eq("id", pedidoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listNotaFiscalItensCompletos(nfId: string) {
  const { data, error } = await supabase
    .from("notas_fiscais_itens")
    .select("*, produtos(nome, sku)")
    .eq("nota_fiscal_id", nfId);
  if (error) throw error;
  return data || [];
}

export async function getEmpresaConfigPrincipal() {
  const { data, error } = await supabase
    .from("empresa_config")
    .select("*")
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Salva uma NF (insert ou update) e substitui seus itens em uma única operação.
 * Não é atômica server-side (idealmente migrar para RPC), mas centraliza o I/O
 * que estava espalhado pela página `Fiscal.tsx`.
 */
export async function upsertNotaFiscalComItens(params: {
  mode: "create" | "edit";
  nfId?: string;
  payload: NotaFiscalInsert & NotaFiscalUpdate;
  itemsBuilder: (nfId: string) => NotaFiscalItemInsert[];
}): Promise<string> {
  const { mode, nfId, payload, itemsBuilder } = params;
  let resolvedId = nfId;
  if (mode === "create") {
    const { data, error } = await supabase
      .from("notas_fiscais")
      .insert(payload as NotaFiscalInsert)
      .select()
      .single();
    if (error) throw error;
    resolvedId = data.id;
  } else {
    if (!nfId) throw new Error("nfId obrigatório para edit");
    await Promise.all([
      supabase.from("notas_fiscais").update(payload as NotaFiscalUpdate).eq("id", nfId),
      supabase.from("notas_fiscais_itens").delete().eq("nota_fiscal_id", nfId),
    ]);
  }
  if (!resolvedId) throw new Error("Falha ao resolver id da NF");
  const itens = itemsBuilder(resolvedId);
  if (itens.length > 0) {
    const { error: insErr } = await supabase
      .from("notas_fiscais_itens")
      .insert(itens);
    if (insErr) throw insErr;
  }
  return resolvedId;
}

// ── Empresa Config (Configuração Fiscal) ───────────────────────────────────────

type EmpresaConfigRow = Database["public"]["Tables"]["empresa_config"]["Row"];
type EmpresaConfigInsert = Database["public"]["Tables"]["empresa_config"]["Insert"];
type EmpresaConfigUpdate = Database["public"]["Tables"]["empresa_config"]["Update"];

export async function getEmpresaConfig(): Promise<EmpresaConfigRow | null> {
  const { data, error } = await supabase
    .from("empresa_config")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function upsertEmpresaConfig(
  payload: EmpresaConfigInsert | EmpresaConfigUpdate,
  configId?: string | null,
): Promise<string> {
  if (configId) {
    const { error } = await supabase
      .from("empresa_config")
      .update(payload as EmpresaConfigUpdate)
      .eq("id", configId);
    if (error) throw error;
    return configId;
  }
  const { data, error } = await supabase
    .from("empresa_config")
    .insert(payload as EmpresaConfigInsert)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
