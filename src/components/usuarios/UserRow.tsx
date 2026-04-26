/**
 * Linha individual da lista de usuários.
 *
 * Responsável apenas pela apresentação e por dois gatilhos de ação
 * (`onEdit` e `onToggleStatus`). Toda a lógica de "última admin",
 * "é o próprio usuário", reload e confirmação fica no componente pai.
 */

import { Edit2, Mail, MoreHorizontal, UserCheck, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ShieldAlert } from 'lucide-react';
import { invokeAdminUsers, type UserWithRoles } from './_shared';
import { RoleBadge, StatusBadgeUser } from './UserBadges';

interface UserRowProps {
  user: UserWithRoles;
  isCurrentUser: boolean;
  isLastAdmin: boolean;
  onEdit: (user: UserWithRoles) => void;
  onToggleStatus: (user: UserWithRoles) => void;
}

export function UserRow({
  user,
  isCurrentUser,
  isLastAdmin,
  onEdit,
  onToggleStatus,
}: UserRowProps) {
  const canToggle = !(
    isCurrentUser || (user.role_padrao === 'admin' && isLastAdmin && user.ativo)
  );
  const exceptionCount =
    user.extra_permissions.length + (user.denied_permissions?.length ?? 0);
  const [resending, setResending] = useState(false);

  const handleResendInvite = async () => {
    if (!user.email) {
      toast.error('Usuário sem e-mail cadastrado.');
      return;
    }
    setResending(true);
    try {
      const res = await invokeAdminUsers({
        action: 'resend-invite',
        payload: { id: user.id, email: user.email },
      });
      if (res?.inviteSent) {
        toast.success(`Convite reenviado para ${user.email}.`);
      } else if (res?.recoveryLink) {
        await navigator.clipboard?.writeText(res.recoveryLink).catch(() => {});
        toast.success('Link de recuperação copiado para a área de transferência.');
      } else if (res?.tempPassword) {
        await navigator.clipboard?.writeText(res.tempPassword).catch(() => {});
        toast.success(`Senha temporária gerada e copiada: ${res.tempPassword}`);
      } else {
        toast.success('Convite processado.');
      }
    } catch (err) {
      console.error('[usuarios] resend-invite failed', err);
      toast.error('Não foi possível reenviar o convite.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center">
      {/* Mobile: clique no corpo (não nas ações) abre edição. */}
      <button
        type="button"
        onClick={() => onEdit(user)}
        className="absolute inset-0 z-0 sm:hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Editar usuário ${user.nome}`}
        tabIndex={-1}
      />
      <div className="min-w-0 flex-1 space-y-1 relative z-10 pointer-events-none sm:pointer-events-auto">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium truncate">{user.nome}</p>
          {isCurrentUser && (
            <span className="text-[11px] border rounded-full px-1.5 py-0.5 text-muted-foreground">
              você
            </span>
          )}
          {exceptionCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[11px] text-warning"
              title={`${user.extra_permissions.length} concedida(s), ${
                user.denied_permissions?.length ?? 0
              } revogada(s)`}
            >
              <ShieldAlert className="h-2.5 w-2.5" />
              {exceptionCount} exceção{exceptionCount > 1 ? 'ões' : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        {user.cargo && <p className="text-xs text-muted-foreground">{user.cargo}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0 relative z-10 pointer-events-none sm:pointer-events-auto">
        <RoleBadge role={user.role_padrao} />
        <StatusBadgeUser ativo={user.ativo} />
      </div>

      <div className="flex items-center gap-1 shrink-0 relative z-10">
        {/* Botão Edit dedicado só em desktop — em mobile o card todo é tappable. */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex h-8 w-8 p-0"
          onClick={() => onEdit(user)}
          title="Editar usuário"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-11 w-11 p-0 sm:h-8 sm:w-8"
              aria-label="Mais ações"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(user)} className="min-h-11 sm:min-h-0">
              <Edit2 className="mr-2 h-3.5 w-3.5" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleResendInvite}
              disabled={resending || !user.email}
              className="min-h-11 sm:min-h-0"
            >
              <Mail className="mr-2 h-3.5 w-3.5" />
              {resending ? 'Reenviando…' : 'Reenviar convite'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onToggleStatus(user)}
              disabled={!canToggle}
              className={
                (!user.ativo ? 'text-success' : 'text-destructive') +
                ' min-h-11 sm:min-h-0'
              }
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