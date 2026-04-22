import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";

/**
 * Hook único para transitar o status_transporte de uma remessa.
 *
 * Estratégia:
 *  - Para transições que têm efeito em estoque ou disparos sistêmicos,
 *    delega para as RPCs do banco (`expedir_remessa`,
 *    `marcar_remessa_em_transito`, `marcar_remessa_entregue`,
 *    `cancelar_remessa`). Isso preserva atomicidade, RLS e baixa de saldo.
 *  - Para transições puramente logísticas (sem efeito em estoque), faz
 *    `update` direto na coluna `status_transporte`.
 *
 * Os status reconhecidos no projeto vivem em `lib/statusSchema.ts`
 * (`pendente | coletado | postado | em_transito | ocorrencia | entregue
 * | devolvido | cancelado`).  As RPCs no banco utilizam `expedido` como
 * sinônimo intermediário; preferimos `em_transito` no front.
 */
export type RemessaTransition =
  | "pendente"
  | "coletado"
  | "postado"
  | "em_transito"
  | "ocorrencia"
  | "entregue"
  | "devolvido"
  | "cancelado";

const RPC_BY_STATUS: Partial<Record<RemessaTransition, string>> = {
  em_transito: "marcar_remessa_em_transito",
  entregue: "marcar_remessa_entregue",
  cancelado: "cancelar_remessa",
};

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

export function useTransicionarRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ remessaId, novoStatus, motivo }: TransicionarRemessaInput) => {
      const rpcName = RPC_BY_STATUS[novoStatus];
      if (rpcName) {
        const params: Record<string, unknown> = { p_remessa_id: remessaId };
        if (rpcName === "cancelar_remessa") params.p_motivo = motivo ?? null;
        const { error } = await (supabase.rpc as unknown as (
          fn: string, args: Record<string, unknown>,
        ) => Promise<{ error: Error | null }>)(rpcName, params);
        if (error) {
          // Fallback: se a RPC recusar (estado incompatível), tenta update direto
          // para preservar a operação puramente logística do usuário.
          const { error: updErr } = await supabase
            .from("remessas")
            .update({ status_transporte: novoStatus })
            .eq("id", remessaId);
          if (updErr) throw new Error(error.message);
        }
      } else {
        const { error } = await supabase
          .from("remessas")
          .update({ status_transporte: novoStatus })
          .eq("id", remessaId);
        if (error) throw new Error(error.message);
      }
    },
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
    onError: (err: Error) => toast.error(getUserFriendlyError(err)),
  });
}