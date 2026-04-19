import { useCallback, useEffect, useRef } from "react";

const AUTO_SAVE_INTERVAL_MS = 30_000;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export interface UseAutoSaveOptions<T> {
  /** Unique key used to persist data in localStorage */
  storageKey: string;
  /** Current form data to persist */
  data: T;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
  /** Interval in milliseconds between saves (default: 30 000) */
  intervalMs?: number;
  /**
   * Maximum age of a draft, in milliseconds, before it is considered expired
   * and discarded by `restore()`. Defaults to 7 days. Set to `0` to disable.
   */
  maxAgeMs?: number;
}

export interface RestoredDraft<T> {
  data: T;
  savedAt: number;
}

export interface UseAutoSaveReturn<T> {
  /**
   * Restore previously saved draft. Returns `null` when none is found, the
   * stored payload is invalid, or the draft is older than `maxAgeMs`.
   * Includes the original `savedAt` timestamp so the caller can show
   * "Rascunho salvo em <date>" feedback.
   */
  restore: () => RestoredDraft<T> | null;
  /** Manually persist the current data immediately */
  save: () => void;
  /** Remove the stored draft from localStorage */
  clear: () => void;
}

export function useAutoSave<T>({
  storageKey,
  data,
  enabled = true,
  intervalMs = AUTO_SAVE_INTERVAL_MS,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const dataRef = useRef<T>(data);
  dataRef.current = data;

  const save = useCallback(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ data: dataRef.current, savedAt: Date.now() }),
      );
    } catch {
      // Storage quota exceeded or private browsing — silently ignore.
    }
  }, [storageKey]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Silently ignore.
    }
  }, [storageKey]);

  const restore = useCallback((): RestoredDraft<T> | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { data: T; savedAt: number } | null;
      if (!parsed || parsed.data === undefined || parsed.data === null) return null;

      if (maxAgeMs && maxAgeMs > 0) {
        const age = Date.now() - (parsed.savedAt ?? 0);
        if (age > maxAgeMs) {
          try {
            localStorage.removeItem(storageKey);
          } catch {
            // ignore
          }
          return null;
        }
      }

      return { data: parsed.data, savedAt: parsed.savedAt ?? Date.now() };
    } catch {
      return null;
    }
  }, [storageKey, maxAgeMs]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(save, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, save]);

  return { restore, save, clear };
}
