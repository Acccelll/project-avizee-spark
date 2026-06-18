import { useState } from "react";
import type { UseFormGetValues, UseFormSetValue, UseFormTrigger } from "react-hook-form";
import type { QueryClient } from "@tanstack/react-query";
import type { NavigateFunction } from "react-router-dom";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { notifyError } from "@/utils/errorMessages";
import { deleteOrcamentoDraft } from "@/services/orcamentos.service";
import type { OrcamentoFormValues } from "@/lib/orcamentoSchema";
import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";
import type { SalvarOrcamentoPayload } from "./types";
import {
  validateOrcamentoItems,
  mapItemsToPayload,
  persistOrcamento,
} from "./saveHelpers";

export interface UseOrcamentoSaveArgs {
  id: string | undefined;
  isEdit: boolean;
  isLocked: boolean;
  status: string | undefined;
  canApprove: boolean;
  draftKey: string;
  userId: string | undefined;
  items: OrcamentoItem[];
  trigger: UseFormTrigger<OrcamentoFormValues>;
  getValues: UseFormGetValues<OrcamentoFormValues>;
  setValue: UseFormSetValue<OrcamentoFormValues>;
  buildOrcamentoPayload: (
    override?: Partial<{ numero: string; status: string; validade: string | null }>,
  ) => SalvarOrcamentoPayload;
  queryClient: QueryClient;
  navigate: NavigateFunction;
}

export interface UseOrcamentoSaveApi {
  saving: boolean;
  handleSave: () => Promise<void>;
  handleDuplicate: () => Promise<void>;
}

/**
 * Encapsula os handlers de persistência do OrcamentoForm:
 *  - `handleSave`: validações de status/permissão/itens, persiste via RPC,
 *    limpa drafts (local + server) e invalida caches de listagens/dashboard.
 *  - `handleDuplicate`: clona o payload atual como novo rascunho (numero
 *    gerado server-side por `proximo_numero_orcamento()`).
 * Expõe `saving` para travar botões durante a operação.
 */
export function useOrcamentoSave(args: UseOrcamentoSaveArgs): UseOrcamentoSaveApi {
  const {
    id, isEdit, isLocked, status, canApprove, draftKey, userId, items,
    trigger, getValues, setValue, buildOrcamentoPayload, queryClient, navigate,
  } = args;
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (isLocked) {
      toast.error(`Orçamento "${status}" não pode ser editado.`, {
        description: "Use \"Criar revisão\" no drawer para gerar uma nova versão.",
      });
      return;
    }
    const formStatus = getValues().status;
    if (formStatus === "aprovado" && !canApprove) {
      toast.error("Você não tem permissão para aprovar orçamentos.", {
        description: "Use o fluxo de aprovação na lista de orçamentos.",
      });
      return;
    }
    if (formStatus === "convertido") {
      toast.error("Conversão em pedido deve ser feita pela lista de orçamentos.");
      return;
    }
    const valid = await trigger(['numero', 'clienteId']);
    if (!valid) {
      toast.error("Preencha os campos obrigatórios para salvar.", { description: "Verifique número e cliente." });
      return;
    }
    const { numero, clienteId } = getValues();
    if (!numero || !clienteId) {
      toast.error("Preencha os campos obrigatórios para salvar.", { description: "Verifique número e cliente." });
      return;
    }

    const itemsCheck = validateOrcamentoItems(items, "salvar");
    if (!itemsCheck.ok) {
      toast.error(itemsCheck.error!.title, itemsCheck.error!.description ? { description: itemsCheck.error!.description } : undefined);
      return;
    }
    const validItems = itemsCheck.validItems;

    setSaving(true);
    try {
      const payload = buildOrcamentoPayload();
      const { orcId, numero: numeroSalvo } = await persistOrcamento({
        id: isEdit ? id! : null,
        payload,
        itens: mapItemsToPayload(validItems),
        fetchServerNumero: !isEdit,
      });

      localStorage.removeItem(draftKey);
      if (userId) {
        try {
          await deleteOrcamentoDraft(userId, draftKey);
        } catch {/* ignore */}
      }
      if (!isEdit && numeroSalvo) setValue("numero", numeroSalvo);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orcamentos"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success(isEdit ? "Orçamento atualizado com sucesso" : "Orçamento criado com sucesso", {
        description: `Registro ${numeroSalvo} salvo.`,
        action: { label: "Visualizar", onClick: () => navigate(orcId ? `/orcamentos/${orcId}` : "/orcamentos") },
      });
      if (!isEdit && orcId) navigate(`/orcamentos/${orcId}?created=1`, { replace: true });
    } catch (err: unknown) {
      logger.error('[orcamento]', err);
      notifyError(err);
    }
    setSaving(false);
  };

  const handleDuplicate = async () => {
    if (!id) { toast.error("Salve o orçamento antes de duplicar"); return; }
    const itemsCheck = validateOrcamentoItems(items, "duplicar");
    if (!itemsCheck.ok) {
      toast.error(itemsCheck.error!.title, itemsCheck.error!.description ? { description: itemsCheck.error!.description } : undefined);
      return;
    }
    const validItems = itemsCheck.validItems;
    try {
      const payload = buildOrcamentoPayload({
        numero: "",
        status: "rascunho",
        validade: null,
      });
      const { orcId, numero: numeroDup } = await persistOrcamento({
        id: null,
        payload,
        itens: mapItemsToPayload(validItems),
        fetchServerNumero: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      toast.success(`Duplicado: ${numeroDup}`);
      navigate(`/orcamentos/${orcId}`, { replace: true });
    } catch (err: unknown) {
      logger.error('[orcamento] duplicar:', err);
      notifyError(err);
    }
  };

  return { saving, handleSave, handleDuplicate };
}