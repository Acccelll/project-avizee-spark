import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
import {
  confirmarResolucaoSuporte,
  criarChamadoSuporte,
  registrarComentarioSuporte,
  uploadAnexoChamado,
  type CriarChamadoInput,
} from "@/services/suporte.service";
import { SUPORTE_QUERY_KEYS } from "./useSuporteQueries";

/**
 * Abre o chamado e, em seguida, sobe os anexos escolhidos (se houver) —
 * upload acontece depois porque o path no Storage é `chamados/{chamado_id}/…`.
 * Uma falha no upload não desfaz o chamado: ele já existe e pode ser visto
 * em "Meus chamados"; o erro do upload é reportado à parte.
 */
export interface AnexoParaEnvio {
  file: File;
  isScreenshot?: boolean;
}

export function useCriarChamadoSuporte() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CriarChamadoInput & { anexos?: AnexoParaEnvio[] }) => {
      const { anexos, ...chamadoInput } = input;
      const chamado = await criarChamadoSuporte(chamadoInput);
      if (anexos?.length) {
        const results = await Promise.allSettled(
          anexos.map((a) => uploadAnexoChamado(chamado.id, a.file, { isScreenshot: a.isScreenshot })),
        );
        const falhas = results.filter((r) => r.status === "rejected").length;
        if (falhas > 0) {
          toast.error(
            falhas === anexos.length
              ? "Chamado aberto, mas nenhum anexo pôde ser enviado."
              : `Chamado aberto. ${falhas} de ${anexos.length} anexo(s) não puderam ser enviados.`,
          );
        }
      }
      return chamado;
    },
    onSuccess: (chamado) => {
      queryClient.invalidateQueries({ queryKey: SUPORTE_QUERY_KEYS.meusChamados });
      toast.success(`Chamado ${chamado.numero} aberto com sucesso.`);
    },
    onError: (err) => notifyError(err),
  });
}

export function useComentarChamado(chamadoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mensagem, visibilidade }: { mensagem: string; visibilidade?: "publico" | "interno" }) =>
      registrarComentarioSuporte(chamadoId, mensagem, visibilidade),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUPORTE_QUERY_KEYS.eventos(chamadoId) });
      queryClient.invalidateQueries({ queryKey: SUPORTE_QUERY_KEYS.chamado(chamadoId) });
    },
    onError: (err) => notifyError(err),
  });
}

export function useConfirmarResolucao(chamadoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (confirmado: boolean) => confirmarResolucaoSuporte(chamadoId, confirmado),
    onSuccess: (_data, confirmado) => {
      queryClient.invalidateQueries({ queryKey: SUPORTE_QUERY_KEYS.chamado(chamadoId) });
      queryClient.invalidateQueries({ queryKey: SUPORTE_QUERY_KEYS.eventos(chamadoId) });
      queryClient.invalidateQueries({ queryKey: SUPORTE_QUERY_KEYS.meusChamados });
      toast.success(confirmado ? "Chamado fechado. Obrigado por confirmar!" : "Chamado reaberto — vamos continuar olhando.");
    },
    onError: (err) => notifyError(err),
  });
}

export function useUploadAnexoSuporte(chamadoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadAnexoChamado(chamadoId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUPORTE_QUERY_KEYS.anexos(chamadoId) });
    },
    onError: (err) => notifyError(err),
  });
}
