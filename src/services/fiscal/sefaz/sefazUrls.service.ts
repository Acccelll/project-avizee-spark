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
  | "status"
  /** RecepcaoEvento Ambiente Nacional (manifestação do destinatário). */
  | "evento_an"
  /** NFeDistribuicaoDFe (Ambiente Nacional). */
  | "distdfe";

interface SefazEndpointMap {
  autorizacao: string;
  consulta: string;
  evento: string;
  inutilizacao: string;
  status: string;
  evento_an?: string;
  distdfe?: string;
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

// ── Ambiente Nacional (AN) ───────────────────────────────────────
// Endpoints únicos para todas as UFs. RecepcaoEvento AN recebe a
// manifestação do destinatário (NT 2014.002). NFeDistribuicaoDFe é
// o serviço de distribuição de documentos por NSU/chave.
const AN: SefazUFAmbientes = {
  "1": {
    autorizacao: "",
    consulta: "",
    evento: "https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
    inutilizacao: "",
    status: "",
    evento_an: "https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
    distdfe: "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
  },
  "2": {
    autorizacao: "",
    consulta: "",
    evento: "https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
    inutilizacao: "",
    status: "",
    evento_an: "https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
    distdfe: "https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
  },
};

// ── SEFAZ Virtual de Contingência — Ambiente Nacional (SVC-AN) ────
// Usada como contingência quando a SEFAZ da UF está fora do ar.
// Não inclui inutilização (não é provida pela SVC).
const SVC_AN: SefazUFAmbientes = {
  "1": {
    autorizacao: "https://www.svc.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx",
    consulta: "https://www.svc.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx",
    evento: "https://www.svc.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
    inutilizacao: "",
    status: "https://www.svc.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx",
  },
  "2": {
    autorizacao: "https://hom.svc.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx",
    consulta: "https://hom.svc.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx",
    evento: "https://hom.svc.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
    inutilizacao: "",
    status: "https://hom.svc.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx",
  },
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
  // Serviços do Ambiente Nacional não dependem da UF do emissor.
  if (servico === "evento_an" || servico === "distdfe") {
    const url = AN[ambiente][servico];
    if (!url) {
      throw new Error(`Serviço AN '${servico}' não mapeado para o ambiente ${ambiente}.`);
    }
    return url;
  }
  const mapa = URL_TABLE[ufNorm];
  if (!mapa) {
    throw new Error(
      `UF "${ufNorm}" ainda não está mapeada para SEFAZ. ` +
        `Atualmente apenas SP está ativa. Ajuste sefazUrls.service.ts ou altere a UF da empresa em Configuração Fiscal.`,
    );
  }
  const url = mapa[ambiente][servico];
  if (!url) {
    throw new Error(
      `Serviço '${servico}' não mapeado para UF ${ufNorm} no ambiente ${ambiente}.`,
    );
  }
  return url;
}

/**
 * Resolve o endpoint SVC-AN (contingência) — independente da UF da empresa.
 * Usado quando o webservice da UF está indisponível e o emissor optou por
 * contingência via SVC-AN. Lança erro se o serviço não for ofertado pela SVC
 * (ex.: inutilização, que continua exclusiva da SEFAZ da UF).
 */
export function resolverUrlSvcAn(
  ambiente: AmbienteSefaz,
  servico: Extract<SefazServico, "autorizacao" | "consulta" | "evento" | "status">,
): string {
  const url = SVC_AN[ambiente][servico];
  if (!url) {
    throw new Error(`Serviço '${servico}' não é ofertado pela SVC-AN.`);
  }
  return url;
}

/** Indica se a UF está ativa no resolver — para feedback antecipado na UI. */
export function ufSuportada(uf: string): boolean {
  const ufNorm = (uf ?? "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(URL_TABLE, ufNorm);
}

/** Lista UFs disponíveis no momento (úteis para validação e seletor). */
export const UFS_SUPORTADAS: ReadonlyArray<string> = Object.keys(URL_TABLE);