import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { notifyError } from '@/utils/errorMessages';
import { saveUserProfile } from '@/services/auth.service';

const NOME_MIN = 2;
const NOME_MAX = 80;
const CARGO_MAX = 80;

function validateProfileFields(nome: string, cargo: string): string | null {
  const nomeTrim = nome.trim();
  if (nomeTrim.length < NOME_MIN) return `Informe um nome com pelo menos ${NOME_MIN} caracteres.`;
  if (nomeTrim.length > NOME_MAX) return `O nome deve ter no máximo ${NOME_MAX} caracteres.`;
  if (cargo.trim().length > CARGO_MAX) return `O cargo deve ter no máximo ${CARGO_MAX} caracteres.`;
  return null;
}

/**
 * Encapsula o formulário de "Dados pessoais editáveis":
 * - Sincroniza com `profile` na primeira carga (sem sobrescrever edições).
 * - Detecta `dirty` ignorando whitespace duplicado.
 * - Persiste via RPC `save_user_profile`, que faz update + auditoria
 *   na mesma transação (fase 6 do roadmap). Auditoria nunca diverge do save.
 * - Valida nome (2-80 chars) e cargo (até 80 chars), com trim antes de salvar.
 */
export function useProfileForm() {
  const { user, profile, refreshProfile } = useAuth();
  const [nome, setNome] = useState(profile?.nome || '');
  const [cargo, setCargo] = useState(profile?.cargo || '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
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
    const nomeTrim = nome.trim();
    const cargoTrim = cargo.trim();
    const err = validateProfileFields(nomeTrim, cargoTrim);
    if (err) {
      setValidationError(err);
      toast.error(err);
      return;
    }
    setValidationError(null);
    setSaving(true);
    try {
      await saveUserProfile({ nome: nomeTrim, cargo: cargoTrim });
      // Espelha valores normalizados no estado local para que o dirty-check
      // não fique "sujo" após o save quando o usuário digitou com espaços.
      setNome(nomeTrim);
      setCargo(cargoTrim);
      setSavedAt(new Date());
      toast.success('Dados pessoais salvos com sucesso.');
      // Fase 9: re-hidrata profile no AuthContext para que header, menus e
      // demais consumidores reflitam o nome/cargo atualizados sem reload.
      try {
        await refreshProfile();
      } catch (refreshErr) {
        console.warn('[perfil] refreshProfile falhou:', refreshErr);
      }
    } catch (err: unknown) {
      console.error('[perfil] save:', err);
      notifyError(err);
    }
    setSaving(false);
  };

  return { nome, setNome, cargo, setCargo, saving, savedAt, dirty, save, validationError };
}