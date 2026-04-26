/**
 * Badges visuais para role e status do usuário.
 *
 * Exporta `RoleBadge` e `StatusBadgeUser` — duas pílulas pequenas usadas
 * tanto na lista quanto em diálogos. Mantidas em arquivo separado para
 * permitir reuso fora do `UsuariosTab` (ex.: header de auditoria) sem
 * arrastar a árvore inteira do god-component anterior.
 */

import { cn } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/permissions';
import { ROLE_COLORS, type AppRole } from './_shared';

export function RoleBadge({ role }: { role: AppRole }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        ROLE_COLORS[role],
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

export function StatusBadgeUser({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        ativo
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-muted-foreground/30 bg-muted/50 text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          ativo ? 'bg-success' : 'bg-muted-foreground/50',
        )}
      />
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  );
}