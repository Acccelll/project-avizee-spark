import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserFriendlyError } from '@/utils/errorMessages';
import { getPasswordCriteriaWithMatch, PASSWORD_MIN_LENGTH } from '@/lib/passwordPolicy';

export interface PasswordErrors {
  current?: string;
  new?: string;
  confirm?: string;
}

/**
 * Encapsula o fluxo "Alterar senha":
 *  1. Re-autentica com a senha atual.
 *  2. Atualiza a senha via `auth.updateUser`.
 *  3. Mapeia erros comuns da política do servidor.
 *  4. Registra auditoria self-update.
 *  5. Sinaliza ao caller que o diálogo "encerrar outras sessões" deve abrir.
 */
export function useChangePassword() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [changing, setChanging] = useState(false);
  const [changedAt, setChangedAt] = useState<Date | null>(null);
  const [showSignOutOthers, setShowSignOutOthers] = useState(false);
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  const change = async () => {
    const criteria = getPasswordCriteriaWithMatch(newPassword, confirmPassword);
    const [lengthOk, caseOk, digitOk, matchOk] = criteria.map((c) => c.met);
    const next: PasswordErrors = {};
    if (!currentPassword) next.current = 'Informe a senha atual';
    if (!newPassword || !lengthOk) next.new = `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres`;
    else if (!caseOk) next.new = 'Use letras maiúsculas e minúsculas';
    else if (!digitOk) next.new = 'Inclua ao menos um número';
    if (newPassword && confirmPassword && !matchOk) next.confirm = 'As senhas não coincidem';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setChanging(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: currentPassword,
      });
      if (signInError) {
        setErrors({ current: 'Senha atual incorreta' });
        setChanging(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('weak') || (msg.includes('password') && msg.includes('short'))) {
          setErrors({ new: 'A senha não atende à política mínima do servidor. Use uma senha mais forte.' });
          setChanging(false);
          return;
        }
        if (msg.includes('same') || msg.includes('different')) {
          setErrors({ new: 'A nova senha precisa ser diferente da senha atual.' });
          setChanging(false);
          return;
        }
        throw error;
      }
      toast.success('Senha alterada com sucesso!');
      try {
        await supabase.rpc('log_self_update_audit', {
          p_tipo_acao: 'self_password_change',
          p_entidade: 'auth.users',
          p_entidade_id: user!.id,
          p_alteracao: { evento: 'password_changed' },
          p_motivo: 'troca de senha pelo próprio usuário',
        });
      } catch (auditErr) {
        console.warn('[perfil] auditoria self-password falhou:', auditErr);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangedAt(new Date());
      setShowSignOutOthers(true);
    } catch (err: unknown) {
      console.error('[perfil] password:', err);
      toast.error(getUserFriendlyError(err));
    }
    setChanging(false);
  };

  const signOutOthers = async () => {
    setSigningOutOthers(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      toast.success('Sessões em outros dispositivos foram encerradas.');
      setShowSignOutOthers(false);
    } catch (err: unknown) {
      console.error('[perfil] signOut others:', err);
      toast.error(getUserFriendlyError(err));
    }
    setSigningOutOthers(false);
  };

  return {
    currentPassword, setCurrentPassword,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    errors, setErrors,
    changing, changedAt,
    change,
    showSignOutOthers, setShowSignOutOthers,
    signingOutOthers,
    signOutOthers,
  };
}