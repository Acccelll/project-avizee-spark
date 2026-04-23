/**
 * Modal de criação/edição de usuário.
 *
 * Concentra:
 *  - validação client-side (nome, e-mail, próprio admin etc.).
 *  - chamada para a edge function `admin-users` (create / update).
 *  - confirmação de troca de role com motivo opcional para auditoria.
 *  - apresentação segura de credenciais temporárias via `TempPasswordDialog`
 *    quando o convite por e-mail não pôde ser entregue.
 *
 * Toda a regra de "último admin" e o reload da lista vêm do componente pai
 * (`UsuariosTab`); este modal é puro do ponto de vista de estado global.
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { FormModal } from '@/components/FormModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TempPasswordDialog } from '@/components/usuarios/TempPasswordDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  PERMISSION_HELP_TEXT,
  ROLE_LABELS,
  getRolePermissions,
} from '@/lib/permissions';
import { getUserFriendlyError } from '@/utils/errorMessages';
import {
  ALL_ROLES,
  emptyForm,
  invokeAdminUsers,
  type AppRole,
  type UserFormData,
  type UserWithRoles,
} from './_shared';
import { PermissionMatrix } from './PermissionMatrix';

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  user: UserWithRoles | null;
  onSaved: () => void;
  isLastAdmin: boolean;
}

export function UserFormModal({
  open,
  onClose,
  user,
  onSaved,
  isLastAdmin,
}: UserFormModalProps) {
  const { user: currentUser } = useAuth();
  const isMobile = useIsMobile();
  const isEdit = Boolean(user);
  const [form, setForm] = useState<UserFormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [mobileStep, setMobileStep] = useState(0);
  const [confirmRoleChange, setConfirmRoleChange] = useState<AppRole | null>(null);
  const [roleChangeMotivo, setRoleChangeMotivo] = useState('');
  const [tempCredentials, setTempCredentials] = useState<{
    userName: string;
    email: string;
    tempPassword: string;
    recoveryLink?: string | null;
  } | null>(null);

  const inheritedPermissions = useMemo(
    () => getRolePermissions(form.role_padrao),
    [form.role_padrao],
  );

  useEffect(() => {
    if (!open) return;
    setMobileStep(0);
    if (user) {
      setForm({
        nome: user.nome,
        email: user.email ?? '',
        cargo: user.cargo ?? '',
        ativo: user.ativo,
        role_padrao: user.role_padrao,
        extra_permissions: [...user.extra_permissions],
        denied_permissions: [...(user.denied_permissions ?? [])],
      });
    } else {
      setForm(emptyForm());
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
    // O motivo é encaminhado no payload do PUT em handleSave (campo controlled).
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
    if (!isEdit) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        toast.error('Informe um endereço de e-mail válido.');
        return;
      }
    }
    if (isEdit && user?.id === currentUser?.id && !form.ativo) {
      toast.error('Você não pode inativar a própria conta.');
      return;
    }
    if (
      isEdit &&
      user?.role_padrao === 'admin' &&
      form.role_padrao !== 'admin' &&
      isLastAdmin
    ) {
      toast.error('Não é possível alterar o role do único administrador ativo.');
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
        // Novo shape `{ allow, deny }` — back-compat aceita também `string[]`.
        // Edge function `admin-users` normaliza e atualiza `user_permissions`
        // preservando histórico (allowed=false em vez de DELETE para revogações).
        extra_permissions: {
          allow: form.extra_permissions,
          deny: form.denied_permissions,
        },
        // Motivo opcional encaminhado para `permission_audit.motivo` quando
        // houve troca de role neste fluxo (não bloqueante).
        motivo:
          isEdit && user && user.role_padrao !== form.role_padrao && roleChangeMotivo.trim()
            ? roleChangeMotivo.trim()
            : undefined,
      };

      if (isEdit && user) {
        await invokeAdminUsers({
          action: 'update',
          payload: { id: user.id, ...payload },
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
          // Substitui o toast (que vazaria em screencaptures e logs do
          // navegador) por um diálogo dedicado com botões de copiar e
          // confirmação ativa de leitura.
          setTempCredentials({
            userName: payload.nome,
            email: payload.email,
            tempPassword: result.tempPassword,
            recoveryLink: result.recoveryLink ?? null,
          });
          toast.success('Usuário criado. Repasse as credenciais com segurança.');
        } else {
          toast.success('Usuário criado com sucesso.');
        }
      }
      onSaved();
      // Quando há credenciais temporárias para entregar, mantemos o modal
      // do usuário fechado mas o `TempPasswordDialog` cuidará da entrega
      // — vive em portal e segue visível mesmo após o fechamento.
      onClose();
    } catch (err) {
      console.error('[usuarios] Erro ao salvar usuário:', err);
      toast.error(getUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const title = isEdit ? `Editar usuário — ${user?.nome}` : 'Novo usuário';

  // Stepper mobile: 4 passos (Auditoria só aparece em edit; em create vira 3 passos).
  const totalSteps = isEdit ? 4 : 3;
  const stepLabels = isEdit
    ? ['Dados', 'Status', 'Acesso', 'Auditoria']
    : ['Dados', 'Status', 'Acesso'];
  const isLastStep = mobileStep === totalSteps - 1;
  const isFirstStep = mobileStep === 0;

  const footerActions = isMobile ? (
    <div className="flex w-full items-center gap-2">
      <Button
        variant="outline"
        onClick={isFirstStep ? onClose : () => setMobileStep((s) => s - 1)}
        disabled={saving}
        className="flex-1 min-h-11 gap-1"
      >
        {isFirstStep ? (
          'Cancelar'
        ) : (
          <>
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </>
        )}
      </Button>
      {isLastStep ? (
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 min-h-11 gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? 'Salvar' : 'Criar'}
        </Button>
      ) : (
        <Button
          onClick={() => setMobileStep((s) => s + 1)}
          disabled={saving}
          className="flex-1 min-h-11 gap-1"
        >
          Próximo
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  ) : (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onClose} disabled={saving}>
        Cancelar
      </Button>
      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {isEdit ? 'Salvar alterações' : 'Criar usuário'}
      </Button>
    </div>
  );

  // Helper: define se o bloco é visível (sempre em desktop; só o passo ativo em mobile).
  const blockVisible = (step: number) => !isMobile || mobileStep === step;

  return (
    <>
      <FormModal open={open} onClose={onClose} title={title} size="lg" footer={footerActions}>
        <div className="space-y-6 pt-2">
          {/* Stepper progress (mobile only) */}
          {isMobile && (
            <div className="flex items-center gap-2 sticky top-0 z-10 -mx-1 px-1 py-2 bg-background/95 backdrop-blur border-b">
              <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                Passo {mobileStep + 1} de {totalSteps}
              </span>
              <span className="text-sm font-semibold truncate">
                · {stepLabels[mobileStep]}
              </span>
              <div className="ml-auto flex gap-1" aria-hidden>
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-6 rounded-full transition-colors ${
                      i === mobileStep
                        ? 'bg-primary'
                        : i < mobileStep
                          ? 'bg-primary/40'
                          : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Bloco 1 — Dados básicos */}
          <div className={`space-y-4 ${blockVisible(0) ? '' : 'hidden'}`}>
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
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  E-mail <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
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
                  onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                  placeholder="Ex.: Analista Comercial"
                />
              </div>
            </div>
          </div>

          <Separator className={isMobile ? 'hidden' : ''} />

          {/* Bloco 2 — Segurança e status */}
          <div className={`space-y-4 ${blockVisible(1) ? '' : 'hidden'}`}>
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

          <Separator className={isMobile ? 'hidden' : ''} />

          {/* Bloco 3 — Acesso */}
          <div className={`space-y-4 ${blockVisible(2) ? '' : 'hidden'}`}>
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

        </div>
      </FormModal>

      {/* Confirm role change */}
      <ConfirmDialog
        open={confirmRoleChange !== null}
        onClose={() => {
          setConfirmRoleChange(null);
          setRoleChangeMotivo('');
        }}
        onConfirm={handleConfirmRoleChange}
        title="Alterar role padrão"
        description={`Alterar o role padrão de "${user ? ROLE_LABELS[user.role_padrao] : ''}" para "${
          confirmRoleChange ? ROLE_LABELS[confirmRoleChange] : ''
        }" irá redefinir as permissões base deste usuário. As permissões complementares existentes serão mantidas. Deseja continuar?`}
        confirmLabel="Alterar role"
        confirmVariant={
          // Rebaixar admin → outro role é tão impactante quanto inativar.
          user?.role_padrao === 'admin' && confirmRoleChange !== 'admin'
            ? 'destructive'
            : 'default'
        }
      >
        <div className="space-y-1.5 px-1">
          <Label htmlFor="role-change-motivo" className="text-xs">
            Motivo (opcional — registrado na auditoria)
          </Label>
          <Textarea
            id="role-change-motivo"
            value={roleChangeMotivo}
            onChange={(e) => setRoleChangeMotivo(e.target.value.slice(0, 500))}
            placeholder="Ex.: promoção a financeiro após mudança de área."
            rows={2}
            className="resize-none text-sm"
          />
        </div>
      </ConfirmDialog>

      {/* Diálogo dedicado para credenciais temporárias quando o convite por
          e-mail falha — substitui exibição em toast. */}
      {tempCredentials && (
        <TempPasswordDialog
          open
          onClose={() => setTempCredentials(null)}
          userName={tempCredentials.userName}
          email={tempCredentials.email}
          tempPassword={tempCredentials.tempPassword}
          recoveryLink={tempCredentials.recoveryLink}
        />
      )}
    </>
  );
}