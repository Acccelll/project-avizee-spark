import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Singleton realtime channel para o módulo Comercial.
 *
 * Escuta mudanças em `ordens_venda` e `notas_fiscais` (publicação
 * `supabase_realtime`) e dispara callbacks registrados.
 *
 * Uso típico em telas:
 * ```ts
 * useEffect(() => subscribeComercial(() => qc.invalidateQueries({ queryKey: ["ordens_venda"] })), [qc]);
 * ```
 *
 * Por que singleton: múltiplas telas (Pedidos grid, OrdemVendaView drawer,
 * Fiscal grid) precisam reagir aos mesmos eventos. Sem singleton cada
 * consumidor abriria seu próprio canal — multiplicando conexões em
 * desenvolvimento (StrictMode) e produção.
 */

type Listener = (table: "ordens_venda" | "notas_fiscais") => void;

const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;

function broadcast(table: "ordens_venda" | "notas_fiscais") {
  for (const cb of listeners) {
    try {
      cb(table);
    } catch (err) {
      console.error("[comercial-channel] listener threw:", err);
    }
  }
}

function ensureChannel() {
  if (channel) return;
  channel = supabase
    .channel("comercial-shared")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ordens_venda" },
      () => broadcast("ordens_venda"),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notas_fiscais" },
      () => broadcast("notas_fiscais"),
    )
    .subscribe();
}

/**
 * Inscreve um callback no canal compartilhado do Comercial.
 * Retorna função de cleanup — chame no `useEffect` return.
 */
export function subscribeComercial(listener: Listener): () => void {
  listeners.add(listener);
  ensureChannel();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  };
}