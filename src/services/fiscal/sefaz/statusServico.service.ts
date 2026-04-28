/**
 * Consulta de Status do Serviço SEFAZ (cStat 107 = "Em Operação").
 * Usa o sefaz-proxy em modo Vault — não envia credenciais do client.
 *
 * Códigos típicos:
 *  - 107 → Em Operação (verde)
 *  - 108 → Paralisado Momentaneamente (amarelo)
 *  - 109 → Paralisado sem previsão (vermelho)
 *  - demais → tratado como "indisponível"
 */

import { enviarParaSefaz } from "./httpClient.service";
import type { AmbienteSefaz } from "./xmlBuilder.service";

export interface StatusServicoResult {
  sucesso: boolean;
  cStat?: string;
  motivo?: string;
  tpAmb?: string;
  cUF?: string;
  dhRecbto?: string;
  tMed?: string;
  emOperacao: boolean;
  paralisado: boolean;
  erro?: string;
}

/** Tabela de códigos IBGE de UF (cUF) — usados no XML de consulta. */
const CUF_MAP: Record<string, string> = {
  AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53",
  ES: "32", GO: "52", MA: "21", MT: "51", MS: "50", MG: "31", PA: "15",
  PB: "25", PR: "41", PE: "26", PI: "22", RJ: "33", RN: "24", RS: "43",
  RO: "11", RR: "14", SC: "42", SP: "35", SE: "28", TO: "17",
};

export function construirXMLConsultaStatus(
  uf: string,
  ambiente: AmbienteSefaz,
): string {
  const cUF = CUF_MAP[uf.toUpperCase()] ?? "35";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">` +
    `<tpAmb>${ambiente}</tpAmb>` +
    `<cUF>${cUF}</cUF>` +
    `<xServ>STATUS</xServ>` +
    `</consStatServ>`
  );
}

function extrair(tag: string, xml: string): string | undefined {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i").exec(xml);
  return m?.[1];
}

export async function consultarStatusServico(
  uf: string,
  ambiente: AmbienteSefaz,
  url: string,
): Promise<StatusServicoResult> {
  const xml = construirXMLConsultaStatus(uf, ambiente);
  const resp = await enviarParaSefaz(
    xml,
    url,
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF",
    null,
    { tentativas: 1 },
  );

  if (!resp.sucesso || !resp.xmlRetorno) {
    return {
      sucesso: false,
      emOperacao: false,
      paralisado: false,
      erro: resp.erro ?? "Sem resposta da SEFAZ",
    };
  }
  const cStat = extrair("cStat", resp.xmlRetorno);
  const motivo = extrair("xMotivo", resp.xmlRetorno);
  const tpAmb = extrair("tpAmb", resp.xmlRetorno);
  const cUF = extrair("cUF", resp.xmlRetorno);
  const dhRecbto = extrair("dhRecbto", resp.xmlRetorno);
  const tMed = extrair("tMed", resp.xmlRetorno);
  return {
    sucesso: true,
    cStat,
    motivo,
    tpAmb,
    cUF,
    dhRecbto,
    tMed,
    emOperacao: cStat === "107",
    paralisado: cStat === "108" || cStat === "109",
  };
}