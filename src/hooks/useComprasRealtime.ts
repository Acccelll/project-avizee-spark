import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";

/**
 * Realtime cross-módulo do fluxo de Compras.
 *
 * Escuta mudanças em `cotacoes_compra`, `pedidos_compra` e
 * `estoque_movimentos` (que sinaliza recebimentos) e invalida as
 * queries do React Query relevantes.
 *
 * Uso (idealmente apenas nas páginas-grid para não duplicar listeners):
 * ```ts
 * useComprasRealtime();
 * ```
 *
 * Os mapeamentos seguem `INVALIDATION_KEYS` para manter coerência com
 * as chamadas síncronas (ver CONTRACTS.md).
 */
export function useComprasRealtime(enabled = true): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const invalidate = (keys: readonly string[]) => {
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    };

    const channel = supabase
      .channel("compras-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos_compra" },
        () => invalidate(INVALIDATION_KEYS.geracaoPedidoCompra),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cotacoes_compra" },
        () => invalidate(INVALIDATION_KEYS.geracaoPedidoCompra),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "estoque_movimentos" },
        (payload) => {
          const row = payload.new as { documento_tipo?: string | null } | null;
          if (!row) return;
          if (row.documento_tipo === "pedido_compra") {
            invalidate(INVALIDATION_KEYS.recebimentoCompra);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);
}