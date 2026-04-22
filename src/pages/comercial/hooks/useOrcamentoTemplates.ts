import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { TemplateConfig } from "@/types/orcamento";
import { getUserFriendlyError } from "@/utils/errorMessages";

const TEAM_TEMPLATE_KEY = "orcamento_template:shared";

export interface OrcamentoTemplate {
  id: string;
  nome: string;
  escopo: "usuario" | "equipe";
  payload: TemplateConfig;
}

export interface UseOrcamentoTemplatesApi {
  templates: OrcamentoTemplate[];
  /** Salva template em `app_configuracoes`. `onConfirmOverwrite` decide
   *  sobrescrever quando `escopo === 'equipe'` e nome já existe. */
  saveTemplate: (input: {
    nome: string;
    escopo: "usuario" | "equipe";
    payload: TemplateConfig;
    onConfirmOverwrite?: () => Promise<boolean>;
  }) => Promise<boolean>;
  /** Recarrega lista (caso queira atualizar após salvar manualmente). */
  reload: () => Promise<void>;
}

/**
 * Hook isolado para gerenciar templates de orçamento (carga + salvamento).
 *
 * Extraído de `OrcamentoForm` (Fase 5 da revisão Comercial) para reduzir o
 * tamanho do componente. **Não toca em `react-hook-form`** — o caller é
 * responsável por aplicar `template.payload` aos campos via `setValue`.
 */
export function useOrcamentoTemplates(userId: string | null | undefined): UseOrcamentoTemplatesApi {
  const [templates, setTemplates] = useState<OrcamentoTemplate[]>([]);

  const reload = useCallback(async () => {
    if (!userId) {
      setTemplates([]);
      return;
    }
    const { data, error } = await supabase
      .from("app_configuracoes")
      .select("valor, chave")
      .or(`chave.like.orcamento_template:${userId}:%,chave.like.${TEAM_TEMPLATE_KEY}:%`);
    if (error) {
      toast.error(getUserFriendlyError(error));
      return;
    }
    const list = (data || [])
      .map((row) => row.valor as unknown as OrcamentoTemplate | null)
      .filter((row): row is OrcamentoTemplate => !!row?.id && !!row?.nome && !!row?.payload);
    setTemplates(list);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveTemplate = useCallback<UseOrcamentoTemplatesApi["saveTemplate"]>(
    async ({ nome, escopo, payload, onConfirmOverwrite }) => {
      const trimmed = nome.trim();
      if (!trimmed) {
        toast.error("Informe um nome para o template");
        return false;
      }
      const key =
        escopo === "equipe"
          ? `${TEAM_TEMPLATE_KEY}:${trimmed}`
          : `orcamento_template:${userId}:${trimmed}`;

      if (escopo === "equipe") {
        const { data: existing, error: existingError } = await supabase
          .from("app_configuracoes")
          .select("chave")
          .eq("chave", key)
          .maybeSingle();
        if (existingError) {
          toast.error(getUserFriendlyError(existingError));
          return false;
        }
        if (existing && onConfirmOverwrite) {
          const ok = await onConfirmOverwrite();
          if (!ok) return false;
        }
      }

      const record: OrcamentoTemplate = { id: key, nome: trimmed, escopo, payload };
      const { error } = await supabase.from("app_configuracoes").upsert(
        { chave: key, valor: record as unknown as Json, updated_at: new Date().toISOString() },
        { onConflict: "chave" },
      );
      if (error) {
        toast.error(getUserFriendlyError(error));
        return false;
      }
      toast.success("Template salvo");
      await reload();
      return true;
    },
    [userId, reload],
  );

  return { templates, saveTemplate, reload };
}