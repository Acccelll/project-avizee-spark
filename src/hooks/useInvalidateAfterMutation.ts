import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * useInvalidateAfterMutation — helper para invalidar React Query caches
 * depois de mutações feitas dentro das Views relacionais.
 *
 * Bug histórico: as Views faziam `delete()` direto no Supabase e fechavam o
 * drawer com `clearStack()`, mas a listagem (que usa React Query / `useSupabaseCrud`)
 * continuava mostrando o item morto até refetch manual. O usuário voltava
 * para a grid e via o registro como se nada tivesse acontecido.
 *
 * Uso:
 * ```ts
 * const invalidate = useInvalidateAfterMutation();
 * await supabase.from("clientes").delete().eq("id", id);
 * await invalidate(["clientes"]);
 * ```
 *
 * Aceita uma ou várias keys — cada chave passa por `invalidateQueries({ queryKey })`.
 */
export function useInvalidateAfterMutation() {
  const qc = useQueryClient();

  return useCallback(
    async (keys: ReadonlyArray<string | readonly unknown[]>) => {
      const tasks = keys.map((k) => {
        const queryKey = Array.isArray(k) ? (k as readonly unknown[]) : [k];
        return qc.invalidateQueries({ queryKey });
      });
      await Promise.all(tasks);
    },
    [qc],
  );
}
