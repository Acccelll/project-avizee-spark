import { z } from "zod";

/**
 * Schema do formulário de edição de Pedido de Compra
 * (rota `/pedidos-compra/:id`).
 *
 * Validações de forma. A transição de status (`validarTransicaoPedidoCompra`)
 * e a regra "status workflow só por ação dedicada" permanecem na página como
 * business rules emitindo `toast.error` — não são erros de campo.
 *
 * Itens (`items[]`) são gerenciados fora do RHF via `ItemsGrid`; suas
 * validações (produto, quantidade > 0, preço >= 0) seguem inline na página.
 */
export const pedidoCompraFormSchema = z
  .object({
    fornecedor_id: z.string().trim().min(1, "Fornecedor é obrigatório"),
    data_pedido: z.string().trim().min(1, "Data do pedido é obrigatória"),
    data_entrega_prevista: z.string().optional().or(z.literal("")),
    data_entrega_real: z.string().optional().or(z.literal("")),
    frete_valor: z
      .string()
      .refine(
        (v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0),
        "Frete inválido (use valor ≥ 0)",
      )
      .optional()
      .or(z.literal("")),
    condicao_pagamento: z.string().optional().or(z.literal("")),
    status: z.string().trim().min(1, "Status é obrigatório"),
    observacoes: z
      .string()
      .max(2000, "Máximo de 2000 caracteres")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (d) =>
      !d.data_entrega_prevista ||
      !d.data_pedido ||
      d.data_entrega_prevista >= d.data_pedido,
    {
      message: "A data de entrega prevista não pode ser anterior à data do pedido.",
      path: ["data_entrega_prevista"],
    },
  );

export type PedidoCompraFormValues = z.infer<typeof pedidoCompraFormSchema>;