/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase join inference limitations */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrcamentoBase {
  id: string;
  numero: string;
  status: string;
  cliente_id: string | null;
  valor_total: number | null;
  quantidade_total: number | null;
  peso_total: number | null;
  observacoes: string | null;
}

export async function sendForApproval(orc: OrcamentoBase): Promise<void> {
  if (orc.status !== "rascunho") return;
  const { error } = await supabase
    .from("orcamentos")
    .update({ status: "confirmado" })
    .eq("id", orc.id);
  if (error) throw error;
  toast.success(`Cotação ${orc.numero} enviada para aprovação!`);
}

export async function approveOrcamento(orc: OrcamentoBase): Promise<void> {
  const { error } = await supabase
    .from("orcamentos")
    .update({ status: "aprovado" })
    .eq("id", orc.id);
  if (error) throw error;
  toast.success(`Cotação ${orc.numero} aprovada!`);
}

export interface ConvertToOVOptions {
  poNumber?: string;
  dataPo?: string;
}

/** @deprecated Use convertToPedido instead */
export const convertToOV = convertToPedido;

export async function convertToPedido(
  orc: OrcamentoBase,
  options: ConvertToOVOptions = {}
): Promise<{ ovId: string; ovNumero: string }> {
  const { data: items } = await supabase
    .from("orcamentos_itens")
    .select("*")
    .eq("orcamento_id", orc.id);

  // Carregar dados de frete do orçamento
  const { data: orcFrete } = await (supabase as any)
    .from("orcamentos")
    .select(
      "frete_valor, frete_tipo, modalidade, transportadora_id, frete_simulacao_id, origem_frete, servico_frete, peso_total, prazo_entrega_dias, volumes"
    )
    .eq("id", orc.id)
    .maybeSingle();

  const { count } = await supabase
    .from("ordens_venda")
    .select("*", { count: "exact", head: true });

  const ovNumero = `PED${String((count || 0) + 1).padStart(6, "0")}`;

  const fretePayload: Record<string, unknown> = {};
  if (orcFrete) {
    const f = orcFrete as Record<string, unknown>;
    if (f.frete_valor != null) fretePayload.frete_valor = f.frete_valor;
    if (f.frete_tipo) fretePayload.frete_tipo = f.frete_tipo;
    if (f.modalidade) fretePayload.modalidade = f.modalidade;
    if (f.transportadora_id) fretePayload.transportadora_id = f.transportadora_id;
    if (f.frete_simulacao_id) fretePayload.frete_simulacao_id = f.frete_simulacao_id;
    if (f.origem_frete) fretePayload.origem_frete = f.origem_frete;
    if (f.servico_frete) fretePayload.servico_frete = f.servico_frete;
    if (f.peso_total != null) fretePayload.peso_total = f.peso_total;
    if (f.prazo_entrega_dias != null) fretePayload.prazo_entrega_dias = f.prazo_entrega_dias;
    if (f.volumes != null) fretePayload.volumes = f.volumes;
  }

  const { data: newOV, error } = await supabase
    .from("ordens_venda")
    .insert({
      numero: ovNumero,
      data_emissao: new Date().toISOString().split("T")[0],
      cliente_id: orc.cliente_id,
      cotacao_id: orc.id,
      status: "aprovada",
      status_faturamento: "aguardando",
      valor_total: orc.valor_total,
      observacoes: orc.observacoes,
      po_number: options.poNumber || null,
      data_po_cliente: options.dataPo || null,
      ...fretePayload,
    } as any)
    .select()
    .single();

  if (error) throw error;

  if (items && items.length > 0 && newOV) {
    const ovItems = items.map((i: any) => ({
      ordem_venda_id: newOV.id,
      produto_id: i.produto_id,
      codigo_snapshot: i.codigo_snapshot,
      descricao_snapshot: i.descricao_snapshot,
      variacao: i.variacao,
      quantidade: i.quantidade,
      unidade: i.unidade,
      valor_unitario: i.valor_unitario,
      valor_total: i.valor_total,
      peso_unitario: i.peso_unitario,
      peso_total: i.peso_total,
      quantidade_faturada: 0,
    }));
    await supabase.from("ordens_venda_itens").insert(ovItems);
  }

  const { error: updateError } = await supabase
    .from("orcamentos")
    .update({ status: "convertido" })
    .eq("id", orc.id);

  if (updateError) throw updateError;

  toast.success(`Pedido ${ovNumero} criado com sucesso!`);
  return { ovId: newOV!.id, ovNumero };
}

export async function ensurePublicToken(orcId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("orcamentos")
    .select("public_token")
    .eq("id", orcId)
    .maybeSingle();

  if (existing?.public_token) return existing.public_token;

  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("orcamentos")
    .update({ public_token: token })
    .eq("id", orcId);

  if (error) throw error;
  return token;
}
