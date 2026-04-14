/**
 * Cliente HTTP para comunicação com a SEFAZ via Edge Function sefaz-proxy.
 * A assinatura digital e o envio SOAP são feitos server-side na Edge Function.
 * Suporta retry automático e timeout configurável.
 */

import { supabase } from "@/integrations/supabase/client";

export interface SefazResponse {
  sucesso: boolean;
  xmlRetorno?: string;
  erro?: string;
  statusHttp?: number;
}

export interface SefazRequestOptions {
  timeoutMs?: number;
  tentativas?: number;
}

export interface SefazCertificado {
  certificado_base64: string;
  certificado_senha: string;
}

const TENTATIVAS_PADRAO = 3;

/**
 * Envia um XML para a SEFAZ via Edge Function sefaz-proxy.
 * A Edge Function assina o XML com o certificado A1 e envia para a SEFAZ via SOAP.
 * Realiza retry automático em caso de falha.
 */
export async function enviarParaSefaz(
  xml: string,
  url: string,
  soapAction: string,
  certificado: SefazCertificado,
  options: SefazRequestOptions = {},
): Promise<SefazResponse> {
  const tentativas = options.tentativas ?? TENTATIVAS_PADRAO;

  let ultimoErro = "Erro desconhecido";

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      const { data, error } = await supabase.functions.invoke("sefaz-proxy", {
        body: {
          action: "assinar-e-enviar",
          xml,
          url,
          soapAction,
          certificado_base64: certificado.certificado_base64,
          certificado_senha: certificado.certificado_senha,
        },
      });

      if (error) {
        ultimoErro = error.message ?? "Erro na Edge Function sefaz-proxy";
        if (tentativa < tentativas) {
          await new Promise((r) => setTimeout(r, 1000 * tentativa));
          continue;
        }
        return { sucesso: false, erro: ultimoErro };
      }

      // A Edge Function retorna { sucesso, xmlRetorno?, erro? }
      if (data && typeof data === "object") {
        return {
          sucesso: data.sucesso ?? false,
          xmlRetorno: data.xmlRetorno,
          erro: data.erro,
        };
      }

      return { sucesso: false, erro: "Resposta inesperada da Edge Function" };
    } catch (err) {
      ultimoErro =
        err instanceof Error
          ? `Tentativa ${tentativa}/${tentativas}: ${err.message}`
          : String(err);

      if (tentativa < tentativas) {
        await new Promise((r) => setTimeout(r, 1000 * tentativa));
        continue;
      }
    }
  }

  return { sucesso: false, erro: ultimoErro };
}
