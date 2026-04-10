/**
 * Serviço de inutilização de numeração de NF-e na SEFAZ.
 */

import { construirXMLInutilizacao } from "./xmlBuilder.service";
import { assinarXML } from "./assinaturaDigital.service";
import type { CertificadoDigital } from "./assinaturaDigital.service";
import { enviarParaSefaz } from "./httpClient.service";

export interface InutilizacaoParams {
  cnpj: string;
  ano: number;
  serie: number;
  numInicial: number;
  numFinal: number;
  justificativa: string;
  uf: string;
}

export interface InutilizacaoResult {
  sucesso: boolean;
  protocolo?: string;
  dataRetorno?: string;
  motivo?: string;
}

/**
 * Inutiliza uma faixa de numeração de NF-e na SEFAZ.
 */
export async function inutilizarNumeracao(
  params: InutilizacaoParams,
  certificado: CertificadoDigital,
  urlSefaz: string,
): Promise<InutilizacaoResult> {
  const xml = construirXMLInutilizacao(
    params.cnpj,
    params.ano,
    params.serie,
    params.numInicial,
    params.numFinal,
    params.justificativa,
    params.uf,
  );

  const { xmlAssinado, sucesso: assinado, erro: erroAssinatura } = assinarXML(xml, certificado);
  if (!assinado) {
    return { sucesso: false, motivo: erroAssinatura };
  }

  const resposta = await enviarParaSefaz(
    xmlAssinado,
    urlSefaz,
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4/nfeInutilizacaoNF",
  );

  if (!resposta.sucesso) {
    return { sucesso: false, motivo: resposta.erro };
  }

  const xmlRetorno = resposta.xmlRetorno ?? "";
  const status = xmlRetorno.match(/<cStat>(.*?)<\/cStat>/)?.[1];
  const motivo = xmlRetorno.match(/<xMotivo>(.*?)<\/xMotivo>/)?.[1];
  const protocolo = xmlRetorno.match(/<nProt>(.*?)<\/nProt>/)?.[1];
  const dataRetorno = xmlRetorno.match(/<dhRecbto>(.*?)<\/dhRecbto>/)?.[1];

  return {
    sucesso: status === "102",
    protocolo,
    dataRetorno,
    motivo,
  };
}
