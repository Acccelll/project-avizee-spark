import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getUserFriendlyError } from "@/utils/errorMessages";

interface LifecycleResult {
  id: string;
  numero: string;
  status: string;
}

function invalidateOrcamentos(qc: ReturnType<typeof useQueryClient>) {
  ["orcamentos", "ordens_venda", "pedidos"].forEach((k) =>
    qc.invalidateQueries({ queryKey: [k] })
  );
}

/**
 * Envia orçamento (rascunho) para aprovação via RPC `enviar_orcamento_aprovacao`.
 * A RPC valida status atual + existência de itens server-side e registra auditoria.
 */
export function useEnviarOrcamentoAprovacao() {
  const qc = useQueryClient();
  return useMutation<LifecycleResult, Error, { id: string; numero?: string }>({
    mutationFn: async ({ id }) => {
      const { data, error } = await supabase.rpc("enviar_orcamento_aprovacao" as never, {
        p_id: id,
      } as never);
      if (error) throw new Error(error.message);
      return data as LifecycleResult;
    },
    onSuccess: (result) => {
      invalidateOrcamentos(qc);
      toast.success(`Orçamento ${result.numero} enviado para aprovação!`);
    },
    onError: (err) => toast.error(getUserFriendlyError(err)),
  });
}

/**
 * Aprova orçamento (pendente → aprovado) via RPC `aprovar_orcamento`.
 * Gate de status server-side + auditoria.
 */
export function useAprovarOrcamento() {
  const qc = useQueryClient();
  return useMutation<LifecycleResult, Error, { id: string; numero?: string }>({
    mutationFn: async ({ id }) => {
      const { data, error } = await supabase.rpc("aprovar_orcamento" as never, {
        p_id: id,
      } as never);
      if (error) throw new Error(error.message);
      return data as LifecycleResult;
    },
    onSuccess: (result) => {
      invalidateOrcamentos(qc);
      toast.success(`Orçamento ${result.numero} aprovado!`);
    },
    onError: (err) => toast.error(getUserFriendlyError(err)),
  });
}