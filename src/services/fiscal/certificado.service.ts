/**
 * Serviço de gerenciamento de certificado digital A1/A3.
 * A leitura real do certificado PFX é feita via Edge Function sefaz-proxy
 * usando node-forge server-side.
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
 * Converte um File para base64 (sem o prefixo data:...).
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Lê os metadados de um certificado A1 (arquivo .pfx/.p12).
 * Envia o arquivo para a Edge Function sefaz-proxy que faz o parsing
 * real com node-forge e retorna CNPJ, razão social e datas de validade.
 */
export async function lerCertificadoA1(
  arquivo: File,
  senha: string,
): Promise<CertificadoInfo> {
  const base64 = await fileToBase64(arquivo);

  const { data, error } = await supabase.functions.invoke("sefaz-proxy", {
    body: { action: "parse-certificado", certificado_base64: base64, senha },
  });

  if (error) {
    throw new Error(`Erro ao ler certificado: ${error.message}`);
  }

  if (!data || typeof data !== "object") {
    throw new Error("Certificado inválido ou senha incorreta.");
  }

  // Validar que temos os campos esperados
  if (data.error) {
    throw new Error(data.error);
  }

  return data as CertificadoInfo;
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
