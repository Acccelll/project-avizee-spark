/**
 * Serviço de inutilização de numeração de NF-e na SEFAZ.
 * A assinatura digital é realizada server-side na Edge Function sefaz-proxy.
 */

import { construirXMLInutilizacao, type AmbienteSefaz } from "./xmlBuilder.service";
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
  /** "1" = Produção, "2" = Homologação. Default: "2". */
  ambiente?: AmbienteSefaz;
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
  if (!certificado.conteudo || !certificado.senha) {
    return { sucesso: false, motivo: "Conteúdo e senha do certificado são obrigatórios." };
  }

  const xml = construirXMLInutilizacao(
    params.cnpj,
    params.ano,
    params.serie,
    params.numInicial,
    params.numFinal,
    params.justificativa,
    params.uf,
    params.ambiente ?? "2",
  );

  const resposta = await enviarParaSefaz(
    xml,
    urlSefaz,
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4/nfeInutilizacaoNF",
    { certificado_base64: certificado.conteudo, certificado_senha: certificado.senha },
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
