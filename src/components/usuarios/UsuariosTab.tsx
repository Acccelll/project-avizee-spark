/**
 * UsuariosTab — orquestrador da gestão de usuários do módulo administração.
 *
 * Após a Fase 6 (decomposição), este arquivo é apenas um shell:
 *  - carrega a lista via edge function `admin-users`.
 *  - calcula stats e o flag `isLastAdmin`.
 *  - sincroniza filtros com `searchParams` (URL-as-state).
 *  - delega cada bloco de UI a um subcomponente em `components/usuarios/`:
 *      `UserFilters`, `UserRow`, `RolesCatalog`, `UserFormModal`,
 *      `ToggleStatusDialog`.
 *
 * As regras de negócio sensíveis (último admin, próprio usuário) ficam aqui
 * porque dependem do conjunto completo da lista; os subcomponentes recebem
 * apenas booleans e callbacks.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { SummaryCard } from '@/components/SummaryCard';
import { useAuth } from '@/contexts/AuthContext';
import { PERMISSION_HELP_TEXT } from '@/lib/permissions';
import {
  invokeAdminUsers,
  type AppRole,
  type UserWithRoles,
} from './_shared';
import { UserFilters, type RoleFilter, type StatusFilter } from './UserFilters';
import { UserRow } from './UserRow';
import { UserFormModal } from './UserFormModal';
import { ToggleStatusDialog } from './ToggleStatusDialog';

export function UsuariosTab() {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(false);

  // ─ Filters persisted in URL ─
  const search = searchParams.get('q') ?? '';
  const filterStatus = (searchParams.get('status') ?? 'todos') as StatusFilter;
  const filterRole = (searchParams.get('perfil') ?? 'todos') as RoleFilter;
  const filterExtra = searchParams.get('extra') === '1';

  const setSearch = (v: string) => updateParam('q', v || null);
  const setFilterStatus = (v: StatusFilter) =>
    updateParam('status', v === 'todos' ? null : v);
  const setFilterRole = (v: RoleFilter) =>
    updateParam('perfil', v === 'todos' ? null : v);
  const setFilterExtra = (v: boolean) => updateParam('extra', v ? '1' : null);

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  }

  // ─ Modal state ─
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);

  // ─ Toggle status confirm ─
  const [toggleTarget, setToggleTarget] = useState<UserWithRoles | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [toggleMotivo, setToggleMotivo] = useState('');

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
      stats.admins <= 1 && users.some((u) => u.role_padrao === 'admin' && u.ativo),
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
      if (
        filterExtra &&
        u.extra_permissions.length === 0 &&
        (u.denied_permissions?.length ?? 0) === 0
      ) {
        return false;
      }
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
          motivo: toggleMotivo.trim() || undefined,
        },
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === toggleTarget.id ? { ...u, ativo: newStatus } : u)),
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
      setToggleMotivo('');
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card de orientação: oculto em mobile (ruído de >280px) */}
      <Card className="hidden md:block border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border bg-background/70 p-3">
              <p className="text-xs font-semibold text-foreground">Role padrão (herdado)</p>
              <p className="mt-1 text-xs text-muted-foreground">{PERMISSION_HELP_TEXT.rolePadrao}</p>
            </div>
            <div className="rounded-md border bg-background/70 p-3">
              <p className="text-xs font-semibold text-foreground">Permissão complementar</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {PERMISSION_HELP_TEXT.permissaoComplementar}
              </p>
            </div>
            <div className="rounded-md border bg-background/70 p-3">
              <p className="text-xs font-semibold text-foreground">Permissão revogada (deny)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {PERMISSION_HELP_TEXT.permissaoRevogada}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
        <SummaryCard title="Total de usuários" value={String(stats.total)} icon={Users} />
        <SummaryCard title="Ativos" value={String(stats.ativos)} icon={UserCheck} variant="success" />
        <SummaryCard title="Administradores" value={String(stats.admins)} icon={Shield} variant="danger" />
        <SummaryCard
          title="Com exceções"
          value={String(stats.comExtras)}
          icon={ShieldAlert}
          variant="warning"
          variation={stats.comExtras > 0 ? 'Permissões complementares ativas' : undefined}
          variationType="neutral"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Novo usuário
        </Button>
      </div>

      <div className="space-y-4">
        <UserFilters
            search={search}
            filterStatus={filterStatus}
            filterRole={filterRole}
            filterExtra={filterExtra}
            hasFilters={hasFilters}
            onSearchChange={setSearch}
            onStatusChange={setFilterStatus}
            onRoleChange={setFilterRole}
            onExtraChange={setFilterExtra}
            onClear={clearFilters}
          />

          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              {filtered.length} de {users.length}{' '}
              {users.length === 1 ? 'usuário' : 'usuários'}
            </p>
          )}

          {filtered.length === 0 ? (
            users.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum usuário cadastrado"
                description="Todo usuário precisa de um role padrão obrigatório. Permissões complementares são exceções concedidas pelo administrador."
                action={<Button onClick={openCreate}>Criar primeiro usuário</Button>}
              />
            ) : (
              <EmptyState
                icon={Search}
                title="Nenhum resultado encontrado"
                description="Tente ajustar os filtros ou o termo de busca."
                action={<Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>}
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
      </div>

      <UserFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        user={selectedUser}
        onSaved={loadUsers}
        isLastAdmin={isLastAdmin}
      />

      <ToggleStatusDialog
        target={toggleTarget}
        motivo={toggleMotivo}
        loading={toggleLoading}
        onMotivoChange={setToggleMotivo}
        onClose={() => {
          setToggleTarget(null);
          setToggleMotivo('');
        }}
        onConfirm={handleConfirmToggleStatus}
      />
    </div>
  );
}

// `AppRole` é re-exportado para compatibilidade com `Administracao.tsx` e
// outros consumidores que importavam o tipo do antigo god-component.
export type { AppRole };