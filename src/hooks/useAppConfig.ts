import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useSyncedStorage } from "./useSyncedStorage";
import { enqueueSync, processSyncQueue } from "@/services/syncQueue";
import { useOnlineStatus } from "./useOnlineStatus";

const REMOTE_TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("sync_timeout")), REMOTE_TIMEOUT_MS)),
  ]);
}

export function useAppConfig<T = Json>(chave: string, defaultValue?: T) {
  const isOnline = useOnlineStatus();
  const { value, set: setCache, getMeta } = useSyncedStorage<T | null>(
    chave,
    defaultValue ?? null,
    {
      namespace: "appconfig",
      onRemoteSyncError: () => {
        toast.error("Inconsistência detectada. Recarregando configuração do servidor...");
      },
    },
  );
  const [loading, setLoading] = useState(true);

  const reloadFromSupabase = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("app_configuracoes").select("valor").eq("chave", chave).maybeSingle();
    if (data?.valor !== undefined) {
      setCache(data.valor as T);
    }
  }, [chave, setCache]);

  useEffect(() => {
    reloadFromSupabase().finally(() => setLoading(false));
  }, [reloadFromSupabase]);

  useEffect(() => {
    const flush = async () => {
      if (!isOnline || !supabase) return;
      await processSyncQueue(async (item) => {
        if (item.scope !== "appconfig" || item.key !== chave) return false;
        const { error } = await supabase
          .from("app_configuracoes")
          .upsert({ chave: item.key, valor: item.value as Json, updated_at: new Date().toISOString() }, { onConflict: "chave" });
        return !error;
      });
      await reloadFromSupabase();
    };

    flush();
  }, [isOnline, chave, reloadFromSupabase]);

  const save = useCallback(
    async (newValue: T) => {
      const previous = value;
      const meta = getMeta();
      setCache(newValue);

      if (!supabase || !isOnline) {
        enqueueSync({ scope: "appconfig", key: chave, value: newValue, prevValue: previous });
        return true;
      }

      const submit = async () => {
        const res = await withTimeout(
          new Promise<{ error: any }>((resolve) => {
            supabase
              .from("app_configuracoes")
              .upsert({ chave, valor: newValue as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "chave" })
              .then(r => resolve(r));
          }),
        );
        const error = res?.error;

        if (error) {
          setCache(previous as T);
          enqueueSync({ scope: "appconfig", key: chave, value: newValue, prevValue: previous });
          toast.error(`Falha ao salvar '${chave}'.`, {
            action: { label: "Tentar novamente", onClick: () => void submit() },
          });
          return false;
        }

        const latestMeta = getMeta();
        if (latestMeta.revision < meta.revision) {
          await reloadFromSupabase();
        }

        return true;
      };

      return submit();
    },
    [value, getMeta, setCache, supabase, isOnline, chave, reloadFromSupabase],
  );

  return { value, loading, save, reloadFromSupabase };
}
