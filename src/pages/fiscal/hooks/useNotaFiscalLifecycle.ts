import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getUserFriendlyError } from "@/utils/errorMessages";

/**
 * Hooks de ciclo de vida de Notas Fiscais (Rodada 5).
 * Encapsulam as RPCs transacionais:
 *  - confirmar_nota_fiscal
 *  - estornar_nota_fiscal
 *  - gerar_devolucao_nota_fiscal
 */

export function useConfirmarNotaFiscal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nfId: string) => {
      const { error } = await supabase.rpc("confirmar_nota_fiscal", { p_nf_id: nfId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota fiscal confirmada");
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
      qc.invalidateQueries({ queryKey: ["estoque"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export function useEstornarNotaFiscal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nfId, motivo }: { nfId: string; motivo?: string }) => {
      const { error } = await supabase.rpc("estornar_nota_fiscal", {
        p_nf_id: nfId,
        p_motivo: motivo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota fiscal estornada");
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
      qc.invalidateQueries({ queryKey: ["estoque"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export interface ItemDevolucao {
  produto_id: string;
  quantidade: number;
}

export function useGerarDevolucaoNF() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      nfOrigemId,
      itens,
    }: {
      nfOrigemId: string;
      /** Quando omitido, gera devolução total. */
      itens?: ItemDevolucao[];
    }) => {
      const { data, error } = await supabase.rpc("gerar_devolucao_nota_fiscal", {
        p_nf_origem_id: nfOrigemId,
        p_itens: (itens ?? null) as never,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("NF de devolução gerada");
      qc.invalidateQueries({ queryKey: ["notas_fiscais"] });
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}
