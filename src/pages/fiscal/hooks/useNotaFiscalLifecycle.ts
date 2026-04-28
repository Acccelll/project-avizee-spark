import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError, notifyError } from "@/utils/errorMessages";
import {
  confirmarNotaFiscal,
  estornarNotaFiscal,
  gerarDevolucaoNotaFiscal,
  type ItemDevolucao,
} from "@/services/fiscal.service";

export type { ItemDevolucao };

/**
 * Hooks de ciclo de vida de Notas Fiscais (Rodada 5).
 * Wrappers React Query sobre `services/fiscal.service.ts`.
 */

export function useConfirmarNotaFiscal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nfId: string) => confirmarNotaFiscal(nfId),
    onSuccess: () => {
      toast.success("Nota fiscal confirmada com impacto em estoque/financeiro.");
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
      qc.invalidateQueries({ queryKey: ["estoque"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
    },
    onError: (e) => notifyError(e),
  });
}

export function useEstornarNotaFiscal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { nfId: string; motivo?: string }) => estornarNotaFiscal(input),
    onSuccess: () => {
      toast.success("Estorno concluído com reversão operacional.");
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
      qc.invalidateQueries({ queryKey: ["estoque"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
    },
    onError: (e) => notifyError(e),
  });
}

export function useGerarDevolucaoNF() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { nfOrigemId: string; itens?: ItemDevolucao[] }) =>
      gerarDevolucaoNotaFiscal(input),
    onSuccess: () => {
      toast.success("NF de devolução gerada e vinculada à origem.");
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
    },
    onError: (e) => notifyError(e),
  });
}
