import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRemessas } from "@/services/logistica/remessas.service";
import type { Remessa } from "@/services/logistica/remessas.service";

export { useRemessas };
export type { Remessa };

export function useRemessaEventos(remessaId: string | null) {
  return useQuery({
    queryKey: ["remessa-eventos", remessaId],
    queryFn: async () => {
      if (!remessaId) return [];
      const { data, error } = await supabase
        .from("remessa_eventos")
        .select("*")
        .eq("remessa_id", remessaId)
        .order("data_hora", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!remessaId,
    staleTime: 30 * 1000,
  });
}
