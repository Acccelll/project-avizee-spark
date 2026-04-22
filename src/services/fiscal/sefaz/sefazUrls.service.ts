/**
 * Mapeamento de endpoints SEFAZ por UF + ambiente + serviço.
 *
 * Apenas SP está ativa nesta fase (conforme decisão do roadmap fiscal —
 * empresa emite somente em SP). Outras UFs ficam como placeholders e devem
 * ser ativadas conforme expansão.
 *
 * Fonte oficial: Portal Nacional NF-e — Web Services NF-e 4.00.
 * URLs validadas em 2024-2025; revisar quando SEFAZ publicar nova versão.
 */

import type { AmbienteSefaz } from "./xmlBuilder.service";

/** Serviços SOAP da SEFAZ utilizados pelo ERP. */
export type SefazServico =
  | "autorizacao"
  | "consulta"
  | "evento"
  | "inutilizacao"
  | "status";

interface SefazEndpointMap {
  autorizacao: string;
  consulta: string;
  evento: string;
  inutilizacao: string;
  status: string;
}

/** Endpoints por ambiente: "1" = Produção, "2" = Homologação. */
interface SefazUFAmbientes {
  "1": SefazEndpointMap;
  "2": SefazEndpointMap;
}

const SP: SefazUFAmbientes = {
  // Produção
  "1": {
    autorizacao:
      "https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
    consulta:
      "https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx",
    evento:
      "https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx",
    inutilizacao:
      "https://nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx",
    status:
      "https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx",
  },
  // Homologação
  "2": {
    autorizacao:
      "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
    consulta:
      "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx",
    evento:
      "https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx",
    inutilizacao:
      "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx",
    status:
      "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx",
  },
};

const URL_TABLE: Partial<Record<string, SefazUFAmbientes>> = {
  SP,
};

/**
 * Resolve o endpoint SOAP da SEFAZ para a UF/ambiente/serviço informados.
 * Lança erro descritivo se a UF ainda não estiver mapeada — preferimos falhar
 * cedo a chamar uma URL inválida.
 */
export function resolverUrlSefaz(
  uf: string,
  ambiente: AmbienteSefaz,
  servico: SefazServico,
): string {
  const ufNorm = (uf ?? "").trim().toUpperCase();
  const mapa = URL_TABLE[ufNorm];
  if (!mapa) {
    throw new Error(
      `UF "${ufNorm}" ainda não está mapeada para SEFAZ. ` +
        `Atualmente apenas SP está ativa. Ajuste sefazUrls.service.ts ou altere a UF da empresa em Configuração Fiscal.`,
    );
  }
  return mapa[ambiente][servico];
}

/** Lista UFs disponíveis no momento (úteis para validação e seletor). */
export const UFS_SUPORTADAS: ReadonlyArray<string> = Object.keys(URL_TABLE);