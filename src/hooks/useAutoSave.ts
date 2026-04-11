import { useCallback, useEffect, useRef } from "react";

const AUTO_SAVE_INTERVAL_MS = 30_000;

export interface UseAutoSaveOptions<T> {
  /** Unique key used to persist data in localStorage */
  storageKey: string;
  /** Current form data to persist */
  data: T;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
  /** Interval in milliseconds between saves (default: 30 000) */
  intervalMs?: number;
}

export interface UseAutoSaveReturn<T> {
  /** Restore previously saved draft, returns null when none is found */
  restore: () => T | null;
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
}: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const dataRef = useRef<T>(data);
  dataRef.current = data;

  const save = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ data: dataRef.current, savedAt: Date.now() }));
    } catch {
      // Storage quota exceeded or private browsing — silently ignore.
    }
  }, [storageKey]);

  const restore = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { data: T; savedAt: number };
      return parsed.data ?? null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Silently ignore.
    }
  }, [storageKey]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(save, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, save]);

  return { restore, save, clear };
}
