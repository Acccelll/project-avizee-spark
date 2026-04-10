/**
 * Serviço de cancelamento de NF-e na SEFAZ.
 */

import { construirXMLCancelamento } from "./xmlBuilder.service";
import { assinarXML } from "./assinaturaDigital.service";
import type { CertificadoDigital } from "./assinaturaDigital.service";
import { enviarParaSefaz } from "./httpClient.service";

export interface CancelamentoResult {
  sucesso: boolean;
  protocolo?: string;
  dataRetorno?: string;
  motivo?: string;
}

/**
 * Cancela uma NF-e autorizada na SEFAZ.
 * @param justificativa - Mínimo 15 caracteres conforme regra SEFAZ.
 */
export async function cancelarNFe(
  chave: string,
  protocolo: string,
  justificativa: string,
  certificado: CertificadoDigital,
  urlSefaz: string,
  dadosEmitente: { cnpj: string },
): Promise<CancelamentoResult> {
  const dataHora = new Date().toISOString().replace("Z", "-03:00");
  const xml = construirXMLCancelamento(
    chave,
    protocolo,
    justificativa,
    dadosEmitente.cnpj,
    dataHora,
  );

  const { xmlAssinado, sucesso: assinado, erro: erroAssinatura } = assinarXML(xml, certificado);
  if (!assinado) {
    return { sucesso: false, motivo: erroAssinatura };
  }

  const resposta = await enviarParaSefaz(
    xmlAssinado,
    urlSefaz,
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento",
  );

  if (!resposta.sucesso) {
    return { sucesso: false, motivo: resposta.erro };
  }

  const xmlRetorno = resposta.xmlRetorno ?? "";
  const status = xmlRetorno.match(/<cStat>(.*?)<\/cStat>/)?.[1];
  const motivo = xmlRetorno.match(/<xMotivo>(.*?)<\/xMotivo>/)?.[1];
  const protCancelamento = xmlRetorno.match(/<nProt>(.*?)<\/nProt>/)?.[1];
  const dataRetorno = xmlRetorno.match(/<dhRegEvento>(.*?)<\/dhRegEvento>/)?.[1];

  return {
    sucesso: status === "135" || status === "155",
    protocolo: protCancelamento,
    dataRetorno,
    motivo,
  };
}
