import { useEffect, useCallback, useState } from "react";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useSyncedStorage } from "./useSyncedStorage";
import { enqueueSync, processSyncQueue } from "@/services/syncQueue";
import { useOnlineStatus } from "./useOnlineStatus";
import { getAppConfig, upsertAppConfig } from "@/services/appConfig.service";

const REMOTE_TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: PromiseLike<T>) {
  return Promise.race<T>([
    Promise.resolve(promise),
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
    const { data } = await getAppConfig(chave);
    if (data?.valor !== undefined) {
      setCache(data.valor as T);
    }
  }, [chave, setCache]);

  useEffect(() => {
    reloadFromSupabase().finally(() => setLoading(false));
  }, [reloadFromSupabase]);

  useEffect(() => {
    const flush = async () => {
      if (!isOnline) return;
      await processSyncQueue(async (item) => {
        if (item.scope !== "appconfig" || item.key !== chave) return false;
        const { error } = await upsertAppConfig(item.key, item.value as Json);
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

      if (!isOnline) {
        enqueueSync({ scope: "appconfig", key: chave, value: newValue, prevValue: previous });
        return true;
      }

      const submit = async () => {
        const res = await withTimeout(
          upsertAppConfig(chave, newValue as unknown as Json),
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
    [value, getMeta, setCache, isOnline, chave, reloadFromSupabase],
  );

  return { value, loading, save, reloadFromSupabase };
}
