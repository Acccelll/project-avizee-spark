/**
 * Cliente HTTP para comunicação com a SEFAZ via SOAP.
 * Suporta retry automático e timeout configurável.
 */

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

const TIMEOUT_PADRAO = 30_000;
const TENTATIVAS_PADRAO = 3;

/**
 * Envia um XML assinado para a SEFAZ via SOAP e retorna o XML de retorno.
 * Realiza retry automático em caso de falha de rede ou timeout.
 */
export async function enviarParaSefaz(
  xml: string,
  url: string,
  soapAction: string,
  options: SefazRequestOptions = {},
): Promise<SefazResponse> {
  const timeoutMs = options.timeoutMs ?? TIMEOUT_PADRAO;
  const tentativas = options.tentativas ?? TENTATIVAS_PADRAO;

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl">
  <soapenv:Header/>
  <soapenv:Body>
    <nfe:nfeDadosMsg>${xml}</nfe:nfeDadosMsg>
  </soapenv:Body>
</soapenv:Envelope>`;

  let ultimoErro: string = "Erro desconhecido";

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: soapAction,
        },
        body: envelope,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const xmlRetorno = await response.text();

      if (!response.ok) {
        ultimoErro = `HTTP ${response.status}: ${response.statusText}`;
        if (tentativa < tentativas) continue;
        return { sucesso: false, erro: ultimoErro, statusHttp: response.status };
      }

      return { sucesso: true, xmlRetorno, statusHttp: response.status };
    } catch (err) {
      ultimoErro =
        err instanceof Error
          ? err.name === "AbortError"
            ? `Timeout após ${timeoutMs}ms (tentativa ${tentativa}/${tentativas})`
            : err.message
          : String(err);

      if (tentativa < tentativas) {
        // Aguarda exponencial antes do próximo retry
        await new Promise((r) => setTimeout(r, 1000 * tentativa));
        continue;
      }
    }
  }

  return { sucesso: false, erro: ultimoErro };
}
