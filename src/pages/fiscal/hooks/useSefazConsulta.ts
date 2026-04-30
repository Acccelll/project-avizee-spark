import { useQuery } from "@tanstack/react-query";
import { consultarNFe } from "@/services/fiscal/sefaz";
import type { AmbienteSefaz } from "@/services/fiscal/sefaz";

export interface UseSefazConsultaOptions {
  pollingInterval?: number;
}

/**
 * Hook para consultar o status/protocolo de uma NF-e na SEFAZ
 * (NFeConsultaProtocolo4). Não exige certificado no client — o transporte
 * mTLS é feito server-side pelo `sefaz-proxy` em modo Vault.
 *
 * Suporta polling opcional via refetchInterval.
 */
export function useSefazConsulta(
  chave: string | null,
  urlSefaz: string,
  ambiente: AmbienteSefaz | null,
  options?: UseSefazConsultaOptions,
) {
  return useQuery({
    queryKey: ["sefaz-consulta", chave, urlSefaz, ambiente],
    queryFn: () => consultarNFe(chave!, ambiente!, urlSefaz),
    enabled: !!chave && !!ambiente && !!urlSefaz,
    refetchInterval: options?.pollingInterval,
    staleTime: 0,
    retry: 1,
  });
}
