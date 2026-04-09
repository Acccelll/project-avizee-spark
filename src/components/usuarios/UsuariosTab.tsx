import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ERP_RESOURCES, getRolePermissions } from '@/lib/permissions';
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

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  financeiro: 'Financeiro',
  estoquista: 'Estoquista',
};

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: 'Acesso total ao sistema. Gerencia usuários, configurações e todos os módulos.',
  vendedor: 'Acesso a clientes, orçamentos, pedidos e logística.',
  financeiro: 'Acesso ao módulo financeiro, compras, faturamento e relatórios.',
  estoquista: 'Acesso a produtos, estoque, compras e logística.',
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-destructive/10 text-destructive border-destructive/30',
  vendedor: 'bg-primary/10 text-primary border-primary/30',
  financeiro:
    'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
  estoquista:
    'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700',
};

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  produtos: 'Cadastros › Produtos',
  clientes: 'Cadastros › Clientes',
  fornecedores: 'Cadastros › Fornecedores',
  transportadoras: 'Cadastros › Transportadoras',
  formas_pagamento: 'Cadastros › Formas de Pagamento',
  orcamentos: 'Comercial › Orçamentos',
  pedidos: 'Comercial › Pedidos',
  compras: 'Compras › Pedidos de Compra',
  estoque: 'Estoque',
  logistica: 'Logística',
  financeiro: 'Financeiro › Lançamentos',
  faturamento_fiscal: 'Fiscal › Notas',
  relatorios: 'Relatórios',
  usuarios: 'Administração › Usuários',
  administracao: 'Administração',
};

const UI_ACTIONS = ['visualizar', 'editar'] as const;

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
}

const emptyForm = (): UserFormData => ({
  nome: '',
  email: '',
  cargo: '',
  ativo: true,
  role_padrao: 'vendedor',
  extra_permissions: [],
});

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
  /** Currently active permissions (keys like "produtos:visualizar") */
  value: string[];
  /** Permissions inherited from the role (read-only display) */
  inheritedPermissions: string[];
  onChange: (value: string[]) => void;
  /** If true, the whole matrix is read-only */
  readOnly?: boolean;
  label?: string;
}

