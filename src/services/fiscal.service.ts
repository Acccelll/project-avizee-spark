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

// ── Lifecycle: Confirmar / Estornar / Devolver ────────────────────────────────

export async function confirmarNotaFiscal(nfId: string): Promise<void> {
  const { error } = await supabase.rpc("confirmar_nota_fiscal", { p_nf_id: nfId });
  if (error) throw error;
}

export async function estornarNotaFiscal(input: { nfId: string; motivo?: string }): Promise<void> {
  const { error } = await supabase.rpc("estornar_nota_fiscal", {
    p_nf_id: input.nfId,
    p_motivo: input.motivo,
  });
  if (error) throw error;
}

export interface ItemDevolucao {
  produto_id: string;
  quantidade: number;
}

export async function gerarDevolucaoNotaFiscal(input: {
  nfOrigemId: string;
  /** Quando omitido, gera devolução total. */
  itens?: ItemDevolucao[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("gerar_devolucao_nota_fiscal", {
    p_nf_origem_id: input.nfOrigemId,
    p_itens: (input.itens ?? null) as never,
  });
  if (error) throw error;
  return data as string;
}

// ── Vínculo NF ↔ Pedido de Compra ─────────────────────────────────────────────

export interface PedidoCompraOpcao {
  id: string;
  numero: string | null;
  valor_total: number | null;
  status: string | null;
  data_pedido: string | null;
  fornecedor_nome: string | null;
}

/** Lista pedidos de compra ativos do fornecedor para vínculo manual com NF. */
export async function listPedidosCompraParaVincular(fornecedorId: string): Promise<PedidoCompraOpcao[]> {
  const { data, error } = await supabase
    .from("pedidos_compra")
    .select("id, numero, valor_total, status, data_pedido, fornecedores(nome_razao_social)")
    .eq("fornecedor_id", fornecedorId)
    .neq("status", "cancelado")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      numero: string | null;
      valor_total: number | null;
      status: string | null;
      data_pedido: string | null;
      fornecedores: { nome_razao_social: string } | null;
    };
    return {
      id: r.id,
      numero: r.numero,
      valor_total: r.valor_total,
      status: r.status,
      data_pedido: r.data_pedido,
      fornecedor_nome: r.fornecedores?.nome_razao_social ?? null,
    };
  });
}

/** Vincula NF a um pedido de compra via RPC `vincular_nf_pedido_compra`. */
export async function vincularNFPedidoCompra(input: {
  notaFiscalId: string;
  pedidoCompraId: string;
}): Promise<void> {
  const { error } = await supabase.rpc("vincular_nf_pedido_compra", {
    p_nf_id: input.notaFiscalId,
    p_pedido_id: input.pedidoCompraId,
  });
  if (error) throw error;
}

/** Remove o vínculo NF ↔ Pedido de Compra (apenas reseta a coluna). */
export async function desvincularNFPedidoCompra(notaFiscalId: string): Promise<void> {
  const { error } = await supabase
    .from("notas_fiscais")
    .update({ pedido_compra_id: null })
    .eq("id", notaFiscalId);
  if (error) throw error;
}

// ── Drawer / detail helpers ────────────────────────────────────────────────────

/**
 * Carrega itens, lançamentos financeiros, movimentos de estoque, eventos e
 * anexos relacionados a uma nota fiscal — usado pelo NotaFiscalDrawer.
 */
export async function fetchNotaFiscalDetalhes(notaFiscalId: string) {
  const [{ data: it }, { data: lanc }, { data: mov }, { data: ev }, { data: anx }] =
    await Promise.all([
      supabase
        .from("notas_fiscais_itens")
        .select("*, produtos(id, nome, sku)")
        .eq("nota_fiscal_id", notaFiscalId),
      supabase
        .from("financeiro_lancamentos")
        .select(
          "id, tipo, descricao, valor, data_vencimento, status, forma_pagamento, parcela_numero, parcela_total",
        )
        .eq("nota_fiscal_id", notaFiscalId)
        .order("parcela_numero", { ascending: true }),
      supabase
        .from("estoque_movimentos")
        .select("*, produtos(id, nome, sku)")
        .eq("documento_id", notaFiscalId)
        .eq("documento_tipo", "fiscal")
        .order("created_at", { ascending: true }),
      supabase
        .from("nota_fiscal_eventos")
        .select("*")
        .eq("nota_fiscal_id", notaFiscalId)
        .order("data_evento", { ascending: false }),
      supabase
        .from("nota_fiscal_anexos")
        .select("*")
        .eq("nota_fiscal_id", notaFiscalId)
        .order("created_at", { ascending: false }),
    ]);
  return {
    items: it ?? [],
    lancamentos: lanc ?? [],
    movimentos: mov ?? [],
    eventos: ev ?? [],
    anexos: anx ?? [],
  };
}

/** Hard-delete genérico de tabelas suportadas pelo PermanentDeleteDialog. */
export type PermanentDeleteTable =
  | "funcionarios"
  | "transportadoras"
  | "formas_pagamento"
  | "grupos_economicos"
  | "notas_fiscais";

export async function permanentDeleteRecord(
  table: PermanentDeleteTable,
  id: string,
): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
