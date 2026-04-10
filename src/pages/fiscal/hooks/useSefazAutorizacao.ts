import { useMutation } from "@tanstack/react-query";
import { autorizarNFe } from "@/services/fiscal/sefaz";
import type { NFeData, CertificadoDigital, AutorizacaoResult } from "@/services/fiscal/sefaz";

export interface UseSefazAutorizacaoOptions {
  onSucesso?: (result: AutorizacaoResult) => void;
  onErro?: (erro: Error) => void;
}

export interface AutorizacaoParams {
  dadosNFe: NFeData;
  certificado: CertificadoDigital;
  urlSefaz: string;
}

/**
 * Hook para autorização de NF-e na SEFAZ.
 * Encapsula a mutation de autorização com callbacks tipados.
 */
export function useSefazAutorizacao(options?: UseSefazAutorizacaoOptions) {
  return useMutation({
    mutationFn: ({ dadosNFe, certificado, urlSefaz }: AutorizacaoParams) =>
      autorizarNFe(dadosNFe, certificado, urlSefaz),
    onSuccess: (result) => {
      options?.onSucesso?.(result);
    },
    onError: (err: Error) => {
      options?.onErro?.(err);
    },
  });
}
