/**
 * Diálogo de confirmação para inativar/reativar um usuário, com campo de
 * motivo opcional encaminhado à edge function `admin-users` para registro
 * em `permission_audit.motivo`.
 *
 * O componente é controlado: o `target` define o usuário-alvo (e quando
 * `null`, o diálogo está fechado). A persistência fica no pai.
 */

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { UserWithRoles } from './_shared';

interface ToggleStatusDialogProps {
  target: UserWithRoles | null;
  motivo: string;
  loading: boolean;
  onMotivoChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function ToggleStatusDialog({
  target,
  motivo,
  loading,
  onMotivoChange,
  onClose,
  onConfirm,
}: ToggleStatusDialogProps) {
  return (
    <ConfirmDialog
      open={target !== null}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={loading}
      title={target?.ativo ? 'Inativar usuário' : 'Reativar usuário'}
      description={
        target?.ativo
          ? `Inativar "${target?.nome}" impedirá acesso imediato ao sistema. O role padrão, permissões complementares e revogações serão preservados para futura reativação.`
          : `Reativar "${target?.nome}" restabelecerá o acesso com o role padrão e todas as permissões já configuradas.`
      }
      confirmLabel={target?.ativo ? 'Inativar' : 'Reativar'}
      confirmVariant={target?.ativo ? 'destructive' : 'default'}
    >
      <div className="space-y-1.5 px-1">
        <Label htmlFor="toggle-motivo" className="text-xs">
          Motivo {target?.ativo ? '(opcional — registrado na auditoria)' : '(opcional)'}
        </Label>
        <Textarea
          id="toggle-motivo"
          value={motivo}
          onChange={(e) => onMotivoChange(e.target.value.slice(0, 500))}
          placeholder={
            target?.ativo ? 'Ex.: desligamento em 30/06.' : 'Ex.: retorno após licença.'
          }
          rows={2}
          className="resize-none text-sm"
          disabled={loading}
        />
      </div>
    </ConfirmDialog>
  );
}