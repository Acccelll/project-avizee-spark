import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Edit2,
  Info,
  Loader2,
  MoreHorizontal,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ERP_RESOURCES,
  RESOURCE_ACTIONS,
  RESOURCE_LABELS,
  ACTION_LABELS,
  getRolePermissions,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  PERMISSION_HELP_TEXT,
  type ErpResource,
  type ErpAction,
  type PermissionOverrideState,
} from '@/lib/permissions';
import { getUserFriendlyError } from '@/utils/errorMessages';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormModal } from '@/components/FormModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import type { Database } from '@/integrations/supabase/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type AppRole = Database['public']['Enums']['app_role'];

const ALL_ROLES: AppRole[] = ['admin', 'vendedor', 'financeiro', 'estoquista'];

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-destructive/10 text-destructive border-destructive/30',
  vendedor: 'bg-primary/10 text-primary border-primary/30',
  financeiro:
    'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
  estoquista:
    'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700',
  user: 'bg-muted text-muted-foreground border-muted-foreground/30',
  viewer: 'bg-muted text-muted-foreground border-muted-foreground/30',
};

/**
 * Rótulos hierárquicos para o editor — exibe "Cadastros › Produtos" no lugar
 * do label flat de `RESOURCE_LABELS`. Usado SOMENTE aqui (a fonte canônica
 * `RESOURCE_LABELS` em `lib/permissions.ts` continua sendo o padrão para o
 * resto da aplicação: AccessDenied, tooltips, catálogo, etc.).
 */
const RESOURCE_PATH_LABEL: Partial<Record<ErpResource, string>> = {
  produtos: 'Cadastros › Produtos',
  clientes: 'Cadastros › Clientes',
  fornecedores: 'Cadastros › Fornecedores',
  transportadoras: 'Cadastros › Transportadoras',
  formas_pagamento: 'Cadastros › Formas de pagamento',
  orcamentos: 'Comercial › Orçamentos',
  pedidos: 'Comercial › Pedidos',
  compras: 'Compras › Pedidos de compra',
  financeiro: 'Financeiro › Lançamentos',
  faturamento_fiscal: 'Fiscal › Notas',
  usuarios: 'Administração › Usuários',
  socios: 'Sócios e participações',
};
const resourceLabel = (r: ErpResource) => RESOURCE_PATH_LABEL[r] ?? RESOURCE_LABELS[r];

interface UserWithRoles {
  id: string;
  nome: string;
  email: string | null;
  cargo: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  role_padrao: AppRole;
  extra_permissions: string[];
  /** Revogações individuais (user_permissions.allowed=false). */
  denied_permissions: string[];
  /** Not persisted — used for display only */
  last_sign_in?: string | null;
}

interface UserFormData {
  nome: string;
  email: string;
  cargo: string;
  ativo: boolean;
  role_padrao: AppRole;
  extra_permissions: string[];
  denied_permissions: string[];
}

const emptyForm = (): UserFormData => ({
  nome: '',
  email: '',
  cargo: '',
  ativo: true,
  role_padrao: 'vendedor',
  extra_permissions: [],
  denied_permissions: [],
});

const ADMIN_USERS_FUNCTION = 'admin-users';

async function invokeAdminUsers(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(ADMIN_USERS_FUNCTION, {
    body: payload,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: AppRole }) {
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

function StatusBadgeUser({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        ativo
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'border-muted-foreground/30 bg-muted/50 text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          ativo ? 'bg-emerald-500' : 'bg-muted-foreground/50',
        )}
      />
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  );
}

// ─── Permission Matrix Editor ─────────────────────────────────────────────────

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

