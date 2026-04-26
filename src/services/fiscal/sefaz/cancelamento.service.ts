/**
 * Serviço de cancelamento de NF-e na SEFAZ.
 * A assinatura digital é realizada server-side na Edge Function sefaz-proxy.
 */

import { construirXMLCancelamento, type AmbienteSefaz } from "./xmlBuilder.service";
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
 * @param ambiente - "1" = Produção, "2" = Homologação. Deve corresponder ao
 *                   ambiente em que a NF-e foi autorizada. Default: "2".
 */
export async function cancelarNFe(
  chave: string,
  protocolo: string,
  justificativa: string,
  certificado: CertificadoDigital,
  urlSefaz: string,
  dadosEmitente: { cnpj: string },
  ambiente: AmbienteSefaz = "2",
): Promise<CancelamentoResult> {
  const certBase64 = certificado.conteudo;
  const certSenha = certificado.senha;
  const useVault = !certBase64 || !certSenha;
  const dataHora = new Date().toISOString().replace("Z", "-03:00");
  const xml = construirXMLCancelamento(
    chave,
    protocolo,
    justificativa,
    dadosEmitente.cnpj,
    dataHora,
    ambiente,
  );

  const resposta = await enviarParaSefaz(
    xml,
    urlSefaz,
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento",
    useVault
      ? null
      : { certificado_base64: certBase64, certificado_senha: certSenha },
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