function PermissionMatrix({
  value,
  inheritedPermissions,
  onChange,
  readOnly = false,
  label = 'Permissões complementares',
}: PermissionMatrixProps) {
  const inheritedSet = useMemo(
    () => new Set(inheritedPermissions),
    [inheritedPermissions],
  );
  const extraSet = useMemo(() => new Set(value), [value]);

  const toggle = (key: string) => {
    if (readOnly) return;
    if (extraSet.has(key)) {
      onChange(value.filter((k) => k !== key));
    } else {
      onChange([...value, key]);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-full">
                Módulo / Submódulo
              </th>
              {UI_ACTIONS.map((a) => (
                <th
                  key={a}
                  className="px-3 py-2 text-center text-xs font-medium text-muted-foreground whitespace-nowrap w-24"
                >
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ERP_RESOURCES.map((resource, idx) => (
              <tr
                key={resource}
                className={cn(
                  'border-b last:border-0',
                  idx % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                )}
              >
                <td className="px-3 py-2 text-sm text-foreground">
                  {MODULE_LABELS[resource] ?? resource}
                </td>
                {UI_ACTIONS.map((action) => {
                  const key = `${resource}:${action}`;
                  const isInherited = inheritedSet.has(key);
                  const isExtra = extraSet.has(key);
                  const isActive = isInherited || isExtra;

                  return (
                    <td key={action} className="px-3 py-2 text-center">
                      <button
                        type="button"
                        disabled={readOnly || isInherited}
                        onClick={() => toggle(key)}
                        title={
                          isInherited
                            ? 'Herdado do role padrão'
                            : isExtra
                              ? 'Permissão complementar ativa — clique para remover'
                              : 'Sem acesso — clique para conceder'
                        }
                        className={cn(
                          'mx-auto flex h-6 w-6 items-center justify-center rounded',
                          isInherited &&
                            'cursor-default opacity-60',
                          !isInherited && !isExtra && !readOnly &&
                            'border border-dashed border-muted-foreground/30 hover:border-primary/50',
                          isExtra && !isInherited &&
                            'border border-primary/40 bg-primary/10 text-primary',
                          isInherited &&
                            'border border-muted-foreground/20 bg-muted/50 text-muted-foreground',
                        )}
                      >
                        {isActive && (
                          <Check className="h-3 w-3" />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" />
          Células acinzentadas são herdadas do role padrão e não podem ser removidas aqui.
          Permissões complementares são adicionais e excepcionais.
        </p>
      )}
    </div>
  );
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
                      value={[]}
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
      const now = new Date().toISOString();
      if (isEdit && user) {
        // Update profile
        await supabase
          .from('profiles')
          .update({
            nome: form.nome.trim(),
            email: form.email.trim(),
            cargo: form.cargo.trim() || null,
            ativo: form.ativo,
            role_padrao: form.role_padrao,
            updated_at: now,
          } as any)
          .eq('id', user.id);

        // Update role in user_roles table
        await supabase
          .from('user_roles')
          .upsert({ user_id: user.id, role: form.role_padrao }, { onConflict: 'user_id' });

        // Sync extra permissions: remove old ones, insert new ones
        const toRemove = user.extra_permissions.filter(
          (p) => !form.extra_permissions.includes(p),
        );
        const toAdd = form.extra_permissions.filter(
          (p) => !user.extra_permissions.includes(p),
        );
        if (toRemove.length > 0) {
          await supabase
            .from('user_permissions')
            .upsert(
              toRemove.map((p) => ({
                user_id: user.id,
                permission_key: p,
                ativo: false,
                updated_by: currentUser?.id,
              })),
              { onConflict: 'user_id,permission_key' },
            );
        }
        if (toAdd.length > 0) {
          await supabase
            .from('user_permissions')
            .upsert(
              toAdd.map((p) => ({
                user_id: user.id,
                permission_key: p,
                ativo: true,
                created_by: currentUser?.id,
                updated_by: currentUser?.id,
              })),
              { onConflict: 'user_id,permission_key' },
            );
        }

        // Audit
        await supabase.from('permission_audit' as any).insert({
          user_id: currentUser?.id,
          target_user_id: user.id,
          role_padrao: form.role_padrao,
          alteracao: {
            tipo: 'user_edit',
            role_padrao: form.role_padrao,
            extra_added: toAdd,
            extra_removed: toRemove,
          },
        });

        toast.success('Usuário atualizado com sucesso.');
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('[usuarios] Erro ao salvar usuário:', err);
      toast.error('Erro ao salvar usuário. Verifique sua conexão.');
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
                O role padrão é obrigatório e define as permissões base do usuário. Permissões
                complementares são exceções concedidas pelo administrador.
              </p>
            </div>

            <PermissionMatrix
              value={form.extra_permissions}
              inheritedPermissions={inheritedPermissions}
              onChange={(v) =>
                setForm((f) => ({ ...f, extra_permissions: v }))
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
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [filterRole, setFilterRole] = useState<AppRole | 'todos'>('todos');
  const [filterExtra, setFilterExtra] = useState(false);

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
      const [{ data: profiles }, { data: roles }, { data: userPermissions }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id, nome, email, cargo, ativo, created_at, updated_at, role_padrao'),
          supabase.from('user_roles').select('user_id, role'),
          supabase
            .from('user_permissions')
            .select('user_id, permission_key, ativo')
            .eq('ativo', true),
        ]);

      const roleMap = new Map<string, AppRole[]>();
      (roles || []).forEach((r: { user_id: string; role: string }) => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role as AppRole);
        roleMap.set(r.user_id, existing);
      });

      const permissionMap = new Map<string, string[]>();
      (
        (userPermissions || []) as Array<{
          user_id: string;
          permission_key: string;
        }>
      ).forEach((row) => {
        const existing = permissionMap.get(row.user_id) || [];
        existing.push(row.permission_key);
        permissionMap.set(row.user_id, existing);
      });

      const merged: UserWithRoles[] = (
        profiles || []
      ).map(
        (p: {
          id: string;
          nome: string;
          email: string | null;
          cargo: string | null;
          ativo: boolean;
          created_at: string;
          updated_at: string;
          role_padrao: AppRole | null;
        }) => ({
          ...p,
          role_padrao:
            p.role_padrao || (roleMap.get(p.id)?.[0] ?? 'vendedor'),
          extra_permissions: permissionMap.get(p.id) || [],
        }),
      );

      merged.sort((a, b) => a.nome.localeCompare(b.nome));
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
      await supabase
        .from('profiles')
        .update({ ativo: newStatus, updated_at: new Date().toISOString() } as any)
        .eq('id', toggleTarget.id);

      await supabase.from('permission_audit' as any).insert({
        user_id: currentUser?.id,
        target_user_id: toggleTarget.id,
        alteracao: {
          tipo: 'status_change',
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
    setSearch('');
    setFilterStatus('todos');
    setFilterRole('todos');
    setFilterExtra(false);
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
                onClick={() => setFilterExtra((v) => !v)}
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
            ? `Inativar "${toggleTarget?.nome}" impedirá que este usuário acesse o sistema. O cadastro será mantido e pode ser reativado a qualquer momento.`
            : `Reativar "${toggleTarget?.nome}" permitirá que este usuário volte a acessar o sistema com o role e permissões anteriores.`
        }
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Reativar'}
        confirmVariant={toggleTarget?.ativo ? 'destructive' : 'default'}
      />
    </div>
  );
}
