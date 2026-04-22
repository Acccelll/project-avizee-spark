import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserFriendlyError } from '@/utils/errorMessages';

/**
 * Encapsula o formulário de "Dados pessoais editáveis":
 * - Sincroniza com `profile` na primeira carga (sem sobrescrever edições).
 * - Detecta `dirty` ignorando whitespace duplicado.
 * - Persiste em `profiles` e registra auditoria self-update.
 */
export function useProfileForm() {
  const { user, profile } = useAuth();
  const [nome, setNome] = useState(profile?.nome || '');
  const [cargo, setCargo] = useState(profile?.cargo || '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const appliedRef = useRef(false);

  useEffect(() => {
    if (profile && !appliedRef.current) {
      appliedRef.current = true;
      setNome(profile.nome || '');
      setCargo(profile.cargo || '');
    }
  }, [profile]);

  const dirty =
    nome.trim() !== (profile?.nome || '').trim() ||
    cargo.trim() !== (profile?.cargo || '').trim();

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const previousNome = profile?.nome || '';
      const previousCargo = profile?.cargo || '';
      const { error } = await supabase
        .from('profiles')
        .update({ nome, cargo })
        .eq('id', user.id);
      if (error) throw error;
      try {
        await supabase.rpc('log_self_update_audit', {
          p_tipo_acao: 'self_profile_update',
          p_entidade: 'profiles',
          p_entidade_id: user.id,
          p_alteracao: {
            antes: { nome: previousNome, cargo: previousCargo },
            depois: { nome, cargo },
          },
          p_motivo: 'alteração pelo próprio usuário',
        });
      } catch (auditErr) {
        console.warn('[perfil] auditoria self-update falhou:', auditErr);
      }
      setSavedAt(new Date());
      toast.success('Dados pessoais salvos com sucesso.');
    } catch (err: unknown) {
      console.error('[perfil] save:', err);
      toast.error(getUserFriendlyError(err));
    }
    setSaving(false);
  };

  return { nome, setNome, cargo, setCargo, saving, savedAt, dirty, save };
}