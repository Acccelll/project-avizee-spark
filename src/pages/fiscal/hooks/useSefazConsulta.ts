import { useQuery } from "@tanstack/react-query";
import { consultarNFe } from "@/services/fiscal/sefaz";
import type { CertificadoDigital } from "@/services/fiscal/sefaz";

export interface UseSefazConsultaOptions {
  pollingInterval?: number;
}

/**
 * Hook para consultar o status de uma NF-e na SEFAZ.
 * Suporta polling opcional via refetchInterval.
 */
export function useSefazConsulta(
  chave: string | null,
  urlSefaz: string,
  certificado: CertificadoDigital | null,
  options?: UseSefazConsultaOptions,
) {
  return useQuery({
    queryKey: ["sefaz-consulta", chave, urlSefaz],
    queryFn: () => consultarNFe(chave!, certificado!, urlSefaz),
    enabled: !!chave && !!certificado && !!urlSefaz,
    refetchInterval: options?.pollingInterval,
    staleTime: 0,
    retry: 1,
  });
}
