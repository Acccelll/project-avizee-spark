/**
 * Serviço de configuração da empresa — operações sobre `empresa_config` e
 * `app_configuracoes`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type EmpresaConfig = Database["public"]["Tables"]["empresa_config"]["Row"];
export type EmpresaConfigUpdate =
  Database["public"]["Tables"]["empresa_config"]["Update"];

/** Busca a configuração da empresa (sempre existe uma única linha). */
export async function fetchEmpresaConfig(): Promise<EmpresaConfig | null> {
  const { data, error } = await supabase
    .from("empresa_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Salva a configuração da empresa (upsert). */
export async function saveEmpresaConfig(
  config: EmpresaConfigUpdate & { id?: string }
): Promise<EmpresaConfig> {
  if (config.id) {
    const { data, error } = await supabase
      .from("empresa_config")
      .update(config)
      .eq("id", config.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("empresa_config")
    .insert(config as Database["public"]["Tables"]["empresa_config"]["Insert"])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export type AppConfigChave = "email" | "fiscal" | "financeiro" | "geral" | "usuarios";

/** Busca uma configuração do sistema por chave. */
export async function fetchAppConfig(chave: AppConfigChave): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("app_configuracoes")
    .select("valor")
    .eq("chave", chave)
    .maybeSingle();

  if (error) throw error;
  return (data?.valor as Record<string, unknown>) ?? {};
}

/** Salva uma configuração do sistema (upsert por chave). */
export async function saveAppConfig(
  chave: AppConfigChave,
  valor: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("app_configuracoes")
    .upsert({ chave, valor }, { onConflict: "chave" });

  if (error) throw error;
}
