/**
 * Serviço de consulta de situação/protocolo de NF-e na SEFAZ
 * (NFeConsultaProtocolo4 — XML `consSitNFe`).
 *
 * Particularidades importantes:
 *  - NÃO exige XMLDSig — `consSitNFe` é enviado sem assinatura.
 *  - Exige mTLS com o A1 da empresa — o transporte é feito server-side pelo
 *    `sefaz-proxy` (action `enviar-sem-assinatura-vault`).
 *  - O ambiente (`tpAmb`) precisa ser o mesmo da URL utilizada — caso
 *    contrário a SEFAZ devolve rejeição.
 *  - Este serviço é distinto do DistDFe (`NFeDistribuicaoDFe`), que é usado
 *    apenas para baixar XMLs/resumos destinados ao CNPJ do certificado.
 */

import { enviarParaSefazSemAssinatura } from "./httpClient.service";
import type { AmbienteSefaz } from "./xmlBuilder.service";

export interface ConsultaResult {
  sucesso: boolean;
  /** cStat oficial devolvido pela SEFAZ (ex.: "100", "217"). */
  status?: string;
  /** Número de protocolo de autorização, quando houver. */
  protocolo?: string;
  /** Data/hora de recebimento devolvida pela SEFAZ. */
  dataAutorizacao?: string;
  /** xMotivo oficial. */
  motivo?: string;
  /** Ambiente devolvido pela SEFAZ (1=produção, 2=homologação). */
  tpAmb?: string;
  /** XML SOAP bruto retornado, útil para auditoria/log. */
  xmlRetorno?: string;
}

function extrair(tag: string, xml: string): string | undefined {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return m?.[1]?.trim();
}

/**
 * Consulta o status/protocolo de uma NF-e na SEFAZ pela chave de acesso.
 *
 * @param chave    Chave de acesso de 44 dígitos.
 * @param ambiente "1" = Produção, "2" = Homologação.
 * @param urlSefaz Endpoint do serviço NFeConsultaProtocolo4 da UF.
 */
export async function consultarNFe(
  chave: string,
  ambiente: AmbienteSefaz,
  urlSefaz: string,
): Promise<ConsultaResult> {
  const chaveLimpa = String(chave ?? "").replace(/\D/g, "");
  if (chaveLimpa.length !== 44) {
    return {
      sucesso: false,
      motivo: "Chave de acesso inválida — exige 44 dígitos numéricos.",
    };
  }
  if (ambiente !== "1" && ambiente !== "2") {
    return {
      sucesso: false,
      motivo:
        "Ambiente SEFAZ inválido — informe '1' (Produção) ou '2' (Homologação).",
    };
  }
  if (!urlSefaz) {
    return {
      sucesso: false,
      motivo:
        "Endpoint SEFAZ não resolvido — verifique a UF da empresa em Configuração Fiscal.",
    };
  }

  const xml =
    `<consSitNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<tpAmb>${ambiente}</tpAmb>` +
    `<xServ>CONSULTAR</xServ>` +
    `<chNFe>${chaveLimpa}</chNFe>` +
    `</consSitNFe>`;

  const resposta = await enviarParaSefazSemAssinatura(
    xml,
    urlSefaz,
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF",
  );

  if (!resposta.sucesso) {
    return { sucesso: false, motivo: resposta.erro };
  }

  const xmlRetorno = resposta.xmlRetorno ?? "";
  const ret = extrair("retConsSitNFe", xmlRetorno) ?? xmlRetorno;
  const status = extrair("cStat", ret);
  const motivo = extrair("xMotivo", ret);
  const protocolo = extrair("nProt", ret);
  const dataAutorizacao = extrair("dhRecbto", ret);
  const tpAmb = extrair("tpAmb", ret);

  return {
    sucesso: true,
    status,
    protocolo,
    dataAutorizacao,
    motivo,
    tpAmb,
    xmlRetorno,
  };
}
