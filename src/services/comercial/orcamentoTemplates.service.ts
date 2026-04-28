import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { TemplateConfig } from "@/types/orcamento";

export const TEAM_TEMPLATE_KEY = "orcamento_template:shared";

export interface OrcamentoTemplate {
  id: string;
  nome: string;
  escopo: "usuario" | "equipe";
  payload: TemplateConfig;
}

/** Carrega templates do usuário + templates de equipe. */
export async function listOrcamentoTemplates(userId: string): Promise<OrcamentoTemplate[]> {
  const { data, error } = await supabase
    .from("app_configuracoes")
    .select("valor, chave")
    .or(`chave.like.orcamento_template:${userId}:%,chave.like.${TEAM_TEMPLATE_KEY}:%`);
  if (error) throw error;
  return (data || [])
    .map((row) => row.valor as unknown as OrcamentoTemplate | null)
    .filter((row): row is OrcamentoTemplate => !!row?.id && !!row?.nome && !!row?.payload);
}

/** Verifica se já existe template de equipe com a chave informada. */
export async function existsTeamTemplate(key: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("app_configuracoes")
    .select("chave")
    .eq("chave", key)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export function buildTemplateKey(input: {
  escopo: "usuario" | "equipe";
  nome: string;
  userId: string;
}): string {
  return input.escopo === "equipe"
    ? `${TEAM_TEMPLATE_KEY}:${input.nome}`
    : `orcamento_template:${input.userId}:${input.nome}`;
}

/** Faz upsert do template em `app_configuracoes`. */
export async function upsertOrcamentoTemplate(record: OrcamentoTemplate): Promise<void> {
  const { error } = await supabase.from("app_configuracoes").upsert(
    { chave: record.id, valor: record as unknown as Json, updated_at: new Date().toISOString() },
    { onConflict: "chave" },
  );
  if (error) throw error;
}