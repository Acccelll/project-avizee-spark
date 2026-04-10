import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { registrarMovimentacao, type EstoqueMovimentoInsert } from "../services/estoque.service";

interface RegistrarMovimentacaoInput {
  payload: EstoqueMovimentoInsert;
  novoEstoqueAtual: number;
}

export function useEstoqueMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["estoque-produtos"] });
    queryClient.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
  };

  const registrarMutation = useMutation<void, Error, RegistrarMovimentacaoInput>({
    mutationFn: ({ payload, novoEstoqueAtual }) =>
      registrarMovimentacao(payload, novoEstoqueAtual),
    onSuccess: () => {
      toast.success("Ajuste registrado com sucesso");
      invalidate();
    },
    onError: (err) => {
      console.error("[estoque] erro ao salvar:", err);
      toast.error("Erro ao registrar movimentação de estoque");
    },
  });

  return {
    registrar: registrarMutation.mutateAsync,
    isSaving: registrarMutation.isPending,
  };
}
