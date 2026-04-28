/**
 * Serviço de Carta de Correção Eletrônica (CC-e) — evento NF-e tpEvento 110110.
 * Assinatura é executada server-side na Edge Function sefaz-proxy.
 */

import { construirXMLCartaCorrecao, type AmbienteSefaz } from "./xmlBuilder.service";
import type { CertificadoDigital } from "./assinaturaDigital.service";
import { enviarParaSefaz } from "./httpClient.service";

export interface CartaCorrecaoResult {
  sucesso: boolean;
  protocolo?: string;
  dataRetorno?: string;
  motivo?: string;
  status?: string;
  xmlRetorno?: string;
}

export interface CartaCorrecaoParams {
  chave: string;
  correcao: string;
  cnpjEmitente: string;
  sequencia: number;
  ambiente?: AmbienteSefaz;
}

/**
 * Envia uma Carta de Correção Eletrônica para a SEFAZ.
 *
 * Regras (NT 2011/004):
 * - Texto da correção: 15 a 1000 caracteres.
 * - Sequência: 1..20 por NF-e (a SEFAZ rejeita repetição).
 * - Não pode corrigir: valor de imposto, base, alíquota, dados cadastrais
 *   que mudam emitente/destinatário, data de emissão/saída.
 */
export async function enviarCartaCorrecao(
  params: CartaCorrecaoParams,
  certificado: CertificadoDigital,
  urlSefaz: string,
): Promise<CartaCorrecaoResult> {
  if (params.correcao.trim().length < 15 || params.correcao.length > 1000) {
    return { sucesso: false, motivo: "Texto da correção deve ter de 15 a 1000 caracteres." };
  }
  if (params.sequencia < 1 || params.sequencia > 20) {
    return { sucesso: false, motivo: "Sequência da CC-e deve estar entre 1 e 20." };
  }

  const certBase64 = certificado.conteudo;
  const certSenha = certificado.senha;
  const useVault = !certBase64 || !certSenha;
  const dataHora = new Date().toISOString().replace("Z", "-03:00");
  const xml = construirXMLCartaCorrecao(
    params.chave,
    params.correcao,
    params.cnpjEmitente,
    dataHora,
    params.sequencia,
    params.ambiente ?? "2",
  );

  const resposta = await enviarParaSefaz(
    xml,
    urlSefaz,
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento",
    useVault ? null : { certificado_base64: certBase64, certificado_senha: certSenha },
  );

  if (!resposta.sucesso) {
    return { sucesso: false, motivo: resposta.erro };
  }

  const xmlRetorno = resposta.xmlRetorno ?? "";
  const status = xmlRetorno.match(/<cStat>(.*?)<\/cStat>/)?.[1];
  const motivo = xmlRetorno.match(/<xMotivo>(.*?)<\/xMotivo>/)?.[1];
  const protocolo = xmlRetorno.match(/<nProt>(.*?)<\/nProt>/)?.[1];
  const dataRetorno = xmlRetorno.match(/<dhRegEvento>(.*?)<\/dhRegEvento>/)?.[1];

  return {
    sucesso: status === "135" || status === "136",
    protocolo,
    dataRetorno,
    motivo,
    status,
    xmlRetorno,
  };
}