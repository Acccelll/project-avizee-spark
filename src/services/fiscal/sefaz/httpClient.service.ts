/**
 * Cliente HTTP para comunicação com a SEFAZ via Edge Function sefaz-proxy.
 * A assinatura digital e o envio SOAP são feitos server-side na Edge Function.
 * Suporta retry automático e timeout configurável.
 */

import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

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
 *
 * Se `certificado` for omitido, usa a action `assinar-e-enviar-vault`, que lê o
 * .pfx do Storage privado e a senha do secret `CERTIFICADO_PFX_SENHA` server-side.
 * Esta é a forma RECOMENDADA — não envie credenciais do client.
 */
export async function enviarParaSefaz(
  xml: string,
  url: string,
  soapAction: string,
  certificado: SefazCertificado | null,
  options: SefazRequestOptions = {},
): Promise<SefazResponse> {
  const tentativas = options.tentativas ?? TENTATIVAS_PADRAO;

  let ultimoErro = "Erro desconhecido";

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      const body = certificado
        ? {
            action: "assinar-e-enviar",
            xml,
            url,
            soapAction,
            certificado_base64: certificado.certificado_base64,
            certificado_senha: certificado.certificado_senha,
          }
        : {
            action: "assinar-e-enviar-vault",
            xml,
            url,
            soapAction,
          };

      const { data, error } = await supabase.functions.invoke("sefaz-proxy", { body });

      if (error) {
        // 404 = Edge Function não deployada → falha imediata e amigável (sem retry).
        const status =
          error instanceof FunctionsHttpError
            ? (error.context as Response | undefined)?.status
            : (error as { context?: { status?: number } }).context?.status;

        if (status === 404) {
          return {
            sucesso: false,
            erro:
              "Serviço de emissão fiscal não está disponível. Contate o suporte técnico (sefaz-proxy não deployado).",
            statusHttp: 404,
          };
        }

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
