/**
 * Serviço de Manifestação do Destinatário (NF-e de entrada).
 * Eventos NT 2012/002:
 *  - 210200 Confirmação da Operação
 *  - 210210 Ciência da Operação
 *  - 210220 Desconhecimento da Operação
 *  - 210240 Operação Não Realizada (exige justificativa 15..255)
 *
 * Os eventos de manifestação trafegam pelo Ambiente Nacional (AN), portanto
 * a URL de envio é o serviço de evento da SEFAZ AN. Reaproveitamos o proxy
 * sefaz-proxy para evitar CORS e manter a assinatura server-side.
 */

import {
  construirXMLManifestacao,
  type AmbienteSefaz,
  type TipoManifestacao,
} from "./xmlBuilder.service";
import type { CertificadoDigital } from "./assinaturaDigital.service";
import { enviarParaSefaz } from "./httpClient.service";

export interface ManifestacaoResult {
  sucesso: boolean;
  protocolo?: string;
  dataRetorno?: string;
  motivo?: string;
  status?: string;
  xmlRetorno?: string;
}

export interface ManifestacaoParams {
  chave: string;
  cnpjDestinatario: string;
  tpEvento: TipoManifestacao;
  ambiente?: AmbienteSefaz;
  justificativa?: string;
}

/**
 * URL do Ambiente Nacional para recepção de evento de manifestação.
 * Produção e Homologação são URLs distintas.
 */
function urlManifestacaoAN(ambiente: AmbienteSefaz): string {
  return ambiente === "1"
    ? "https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx"
    : "https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx";
}

export async function enviarManifestacao(
  params: ManifestacaoParams,
  certificado: CertificadoDigital,
): Promise<ManifestacaoResult> {
  if (params.chave.length !== 44) {
    return { sucesso: false, motivo: "Chave de acesso inválida (44 dígitos)." };
  }
  if (params.tpEvento === "210240") {
    const j = (params.justificativa ?? "").trim();
    if (j.length < 15 || j.length > 255) {
      return {
        sucesso: false,
        motivo: "Justificativa de Operação Não Realizada deve ter de 15 a 255 caracteres.",
      };
    }
  }

  const ambiente = params.ambiente ?? "2";
  const dataHora = new Date().toISOString().replace("Z", "-03:00");
  const xml = construirXMLManifestacao(
    params.chave,
    params.cnpjDestinatario,
    params.tpEvento,
    dataHora,
    ambiente,
    params.justificativa,
  );

  const certBase64 = certificado.conteudo;
  const certSenha = certificado.senha;
  const useVault = !certBase64 || !certSenha;

  const resposta = await enviarParaSefaz(
    xml,
    urlManifestacaoAN(ambiente),
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

  // 135 = registrado e vinculado, 136 = registrado mas não vinculado (a NF-e
  // ainda pode aparecer depois). Ambos representam sucesso na manifestação.
  return {
    sucesso: status === "135" || status === "136",
    protocolo,
    dataRetorno,
    motivo,
    status,
    xmlRetorno,
  };
}

/** Mapeia tpEvento → coluna status_manifestacao da tabela nfe_distribuicao. */
export function statusManifestacaoFromEvento(
  tpEvento: TipoManifestacao,
): "ciencia" | "confirmada" | "desconhecida" | "nao_realizada" {
  switch (tpEvento) {
    case "210200":
      return "confirmada";
    case "210210":
      return "ciencia";
    case "210220":
      return "desconhecida";
    case "210240":
      return "nao_realizada";
  }
}

/** Mapeia tpEvento → tipo_evento da tabela eventos_fiscais. */
export function tipoEventoFiscalFromManifestacao(
  tpEvento: TipoManifestacao,
):
  | "manifestacao_ciencia"
  | "manifestacao_confirmada"
  | "manifestacao_desconhecida"
  | "manifestacao_nao_realizada" {
  switch (tpEvento) {
    case "210200":
      return "manifestacao_confirmada";
    case "210210":
      return "manifestacao_ciencia";
    case "210220":
      return "manifestacao_desconhecida";
    case "210240":
      return "manifestacao_nao_realizada";
  }
}