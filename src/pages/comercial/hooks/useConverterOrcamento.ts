import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { convertToPedido, type ConvertToOVOptions } from "@/services/orcamentos.service";

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
 * Invalidates queries for orcamentos and ordens_venda on success.
 */
export function useConverterOrcamento() {
  const queryClient = useQueryClient();

  return useMutation<{ ovId: string; ovNumero: string }, Error, ConverterOrcamentoInput>({
    mutationFn: ({ orcamento, options = {} }) => convertToPedido(orcamento, options),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens_venda"] });
      toast.success(`Pedido ${result.ovNumero} criado com sucesso!`);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao converter cotação: ${err.message}`);
    },
  });
}
