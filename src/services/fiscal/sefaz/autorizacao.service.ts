/**
 * Serviço de autorização de NF-e junto à SEFAZ.
 */

import { construirXMLNFe } from "./xmlBuilder.service";
import type { NFeData } from "./xmlBuilder.service";
import { assinarXML } from "./assinaturaDigital.service";
import type { CertificadoDigital } from "./assinaturaDigital.service";
import { enviarParaSefaz } from "./httpClient.service";

export interface AutorizacaoResult {
  sucesso: boolean;
  protocolo?: string;
  chave?: string;
  xmlAutorizado?: string;
  status?: string;
  motivo?: string;
}

/**
 * Autoriza uma NF-e junto à SEFAZ.
 * Orquestra: construção do XML → assinatura → envio → parseamento do retorno.
 */
export async function autorizarNFe(
  dadosNFe: NFeData,
  certificado: CertificadoDigital,
  urlSefaz: string,
): Promise<AutorizacaoResult> {
  const xmlNFe = construirXMLNFe(dadosNFe);
  const { xmlAssinado, sucesso: assinado, erro: erroAssinatura } = assinarXML(xmlNFe, certificado);

  if (!assinado) {
    return { sucesso: false, motivo: erroAssinatura };
  }

  const resposta = await enviarParaSefaz(
    xmlAssinado,
    urlSefaz,
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote",
  );

  if (!resposta.sucesso) {
    return { sucesso: false, motivo: resposta.erro };
  }

  // Parsear protocolo e status do XML de retorno
  const xmlRetorno = resposta.xmlRetorno ?? "";
  const protocolo = xmlRetorno.match(/<nProt>(.*?)<\/nProt>/)?.[1];
  const status = xmlRetorno.match(/<cStat>(.*?)<\/cStat>/)?.[1];
  const motivo = xmlRetorno.match(/<xMotivo>(.*?)<\/xMotivo>/)?.[1];

  const autorizado = status === "100";

  return {
    sucesso: autorizado,
    protocolo,
    chave: dadosNFe.chave,
    xmlAutorizado: autorizado ? xmlAssinado : undefined,
    status,
    motivo,
  };
}
