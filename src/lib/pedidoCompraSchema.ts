import { z } from "zod";

/**
 * Schema mínimo para validar o formulário de Pedido de Compra antes do submit.
 * Itens são validados separadamente (ver helper `validatePedidoItems`).
 */
export const pedidoCompraSchema = z.object({
  fornecedor_id: z.string().trim().min(1, "Fornecedor é obrigatório"),
  data_pedido: z.string().min(1, "Data do pedido é obrigatória"),
  data_entrega_prevista: z.string().optional().or(z.literal("")),
  data_entrega_real: z.string().optional().or(z.literal("")),
  frete_valor: z.union([z.string(), z.number()]).optional(),
  condicao_pagamento: z.string().optional().or(z.literal("")),
  status: z.enum([
    "rascunho",
    "aguardando_aprovacao",
    "aprovado",
    "enviado_ao_fornecedor",
    "aguardando_recebimento",
    "parcialmente_recebido",
    "recebido",
    "cancelado",
  ]),
  observacoes: z.string().optional().or(z.literal("")),
});

export type PedidoCompraFormValues = z.infer<typeof pedidoCompraSchema>;

export interface PedidoItemInput {
  produto_id?: string | number | null;
  quantidade?: number | null;
  valor_unitario?: number | null;
}

/**
 * Validação dos itens do pedido. Retorna mensagem de erro ou null.
 */
export function validatePedidoItems(items: PedidoItemInput[]): string | null {
  const valid = items.filter((i) => i.produto_id);
  if (valid.length === 0) return "Adicione ao menos um item com produto selecionado.";
  const invalidQty = valid.findIndex((i) => Number(i.quantidade || 0) <= 0);
  if (invalidQty !== -1) return `Item ${invalidQty + 1}: quantidade deve ser maior que zero.`;
  const invalidPrice = valid.findIndex((i) => Number(i.valor_unitario ?? 0) < 0);
  if (invalidPrice !== -1) return `Item ${invalidPrice + 1}: preço unitário inválido.`;
  return null;
}
