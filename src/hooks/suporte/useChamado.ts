import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";
import * as chamadosSvc from "@/services/suporte/chamados.service";
import * as eventosSvc from "@/services/suporte/eventos.service";
import * as anexosSvc from "@/services/suporte/anexos.service";
import type { SuporteVisibilidade } from "@/services/suporte/types";

const inv = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all(INVALIDATION_KEYS.suporte.map((k) => qc.invalidateQueries({ queryKey: [k] })));

/** Detalhe de um chamado: dados, timeline (eventos) e anexos. */
export function useChamado(chamadoId: string | undefined) {
  const qc = useQueryClient();

  const chamado = useQuery({
    enabled: !!chamadoId,
    queryKey: ["suporte_chamado", chamadoId],
    queryFn: () => chamadosSvc.getChamado(chamadoId as string),
  });

  const eventos = useQuery({
    enabled: !!chamadoId,
    queryKey: ["suporte_eventos", chamadoId],
    queryFn: () => eventosSvc.listEventos(chamadoId as string),
  });

  const anexos = useQuery({
    enabled: !!chamadoId,
    queryKey: ["suporte_anexos", chamadoId],
    queryFn: () => anexosSvc.listAnexos(chamadoId as string),
  });

  const comentar = useMutation({
    mutationFn: (params: { mensagem: string; visibilidade?: SuporteVisibilidade }) =>
      eventosSvc.registrarComentario(chamadoId as string, params.mensagem, params.visibilidade),
    onSuccess: async () => { await inv(qc); },
    onError: (e) => notifyError(e),
  });

  const anexar = useMutation({
    mutationFn: (params: { file: File; eventoId?: string; isScreenshot?: boolean }) =>
      anexosSvc.uploadAnexo({
        chamadoId: chamadoId as string,
        file: params.file,
        eventoId: params.eventoId,
        isScreenshot: params.isScreenshot,
        anexosExistentes: anexos.data?.length ?? 0,
      }),
    onSuccess: async () => { await inv(qc); toast.success("Anexo enviado."); },
    onError: (e) => notifyError(e),
  });

  const confirmarResolucao = useMutation({
    mutationFn: (confirmado: boolean) =>
      chamadosSvc.confirmarResolucao(chamadoId as string, confirmado),
    onSuccess: async (_data, confirmado) => {
      await inv(qc);
      toast.success(confirmado ? "Chamado fechado." : "Reaberto — descreva o que ainda falta.");
    },
    onError: (e) => notifyError(e),
  });

  // Ações administrativas — RLS/RPC já garantem que só admin pode executá-las.
  const assumir = useMutation({
    mutationFn: () => chamadosSvc.assumirChamado(chamadoId as string),
    onSuccess: async () => { await inv(qc); toast.success("Chamado assumido."); },
    onError: (e) => notifyError(e),
  });

  const atribuirResponsavel = useMutation({
    mutationFn: (responsavelId: string) =>
      chamadosSvc.atribuirResponsavel(chamadoId as string, responsavelId),
    onSuccess: async () => { await inv(qc); toast.success("Responsável atualizado."); },
    onError: (e) => notifyError(e),
  });

  const triar = useMutation({
    mutationFn: (patch: Parameters<typeof chamadosSvc.triarChamado>[1]) =>
      chamadosSvc.triarChamado(chamadoId as string, patch),
    onSuccess: async () => { await inv(qc); toast.success("Chamado atualizado."); },
    onError: (e) => notifyError(e),
  });

  const resolver = useMutation({
    mutationFn: (params: { resumo: string; causa?: Parameters<typeof chamadosSvc.resolverChamado>[2] }) =>
      chamadosSvc.resolverChamado(chamadoId as string, params.resumo, params.causa),
    onSuccess: async () => { await inv(qc); toast.success("Chamado marcado como resolvido."); },
    onError: (e) => notifyError(e),
  });

  const cancelar = useMutation({
    mutationFn: (motivo?: string) => chamadosSvc.cancelarChamado(chamadoId as string, motivo),
    onSuccess: async () => { await inv(qc); toast.success("Chamado cancelado."); },
    onError: (e) => notifyError(e),
  });

  const marcarDuplicado = useMutation({
    mutationFn: (duplicadoDeId: string) =>
      chamadosSvc.marcarDuplicado(chamadoId as string, duplicadoDeId),
    onSuccess: async () => { await inv(qc); toast.success("Chamado marcado como duplicado."); },
    onError: (e) => notifyError(e),
  });

  return {
    chamado: chamado.data,
    loadingChamado: chamado.isLoading,
    eventos: eventos.data ?? [],
    loadingEventos: eventos.isLoading,
    anexos: anexos.data ?? [],
    loadingAnexos: anexos.isLoading,
    comentar,
    anexar,
    confirmarResolucao,
    assumir,
    atribuirResponsavel,
    triar,
    resolver,
    cancelar,
    marcarDuplicado,
  };
}
