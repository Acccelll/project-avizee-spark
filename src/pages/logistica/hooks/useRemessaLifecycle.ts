import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["remessas"] });
  qc.invalidateQueries({ queryKey: ["entregas"] });
  qc.invalidateQueries({ queryKey: ["estoque-posicao"] });
};

export function useExpedirRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (remessaId: string) => {
      const { error } = await supabase.rpc("expedir_remessa", {
        p_remessa_id: remessaId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Remessa expedida — estoque baixado");
      invalidateAll(qc);
    },
    onError: (err: Error) => toast.error(getUserFriendlyError(err)),
  });
}

export function useMarcarEmTransito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (remessaId: string) => {
      const { error } = await supabase.rpc("marcar_remessa_em_transito", {
        p_remessa_id: remessaId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Remessa em trânsito");
      invalidateAll(qc);
    },
    onError: (err: Error) => toast.error(getUserFriendlyError(err)),
  });
}

export function useMarcarEntregue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (remessaId: string) => {
      const { error } = await supabase.rpc("marcar_remessa_entregue", {
        p_remessa_id: remessaId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Remessa marcada como entregue");
      invalidateAll(qc);
    },
    onError: (err: Error) => toast.error(getUserFriendlyError(err)),
  });
}

export function useCancelarRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) => {
      const { error } = await supabase.rpc("cancelar_remessa", {
        p_remessa_id: id,
        p_motivo: motivo ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Remessa cancelada");
      invalidateAll(qc);
    },
    onError: (err: Error) => toast.error(getUserFriendlyError(err)),
  });
}
