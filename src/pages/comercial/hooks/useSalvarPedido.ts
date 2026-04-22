import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";

interface SalvarPedidoInput {
  id: string;
  patch: {
    status?: string | null;
    po_number?: string | null;
    data_po_cliente?: string | null;
    data_prometida_despacho?: string | null;
    prazo_despacho_dias?: number | null;
    observacoes?: string | null;
  };
}

/**
 * Atualiza dados operacionais do pedido e invalida queries cross-módulo.
 * Substitui o `update` direto que vivia em `PedidoForm.handleSave` para
 * garantir que grid de Pedidos/dashboard reflitam sem refresh manual.
 */
export function useSalvarPedido() {
  const qc = useQueryClient();
  return useMutation<void, Error, SalvarPedidoInput>({
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase
        .from("ordens_venda")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      INVALIDATION_KEYS.faturamentoPedido.forEach((key) => {
        qc.invalidateQueries({ queryKey: [key] });
      });
      toast.success("Pedido atualizado com sucesso.");
    },
    onError: (err) => toast.error(getUserFriendlyError(err)),
  });
}