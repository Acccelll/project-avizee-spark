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

/* ─────────────────────────────────────────────────────────────────
 * Upload seguro do certificado A1
 * ────────────────────────────────────────────────────────────────*/

const STORAGE_BUCKET = "dbavizee";
const STORAGE_PATH = "certificados/empresa.pfx";
const VAULT_SECRET_NAME = "CERTIFICADO_PFX_SENHA";
const APP_CONFIG_KEY = "certificado_digital";

/**
 * Persiste o .pfx no Storage privado, salva a senha no Vault e atualiza os
 * metadados em `app_configuracoes`. Devolve o `CertificadoInfo` calculado.
 *
 * - Storage: bucket `dbavizee`, path fixo `certificados/empresa.pfx`.
 *   A edge function `sefaz-proxy` (action `assinar-e-enviar-vault`) lê
 *   exatamente desse caminho.
 * - Senha: gravada via RPC `salvar_secret_vault` (admin-only). A senha
 *   nunca volta para o client depois de salva.
 */
export async function uploadCertificadoA1(
  arquivo: File,
  senha: string,
): Promise<CertificadoInfo> {
  // 1. Lê metadados via edge function (valida senha + arquivo).
  const info = await lerCertificadoA1(arquivo, senha);

  // 2. Sobe o .pfx para o Storage privado.
  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(STORAGE_PATH, arquivo, {
      upsert: true,
      contentType: "application/x-pkcs12",
    });
  if (upErr) throw new Error(`Falha ao enviar certificado: ${upErr.message}`);

  // 3. Persiste senha no Vault.
  const { error: vaultErr } = await supabase.rpc("salvar_secret_vault", {
    p_name: VAULT_SECRET_NAME,
    p_secret: senha,
  });
  if (vaultErr) throw new Error(`Falha ao salvar senha no cofre: ${vaultErr.message}`);

  // 4. Atualiza metadados (sem senha, sem .pfx).
  const { error: cfgErr } = await supabase.from("app_configuracoes").upsert(
    {
      chave: APP_CONFIG_KEY,
      valor: {
        cnpj: info.cnpj,
        razaoSocial: info.razaoSocial,
        validadeInicio: info.validadeInicio,
        validadeFim: info.validadeFim,
        atualizadoEm: new Date().toISOString(),
        storagePath: `${STORAGE_BUCKET}/${STORAGE_PATH}`,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "chave" },
  );
  if (cfgErr) throw new Error(`Falha ao gravar metadados: ${cfgErr.message}`);

  return info;
}

export async function removerCertificadoA1(): Promise<void> {
  await supabase.storage.from(STORAGE_BUCKET).remove([STORAGE_PATH]);
  await supabase.rpc("remover_secret_vault", { p_name: VAULT_SECRET_NAME });
  await supabase.from("app_configuracoes").delete().eq("chave", APP_CONFIG_KEY);
}
