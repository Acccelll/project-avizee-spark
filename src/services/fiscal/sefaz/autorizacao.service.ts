/**
 * Serviço de autorização de NF-e junto à SEFAZ.
 * A assinatura digital é realizada server-side na Edge Function sefaz-proxy.
 */

import { construirXMLNFe } from "./xmlBuilder.service";
import type { NFeData, CRT, AmbienteSefaz } from "./xmlBuilder.service";
import type { CertificadoDigital } from "./assinaturaDigital.service";
import { enviarParaSefaz } from "./httpClient.service";
import { supabase } from "@/integrations/supabase/client";

export interface AutorizacaoResult {
  sucesso: boolean;
  protocolo?: string;
  chave?: string;
  xmlAutorizado?: string;
  status?: string;
  motivo?: string;
}

/**
 * Lê `crt` e `ambiente_sefaz` da tabela `empresa_config`. Quando ausentes,
 * usa defaults seguros: Simples Nacional ("1") e Homologação ("2").
 *
 * Retorna `null` se a consulta falhar — caller deve usar valores fornecidos
 * em `dadosNFe` ou abortar com mensagem clara.
 */
export async function lerConfigFiscalEmpresa(): Promise<{
  crt: CRT;
  ambiente: AmbienteSefaz;
} | null> {
  try {
    const { data, error } = await supabase
      .from("empresa_config")
      .select("crt, ambiente_sefaz, ambiente_padrao")
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;

    const crt = ((data.crt ?? "1") as CRT);
    // Preferência: ambiente_sefaz (formato SEFAZ "1"/"2"); fallback derivado
    // de ambiente_padrao ("producao"|"homologacao") para retrocompatibilidade.
    let ambiente: AmbienteSefaz = "2";
    const ambienteSefazRaw = (data as { ambiente_sefaz?: string | null }).ambiente_sefaz;
    if (ambienteSefazRaw === "1" || ambienteSefazRaw === "2") {
      ambiente = ambienteSefazRaw;
    } else if (data.ambiente_padrao === "producao") {
      ambiente = "1";
    }
    return { crt, ambiente };
  } catch {
    return null;
  }
}

/**
 * Autoriza uma NF-e junto à SEFAZ.
 * Orquestra: construção do XML → envio (com assinatura server-side) → parseamento do retorno.
 *
 * Se `dadosNFe.crt` ou `dadosNFe.ambiente` não vierem definidos, lê os
 * valores de `empresa_config` para garantir XML válido.
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

  // Sem credenciais explícitas → modo Vault (padrão recomendado).
  // O sefaz-proxy lerá .pfx do Storage e a senha do secret server-side.

  // Garante que crt e ambiente reflitam a configuração da empresa quando
  // não vieram explicitamente em dadosNFe.
  let dadosCompletos = dadosNFe;
  if (!dadosNFe.crt || !dadosNFe.ambiente) {
    const config = await lerConfigFiscalEmpresa();
    dadosCompletos = {
      ...dadosNFe,
      crt: dadosNFe.crt ?? config?.crt ?? "1",
      ambiente: dadosNFe.ambiente ?? config?.ambiente ?? "2",
    };
  }

  const xmlNFe = construirXMLNFe(dadosCompletos);

  // Assinatura + envio são feitos na Edge Function sefaz-proxy.
  // Padrão Vault: certificado e senha são lidos server-side (Storage privado +
  // secret CERTIFICADO_PFX_SENHA). Mantemos o objeto como fallback caso o
  // caller queira injetar credenciais explicitamente (não recomendado).
  const useVault = !certificado.conteudo || !certificado.senha;
  const resposta = await enviarParaSefaz(
    xmlNFe,
    urlSefaz,
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote",
    useVault
      ? null
      : {
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
    chave: dadosCompletos.chave,
    xmlAutorizado: autorizado ? xmlRetorno : undefined,
    status,
    motivo,
  };
}
