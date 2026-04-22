/**
 * Catálogo somente-leitura dos roles padrão do sistema.
 *
 * Exibe cada role em accordion, mostrando a contagem de usuários com aquele
 * role e a matriz de permissões herdadas (`PermissionMatrix` em modo
 * `readOnly`). É a aba "Perfis e Permissões" do `UsuariosTab`.
 */

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  getRolePermissions,
} from '@/lib/permissions';
import { ALL_ROLES, type AppRole, type UserWithRoles } from './_shared';
import { RoleBadge } from './UserBadges';
import { PermissionMatrix } from './PermissionMatrix';

export function RolesCatalog({ users }: { users: UserWithRoles[] }) {
  const [expandedRole, setExpandedRole] = useState<AppRole | null>(null);

  const userCountByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((u) => {
      counts[u.role_padrao] = (counts[u.role_padrao] ?? 0) + 1;
    });
    return counts;
  }, [users]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <CardTitle>Perfis padrão do sistema</CardTitle>
              <CardDescription>
                Cada usuário possui exatamente um role padrão obrigatório.
                O role define as permissões base. Permissões complementares são exceções
                concedidas individualmente pelo administrador.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {ALL_ROLES.map((role) => {
            const perms = getRolePermissions(role);
            const isExpanded = expandedRole === role;
            const count = userCountByRole[role] ?? 0;

            return (
              <div key={role} className="rounded-lg border">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  onClick={() => setExpandedRole(isExpanded ? null : role)}
                >
                  <RoleBadge role={role} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {ROLE_DESCRIPTIONS[role]}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {count} {count === 1 ? 'usuário' : 'usuários'}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-3">
                    <PermissionMatrix
                      allow={[]}
                      deny={[]}
                      inheritedPermissions={perms}
                      onChange={() => {}}
                      readOnly
                      label={`Permissões padrão — ${ROLE_LABELS[role]}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Legenda</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded border border-muted-foreground/20 bg-muted/50">
              <Check className="h-3 w-3 text-muted-foreground" />
            </span>
            Herdado do role padrão
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded border border-primary/40 bg-primary/10">
              <Check className="h-3 w-3 text-primary" />
            </span>
            Permissão complementar concedida
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded border border-dashed border-muted-foreground/30" />
            Sem acesso
          </div>
        </CardContent>
      </Card>
    </div>
  );
}