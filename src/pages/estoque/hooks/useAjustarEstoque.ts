import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import {
  ajustarEstoqueManual,
  type AjusteEstoqueInput,
  type TipoAjusteEstoque,
} from "@/services/estoque.service";

export type TipoAjuste = TipoAjusteEstoque;
export type { AjusteEstoqueInput };

/**
 * Wrapper React Query para `ajustarEstoqueManual` (service de estoque).
 */
export function useAjustarEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AjusteEstoqueInput) => ajustarEstoqueManual(input),
    onSuccess: () => {
      toast.success("Estoque ajustado com sucesso");
      qc.invalidateQueries({ queryKey: ["estoque-posicao"] });
      qc.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (err: Error) => toast.error(getUserFriendlyError(err)),
  });
}
