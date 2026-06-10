import { useRef } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { notifyError } from "@/utils/errorMessages";
import { useActionLock } from "@/hooks/useActionLock";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useInvalidateAfterMutation } from "@/hooks/useInvalidateAfterMutation";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";
import { cancelarNotaFiscal } from "@/services/fiscal.service";
import {
  useConfirmarNotaFiscal,
  useEstornarNotaFiscal,
} from "@/pages/fiscal/hooks/useNotaFiscalLifecycle";
import { canConfirmFiscal, canEstornarFiscal } from "@/lib/fiscalStatus";
import { FiscalDevolucaoFlow, type FiscalDevolucaoFlowHandle } from "@/pages/fiscal/components/FiscalDevolucaoFlow";
import type { NotaFiscal } from "@/types/domain";

export interface UseFiscalLifecycleActionsDeps {
  /** Lista paginada atual — usada por `handleInativar` para resolver `nfId` → NF. */
  data: NotaFiscal[];
  /** Refetch da grid após mutações. */
  refetch: () => void;
  /** NF atualmente aberta no modal (para `handleCancelarRascunho`). */
  selected: NotaFiscal | null;
  /** Fecha o modal de edição após cancelar rascunho. */
  closeModal: () => void;
}

/**
 * Encapsula os handlers de ciclo de vida da NF (confirmar, estornar, cancelar
 * rascunho, inativar, devolução). Extraído de `src/pages/Fiscal.tsx`
 * (Frente 1 — decomposição). Comportamento idêntico ao original.
 */
export function useFiscalLifecycleActions(deps: UseFiscalLifecycleActionsDeps) {
  const { data, refetch, selected, closeModal } = deps;

  const confirmarLock = useActionLock();
  const estornarLock = useActionLock();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const invalidate = useInvalidateAfterMutation();
  const confirmarMutation = useConfirmarNotaFiscal();
  const estornarMutation = useEstornarNotaFiscal();
  const devolucaoFlowRef = useRef<FiscalDevolucaoFlowHandle>(null);

  const handleConfirmar = async (nf: NotaFiscal) => {
    if (!canConfirmFiscal(nf.status)) {
      toast.error(`NF ${nf.numero} não está em estado confirmável.`);
      return;
    }
    const ok = await confirm({
      title: "Concluir lançamento da NF",
      description: `Concluir o lançamento da NF ${nf.numero}? O ERP movimentará estoque e gerará o financeiro conforme a configuração da nota. (Notas com condição financeira completa são concluídas automaticamente no salvar — esta ação é o fallback para pendências.)`,
      confirmLabel: "Concluir lançamento",
      confirmVariant: "default",
    });
    if (!ok) return;
    await confirmarLock.run(async () => {
      try {
        await confirmarMutation.mutateAsync({
          nfId: nf.id,
          tipoDocumento:
            ((nf as { tipo_documento?: "nfe" | "nfse" | "cte" }).tipo_documento) ?? "nfe",
        });
        toast.success(`NF ${nf.numero} confirmada com sucesso. Impactos operacionais aplicados.`);
        refetch();
        await invalidate(INVALIDATION_KEYS.fiscalLifecycle);
      } catch (err: unknown) {
        logger.error("[fiscal] confirmar NF:", err);
        notifyError(err);
      }
    });
  };

  const handleEstornar = async (nf: NotaFiscal) => {
    if (!canEstornarFiscal(nf.status)) {
      toast.error(`NF ${nf.numero} não está em estado estornável.`);
      return;
    }
    const ok = await confirm({
      title: "Estornar nota fiscal",
      description: `Estorno da NF ${nf.numero}: o sistema reverterá os movimentos de estoque, cancelará lançamentos financeiros e recalculará faturamento vinculado.`,
      confirmLabel: "Estornar",
      confirmVariant: "destructive",
    });
    if (!ok) return;
    await estornarLock.run(async () => {
      try {
        await estornarMutation.mutateAsync({ nfId: nf.id });
        toast.success(`NF ${nf.numero} estornada! Estoque e financeiro revertidos.`);
        refetch();
        await invalidate(INVALIDATION_KEYS.fiscalLifecycle);
      } catch (err: unknown) {
        logger.error("[fiscal] estornar NF:", err);
        notifyError(err);
      }
    });
  };

  const handleCancelarRascunho = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: "Cancelar rascunho",
      description: `Cancelar o rascunho da NF ${selected.numero}? Esta ação não pode ser desfeita.`,
      confirmLabel: "Cancelar rascunho",
      confirmVariant: "destructive",
    });
    if (!ok) return;
    try {
      // RPC canônica `cancelar_nota_fiscal`: respeita máquina de estados,
      // estorna efeitos quando necessário e registra evento na transação.
      await cancelarNotaFiscal(selected.id, `Rascunho da NF ${selected.numero} cancelado pelo usuário.`);
      toast.success("Rascunho inativado com sucesso.");
      closeModal();
      refetch();
    } catch (err: unknown) {
      logger.error("[fiscal] cancelar rascunho:", err);
      notifyError(err);
    }
  };

  const handleInativar = async (nfId: string) => {
    const nf = data.find((item) => item.id === nfId);
    if (!nf) return;
    if (!canConfirmFiscal(nf.status)) {
      toast.error("Inativação permitida apenas para notas em preparação (rascunho/pendente).");
      return;
    }
    const ok = await confirm({
      title: "Inativar rascunho fiscal",
      description: `A NF ${nf.numero} será inativada no ERP. Esta ação não cancela eventos na SEFAZ.`,
      confirmLabel: "Inativar",
      confirmVariant: "destructive",
    });
    if (!ok) return;
    try {
      await cancelarNotaFiscal(nfId, `NF ${nf.numero} inativada via grid.`);
      toast.success(`NF ${nf.numero} inativada.`);
      refetch();
    } catch (err: unknown) {
      logger.error("[fiscal] inativar NF:", err);
      notifyError(err);
    }
  };

  const openDevolucao = (nf: NotaFiscal) => devolucaoFlowRef.current?.open(nf);

  return {
    handleConfirmar,
    handleEstornar,
    handleCancelarRascunho,
    handleInativar,
    openDevolucao,
    devolucaoFlowRef,
    confirmDialog,
    /** Re-exporta o componente para uso no JSX do orquestrador. */
    FiscalDevolucaoFlow,
  };
}