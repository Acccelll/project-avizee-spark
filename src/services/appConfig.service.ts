import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export async function getAppConfig(chave: string) {
  return supabase.from("app_configuracoes").select("valor").eq("chave", chave).maybeSingle();
}

export async function upsertAppConfig(chave: string, valor: Json) {
  return supabase
    .from("app_configuracoes")
    .upsert({ chave, valor, updated_at: new Date().toISOString() }, { onConflict: "chave" });
}