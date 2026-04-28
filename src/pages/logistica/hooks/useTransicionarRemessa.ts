import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
import {
  transicionarRemessa,
  type RemessaTransition,
} from "@/services/logistica/remessas.service";

export type { RemessaTransition };

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["remessas"] });
  qc.invalidateQueries({ queryKey: ["entregas"] });
  qc.invalidateQueries({ queryKey: ["estoque-posicao"] });
  qc.invalidateQueries({ queryKey: ["estoque-produtos"] });
};

export interface TransicionarRemessaInput {
  remessaId: string;
  novoStatus: RemessaTransition;
  motivo?: string;
}

/**
 * Wrapper React Query para `transicionarRemessa` (service de logística).
 * Estratégia de transição (RPC + fallback de update direto) vive no service.
 */
export function useTransicionarRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransicionarRemessaInput) => transicionarRemessa(input),
    onSuccess: (_d, vars) => {
      const labelMap: Record<RemessaTransition, string> = {
        pendente: "Pendente",
        coletado: "Coletada",
        postado: "Postada",
        em_transito: "Em trânsito",
        ocorrencia: "Com ocorrência",
        entregue: "Entregue (estoque baixado quando aplicável)",
        devolvido: "Devolvida",
        cancelado: "Cancelada (estoque revertido quando aplicável)",
      };
      toast.success(`Remessa atualizada — ${labelMap[vars.novoStatus]}`);
      invalidateAll(qc);
    },
    onError: (err: Error) => notifyError(err),
  });
}