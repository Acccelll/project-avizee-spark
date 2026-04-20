/**
 * Maps a canonical StatusKind to a shadcn Badge variant.
 *
 * Used by Relatorios.tsx to render status badges without falling back to
 * substring heuristics on display labels.
 */

import type { StatusKind } from '@/services/relatorios/lib/statusMap';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export function badgeVariantFromKind(kind?: StatusKind | null): BadgeVariant {
  switch (kind) {
    case 'critical':
      return 'destructive';
    case 'success':
      return 'default';
    case 'warning':
      return 'secondary';
    case 'info':
      return 'outline';
    case 'neutral':
    default:
      return 'secondary';
  }
}