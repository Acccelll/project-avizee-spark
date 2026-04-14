/**
 * Serviço de autorização de NF-e junto à SEFAZ.
 * A assinatura digital é realizada server-side na Edge Function sefaz-proxy.
 */

import { construirXMLNFe } from "./xmlBuilder.service";
import type { NFeData } from "./xmlBuilder.service";
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
 * Orquestra: construção do XML → envio (com assinatura server-side) → parseamento do retorno.
 */
export async function autorizarNFe(
  dadosNFe: NFeData,
  certificado: CertificadoDigital,
  urlSefaz: string,
): Promise<AutorizacaoResult> {
  if (certificado.tipo === "A3") {
    return {
      sucesso: false,
      motivo:
        "Certificado A3 requer middleware específico. Não suportado diretamente.",
    };
  }

  if (!certificado.conteudo || !certificado.senha) {
    return {
      sucesso: false,
      motivo: "Conteúdo e senha do certificado A1 são obrigatórios.",
    };
  }

  const xmlNFe = construirXMLNFe(dadosNFe);

  // Assinatura + envio são feitos na Edge Function sefaz-proxy
  const resposta = await enviarParaSefaz(
    xmlNFe,
    urlSefaz,
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote",
    {
      certificado_base64: certificado.conteudo,
      certificado_senha: certificado.senha,
    },
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
    xmlAutorizado: autorizado ? xmlRetorno : undefined,
    status,
    motivo,
  };
}
