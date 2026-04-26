import { useMutation, useQueryClient } from "@tanstack/react-query";
import { receberCompra } from "@/types/rpc";
import { toast } from "sonner";

export interface ReceberCompraItem {
  produto_id: string | null;
  descricao?: string | null;
  quantidade_recebida: number;
  valor_unitario: number;
}

export interface ReceberCompraInput {
  pedidoId: string;
  dataRecebimento: string; // YYYY-MM-DD
  itens: ReceberCompraItem[];
  observacoes?: string;
}

interface ReceberCompraResult {
  compra_id: string;
  numero: string;
  status_pedido: "recebido" | "parcialmente_recebido";
  valor_total: number;
}

export function useReceberCompra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReceberCompraInput): Promise<ReceberCompraResult> => {
      const data = await receberCompra({
        p_pedido_id: input.pedidoId,
        p_data_recebimento: input.dataRecebimento,
        p_itens: input.itens as unknown as never,
        p_observacoes: input.observacoes ?? null,
      });
      return data as unknown as ReceberCompraResult;
    },
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
    mutationFn: async ({ compraId, motivo }: { compraId: string; motivo?: string }) => {
      const { data, error } = await supabase.rpc("estornar_recebimento_compra", {
        p_compra_id: compraId,
        p_motivo: motivo ?? null,
      });
      if (error) throw error;
      return data;
    },
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
