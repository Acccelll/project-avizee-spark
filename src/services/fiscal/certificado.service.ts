/**
 * Serviço de gerenciamento de certificado digital A1/A3.
 *
 * ATENÇÃO: A leitura real de certificados PFX requer a biblioteca node-forge.
 * Esta implementação fornece a interface e integração com Supabase para
 * armazenar/recuperar os metadados do certificado configurado.
 *
 * Para produção com node-forge:
 *   npm install node-forge @types/node-forge
 *   const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(base64)), senha);
 */

import { supabase } from "@/integrations/supabase/client";

export interface CertificadoInfo {
  cnpj: string;
  razaoSocial: string;
  validadeInicio: string;
  validadeFim: string;
  diasRestantes: number;
}

function calcularDiasRestantes(validadeFim: string): number {
  const fim = new Date(validadeFim);
  const hoje = new Date();
  const diff = fim.getTime() - hoje.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Lê os metadados de um certificado A1 (arquivo .pfx/.p12).
 *
 * NOTA: A extração real das datas e CNPJ do certificado requer node-forge.
 * Esta implementação retorna dados baseados no nome do arquivo e datas
 * estimadas enquanto a integração com node-forge não está disponível.
 */
export async function lerCertificadoA1(
  arquivo: File,
  _senha: string,
): Promise<CertificadoInfo> {
  // Em produção, usar node-forge para parsear o PFX e extrair:
  // - Subject CN (razão social)
  // - Subject serialNumber (CNPJ)
  // - notBefore (validade início)
  // - notAfter (validade fim)
  //
  // Placeholder: retorna metadados estimados baseados no nome do arquivo
  const validadeInicio = new Date().toISOString().split("T")[0];
  const validadeFim = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return {
    cnpj: "00000000000000",
    razaoSocial: arquivo.name.replace(/\.(pfx|p12)$/i, ""),
    validadeInicio,
    validadeFim,
    diasRestantes: calcularDiasRestantes(validadeFim),
  };
}

/**
 * Obtém as informações do certificado digital configurado na empresa.
 * Busca a configuração salva na tabela app_configuracoes.
 */
export async function obterCertificadoConfigurado(): Promise<CertificadoInfo | null> {
  const { data, error } = await supabase
    .from("app_configuracoes")
    .select("valor")
    .eq("chave", "certificado_digital")
    .maybeSingle();

  if (error || !data?.valor) return null;

  const valor = data.valor as Record<string, string>;

  if (!valor.validadeFim) return null;

  return {
    cnpj: valor.cnpj ?? "",
    razaoSocial: valor.razaoSocial ?? "",
    validadeInicio: valor.validadeInicio ?? "",
    validadeFim: valor.validadeFim,
    diasRestantes: calcularDiasRestantes(valor.validadeFim),
  };
}