function PermissionMatrix({
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

  /**
   * Avança para o próximo estado tri-state. Regras:
   *  - inherited → deny    (revoga acesso herdado)
   *  - deny      → none*   (*remove a revogação; se ainda há herança, volta a inherited)
   *  - allow     → none    (remove a concessão extra)
   *  - none      → allow   (concede acesso individual)
   *
   * Para concretizar: limpamos a chave de allow/deny e adicionamos no destino correto.
   */
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

// ─── Role Catalog Section ─────────────────────────────────────────────────────

function RolesCatalog({ users }: { users: UserWithRoles[] }) {
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

// ─── User Form Modal ──────────────────────────────────────────────────────────

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  user: UserWithRoles | null;
  onSaved: () => void;
  isLastAdmin: boolean;
}

function UserFormModal({
  open,
  onClose,
  user,
  onSaved,
  isLastAdmin,
}: UserFormModalProps) {
  const { user: currentUser } = useAuth();
  const isEdit = Boolean(user);
  const [form, setForm] = useState<UserFormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [confirmRoleChange, setConfirmRoleChange] = useState<AppRole | null>(
    null,
  );

  // Inherited permissions from the selected role
  const inheritedPermissions = useMemo(
    () => getRolePermissions(form.role_padrao),
    [form.role_padrao],
  );

  useEffect(() => {
    if (open) {
      if (user) {
        setForm({
          nome: user.nome,
          email: user.email ?? '',
          cargo: user.cargo ?? '',
          ativo: user.ativo,
          role_padrao: user.role_padrao,
          extra_permissions: [...user.extra_permissions],
        });
      } else {
        setForm(emptyForm());
      }
    }
  }, [open, user]);

  const handleRoleChange = (newRole: AppRole) => {
    if (isEdit && user?.role_padrao !== newRole) {
      setConfirmRoleChange(newRole);
    } else {
      setForm((f) => ({ ...f, role_padrao: newRole }));
    }
  };

  const handleConfirmRoleChange = () => {
    if (confirmRoleChange) {
      setForm((f) => ({ ...f, role_padrao: confirmRoleChange }));
    }
    setConfirmRoleChange(null);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('Nome é obrigatório.');
      return;
    }
    if (!form.email.trim()) {
      toast.error('E-mail é obrigatório.');
      return;
    }
    // Validate email format for new users (edit disables the field so format is already stored)
    if (!isEdit) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        toast.error('Informe um endereço de e-mail válido.');
        return;
      }
    }
    // Guard: cannot deactivate self
    if (isEdit && user?.id === currentUser?.id && !form.ativo) {
      toast.error('Você não pode inativar a própria conta.');
      return;
    }
    // Guard: cannot remove role from last admin
    if (
      isEdit &&
      user?.role_padrao === 'admin' &&
      form.role_padrao !== 'admin' &&
      isLastAdmin
    ) {
      toast.error(
        'Não é possível alterar o role do único administrador ativo.',
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        email: form.email.trim(),
        cargo: form.cargo.trim(),
        ativo: form.ativo,
        role_padrao: form.role_padrao,
        extra_permissions: form.extra_permissions,
      };

      if (isEdit && user) {
        await invokeAdminUsers({
          action: 'update',
          payload: {
            id: user.id,
            ...payload,
          },
        });

        toast.success('Usuário atualizado com sucesso.');
      } else {
        const result = await invokeAdminUsers({
          action: 'create',
          payload,
        });

        if (result?.inviteSent) {
          toast.success('Usuário criado e convite enviado por e-mail.');
        } else if (result?.tempPassword) {
          toast.success(
            `Usuário criado. Senha temporária: ${result.tempPassword}` +
            (result.recoveryLink ? ' (link de redefinição também gerado)' : ''),
            { duration: 20000 },
          );
          // Loga o link no console para o admin copiar manualmente se precisar
          if (result.recoveryLink) {
            console.info('[usuarios] Link de redefinição:', result.recoveryLink);
          }
        } else {
          toast.success('Usuário criado com sucesso.');
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('[usuarios] Erro ao salvar usuário:', err);
      toast.error(getUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const title = isEdit ? `Editar usuário — ${user?.nome}` : 'Novo usuário';

  return (
    <>
      <FormModal open={open} onClose={onClose} title={title} size="lg">
        <div className="space-y-6 pt-2">
          {/* Bloco 1 — Dados básicos */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary text-[11px] font-bold">
                1
              </span>
              Dados básicos
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Nome <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.nome}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nome: e.target.value }))
                  }
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  E-mail <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  type="email"
                  placeholder="usuario@empresa.com"
                  disabled={isEdit}
                />
                {isEdit && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    O e-mail não pode ser alterado aqui.
                  </p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Cargo / Função</Label>
                <Input
                  value={form.cargo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cargo: e.target.value }))
                  }
                  placeholder="Ex.: Analista Comercial"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Bloco 2 — Segurança e status */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary text-[11px] font-bold">
                2
              </span>
              Segurança e status
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Usuário ativo</p>
                <p className="text-xs text-muted-foreground">
                  Usuários inativos não conseguem acessar o sistema.
                </p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                disabled={isEdit && user?.id === currentUser?.id}
              />
            </div>
            {isEdit && user?.id === currentUser?.id && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                Você não pode inativar a própria conta.
              </p>
            )}
          </div>

          <Separator />

          {/* Bloco 3 — Acesso */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary text-[11px] font-bold">
                3
              </span>
              Acesso e permissões
            </div>

            <div className="space-y-1.5">
              <Label>
                Role padrão <span className="text-destructive">*</span>
              </Label>
              <Select value={form.role_padrao} onValueChange={(v) => handleRoleChange(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                {PERMISSION_HELP_TEXT.rolePadrao} {PERMISSION_HELP_TEXT.permissaoComplementar}
              </p>
            </div>

            <PermissionMatrix
              allow={form.extra_permissions}
              deny={form.denied_permissions}
              inheritedPermissions={inheritedPermissions}
              onChange={({ allow: nextAllow, deny: nextDeny }) =>
                setForm((f) => ({
                  ...f,
                  extra_permissions: nextAllow,
                  denied_permissions: nextDeny,
                }))
              }
            />
          </div>

          {/* Bloco 4 — Auditoria (edit only) */}
          {isEdit && user && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary text-[11px] font-bold">
                    4
                  </span>
                  Auditoria
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Cadastrado em
                    </p>
                    <p className="text-sm font-medium">
                      {new Date(user.created_at).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Última alteração
                    </p>
                    <p className="text-sm font-medium">
                      {user.updated_at
                        ? new Date(user.updated_at).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </p>
                  </div>
                  {user.last_sign_in && (
                    <div className="rounded-md border bg-muted/30 p-3 space-y-0.5 sm:col-span-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Último acesso
                      </p>
                      <p className="text-sm font-medium">
                        {new Date(user.last_sign_in).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Salvar alterações' : 'Criar usuário'}
            </Button>
          </div>
        </div>
      </FormModal>

      {/* Confirm role change */}
      <ConfirmDialog
        open={confirmRoleChange !== null}
        onClose={() => setConfirmRoleChange(null)}
        onConfirm={handleConfirmRoleChange}
        title="Alterar role padrão"
        description={`Alterar o role padrão de "${user ? ROLE_LABELS[user.role_padrao] : ''}" para "${confirmRoleChange ? ROLE_LABELS[confirmRoleChange] : ''}" irá redefinir as permissões base deste usuário. As permissões complementares existentes serão mantidas. Deseja continuar?`}
        confirmLabel="Alterar role"
        confirmVariant="default"
      />
    </>
  );
}

// ─── User List Row ────────────────────────────────────────────────────────────

interface UserRowProps {
  user: UserWithRoles;
  isCurrentUser: boolean;
  isLastAdmin: boolean;
  onEdit: (user: UserWithRoles) => void;
  onToggleStatus: (user: UserWithRoles) => void;
}

function UserRow({
  user,
  isCurrentUser,
  isLastAdmin,
  onEdit,
  onToggleStatus,
}: UserRowProps) {
  const canToggle = !(isCurrentUser || (user.role_padrao === 'admin' && isLastAdmin && user.ativo));

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium truncate">{user.nome}</p>
          {isCurrentUser && (
            <span className="text-[10px] border rounded-full px-1.5 py-0.5 text-muted-foreground">
              você
            </span>
          )}
          {user.extra_permissions.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              <ShieldAlert className="h-2.5 w-2.5" />
              {user.extra_permissions.length} exceção{user.extra_permissions.length > 1 ? 'ões' : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        {user.cargo && (
          <p className="text-xs text-muted-foreground">{user.cargo}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <RoleBadge role={user.role_padrao} />
        <StatusBadgeUser ativo={user.ativo} />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onEdit(user)}
          title="Editar usuário"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(user)}>
              <Edit2 className="mr-2 h-3.5 w-3.5" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onToggleStatus(user)}
              disabled={!canToggle}
              className={!user.ativo ? 'text-emerald-600' : 'text-destructive'}
            >
              {user.ativo ? (
                <>
                  <UserMinus className="mr-2 h-3.5 w-3.5" /> Inativar usuário
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-3.5 w-3.5" /> Reativar usuário
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function UsuariosTab() {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters — persisted in URL
  const search = searchParams.get('q') ?? '';
  const filterStatus = (searchParams.get('status') ?? 'todos') as 'todos' | 'ativo' | 'inativo';
  const filterRole = (searchParams.get('perfil') ?? 'todos') as AppRole | 'todos';
  const filterExtra = searchParams.get('extra') === '1';

  const setSearch = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v) next.set('q', v); else next.delete('q');
    setSearchParams(next);
  };
  const setFilterStatus = (v: 'todos' | 'ativo' | 'inativo') => {
    const next = new URLSearchParams(searchParams);
    if (v !== 'todos') next.set('status', v); else next.delete('status');
    setSearchParams(next);
  };
  const setFilterRole = (v: AppRole | 'todos') => {
    const next = new URLSearchParams(searchParams);
    if (v !== 'todos') next.set('perfil', v); else next.delete('perfil');
    setSearchParams(next);
  };
  const setFilterExtra = (v: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (v) next.set('extra', '1'); else next.delete('extra');
    setSearchParams(next);
  };

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);

  // Toggle status confirm
  const [toggleTarget, setToggleTarget] = useState<UserWithRoles | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'usuarios' | 'roles'>('usuarios');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await invokeAdminUsers({ action: 'list' });
      const merged = ((response?.users as UserWithRoles[] | undefined) ?? []).sort(
        (a, b) => a.nome.localeCompare(b.nome),
      );
      setUsers(merged);
    } catch (err) {
      console.error('[usuarios] Erro ao carregar usuários:', err);
      toast.error('Erro ao carregar lista de usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // ─ Derived stats ─
  const stats = useMemo(() => {
    const total = users.length;
    const ativos = users.filter((u) => u.ativo).length;
    const inativos = total - ativos;
    const admins = users.filter((u) => u.role_padrao === 'admin' && u.ativo).length;
    const comExtras = users.filter((u) => u.extra_permissions.length > 0).length;
    return { total, ativos, inativos, admins, comExtras };
  }, [users]);

  const isLastAdmin = useMemo(
    () =>
      stats.admins <= 1 &&
      users.some((u) => u.role_padrao === 'admin' && u.ativo),
    [stats.admins, users],
  );

  // ─ Filtered list ─
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const match =
          u.nome.toLowerCase().includes(q) ||
          (u.email?.toLowerCase().includes(q) ?? false) ||
          (u.cargo?.toLowerCase().includes(q) ?? false);
        if (!match) return false;
      }
      if (filterStatus === 'ativo' && !u.ativo) return false;
      if (filterStatus === 'inativo' && u.ativo) return false;
      if (filterRole !== 'todos' && u.role_padrao !== filterRole) return false;
      if (filterExtra && u.extra_permissions.length === 0) return false;
      return true;
    });
  }, [users, search, filterStatus, filterRole, filterExtra]);

  const openCreate = () => {
    setSelectedUser(null);
    setModalOpen(true);
  };

  const openEdit = (u: UserWithRoles) => {
    setSelectedUser(u);
    setModalOpen(true);
  };

  const handleToggleStatusRequest = (u: UserWithRoles) => {
    if (u.id === currentUser?.id) {
      toast.error('Você não pode inativar a própria conta.');
      return;
    }
    if (u.role_padrao === 'admin' && isLastAdmin && u.ativo) {
      toast.error('Não é possível inativar o único administrador ativo.');
      return;
    }
    setToggleTarget(u);
  };

  const handleConfirmToggleStatus = async () => {
    if (!toggleTarget) return;
    setToggleLoading(true);
    try {
      const newStatus = !toggleTarget.ativo;
      await invokeAdminUsers({
        action: 'toggle-status',
        payload: {
          id: toggleTarget.id,
          ativo: newStatus,
        },
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === toggleTarget.id ? { ...u, ativo: newStatus } : u,
        ),
      );
      toast.success(
        newStatus
          ? `${toggleTarget.nome} reativado com sucesso.`
          : `${toggleTarget.nome} inativado com sucesso.`,
      );
    } catch (err) {
      console.error('[usuarios] Erro ao alterar status:', err);
      toast.error('Erro ao alterar status do usuário.');
    } finally {
      setToggleLoading(false);
      setToggleTarget(null);
    }
  };

  const hasFilters =
    search.trim() !== '' ||
    filterStatus !== 'todos' ||
    filterRole !== 'todos' ||
    filterExtra;

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    next.delete('status');
    next.delete('perfil');
    next.delete('extra');
    setSearchParams(next);
  };

  // ─ Render ─

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando usuários...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-background/70 p-3">
              <p className="text-xs font-semibold text-foreground">Role padrão (herdado)</p>
              <p className="mt-1 text-xs text-muted-foreground">{PERMISSION_HELP_TEXT.rolePadrao}</p>
            </div>
            <div className="rounded-md border bg-background/70 p-3">
              <p className="text-xs font-semibold text-foreground">Permissão complementar</p>
              <p className="mt-1 text-xs text-muted-foreground">{PERMISSION_HELP_TEXT.permissaoComplementar}</p>
            </div>
            <div className="rounded-md border bg-background/70 p-3">
              <p className="text-xs font-semibold text-foreground">Permissão revogada (deny)</p>
              <p className="mt-1 text-xs text-muted-foreground">{PERMISSION_HELP_TEXT.permissaoRevogada}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
        <StatCard
          title="Total de usuários"
          value={String(stats.total)}
          icon={Users}
        />
        <StatCard
          title="Ativos"
          value={String(stats.ativos)}
          icon={UserCheck}
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Administradores"
          value={String(stats.admins)}
          icon={Shield}
          iconColor="text-destructive"
        />
        <StatCard
          title="Com exceções"
          value={String(stats.comExtras)}
          icon={ShieldAlert}
          iconColor="text-amber-600"
          change={stats.comExtras > 0 ? 'Permissões complementares ativas' : undefined}
          changeType="neutral"
        />
      </div>

      {/* Tabs: Usuários / Roles */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="usuarios" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Usuários
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Perfis e Permissões
            </TabsTrigger>
          </TabsList>

          {activeTab === 'usuarios' && (
            <Button onClick={openCreate} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Novo usuário
            </Button>
          )}
        </div>

        {/* ── Tab: Usuários ── */}
        <TabsContent value="usuarios" className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, e-mail ou cargo..."
                className="pl-9 pr-8"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={filterStatus}
                onValueChange={(v) =>
                  setFilterStatus(v as typeof filterStatus)
                }
              >
                <SelectTrigger className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="ativo">Apenas ativos</SelectItem>
                  <SelectItem value="inativo">Apenas inativos</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filterRole}
                onValueChange={(v) =>
                  setFilterRole(v as typeof filterRole)
                }
              >
                <SelectTrigger className="h-9 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os perfis</SelectItem>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={filterExtra ? 'secondary' : 'outline'}
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => setFilterExtra(!filterExtra)}
                title="Filtrar usuários com permissões complementares"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Com exceções
              </Button>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1.5 text-muted-foreground"
                  onClick={clearFilters}
                >
                  <X className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Result count */}
          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              {filtered.length} de {users.length}{' '}
              {users.length === 1 ? 'usuário' : 'usuários'}
            </p>
          )}

          {/* List */}
          {filtered.length === 0 ? (
            users.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum usuário cadastrado"
                description="Todo usuário precisa de um role padrão obrigatório. Permissões complementares são exceções concedidas pelo administrador."
                actionLabel="Criar primeiro usuário"
                onAction={openCreate}
              />
            ) : (
              <EmptyState
                icon={Search}
                title="Nenhum resultado encontrado"
                description="Tente ajustar os filtros ou o termo de busca."
                actionLabel="Limpar filtros"
                onAction={clearFilters}
              />
            )
          ) : (
            <div className="space-y-2">
              {filtered.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isCurrentUser={u.id === currentUser?.id}
                  isLastAdmin={isLastAdmin && u.role_padrao === 'admin' && u.ativo}
                  onEdit={openEdit}
                  onToggleStatus={handleToggleStatusRequest}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Roles ── */}
        <TabsContent value="roles">
          <RolesCatalog users={users} />
        </TabsContent>
      </Tabs>

      {/* User form modal */}
      <UserFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        user={selectedUser}
        onSaved={loadUsers}
        isLastAdmin={isLastAdmin}
      />

      {/* Toggle status confirm */}
      <ConfirmDialog
        open={toggleTarget !== null}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleConfirmToggleStatus}
        loading={toggleLoading}
        title={
          toggleTarget?.ativo
            ? 'Inativar usuário'
            : 'Reativar usuário'
        }
        description={
          toggleTarget?.ativo
            ? `Inativar "${toggleTarget?.nome}" impedirá acesso imediato ao sistema. O role padrão, permissões complementares e revogações serão preservados para futura reativação.`
            : `Reativar "${toggleTarget?.nome}" restabelecerá o acesso com o role padrão e todas as permissões já configuradas.`
        }
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Reativar'}
        confirmVariant={toggleTarget?.ativo ? 'destructive' : 'default'}
      />
    </div>
  );
}
