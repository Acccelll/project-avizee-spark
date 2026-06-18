import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { UseFormSetValue } from "react-hook-form";
import type { OrcamentoFormValues } from "@/lib/orcamentoSchema";
import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import type { TemplateConfig } from "@/types/orcamento";
import {
  useOrcamentoTemplates,
  type OrcamentoTemplate,
} from "@/pages/comercial/hooks/useOrcamentoTemplates";
import { applyOrcamentoTemplate } from "./draftTemplate";
import type { TemplateScope } from "./TemplateSaveDialog";

interface UseOrcamentoFormTemplatesArgs {
  userId: string | null | undefined;
  getTemplatePayload: () => TemplateConfig;
  setValue: UseFormSetValue<OrcamentoFormValues>;
  setItems: (items: OrcamentoItem[]) => void;
  confirmAction: (opts: {
    title: string;
    description?: string;
    confirmLabel?: string;
    confirmVariant?: "default" | "destructive";
  }) => Promise<boolean>;
}

/**
 * Centraliza estado e handlers de templates do OrcamentoForm:
 * lista + persistência (via `useOrcamentoTemplates`), nome/diálogo de salvar
 * e aplicação de template ao formulário.
 */
export function useOrcamentoFormTemplates({
  userId,
  getTemplatePayload,
  setValue,
  setItems,
  confirmAction,
}: UseOrcamentoFormTemplatesArgs) {
  const [templateName, setTemplateName] = useState("");
  const [templateDialogOpen, setTemplateDialogOpen] = useState<TemplateScope | null>(null);
  const { templates, saveTemplate: persistTemplate } = useOrcamentoTemplates(userId);

  const saveTemplate = useCallback(
    async (escopo: TemplateScope) => {
      const ok = await persistTemplate({
        nome: templateName,
        escopo,
        payload: getTemplatePayload(),
        onConfirmOverwrite: () =>
          confirmAction({
            title: "Sobrescrever template?",
            description: "Template com este nome já existe. Deseja sobrescrever?",
            confirmLabel: "Sobrescrever",
            confirmVariant: "destructive",
          }),
      });
      if (ok) setTemplateName("");
    },
    [persistTemplate, templateName, getTemplatePayload, confirmAction],
  );

  const applyTemplate = useCallback(
    (tpl: OrcamentoTemplate) => {
      applyOrcamentoTemplate(tpl, { setValue, setItems });
      toast.success(`Template '${tpl.nome}' aplicado`);
    },
    [setValue, setItems],
  );

  const openTemplateDialog = useCallback((escopo: TemplateScope) => {
    setTemplateName("");
    setTemplateDialogOpen(escopo);
  }, []);

  return {
    templates,
    templateName,
    setTemplateName,
    templateDialogOpen,
    setTemplateDialogOpen,
    openTemplateDialog,
    saveTemplate,
    applyTemplate,
  };
}