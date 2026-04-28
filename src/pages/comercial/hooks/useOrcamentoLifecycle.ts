import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import {
  enviarOrcamentoAprovacao,
  aprovarOrcamento,
  type OrcamentoLifecycleResult,
} from "@/services/comercial/orcamentosLifecycle.service";

function invalidateOrcamentos(qc: ReturnType<typeof useQueryClient>) {
  ["orcamentos", "ordens_venda", "pedidos"].forEach((k) =>
    qc.invalidateQueries({ queryKey: [k] })
  );
}

/**
 * Envia orçamento (rascunho) para aprovação via RPC `enviar_orcamento_aprovacao`.
 */
export function useEnviarOrcamentoAprovacao() {
  const qc = useQueryClient();
  return useMutation<OrcamentoLifecycleResult, Error, { id: string; numero?: string }>({
    mutationFn: ({ id }) => enviarOrcamentoAprovacao(id),
    onSuccess: (result) => {
      invalidateOrcamentos(qc);
      toast.success(`Orçamento ${result.numero} enviado para aprovação!`);
    },
    onError: (err) => toast.error(getUserFriendlyError(err)),
  });
}

/**
 * Aprova orçamento (pendente → aprovado) via RPC `aprovar_orcamento`.
 */
export function useAprovarOrcamento() {
  const qc = useQueryClient();
  return useMutation<OrcamentoLifecycleResult, Error, { id: string; numero?: string }>({
    mutationFn: ({ id }) => aprovarOrcamento(id),
    onSuccess: (result) => {
      invalidateOrcamentos(qc);
      toast.success(`Orçamento ${result.numero} aprovado!`);
    },
    onError: (err) => toast.error(getUserFriendlyError(err)),
  });
}