/**
 * Tipos para assinatura digital de documentos fiscais.
 *
 * A assinatura digital real (RSA-SHA1, xmldsig) é realizada na Edge Function
 * `sefaz-proxy` usando node-forge. Este módulo mantém apenas as interfaces
 * para compatibilidade com o restante do sistema.
 *
 * A função `assinarXML()` foi removida — a assinatura ocorre server-side
 * na Edge Function, integrada ao fluxo de envio para a SEFAZ.
 */

export interface CertificadoDigital {
  tipo: "A1" | "A3";
  /** Conteúdo base64 do arquivo .pfx para certificado A1. */
  conteudo?: string;
  senha?: string;
}

export interface AssinaturaResult {
  xmlAssinado: string;
  sucesso: boolean;
  erro?: string;
}
