import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserFriendlyError, notifyError } from "@/utils/errorMessages";
import { convertToPedido, type ConvertToOVOptions } from "@/services/orcamentos.service";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";

interface OrcamentoBase {
  id: string;
  numero: string;
  status: string;
  cliente_id: string | null;
  valor_total: number | null;
  quantidade_total: number | null;
  peso_total: number | null;
  observacoes: string | null;
}

interface ConverterOrcamentoInput {
  orcamento: OrcamentoBase;
  options?: ConvertToOVOptions;
}

/**
 * Hook for converting a quotation (orçamento) into a sales order (pedido).
 * Invalida `conversaoOrcamento` (orçamentos + ordens_venda + pedidos).
 * O toast de sucesso é emitido pelo service `convertToPedido`.
 */
export function useConverterOrcamento() {
  const queryClient = useQueryClient();

  return useMutation<{ ovId: string; ovNumero: string }, Error, ConverterOrcamentoInput>({
    mutationFn: ({ orcamento, options = {} }) => convertToPedido(orcamento, options),
    onSuccess: () => {
      INVALIDATION_KEYS.conversaoOrcamento.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    },
    onError: (err: Error) => {
      notifyError(err);
    },
  });
}
