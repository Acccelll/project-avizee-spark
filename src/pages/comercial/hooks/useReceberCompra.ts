import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  receberCompra,
  estornarRecebimentoCompra,
  type ReceberCompraInput,
  type ReceberCompraItem,
  type ReceberCompraResult,
} from "@/services/comercial/comprasLifecycle.service";

export type { ReceberCompraInput, ReceberCompraItem };

export function useReceberCompra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReceberCompraInput): Promise<ReceberCompraResult> => receberCompra(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra"] });
      queryClient.invalidateQueries({ queryKey: ["compras"] });
      queryClient.invalidateQueries({ queryKey: ["estoque_movimentos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      const label = result.status_pedido === "recebido" ? "Recebimento total" : "Recebimento parcial";
      toast.success(`${label} registrado — Compra ${result.numero}`);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Falha ao receber compra";
      toast.error(message);
    },
  });
}

export function useEstornarRecebimento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ compraId, motivo }: { compraId: string; motivo?: string }) =>
      estornarRecebimentoCompra({ compraId, motivo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos_compra"] });
      queryClient.invalidateQueries({ queryKey: ["compras"] });
      queryClient.invalidateQueries({ queryKey: ["estoque_movimentos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Recebimento estornado");
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Falha ao estornar";
      toast.error(message);
    },
  });
}
