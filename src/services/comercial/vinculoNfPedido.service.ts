/**
 * Vínculo NF de saída ↔ pedido (orçamento com pedido do cliente).
 *
 * A NF é emitida fora do ERP e importada pelo XML; o número do pedido que
 * vem no XML liga a nota ao orçamento, item a item, e dá o saldo a faturar.
 * Regras de vínculo e saldo ficam no banco (RPCs `*_nf_*` e a view
 * `vw_orcamento_itens_saldo`).
 */

import { supabase } from "@/integrations/supabase/client";

export type OrigemVinculo = "xml_pedido" | "xml_orcamento" | "valor" | "manual" | "historico";
export type FaturamentoStatus = "aberto" | "parcial" | "faturado" | "encerrado";

export interface ResultadoVinculoAutomatico {
  status: "vinculado" | "pedido_nao_registrado" | "sugestao" | "sem_pedido" | "ignorada";
  nf?: string;
  vinculados: { orcamento_id: string; numero: string; pedido_cliente: string | null; referencia: string; faturamento_status: FaturamentoStatus | null }[];
  pendentes?: { orcamento_id: string; numero: string; referencia: string; status: string }[];
  sugestoes?: { orcamento_id: string; numero: string; pedido_cliente?: string | null; motivo: string }[];
}

export interface PedidoSugerido {
  orcamento_id: string;
  numero: string;
  pedido_cliente: string | null;
  status: string;
  faturamento_status: FaturamentoStatus | null;
  valor_total: number | null;
  motivo: "xml_pedido" | "xml_orcamento" | "valor";
  referencia: string | null;
  registrado: boolean;
  vinculado: boolean;
}

export interface VinculoDaNf {
  id: string;
  origem: OrigemVinculo;
  referencia: string | null;
  orcamento: {
    id: string;
    numero: string;
    pedido_cliente: string | null;
    faturamento_status: string | null;
  } | null;
}

export interface VinculoDoOrcamento {
  id: string;
  origem: OrigemVinculo;
  referencia: string | null;
  created_at: string;
  nota: {
    id: string;
    numero: string | null;
    data_emissao: string | null;
    valor_total: number | null;
    status: string | null;
  } | null;
}

export interface SaldoItemPedido {
  orcamento_item_id: string;
  produto_id: string | null;
  quantidade: number;
  quantidade_faturada: number;
  saldo: number;
  faturado_a_mais: boolean;
  notas: string[];
}

export const ORIGEM_VINCULO_LABEL: Record<OrigemVinculo, string> = {
  xml_pedido: "automático (pedido no XML)",
  xml_orcamento: "automático (nº do orçamento no XML)",
  valor: "pelo valor",
  manual: "manual",
  historico: "histórico",
};

export const FATURAMENTO_LABEL: Record<FaturamentoStatus, string> = {
  aberto: "A faturar",
  parcial: "Faturado parcial",
  faturado: "Faturado",
  encerrado: "Saldo encerrado",
};

function rpcError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function vincularNfAutomatico(
  nfId: string,
  referencias?: string[],
): Promise<ResultadoVinculoAutomatico> {
  const { data, error } = await supabase.rpc("vincular_nf_automatico", {
    p_nf_id: nfId,
    p_referencias: referencias,
  });
  rpcError(error);
  return data as unknown as ResultadoVinculoAutomatico;
}

export async function sugerirPedidosNf(nfId: string): Promise<PedidoSugerido[]> {
  const { data, error } = await supabase.rpc("sugerir_pedidos_nf", { p_nf_id: nfId });
  rpcError(error);
  return (data ?? []) as unknown as PedidoSugerido[];
}

export async function vincularNfOrcamento(params: {
  nfId: string;
  orcamentoId: string;
  origem?: OrigemVinculo;
  referencia?: string | null;
}): Promise<{ orcamento: string; nf: string; faturamento_status: FaturamentoStatus | null; ja_vinculado: boolean }> {
  const { data, error } = await supabase.rpc("vincular_nf_orcamento", {
    p_nf_id: params.nfId,
    p_orcamento_id: params.orcamentoId,
    p_origem: params.origem ?? "manual",
    p_referencia: params.referencia ?? undefined,
  });
  rpcError(error);
  return data as never;
}

export async function desvincularNfOrcamento(nfId: string, orcamentoId: string): Promise<void> {
  const { error } = await supabase.rpc("desvincular_nf_orcamento", {
    p_nf_id: nfId,
    p_orcamento_id: orcamentoId,
  });
  rpcError(error);
}

export async function encerrarSaldoOrcamento(orcamentoId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("encerrar_saldo_orcamento", { p_id: orcamentoId, p_motivo: motivo });
  rpcError(error);
}

export async function listarVinculosDaNf(nfId: string): Promise<VinculoDaNf[]> {
  const { data, error } = await supabase
    .from("orcamento_nf_vinculos")
    .select("id, origem, referencia, orcamento:orcamentos(id, numero, pedido_cliente, faturamento_status)")
    .eq("nota_fiscal_id", nfId);
  if (error) throw error;
  return (data ?? []) as unknown as VinculoDaNf[];
}

export async function listarVinculosDoOrcamento(orcamentoId: string): Promise<VinculoDoOrcamento[]> {
  const { data, error } = await supabase
    .from("orcamento_nf_vinculos")
    .select("id, origem, referencia, created_at, nota:notas_fiscais(id, numero, data_emissao, valor_total, status)")
    .eq("orcamento_id", orcamentoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as VinculoDoOrcamento[];
}

export async function listarSaldoItensPedido(orcamentoId: string): Promise<SaldoItemPedido[]> {
  const { data, error } = await supabase
    .from("vw_orcamento_itens_saldo")
    .select("orcamento_item_id, produto_id, quantidade, quantidade_faturada, saldo, faturado_a_mais, notas")
    .eq("orcamento_id", orcamentoId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    quantidade: Number(r.quantidade ?? 0),
    quantidade_faturada: Number(r.quantidade_faturada ?? 0),
    saldo: Number(r.saldo ?? 0),
    faturado_a_mais: !!r.faturado_a_mais,
    notas: r.notas ?? [],
  })) as SaldoItemPedido[];
}

/** Texto curto para o aviso depois de importar o XML. */
export function resumoVinculoAutomatico(r: ResultadoVinculoAutomatico): { tipo: "success" | "info" | "warning"; texto: string } | null {
  if (r.status === "vinculado") {
    const pedidos = r.vinculados.map((v) => `${v.pedido_cliente ?? v.referencia} (${v.numero})`).join(", ");
    return { tipo: "success", texto: `NF ligada ao pedido ${pedidos}.` };
  }
  if (r.status === "pedido_nao_registrado") {
    const orcs = (r.pendentes ?? []).map((p) => p.numero).join(", ");
    return { tipo: "warning", texto: `O XML cita ${orcs}, que ainda não virou pedido. Registre o pedido e ligue a nota em Fiscal › Vínculos.` };
  }
  if (r.status === "sugestao") {
    const orcs = (r.sugestoes ?? []).map((s) => s.numero).join(", ");
    return { tipo: "info", texto: `Pedido provável pelo valor: ${orcs}. Confirme em Fiscal › Vínculos.` };
  }
  return null;
}
