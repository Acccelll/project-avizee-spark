/**
 * Pedido direto: pedido que chega sem proposta enviada (WhatsApp, Mercado
 * Livre, OC por e-mail, telefone). Vira um orçamento já com o pedido
 * registrado, pela RPC `criar_pedido_direto`, e segue o mesmo fluxo dos
 * pedidos (saldo por item, vínculo com a NF, relatório Pedidos a Faturar).
 */

import { supabase } from "@/integrations/supabase/client";
import { atualizarPedidoOrcamento, type RegistrarPedidoResult } from "./pedidoOrcamento.service";

export type CanalVenda = "orcamento" | "whatsapp" | "mercado_livre" | "email" | "telefone";
export type CanalPedidoDireto = Exclude<CanalVenda, "orcamento">;

export const CANAL_LABEL: Record<CanalVenda, string> = {
  orcamento: "Orçamento",
  whatsapp: "WhatsApp",
  mercado_livre: "Mercado Livre",
  email: "E-mail/OC",
  telefone: "Telefone",
};

export const CANAIS_PEDIDO_DIRETO: CanalPedidoDireto[] = ["whatsapp", "mercado_livre", "email", "telefone"];

/** Canais em que o número do pedido é obrigatório. */
export function pedidoObrigatorio(canal: CanalPedidoDireto): boolean {
  return canal === "mercado_livre" || canal === "email";
}

export function rotuloNumeroPedido(canal: CanalPedidoDireto): string {
  if (canal === "mercado_livre") return "Nº da venda no Mercado Livre";
  if (canal === "email") return "Nº da OC do cliente";
  return "Nº do pedido do cliente (opcional)";
}

/**
 * Venda do Mercado Livre: 16 dígitos começando por 2000. Só avisa — o
 * número pode vir num formato novo e não deve travar o cadastro.
 */
export function avisoNumeroMercadoLivre(numero: string): string | null {
  const digitos = numero.replace(/\D/g, "");
  if (!digitos) return null;
  return /^2000\d{12}$/.test(digitos) ? null : "Confira o número: vendas do Mercado Livre têm 16 dígitos e começam com 2000.";
}

export interface ItemPedidoDireto {
  produtoId: string | null;
  codigo?: string | null;
  descricao: string;
  unidade?: string | null;
  quantidade: number;
  valorUnitario: number;
}

export interface CriarPedidoDiretoInput {
  clienteId: string;
  canal: CanalPedidoDireto;
  itens: ItemPedidoDireto[];
  pedidoCliente?: string | null;
  dataPedido?: string | null;
  previsaoDespacho?: string | null;
  freteValor?: number | null;
  observacoes?: string | null;
  anexo?: File | null;
}

export function totalItens(itens: ItemPedidoDireto[]): number {
  return Math.round(itens.reduce((s, i) => s + (i.quantidade > 0 ? i.quantidade * i.valorUnitario : 0), 0) * 100) / 100;
}

export async function criarPedidoDireto(input: CriarPedidoDiretoInput): Promise<RegistrarPedidoResult & { canal: string }> {
  const { data, error } = await supabase.rpc("criar_pedido_direto", {
    p_cliente_id: input.clienteId,
    p_canal: input.canal,
    p_itens: input.itens
      .filter((i) => i.quantidade > 0)
      .map((i) => ({
        produto_id: i.produtoId,
        codigo: i.codigo ?? null,
        descricao: i.descricao,
        unidade: i.unidade ?? null,
        quantidade: i.quantidade,
        valor_unitario: i.valorUnitario,
      })) as never,
    p_pedido_cliente: input.pedidoCliente?.trim() || undefined,
    p_data_pedido: input.dataPedido || undefined,
    p_previsao_despacho: input.previsaoDespacho || undefined,
    p_frete_valor: input.freteValor ?? 0,
    p_observacoes: input.observacoes?.trim() || undefined,
  });
  if (error) throw new Error(error.message);
  const res = data as unknown as RegistrarPedidoResult & { canal: string };

  // O anexo vai para a pasta do orçamento, que só existe depois de criado.
  if (input.anexo) {
    await atualizarPedidoOrcamento({
      orcamentoId: res.id,
      pedidoCliente: res.pedido_cliente,
      dataPedido: input.dataPedido || null,
      previsaoDespacho: input.previsaoDespacho || null,
      anexo: input.anexo,
    });
  }
  return res;
}

/** Último preço praticado para o cliente, por produto (pedidos e histórico). */
export async function ultimosPrecosDoCliente(clienteId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("orcamentos_itens")
    .select("produto_id, valor_unitario, orcamentos!inner(cliente_id, status, data_orcamento)")
    .eq("orcamentos.cliente_id", clienteId)
    .in("orcamentos.status", ["aprovado", "convertido", "historico"])
    .not("produto_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const precos = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.produto_id && !precos.has(row.produto_id) && Number(row.valor_unitario) > 0) {
      precos.set(row.produto_id, Number(row.valor_unitario));
    }
  }
  return precos;
}
