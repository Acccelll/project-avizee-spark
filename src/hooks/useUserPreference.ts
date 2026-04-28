import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useSyncedStorage, buildSyncedStorageKey } from './useSyncedStorage';
import { enqueueSync, processSyncQueue } from '@/services/syncQueue';
import { useOnlineStatus } from './useOnlineStatus';
import { getUserPreference, upsertUserPreference } from '@/services/userPreference.service';

/**
 * useUserPreference
 *
 * Persists per-user preferences in the dedicated `user_preferences` table
 * (one row per user_id + module_key). RLS guarantees each user only reads
 * and writes their own rows.
 *
 * Offline behavior: when the remote persist fails or the user is offline, the
 * preference is updated locally and queued for retry on the next successful
 * connection. A toast informs the user that persistence is pending.
 */

const PREFIX = 'erp-user-pref';
const REMOTE_TIMEOUT_MS = 8000;

function buildStorageKey(userId: string | null | undefined, preferenceKey: string) {
  return `${PREFIX}:${userId ?? 'anon'}:${preferenceKey}`;
}

async function withTimeout<T>(promise: PromiseLike<T>) {
  return Promise.race<T>([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('sync_timeout')), REMOTE_TIMEOUT_MS)),
  ]);
}

export function useUserPreference<T = Json>(userId: string | null | undefined, preferenceKey: string, defaultValue: T) {
  const isOnline = useOnlineStatus();
  const namespace = useMemo(() => `user-pref:${userId ?? 'anon'}`, [userId]);

  const { value, set: setCache, getMeta } = useSyncedStorage<T>(preferenceKey, defaultValue, {
    namespace,
    onRemoteSyncError: () => {
      toast.warning(`Preferência '${preferenceKey}' pode estar desatualizada entre abas.`);
    },
  });
  const [loading, setLoading] = useState(true);

  const legacyKey = useMemo(() => buildStorageKey(userId, preferenceKey), [userId, preferenceKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(legacyKey);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        const newKey = buildSyncedStorageKey(namespace, preferenceKey);
        if (localStorage.getItem(newKey) === null) {
          setCache(parsed);
        }
        localStorage.removeItem(legacyKey);
      }
    } catch {
      // ignore
    }
  }, [legacyKey, namespace, preferenceKey, setCache]);

  const reloadFromSupabase = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await getUserPreference(userId, preferenceKey);

    if (!error && data?.columns_config !== undefined && data?.columns_config !== null) {
      setCache(data.columns_config as unknown as T);
    }
  }, [userId, preferenceKey, setCache]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    reloadFromSupabase().finally(() => setLoading(false));
  }, [userId, reloadFromSupabase]);

  useEffect(() => {
    const flush = async () => {
      if (!isOnline || !userId) return;
      await processSyncQueue(async (item) => {
        if (item.scope !== 'userpref') return false;
        const [, uId, mKey] = item.key.split(':');
        if (!uId || !mKey) return true;
        const { error } = await upsertUserPreference({
          userId: uId,
          moduleKey: mKey,
          value: item.value as Json,
        });
        return !error;
      });
      await reloadFromSupabase();
    };
    flush();
  }, [isOnline, userId, reloadFromSupabase]);

  const save = useCallback(
    async (nextValue: T) => {
      const previous = value;
      const meta = getMeta();
      setCache(nextValue);

      const queueKey = `user_pref:${userId ?? 'anon'}:${preferenceKey}`;

      if (!userId || !isOnline) {
        if (userId) {
          enqueueSync({ scope: 'userpref', key: queueKey, value: nextValue, prevValue: previous });
          if (!isOnline) {
            toast.info(`Preferência salva localmente. Será sincronizada quando a conexão for restaurada.`);
          }
        }
        return true;
      }

      const submit = async (): Promise<boolean> => {
        const res = await withTimeout(
          upsertUserPreference({
            userId,
            moduleKey: preferenceKey,
            value: nextValue as unknown as Json,
          }),
        );
        const error = res?.error;

        if (error) {
          setCache(previous);
          enqueueSync({ scope: 'userpref', key: queueKey, value: nextValue, prevValue: previous });
          toast.error(`Erro ao salvar preferência '${preferenceKey}'.`, {
            action: { label: 'Tentar novamente', onClick: () => void submit() },
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
    [value, getMeta, setCache, userId, isOnline, preferenceKey, reloadFromSupabase],
  );

  return { value, loading, save, reloadFromSupabase };
}
