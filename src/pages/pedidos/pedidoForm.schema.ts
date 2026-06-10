import { z } from "zod";

/**
 * Schema do formulário de edição de Pedido de Venda (rota `/pedidos/:id`).
 *
 * Regras de campo (validação de forma). Regras de domínio que dependem do
 * estado do pedido (ex.: transição de status × `status_faturamento`)
 * permanecem fora do schema — vide `validarTransicaoPedido` em
 * `@/lib/comercialWorkflow`, ainda chamado no submit como business rule.
 */
export const pedidoFormSchema = z.object({
  status: z.string().trim().min(1, "Status é obrigatório"),
  po_number: z
    .string()
    .trim()
    .max(60, "Máximo de 60 caracteres")
    .optional()
    .or(z.literal("")),
  data_po_cliente: z.string().optional().or(z.literal("")),
  data_prometida_despacho: z.string().optional().or(z.literal("")),
  prazo_despacho_dias: z
    .string()
    .refine(
      (v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 365),
      "Informe um número inteiro entre 0 e 365",
    )
    .optional()
    .or(z.literal("")),
  observacoes: z
    .string()
    .max(2000, "Máximo de 2000 caracteres")
    .optional()
    .or(z.literal("")),
});

export type PedidoFormValues = z.infer<typeof pedidoFormSchema>;