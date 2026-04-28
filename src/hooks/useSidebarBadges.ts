import { useMemo } from 'react';
import type { NavSectionKey } from '@/lib/navigation';
import { useSidebarAlerts } from '@/hooks/useSidebarAlerts';

export type BadgeTone = 'danger' | 'warning' | 'info';
export interface BadgeInfo {
  count: number;
  tone: BadgeTone;
}

export interface SidebarBadges {
  /** Module-level badge counts shown on each section header */
  moduleBadges: Partial<Record<NavSectionKey, BadgeInfo>>;
  /** Leaf-item badges keyed by route path */
  itemBadges: Record<string, BadgeInfo>;
  /** Seconds since the alerts were last synced (null when never synced) */
  secondsSinceSync: number | null;
}

/**
 * Centralises the alert-to-badge derivation that was previously inline
 * in AppSidebar. Returned maps are referentially stable as long as alerts
 * don't change, so consumers can safely include them in dependency arrays.
 */
export function useSidebarBadges(): SidebarBadges {
  const alerts = useSidebarAlerts();

  return useMemo(() => {
    const financeiroTotal = alerts.financeiroVencidos + alerts.financeiroVencer;
    const financeiroTone: BadgeTone = alerts.financeiroVencidos > 0 ? 'danger' : 'info';

    const moduleBadges: Partial<Record<NavSectionKey, BadgeInfo>> = {
      financeiro: { count: financeiroTotal, tone: financeiroTone },
      estoque: { count: alerts.estoqueBaixo, tone: 'danger' },
      comercial: { count: alerts.orcamentosPendentes, tone: 'warning' },
      fiscal: { count: alerts.nfRejeitadas, tone: 'danger' },
      administracao: { count: alerts.filaEmailDLQ, tone: 'danger' },
    };

    const itemBadges: Record<string, BadgeInfo> = {
      '/orcamentos': { count: alerts.orcamentosPendentes, tone: 'warning' },
      '/financeiro': { count: financeiroTotal, tone: financeiroTone },
      '/estoque': { count: alerts.estoqueBaixo, tone: 'danger' },
      '/fiscal': { count: alerts.nfRejeitadas, tone: 'danger' },
      '/administracao': { count: alerts.filaEmailDLQ, tone: 'danger' },
    };

    const secondsSinceSync = alerts.lastUpdatedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(alerts.lastUpdatedAt).getTime()) / 1000))
      : null;

    return { moduleBadges, itemBadges, secondsSinceSync };
  }, [alerts]);
}

export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  danger: 'bg-destructive text-destructive-foreground',
  warning: 'bg-warning text-warning-foreground',
  info: 'bg-primary text-primary-foreground',
};
