import type { WidgetId } from '@/hooks/useDashboardLayout';

/**
 * Single source of truth for the user-visible widget catalogue.
 * Index.tsx reads this to build the customize menu and to know
 * the labels of what is being toggled.
 */
export interface WidgetMeta {
  id: WidgetId;
  label: string;
  description: string;
  /** Set to true if the widget should never be hidden by the user (e.g. KPIs). */
  required?: boolean;
}

export const WIDGET_REGISTRY: Record<WidgetId, WidgetMeta> = {
  kpis: { id: 'kpis', label: 'KPIs Financeiros', description: 'Receber, Pagar e Saldo Projetado', required: true },
  operational: { id: 'operational', label: 'Indicadores Operacionais', description: 'Estoque crítico, backlog, atrasos' },
  alertas: { id: 'alertas', label: 'Faixa de Alertas', description: 'Atalhos contextuais para exceções' },
  financeiro: { id: 'financeiro', label: 'Bloco Financeiro', description: 'Resumo + fluxo de caixa' },
  acoes_rapidas: { id: 'acoes_rapidas', label: 'Ações Rápidas', description: 'Atalhos para criar registros' },
  vendas_chart: { id: 'vendas_chart', label: 'Gráfico de Vendas', description: 'Faturamento por dia' },
  pendencias: { id: 'pendencias', label: 'Pendências Financeiras', description: 'Vencimentos e atrasos' },
  comercial: { id: 'comercial', label: 'Bloco Comercial', description: 'Orçamentos e pedidos' },
  estoque: { id: 'estoque', label: 'Bloco Estoque', description: 'Posição e itens críticos' },
  logistica: { id: 'logistica', label: 'Bloco Logística', description: 'Compras aguardando entrega' },
  fiscal: { id: 'fiscal', label: 'Bloco Fiscal', description: 'Notas emitidas e pendentes' },
};

export const WIDGET_LIST = Object.values(WIDGET_REGISTRY);