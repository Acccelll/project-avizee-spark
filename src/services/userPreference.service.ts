import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export async function getUserPreference(userId: string, moduleKey: string) {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("columns_config, updated_at")
    .eq("user_id", userId)
    .eq("module_key", moduleKey)
    .maybeSingle();
  return { data, error };
}

export async function upsertUserPreference(input: {
  userId: string;
  moduleKey: string;
  value: Json;
}) {
  return supabase.from("user_preferences").upsert(
    {
      user_id: input.userId,
      module_key: input.moduleKey,
      columns_config: input.value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,module_key" },
  );
}