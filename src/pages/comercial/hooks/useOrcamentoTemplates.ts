import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { TemplateConfig } from "@/types/orcamento";
import { getUserFriendlyError } from "@/utils/errorMessages";
import {
  buildTemplateKey,
  existsTeamTemplate,
  listOrcamentoTemplates,
  upsertOrcamentoTemplate,
  type OrcamentoTemplate,
} from "@/services/comercial/orcamentoTemplates.service";

export type { OrcamentoTemplate };

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
 * Camada fina sobre `services/comercial/orcamentoTemplates.service`.
 */
export function useOrcamentoTemplates(userId: string | null | undefined): UseOrcamentoTemplatesApi {
  const [templates, setTemplates] = useState<OrcamentoTemplate[]>([]);

  const reload = useCallback(async () => {
    if (!userId) {
      setTemplates([]);
      return;
    }
    try {
      const list = await listOrcamentoTemplates(userId);
      setTemplates(list);
    } catch (err) {
      toast.error(getUserFriendlyError(err));
      return;
    }
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
      if (!userId) {
        toast.error("Sessão de usuário não disponível");
        return false;
      }
      const key = buildTemplateKey({ escopo, nome: trimmed, userId });

      if (escopo === "equipe") {
        try {
          const exists = await existsTeamTemplate(key);
          if (exists && onConfirmOverwrite) {
            const ok = await onConfirmOverwrite();
            if (!ok) return false;
          }
        } catch (err) {
          toast.error(getUserFriendlyError(err));
          return false;
        }
      }

      const record: OrcamentoTemplate = { id: key, nome: trimmed, escopo, payload };
      try {
        await upsertOrcamentoTemplate(record);
      } catch (err) {
        toast.error(getUserFriendlyError(err));
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