import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
import {
  assumirChamado,
  atribuirResponsavelChamado,
  cancelarChamado,
  listarAdmins,
  listarFilaChamados,
  resolverChamado,
  triarChamado,
  type SuporteCausa,
  type SuporteChamado,
  type SuporteStatus,
  type TriarChamadoInput,
} from "@/services/suporte.service";
import { SUPORTE_QUERY_KEYS } from "./useSuporteQueries";

const FILA_QUERY_KEY = ["suporte-fila-admin"] as const;
const ADMINS_QUERY_KEY = ["suporte-admins"] as const;

export function useFilaChamados() {
  return useQuery({
    queryKey: FILA_QUERY_KEY,
    queryFn: listarFilaChamados,
    staleTime: 15_000,
  });
}

export function useAdmins() {
  return useQuery({
    queryKey: ADMINS_QUERY_KEY,
    queryFn: listarAdmins,
    staleTime: 5 * 60_000,
  });
}

/** Invalida tudo que pode ter mudado depois de uma ação administrativa num chamado. */
function useInvalidateChamado(chamadoId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: FILA_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: SUPORTE_QUERY_KEYS.meusChamados });
    queryClient.invalidateQueries({ queryKey: SUPORTE_QUERY_KEYS.chamado(chamadoId) });
    queryClient.invalidateQueries({ queryKey: SUPORTE_QUERY_KEYS.eventos(chamadoId) });
  };
}

export function useAssumirChamado(chamadoId: string) {
  const invalidate = useInvalidateChamado(chamadoId);
  return useMutation({
    mutationFn: () => assumirChamado(chamadoId),
    onSuccess: () => {
      invalidate();
      toast.success("Chamado assumido.");
    },
    onError: (err) => notifyError(err),
  });
}

export function useAtribuirResponsavel(chamadoId: string) {
  const invalidate = useInvalidateChamado(chamadoId);
  return useMutation({
    mutationFn: (responsavelId: string) => atribuirResponsavelChamado(chamadoId, responsavelId),
    onSuccess: () => {
      invalidate();
      toast.success("Responsável atualizado.");
    },
    onError: (err) => notifyError(err),
  });
}

export function useTriarChamado(chamadoId: string) {
  const invalidate = useInvalidateChamado(chamadoId);
  return useMutation({
    mutationFn: (input: TriarChamadoInput) => triarChamado(chamadoId, input),
    onSuccess: () => {
      invalidate();
      toast.success("Chamado atualizado.");
    },
    onError: (err) => notifyError(err),
  });
}

export function useResolverChamado(chamadoId: string) {
  const invalidate = useInvalidateChamado(chamadoId);
  return useMutation({
    mutationFn: ({ resumo, causa }: { resumo: string; causa?: SuporteCausa }) =>
      resolverChamado(chamadoId, resumo, causa),
    onSuccess: () => {
      invalidate();
      toast.success("Chamado marcado como resolvido.");
    },
    onError: (err) => notifyError(err),
  });
}

/**
 * Mover status sem `chamadoId` fixo no hook — usado pelo Kanban, onde o
 * card arrastado só é conhecido no momento do drop. Não serve para mover
 * para 'resolvido' (a constraint do banco exige resumo_resolucao, que só
 * `suporte_resolver_chamado` grava — use `useResolverChamado` nesse caso).
 *
 * Atualiza a lista da fila otimisticamente (o card já aparece na coluna de
 * destino antes da resposta do servidor) e desfaz em caso de erro.
 */
export function useMoverStatusChamado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chamadoId, status }: { chamadoId: string; status: SuporteStatus }) =>
      triarChamado(chamadoId, { status }),
    onMutate: async ({ chamadoId, status }) => {
      await queryClient.cancelQueries({ queryKey: FILA_QUERY_KEY });
      const anterior = queryClient.getQueryData<SuporteChamado[]>(FILA_QUERY_KEY);
      if (anterior) {
        queryClient.setQueryData<SuporteChamado[]>(
          FILA_QUERY_KEY,
          anterior.map((c) => (c.id === chamadoId ? { ...c, status } : c)),
        );
      }
      return { anterior };
    },
    onError: (err, _vars, context) => {
      if (context?.anterior) queryClient.setQueryData(FILA_QUERY_KEY, context.anterior);
      notifyError(err);
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: FILA_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: SUPORTE_QUERY_KEYS.meusChamados });
      queryClient.invalidateQueries({ queryKey: SUPORTE_QUERY_KEYS.chamado(vars.chamadoId) });
      queryClient.invalidateQueries({ queryKey: SUPORTE_QUERY_KEYS.eventos(vars.chamadoId) });
    },
  });
}

export function useCancelarChamado(chamadoId: string) {
  const invalidate = useInvalidateChamado(chamadoId);
  return useMutation({
    mutationFn: (motivo?: string) => cancelarChamado(chamadoId, motivo),
    onSuccess: () => {
      invalidate();
      toast.success("Chamado cancelado.");
    },
    onError: (err) => notifyError(err),
  });
}
