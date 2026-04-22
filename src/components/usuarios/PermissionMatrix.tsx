/**
 * Editor tri-state da matriz de permissões.
 *
 * Estado de cada par `resource:action`:
 *   - inherited → vem do role padrão (somente leitura quando `readOnly`)
 *   - allow     → concedido individualmente (`user_permissions.allowed=true`)
 *   - deny      → revogado individualmente (`user_permissions.allowed=false`)
 *   - none      → sem acesso e sem override
 *
 * Ciclo do clique: inherited → deny → none → allow → none ...
 * (allow/none alternam diretamente porque `inherited` não é destino válido a partir de allow).
 *
 * Usado em dois cenários:
 *   1. Edição de usuário no `UserFormModal` (interativo).
 *   2. Visualização do catálogo de roles em `RolesCatalog` (`readOnly`).
 */

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Info, X } from 'lucide-react';
import {
  ACTION_LABELS,
  ERP_RESOURCES,
  PERMISSION_HELP_TEXT,
  RESOURCE_ACTIONS,
  type ErpAction,
  type ErpResource,
  type PermissionOverrideState,
} from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { resourceLabel } from './_shared';

interface PermissionMatrixProps {
  /** Permissões individualmente concedidas (`user_permissions.allowed=true`). */
  allow: string[];
  /** Permissões individualmente revogadas (`user_permissions.allowed=false`). */
  deny: string[];
  /** Permissões herdadas do role padrão (somente leitura — origem da herança). */
  inheritedPermissions: string[];
  onChange: (next: { allow: string[]; deny: string[] }) => void;
  /** Se true, a matriz é totalmente somente leitura. */
  readOnly?: boolean;
  label?: string;
}

export function PermissionMatrix({
  allow,
  deny,
  inheritedPermissions,
  onChange,
  readOnly = false,
  label = 'Permissões complementares',
}: PermissionMatrixProps) {
  const inheritedSet = useMemo(() => new Set(inheritedPermissions), [inheritedPermissions]);
  const allowSet = useMemo(() => new Set(allow), [allow]);
  const denySet = useMemo(() => new Set(deny), [deny]);
  const [expanded, setExpanded] = useState<Set<ErpResource>>(new Set());

  const stateOf = (key: string): PermissionOverrideState => {
    if (denySet.has(key)) return 'deny';
    if (allowSet.has(key)) return 'allow';
    if (inheritedSet.has(key)) return 'inherited';
    return 'none';
  };

  const cycle = (resource: ErpResource, action: ErpAction) => {
    if (readOnly) return;
    const key = `${resource}:${action}`;
    const current = stateOf(key);
    const nextAllow = new Set(allowSet);
    const nextDeny = new Set(denySet);
    nextAllow.delete(key);
    nextDeny.delete(key);

    let target: PermissionOverrideState;
    switch (current) {
      case 'inherited':
        target = 'deny';
        break;
      case 'deny':
        target = 'none';
        break;
      case 'allow':
        target = 'none';
        break;
      default:
        target = 'allow';
    }
    if (target === 'allow') nextAllow.add(key);
    if (target === 'deny') nextDeny.add(key);
    onChange({ allow: Array.from(nextAllow), deny: Array.from(nextDeny) });
  };

  const toggleExpand = (resource: ErpResource) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(resource)) next.delete(resource);
      else next.add(resource);
      return next;
    });
  };

  /** Conta overrides (allow + deny) por recurso para o resumo da linha. */
  const overrideCountByResource = useMemo(() => {
    const counts = new Map<ErpResource, { allow: number; deny: number }>();
    const bump = (key: string, kind: 'allow' | 'deny') => {
      const [resource] = key.split(':') as [ErpResource];
      if (!ERP_RESOURCES.includes(resource)) return;
      const cur = counts.get(resource) ?? { allow: 0, deny: 0 };
      cur[kind] += 1;
      counts.set(resource, cur);
    };
    allow.forEach((k) => bump(k, 'allow'));
    deny.forEach((k) => bump(k, 'deny'));
    return counts;
  }, [allow, deny]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <LegendDot variant="inherited" /> Herdado
          <LegendDot variant="allow" /> Concedido
          <LegendDot variant="deny" /> Revogado
          <LegendDot variant="none" /> Sem acesso
        </div>
      </div>
      <div className="rounded-md border overflow-hidden">
        {ERP_RESOURCES.map((resource, idx) => {
          const actions = RESOURCE_ACTIONS[resource];
          const counts = overrideCountByResource.get(resource);
          const isExpanded = expanded.has(resource);
          const inheritedForResource = actions.filter((a) =>
            inheritedSet.has(`${resource}:${a}`),
          ).length;

          return (
            <div
              key={resource}
              className={cn(
                'border-b last:border-0',
                idx % 2 === 0 ? 'bg-background' : 'bg-muted/20',
              )}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                onClick={() => toggleExpand(resource)}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-medium text-foreground flex-1">
                  {resourceLabel(resource)}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground shrink-0">
                  <span>
                    {inheritedForResource}/{actions.length} herdadas
                  </span>
                  {counts && counts.allow > 0 && (
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-primary">
                      +{counts.allow}
                    </span>
                  )}
                  {counts && counts.deny > 0 && (
                    <span className="rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-destructive">
                      −{counts.deny}
                    </span>
                  )}
                </span>
              </button>
              {isExpanded && (
                <div className="grid gap-1.5 border-t bg-background/40 px-3 py-3 sm:grid-cols-2">
                  {actions.map((action) => {
                    const key = `${resource}:${action}`;
                    const state = stateOf(key);
                    return (
                      <button
                        key={action}
                        type="button"
                        disabled={readOnly}
                        onClick={() => cycle(resource, action)}
                        title={titleFor(state)}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors',
                          state === 'inherited' &&
                            'border-muted-foreground/30 bg-muted/40 text-muted-foreground',
                          state === 'allow' &&
                            'border-primary/50 bg-primary/10 text-primary',
                          state === 'deny' &&
                            'border-destructive/50 bg-destructive/10 text-destructive',
                          state === 'none' &&
                            'border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/40',
                          readOnly && 'cursor-default opacity-70',
                        )}
                      >
                        <span className="truncate">{ACTION_LABELS[action]}</span>
                        <span className="shrink-0">
                          {state === 'inherited' && <Check className="h-3 w-3 opacity-60" />}
                          {state === 'allow' && <Check className="h-3 w-3" />}
                          {state === 'deny' && <X className="h-3 w-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!readOnly && (
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>
            Clique em uma ação para alternar entre <strong>concedido</strong>,{' '}
            <strong>revogado</strong> e <strong>sem override</strong>.{' '}
            {PERMISSION_HELP_TEXT.permissaoRevogada}
          </span>
        </p>
      )}
    </div>
  );
}

function LegendDot({ variant }: { variant: PermissionOverrideState }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        variant === 'inherited' && 'bg-muted-foreground/40',
        variant === 'allow' && 'bg-primary',
        variant === 'deny' && 'bg-destructive',
        variant === 'none' && 'border border-dashed border-muted-foreground/40 bg-transparent',
      )}
    />
  );
}

function titleFor(state: PermissionOverrideState): string {
  switch (state) {
    case 'inherited':
      return 'Herdado do role padrão — clique para revogar';
    case 'allow':
      return 'Concedido individualmente — clique para remover';
    case 'deny':
      return 'Revogado individualmente — clique para remover a revogação';
    default:
      return 'Sem acesso — clique para conceder';
  }
}