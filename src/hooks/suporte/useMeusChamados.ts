import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";
import * as svc from "@/services/suporte/chamados.service";
import type { AbrirChamadoInput } from "@/services/suporte/types";

const inv = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all(INVALIDATION_KEYS.suporte.map((k) => qc.invalidateQueries({ queryKey: [k] })));

/** Chamados do usuário logado — "Meus chamados" (seção 17 da especificação). */
export function useMeusChamados() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["suporte_meus_chamados"],
    queryFn: () => svc.listMeusChamados(),
  });

  const abrir = useMutation({
    mutationFn: (input: AbrirChamadoInput) => svc.abrirChamado(input),
    onSuccess: async (result) => {
      await inv(qc);
      toast.success(`Chamado ${result.numero} aberto.`);
    },
    onError: (e) => notifyError(e),
  });

  return {
    chamados: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
    abrir,
  };
}
