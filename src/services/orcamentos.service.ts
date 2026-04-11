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
  frete_valor?: number | null;
  frete_tipo?: string | null;
  modalidade?: string | null;
  transportadora_id?: string | null;
  frete_simulacao_id?: string | null;
  origem_frete?: string | null;
  servico_frete?: string | null;
  prazo_entrega_dias?: number | null;
  volumes?: number | null;
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
  const { data: orcamentoCompleto } = await supabase
    .from("orcamentos")
    .select("*")
    .eq("id", orc.id)
    .maybeSingle();

  const origem = orcamentoCompleto || orc;

  const { data: items } = await supabase
    .from("orcamentos_itens")
    .select("*")
    .eq("orcamento_id", orc.id);

  const { count } = await supabase
    .from("ordens_venda")
    .select("*", { count: "exact", head: true });

  const ovNumero = `PED${String((count || 0) + 1).padStart(6, "0")}`;

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
      transportadora_id: origem.transportadora_id || null,
      frete_simulacao_id: origem.frete_simulacao_id || null,
      origem_frete: origem.origem_frete || null,
      servico_frete: origem.servico_frete || null,
      frete_valor: origem.frete_valor || 0,
      frete_tipo: origem.frete_tipo || null,
      modalidade: origem.modalidade || null,
      peso_total: orc.peso_total || null,
      prazo_entrega_dias: origem.prazo_entrega_dias || null,
      volumes: origem.volumes || null,
      po_number: options.poNumber || null,
      data_po_cliente: options.dataPo || null,
    })
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
