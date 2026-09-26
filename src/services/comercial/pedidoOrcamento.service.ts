/**
 * Pedido do cliente registrado no próprio orçamento.
 *
 * O orçamento vira o pedido (status `aprovado`, exibido como "Pedido")
 * quando o cliente envia o número do pedido ou OC. Sem número, o próprio
 * número do orçamento é a referência — é o que já vai na NF hoje.
 */

import { supabase } from "@/integrations/supabase/client";

const BUCKET_ANEXO = "orcamentos-pdf";

export interface PedidoOrcamentoInput {
  orcamentoId: string;
  /** Vazio → o RPC usa o número do orçamento. */
  pedidoCliente: string | null;
  dataPedido: string | null;
  previsaoDespacho: string | null;
  anexo?: File | null;
}

export interface RegistrarPedidoResult {
  id: string;
  numero: string;
  pedido_cliente: string;
  versoes_substituidas: string[];
}

export interface PedidoDuplicado {
  id: string;
  numero: string;
  status: string | null;
}

/** Compara números de pedido sem pontuação nem zeros à esquerda ("1.181" = "01181"). */
export function normalizarPedido(valor: string | null | undefined): string {
  return (valor ?? "").replace(/[^0-9a-z]/gi, "").replace(/^0+/, "").toUpperCase();
}

/** Raiz do CNPJ (8 dígitos) para agrupar filiais; CPF fica inteiro. */
export function raizDocumento(cpfCnpj: string | null | undefined): string {
  const digitos = (cpfCnpj ?? "").replace(/\D/g, "");
  return digitos.length === 14 ? digitos.slice(0, 8) : digitos;
}

/** Previsão sugerida: data do pedido + prazo de entrega do orçamento. */
export function sugerirPrevisaoDespacho(
  dataPedido: string | null,
  prazoEntregaDias: number | null | undefined,
): string {
  if (!dataPedido || !prazoEntregaDias || prazoEntregaDias <= 0) return "";
  const [ano, mes, dia] = dataPedido.split("-").map(Number);
  if (!ano || !mes || !dia) return "";
  const d = new Date(Date.UTC(ano, mes - 1, dia + prazoEntregaDias));
  return d.toISOString().slice(0, 10);
}

async function uploadAnexoPedido(orcamentoId: string, file: File): Promise<string> {
  const nomeSeguro = file.name.normalize("NFD").replace(/[^\w.-]+/g, "_");
  const path = `${orcamentoId}/pedido-cliente/${Date.now()}-${nomeSeguro}`;
  const { error } = await supabase.storage
    .from(BUCKET_ANEXO)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(`Não foi possível enviar o anexo: ${error.message}`);
  return path;
}

export async function registrarPedidoOrcamento(
  input: PedidoOrcamentoInput,
): Promise<RegistrarPedidoResult> {
  const anexoPath = input.anexo ? await uploadAnexoPedido(input.orcamentoId, input.anexo) : undefined;
  const { data, error } = await supabase.rpc("registrar_pedido_orcamento", {
    p_id: input.orcamentoId,
    p_pedido_cliente: input.pedidoCliente?.trim() || undefined,
    p_data_pedido: input.dataPedido || undefined,
    p_previsao_despacho: input.previsaoDespacho || undefined,
    p_anexo_path: anexoPath,
  });
  if (error) throw new Error(error.message);
  return data as unknown as RegistrarPedidoResult;
}

export async function atualizarPedidoOrcamento(input: PedidoOrcamentoInput): Promise<void> {
  const anexoPath = input.anexo ? await uploadAnexoPedido(input.orcamentoId, input.anexo) : undefined;
  const { error } = await supabase.rpc("atualizar_pedido_orcamento", {
    p_id: input.orcamentoId,
    p_pedido_cliente: input.pedidoCliente?.trim() || undefined,
    p_data_pedido: input.dataPedido || undefined,
    p_previsao_despacho: input.previsaoDespacho || undefined,
    p_anexo_path: anexoPath,
  });
  if (error) throw new Error(error.message);
}

export async function getAnexoPedidoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_ANEXO).createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) throw new Error(error?.message || "Anexo indisponível");
  return data.signedUrl;
}

/**
 * Outros orçamentos com o mesmo número de pedido para o mesmo cliente
 * (mesma raiz de CNPJ, para pegar filiais e cadastros duplicados).
 */
export async function buscarPedidosDuplicados(params: {
  orcamentoId: string;
  clienteCpfCnpj: string | null;
  clienteId: string | null;
  pedidoCliente: string;
}): Promise<PedidoDuplicado[]> {
  const alvo = normalizarPedido(params.pedidoCliente);
  if (!alvo) return [];
  const { data, error } = await supabase
    .from("orcamentos")
    .select("id, numero, status, cliente_id, pedido_cliente, clientes(cpf_cnpj)")
    .not("pedido_cliente", "is", null)
    .neq("id", params.orcamentoId);
  if (error) throw new Error(error.message);
  const raiz = raizDocumento(params.clienteCpfCnpj);
  return (data ?? [])
    .filter((o) => normalizarPedido(o.pedido_cliente) === alvo)
    .filter((o) =>
      raiz
        ? raizDocumento((o.clientes as { cpf_cnpj: string | null } | null)?.cpf_cnpj) === raiz
        : o.cliente_id === params.clienteId,
    )
    .map((o) => ({ id: o.id, numero: o.numero, status: o.status }));
}
