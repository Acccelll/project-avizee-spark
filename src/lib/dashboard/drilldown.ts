/**
 * Centralized drill-down URL builder for dashboard navigation.
 *
 * Each entry maps a dashboard "intent" to the destination route + the params
 * that the destination page is known to consume. Keeping it here prevents the
 * dashboard from constructing ad-hoc query strings and makes it easy to audit
 * what destinations support what filters.
 *
 * CONVENTION (multivalor): a página de destino DEVE ler um único parâmetro
 * com valores separados por vírgula — `?status=aberto,parcial`. Não usar
 * params repetidos (`?status=aberto&status=parcial`). Esse padrão já é usado
 * por Financeiro; Pedidos foi alinhado em 2026-04 (vide useDashboardLayout PR).
 */

export type DrilldownIntent =
  // Financeiro
  | { kind: 'financeiro:receber-aberto' }
  | { kind: 'financeiro:pagar-aberto' }
  | { kind: 'financeiro:vencidos' }
  | { kind: 'financeiro:saldo' }
  // Estoque
  | { kind: 'estoque:critico' }
  // Logistica
  | { kind: 'logistica:remessas-atrasadas' }
  // Compras
  | { kind: 'compras:atrasadas' }
  // Fiscal
  | { kind: 'fiscal:rascunho' }
  | { kind: 'fiscal:pendentes' }
  // Comercial
  | { kind: 'pedidos:aguardando-faturamento' };

export function buildDrilldownUrl(intent: DrilldownIntent): string {
  switch (intent.kind) {
    case 'financeiro:receber-aberto':
      return '/financeiro?tipo=receber&status=aberto,parcial,vencido';
    case 'financeiro:pagar-aberto':
      return '/financeiro?tipo=pagar&status=aberto,parcial,vencido';
    case 'financeiro:vencidos':
      return '/financeiro?status=vencido';
    case 'financeiro:saldo':
      return '/fluxo-caixa';
    case 'estoque:critico':
      return '/estoque?critico=1';
    case 'logistica:remessas-atrasadas':
      return '/logistica?tab=remessas&atrasadas=1';
    case 'compras:atrasadas':
      return '/pedidos-compra?atrasadas=1';
    case 'fiscal:rascunho':
      return '/fiscal?status=rascunho';
    case 'fiscal:pendentes':
      return '/fiscal?status=pendente,rascunho';
    case 'pedidos:aguardando-faturamento':
      return '/pedidos?faturamento=aguardando,parcial';
  }
}