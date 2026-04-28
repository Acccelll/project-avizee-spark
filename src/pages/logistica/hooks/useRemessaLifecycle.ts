import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import {
  expedirRemessa,
  marcarRemessaEmTransito,
  marcarRemessaEntregue,
  cancelarRemessa,
} from "@/services/logistica/remessas.service";

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["remessas"] });
  qc.invalidateQueries({ queryKey: ["entregas"] });
  qc.invalidateQueries({ queryKey: ["estoque-posicao"] });
};

export function useExpedirRemessa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (remessaId: string) => expedirRemessa(remessaId),
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
    mutationFn: (remessaId: string) => marcarRemessaEmTransito(remessaId),
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
    mutationFn: (remessaId: string) => marcarRemessaEntregue(remessaId),
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
    mutationFn: ({ id, motivo }: { id: string; motivo?: string }) =>
      cancelarRemessa({ id, motivo: motivo ?? null }),
    onSuccess: () => {
      toast.success("Remessa cancelada");
      invalidateAll(qc);
    },
    onError: (err: Error) => toast.error(getUserFriendlyError(err)),
  });
}
