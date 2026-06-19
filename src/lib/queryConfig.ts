/**
 * Tiers padronizados de cache do TanStack Query (Etapa 8.2).
 *
 * Substituir números mágicos (`staleTime: 60_000`, `staleTime: 5*60*1000`)
 * por um destes tiers em hooks novos. Hooks legados podem migrar
 * progressivamente sem mudança de comportamento — os valores foram
 * escolhidos para corresponder ao uso atual mais comum no projeto.
 *
 * Diretriz:
 * - REALTIME (0) — dados que mudam a cada interação: status SEFAZ ao vivo,
 *   carrinho do orçamento em edição.
 * - SHORT (30s) — contadores/duplicidade, sessões, presença de campos únicos.
 * - OPERATIONAL (1–2min) — estoque ao vivo, fluxo de caixa, alertas sidebar.
 * - TRANSACTIONAL (5min) — vendas/compras do dia, cadastros consultados em
 *   listas (clientes, fornecedores, contas), default global.
 * - AGGREGATE (15min) — DRE, curva ABC, margem, relatórios mensais.
 * - REFERENCE (30min) — cadastros raramente alterados (formas de pagamento,
 *   grupos econômicos, transportadoras).
 * - STATIC (1h) — validade de certificado, branding.
 *
 * `gcTime` é geralmente `staleTime * 2`. Use `staleTime: QUERY_STALE.REALTIME`
 * + `refetchOnWindowFocus: true` quando precisar de fresh sempre.
 */
export const QUERY_STALE = {
  REALTIME: 0,
  SHORT: 30 * 1000,
  OPERATIONAL: 2 * 60 * 1000,
  TRANSACTIONAL: 5 * 60 * 1000,
  AGGREGATE: 15 * 60 * 1000,
  REFERENCE: 30 * 60 * 1000,
  STATIC: 60 * 60 * 1000,
} as const;

export const QUERY_GC = {
  REALTIME: 60 * 1000,
  SHORT: 60 * 1000,
  OPERATIONAL: 5 * 60 * 1000,
  TRANSACTIONAL: 10 * 60 * 1000,
  AGGREGATE: 30 * 60 * 1000,
  REFERENCE: 60 * 60 * 1000,
  STATIC: 2 * 60 * 60 * 1000,
} as const;

export type QueryStaleTier = keyof typeof QUERY_STALE;