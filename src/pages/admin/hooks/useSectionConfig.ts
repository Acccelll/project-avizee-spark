/**
 * useSectionConfig — wrapper sobre useAppConfig que adiciona:
 *  - extração de metadados de governança (`_updatedAt`, `_updatedByName`)
 *  - injeção automática desses metadados ao salvar
 *  - merge com defaults da seção
 *
 * Substitui os 6 padrões duplicados que existiam em `Administracao.tsx`
 * (email/integracoes/notificacoes/backup/fiscal/financeiro), centralizando
 * `at` / `by` num único hook.
 */

import { useMemo } from "react";
import { useAppConfig, type AppConfigChave } from "./useEmpresaConfig";
import { useAuth } from "@/contexts/AuthContext";

export interface SectionMeta {
  at: string | null;
  by: string | null;
}

interface UseSectionConfigResult<T> {
  /** Estado mesclado (defaults + valores persistidos). */
  values: T;
  /** Metadata de governança extraída do JSON salvo. */
  lastSaved: SectionMeta;
  isLoading: boolean;
  isSaving: boolean;
  /**
   * Persiste a seção. Os valores recebidos são serializados junto com
   * `_updatedAt` (ISO now) e `_updatedByName` (nome amigável do usuário).
   */
  save: (next: T) => void;
}

const META_KEYS = ["_updatedAt", "_updatedBy", "_updatedByName"] as const;

function stripMeta<T extends Record<string, unknown>>(raw: Record<string, unknown>): {
  data: Partial<T>;
  meta: SectionMeta;
} {
  const meta: SectionMeta = {
    at: (raw._updatedAt as string | undefined) ?? null,
    // legado: `email` usa `_updatedBy`; demais usam `_updatedByName`.
    by:
      (raw._updatedByName as string | undefined) ??
      (raw._updatedBy as string | undefined) ??
      null,
  };
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if ((META_KEYS as readonly string[]).includes(k)) continue;
    data[k] = v;
  }
  return { data: data as Partial<T>, meta };
}

export function useSectionConfig<T extends Record<string, unknown>>(
  chave: AppConfigChave,
  defaults: T,
): UseSectionConfigResult<T> {
  const { user, profile } = useAuth();
  const { config, isLoading, handleSave, isSaving } = useAppConfig(chave);

  const { values, lastSaved } = useMemo(() => {
    const { data, meta } = stripMeta<T>(config);
    return {
      values: { ...defaults, ...data } as T,
      lastSaved: meta,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const save = (next: T) => {
    const updatedByName = profile?.nome ?? user?.email ?? null;
    handleSave({
      ...(next as Record<string, unknown>),
      _updatedAt: new Date().toISOString(),
      _updatedByName: updatedByName,
    });
  };

  return { values, lastSaved, isLoading, isSaving, save };
}