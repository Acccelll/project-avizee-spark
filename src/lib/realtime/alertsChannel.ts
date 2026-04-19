import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Singleton realtime channel for sidebar/notifications alerts.
 *
 * Multiple hooks (useSidebarAlerts, NotificationsPanel) need to react to changes
 * in financeiro_lancamentos and orcamentos. Without a singleton, each consumer
 * (and each StrictMode double-mount) would open its own channel, multiplying
 * Supabase realtime connections unnecessarily.
 *
 * This module exposes one shared channel and a Set of subscribers. Each consumer
 * registers a callback, the first call subscribes, the last call cleans up.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;

function broadcast() {
  for (const cb of listeners) {
    try {
      cb();
    } catch (err) {
      console.error("[alerts-channel] listener threw:", err);
    }
  }
}

function ensureChannel() {
  if (channel) return;
  channel = supabase
    .channel("sidebar-alerts-shared")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "financeiro_lancamentos" },
      broadcast,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orcamentos" },
      broadcast,
    )
    .subscribe();
}

/**
 * Subscribe a callback to the shared alerts channel.
 * Returns an unsubscribe function — call it on cleanup.
 */
export function subscribeAlerts(listener: Listener): () => void {
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
