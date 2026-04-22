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
 *
 * AUDITORIA HOOK ↔ PÁGINA (mantém em paridade os filtros que produzem o KPI
 * com os filtros aplicados na listagem-destino). Ao alterar um lado, atualizar
 * o outro.
 *
 * | intent                              | hook que produz a contagem               | filtro aplicado na página de destino                          |
 * |-------------------------------------|------------------------------------------|---------------------------------------------------------------|
 * | financeiro:receber-aberto           | useDashboardFinanceiroData (totalReceber)| tipo=receber + status IN (aberto,parcial,vencido)             |
 * | financeiro:pagar-aberto             | useDashboardFinanceiroData (totalPagar)  | tipo=pagar + status IN (aberto,parcial,vencido)               |
 * | financeiro:vencidos                 | useDashboardFinanceiroData (vencidos)    | status=vencido                                                |
 * | estoque:critico                     | useDashboardEstoqueData                  | critico=1                                                     |
 * | logistica:remessas-atrasadas        | useDashboardAuxData                      | tab=remessas + atrasadas=1                                    |
 * | compras:atrasadas                   | useDashboardAuxData (comprasAtrasadasCount)| atrasadas=1 (interpretação local em PedidosCompra.tsx)      |
 * | fiscal:rascunho / fiscal:pendentes  | useDashboardFiscalData (pendentes)       | status=rascunho (único status real de NF não emitida)         |
 * | pedidos:aguardando-faturamento      | useDashboardComercialData (backlogOVs)   | status IN (aprovada,em_separacao) + faturamento IN (aguardando,parcial) |
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
      // 'pendente' não é status real de notas_fiscais; rascunho é a fonte de verdade.
      return '/fiscal?status=rascunho';
    case 'pedidos:aguardando-faturamento':
      // Espelha o filtro do hook (status da OV + status_faturamento).
      return '/pedidos?status=aprovada,em_separacao&faturamento=aguardando,parcial';
  }
}