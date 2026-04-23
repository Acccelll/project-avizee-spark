/**
 * Standardised UI type definitions shared across the ERP modules.
 */

/**
 * Design-token variants for status badges, alerts, and visual indicators.
 * Maps semantic backend status strings to Tailwind/shadcn colour tokens.
 */
export type StatusVariant =
  | "success"      // green  – pago, concluido, ativo, entregue, conciliado, finalizada
  | "warning"      // amber  – pendente, aberto, aguardando, parcial, em_separacao, confirmado
  | "destructive"  // red    – cancelado, rejeitado, vencido, expirado, bloqueado, sem_correspondencia
  | "info"         // blue   – aprovado, enviado, processando, em_analise, importada
  | "primary"      // brand  – faturado, convertido, composto, conciliado_manual
  | "muted";       // grey   – rascunho, inativo, simples, default fallback

/**
 * Maps backend status strings (lower-cased) to a `StatusVariant`.
 * Used by StatusBadge and any component that needs a colour token.
 */
export const STATUS_VARIANT_MAP: Record<string, StatusVariant> = {
  // success
  pago:               "success",
  concluido:          "success",
  concluída:          "success",
  ativo:              "success",
  ativa:              "success",
  entregue:           "success",
  conciliado:         "success",
  finalizada:         "success",
  finalizado:         "success",
  total:              "success",
  aprovado:           "success",
  aprovada:           "success",

  // warning
  pendente:           "warning",
  aberto:             "warning",
  aberta:             "warning",
  aguardando:         "warning",
  aguardando_aprovacao: "warning",
  confirmado:         "warning",
  confirmada:         "warning",
  parcial:            "warning",
  em_separacao:       "warning",
  divergente:         "warning",

  // destructive
  cancelado:          "destructive",
  cancelada:          "destructive",
  rejeitado:          "destructive",
  rejeitada:          "destructive",
  vencido:            "destructive",
  vencida:            "destructive",
  expirado:           "destructive",
  bloqueado:          "destructive",
  sem_correspondencia: "destructive",

  // info
  enviado:            "info",
  enviada:            "info",
  processando:        "info",
  em_analise:         "info",
  importada:          "info",
  importado:          "info",
  em_transito:        "info",

  // primary (brand)
  faturado:           "primary",
  faturada:           "primary",
  convertido:         "primary",
  convertida:         "primary",
  composto:           "primary",
  conciliado_manual:  "primary",

  // muted
  rascunho:           "muted",
  inativo:            "muted",
  inativa:            "muted",
  simples:            "muted",
  nao_faturado:       "muted",

  // success (extras usados por StatusBadge)
  no_prazo:           "success",
  despachado:         "success",
  recebido:           "success",
  emitida:            "success",

  // warning (extras)
  proximo_vencimento: "warning",
  recebido_parcial:   "warning",
  em_separacao:       "warning",
  aguardando_aprovacao: "warning",

  // destructive (extras)
  atrasado:           "destructive",

  // info (extras — produto/insumo/importação têm tom info no design)
  produto:            "info",
  insumo:             "info",
};

/**
 * Returns the `StatusVariant` for a given backend status string.
 * Falls back to `"muted"` for unknown values.
 */
export function getStatusVariant(status: string): StatusVariant {
  return STATUS_VARIANT_MAP[status?.toLowerCase()] ?? "muted";
}
