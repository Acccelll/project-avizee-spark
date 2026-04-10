/**
 * Serviço de consulta de NF-e na SEFAZ.
 */

import type { CertificadoDigital } from "./assinaturaDigital.service";
import { enviarParaSefaz } from "./httpClient.service";

export interface ConsultaResult {
  sucesso: boolean;
  status?: string;
  protocolo?: string;
  dataAutorizacao?: string;
  motivo?: string;
}

/**
 * Consulta o status de uma NF-e na SEFAZ pela chave de acesso.
 */
export async function consultarNFe(
  chave: string,
  _certificado: CertificadoDigital,
  urlSefaz: string,
): Promise<ConsultaResult> {
  const xml = `<consSitNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
    <tpAmb>2</tpAmb>
    <xServ>CONSULTAR</xServ>
    <chNFe>${chave}</chNFe>
  </consSitNFe>`;

  const resposta = await enviarParaSefaz(
    xml,
    urlSefaz,
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF",
  );

  if (!resposta.sucesso) {
    return { sucesso: false, motivo: resposta.erro };
  }

  const xmlRetorno = resposta.xmlRetorno ?? "";
  const status = xmlRetorno.match(/<cStat>(.*?)<\/cStat>/)?.[1];
  const protocolo = xmlRetorno.match(/<nProt>(.*?)<\/nProt>/)?.[1];
  const dataAutorizacao = xmlRetorno.match(/<dhRecbto>(.*?)<\/dhRecbto>/)?.[1];
  const motivo = xmlRetorno.match(/<xMotivo>(.*?)<\/xMotivo>/)?.[1];

  return {
    sucesso: true,
    status,
    protocolo,
    dataAutorizacao,
    motivo,
  };
}
