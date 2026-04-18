/**
 * Mapas de query keys que devem ser invalidadas em cada operação cross-módulo.
 *
 * Centraliza listas para evitar drift entre callers (ex.: confirmar NF
 * impacta estoque + financeiro + OV, e múltiplos componentes precisam
 * lembrar de invalidar todas).
 *
 * Uso:
 * ```ts
 * const invalidate = useInvalidateAfterMutation();
 * await confirmarNotaFiscal(...);
 * await invalidate(INVALIDATION_KEYS.fiscalLifecycle);
 * ```
 */
export const INVALIDATION_KEYS = {
  /** Confirmação/estorno/devolução de NF — toca tudo. */
  fiscalLifecycle: [
    "notas_fiscais",
    "fiscal",
    "ordens_venda",
    "pedidos",
    "financeiro_lancamentos",
    "financeiro_baixas",
    "estoque-produtos",
    "estoque-movimentacoes",
    "contas_bancarias",
  ],
  /** Faturamento de pedido (gera NF). */
  faturamentoPedido: [
    "notas_fiscais",
    "fiscal",
    "ordens_venda",
    "pedidos",
    "financeiro_lancamentos",
    "estoque-produtos",
    "estoque-movimentacoes",
  ],
  /** Conversão Orçamento → Pedido. */
  conversaoOrcamento: [
    "orcamentos",
    "ordens_venda",
    "pedidos",
  ],
  /** Recebimento de compra (estoque + financeiro). */
  recebimentoCompra: [
    "pedidos_compra",
    "compras",
    "estoque-produtos",
    "estoque-movimentacoes",
    "financeiro_lancamentos",
    "notas_fiscais",
  ],
  /** Geração de pedido de compra a partir de cotação. */
  geracaoPedidoCompra: [
    "cotacoes_compra",
    "pedidos_compra",
  ],
  /** Baixa financeira (lote ou individual). */
  baixaFinanceira: [
    "financeiro_lancamentos",
    "financeiro_baixas",
    "contas_bancarias",
  ],
} as const;
