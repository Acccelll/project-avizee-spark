import type { SocialDashboardConsolidado, SocialPost } from '@/types/social';

export function calculatePostingFrequency(posts: SocialPost[], days: number): number {
  if (days <= 0) return 0;
  return posts.length / days;
}

export function calculateContentDistribution(posts: SocialPost[]): Array<{ tipo: string; total: number }> {
  const grouped = posts.reduce<Record<string, number>>((acc, post) => {
    acc[post.tipo_post] = (acc[post.tipo_post] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([tipo, total]) => ({ tipo, total }))
    .sort((a, b) => b.total - a.total);
}

export function calculateTrend(dashboard: SocialDashboardConsolidado): 'alta' | 'estavel' | 'queda' {
  const seguidores = dashboard.comparativo.reduce((acc, item) => acc + Number(item.seguidores_novos || 0), 0);
  const engajamento = dashboard.comparativo.reduce((acc, item) => acc + Number(item.taxa_engajamento_media || 0), 0);
  if (seguidores > 0 && engajamento > 0) return 'alta';
  if (seguidores < 0 || engajamento < 0.5) return 'queda';
  return 'estavel';
}

export function calculatePercentGrowth(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}
