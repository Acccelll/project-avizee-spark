import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useSyncedStorage, buildSyncedStorageKey } from './useSyncedStorage';
import { enqueueSync, processSyncQueue } from '@/services/syncQueue';
import { useOnlineStatus } from './useOnlineStatus';

const PREFIX = 'erp-user-pref';
const REMOTE_TIMEOUT_MS = 8000;

function buildStorageKey(userId: string | null | undefined, preferenceKey: string) {
  return `${PREFIX}:${userId ?? 'anon'}:${preferenceKey}`;
}

function buildDbKey(userId: string, preferenceKey: string) {
  return `user_pref:${userId}:${preferenceKey}`;
}

async function withTimeout<T>(promise: Promise<T>) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('sync_timeout')), REMOTE_TIMEOUT_MS)),
  ]);
}

export function useUserPreference<T = Json>(userId: string | null | undefined, preferenceKey: string, defaultValue: T) {
  const isOnline = useOnlineStatus();
  const namespace = useMemo(() => `user-pref:${userId ?? 'anon'}`, [userId]);

  const { value, set: setCache, getMeta } = useSyncedStorage<T>(preferenceKey, defaultValue, {
    namespace,
    onRemoteSyncError: () => {
      toast.error(`Inconsistência em '${preferenceKey}'. Recarregando...`);
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
    if (!supabase || !userId) return;
    const { data, error } = await supabase
      .from('app_configuracoes')
      .select('valor, updated_at')
      .eq('chave', buildDbKey(userId, preferenceKey))
      .maybeSingle();

    if (!error && data?.valor !== undefined && data?.valor !== null) {
      setCache(data.valor as T);
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
      if (!isOnline || !supabase || !userId) return;
      await processSyncQueue(async (item) => {
        if (item.scope !== 'userpref') return false;
        const { error } = await supabase.from('app_configuracoes').upsert(
          { chave: item.key, valor: item.value as Json, updated_at: new Date().toISOString() },
          { onConflict: 'chave' },
        );
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

      if (!userId || !supabase || !isOnline) {
        if (userId) {
          enqueueSync({ scope: 'userpref', key: buildDbKey(userId, preferenceKey), value: nextValue, prevValue: previous });
        }
        return true;
      }

      const submit = async (): Promise<boolean> => {
        const res = await withTimeout(
          new Promise<{ error: any }>((resolve) => {
            supabase.from('app_configuracoes').upsert(
              {
                chave: buildDbKey(userId, preferenceKey),
                valor: nextValue as unknown as Json,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'chave' },
            ).then(r => resolve(r));
          }),
        );
        const error = res?.error;

        if (error) {
          setCache(previous);
          enqueueSync({ scope: 'userpref', key: buildDbKey(userId, preferenceKey), value: nextValue, prevValue: previous });
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
    [value, getMeta, setCache, userId, supabase, isOnline, preferenceKey, reloadFromSupabase],
  );

  return { value, loading, save, reloadFromSupabase };
}
