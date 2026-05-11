import { supabase } from "@/integrations/supabase/client";

/**
 * Registra feedback do usuário sobre uma página de ajuda.
 * Lança erro — caller decide UX (toast).
 */
export async function submitHelpFeedback(
  userId: string,
  route: string,
  helpful: boolean,
): Promise<void> {
  const { error } = await supabase.from("help_feedback").insert({
    user_id: userId,
    route,
    helpful,
  });
  if (error) throw error;
}
