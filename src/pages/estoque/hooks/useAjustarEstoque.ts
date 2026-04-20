import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";

export type TipoAjuste = "entrada" | "saida" | "ajuste";

export interface AjusteEstoqueInput {
  produto_id: string;
  tipo: TipoAjuste;
  quantidade: number;
  motivo?: string;
  categoria_ajuste?: string;
  motivo_estruturado?: string;
}

/**
 * Calls the transactional RPC `ajustar_estoque_manual` which performs the
 * stock movement and updates `produtos.estoque_atual` atomically.
 *
 * - tipo='entrada' / 'saida': quantidade é somada/subtraída do saldo atual
 * - tipo='ajuste': quantidade é o saldo absoluto desejado (usado para
 *   inventário); a diferença é registrada como movimento.
 */
export function useAjustarEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AjusteEstoqueInput) => {
      const { data, error } = await (supabase.rpc as any)("ajustar_estoque_manual", {
        p_produto_id: input.produto_id,
        p_tipo: input.tipo,
        p_quantidade: input.quantidade,
        p_motivo: input.motivo ?? null,
        p_categoria_ajuste: input.categoria_ajuste ?? null,
        p_motivo_estruturado: input.motivo_estruturado ?? null,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => {
      toast.success("Estoque ajustado com sucesso");
      qc.invalidateQueries({ queryKey: ["estoque-posicao"] });
      qc.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (err: Error) => toast.error(getUserFriendlyError(err)),
  });
}
