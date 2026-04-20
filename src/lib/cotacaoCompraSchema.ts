import { z } from "zod";

/**
 * Schema mínimo para validar o formulário de Cotação de Compra antes do submit.
 * Itens são validados separadamente (ver helper `validateCotacaoItems`).
 */
export const cotacaoCompraSchema = z.object({
  numero: z.string().trim().min(1, "Número da cotação é obrigatório"),
  data_cotacao: z.string().min(1, "Data da cotação é obrigatória"),
  data_validade: z.string().optional().or(z.literal("")),
  observacoes: z.string().optional().or(z.literal("")),
  status: z
    .string()
    .refine(
      (s) =>
        [
          "rascunho",
          "aberta",
          "em_analise",
          "aguardando_aprovacao",
          "aprovada",
        ].includes(s),
      {
        message:
          "Status inválido para edição. Use 'aberta', 'em_analise', 'aguardando_aprovacao' ou 'aprovada'.",
      },
    ),
});

export type CotacaoCompraFormValues = z.infer<typeof cotacaoCompraSchema>;

export interface CotacaoItemInput {
  produto_id: string;
  quantidade: number;
}

/**
 * Validação de itens da cotação. Retorna mensagem de erro ou null se OK.
 */
export function validateCotacaoItems(items: CotacaoItemInput[]): string | null {
  if (items.length === 0) return "Adicione ao menos um item";
  const semProduto = items.findIndex((i) => !i.produto_id);
  if (semProduto !== -1) return `Item ${semProduto + 1}: selecione um produto.`;
  const semQtd = items.findIndex((i) => Number(i.quantidade || 0) <= 0);
  if (semQtd !== -1) return `Item ${semQtd + 1}: quantidade deve ser maior que zero.`;
  const ids = items.map((i) => i.produto_id);
  if (ids.some((id, idx) => ids.indexOf(id) !== idx)) {
    return "Produto duplicado na cotação. Cada produto deve aparecer apenas uma vez.";
  }
  return null;
}
