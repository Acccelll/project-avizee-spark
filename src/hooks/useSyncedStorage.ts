import { useState, useEffect, useCallback, useRef } from 'react';

export const STORAGE_SCHEMA_VERSION = 2;

interface StoredEnvelope<T> {
  v: number;
  data: T;
  updatedAt: number;
  revision: number;
}

function readFromStorage<T>(key: string): StoredEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const envelope = JSON.parse(raw) as StoredEnvelope<T>;
    if (!envelope || envelope.v !== STORAGE_SCHEMA_VERSION) {
      localStorage.removeItem(key);
      return null;
    }
    return envelope;
  } catch {
    return null;
  }
}

function writeToStorage<T>(key: string, value: T, revision: number): StoredEnvelope<T> {
  const envelope: StoredEnvelope<T> = { v: STORAGE_SCHEMA_VERSION, data: value, updatedAt: Date.now(), revision };
  localStorage.setItem(key, JSON.stringify(envelope));
  return envelope;
}

function removeFromStorage(key: string): void {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

export function buildSyncedStorageKey(namespace: string, key: string): string {
  return `erp:${namespace}:${key}`;
}

export interface UseSyncedStorageOptions {
  namespace?: string;
  onRemoteSyncError?: (info: { key: string; reason: string; expectedRevision: number; actualRevision: number | null }) => void;
}

export interface UseSyncedStorageResult<T> {
  value: T;
  set: (next: T | null) => { revision: number };
  remove: () => void;
  getMeta: () => { revision: number; updatedAt: number };
}

export function useSyncedStorage<T>(key: string, defaultValue: T, options: UseSyncedStorageOptions = {}): UseSyncedStorageResult<T> {
  const namespace = options.namespace ?? 'erp';
  const storageKey = `erp:${namespace}:${key}`;

  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;

  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;

  const metaRef = useRef<{ revision: number; updatedAt: number }>({ revision: 0, updatedAt: Date.now() });

  const [value, setValue] = useState<T>(() => {
    const cached = readFromStorage<T>(storageKey);
    if (cached !== null) {
      metaRef.current = { revision: cached.revision, updatedAt: cached.updatedAt };
      return cached.data;
    }
    return defaultValue;
  });

  useEffect(() => {
    const cached = readFromStorage<T>(storageKey);
    if (cached !== null) {
      metaRef.current = { revision: cached.revision, updatedAt: cached.updatedAt };
      setValue(cached.data);
    } else {
      setValue(defaultValueRef.current);
    }
  }, [storageKey]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKeyRef.current) return;
      if (event.newValue === null) {
        setValue(defaultValueRef.current);
        metaRef.current = { revision: 0, updatedAt: Date.now() };
        return;
      }

      const parsed = readFromStorage<T>(storageKeyRef.current);
      if (parsed !== null) {
        metaRef.current = { revision: parsed.revision, updatedAt: parsed.updatedAt };
        setValue(parsed.data);
      } else {
        setValue(defaultValueRef.current);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const set = useCallback((next: T | null) => {
    if (next === null) {
      removeFromStorage(storageKeyRef.current);
      setValue(defaultValueRef.current);
      metaRef.current = { revision: 0, updatedAt: Date.now() };
      return { revision: 0 };
    }

    const nextRevision = metaRef.current.revision + 1;
    const env = writeToStorage(storageKeyRef.current, next, nextRevision);
    setValue(next);
    metaRef.current = { revision: env.revision, updatedAt: env.updatedAt };
    return { revision: nextRevision };
  }, []);

  const remove = useCallback(() => {
    removeFromStorage(storageKeyRef.current);
    setValue(defaultValueRef.current);
    metaRef.current = { revision: 0, updatedAt: Date.now() };
  }, []);

  const getMeta = useCallback(() => metaRef.current, []);

  // simple inconsistency detector for domain hooks
  useEffect(() => {
    const cached = readFromStorage<T>(storageKeyRef.current);
    if (cached && cached.revision < metaRef.current.revision) {
      options.onRemoteSyncError?.({
        key: storageKeyRef.current,
        reason: 'local_revision_ahead_of_storage',
        expectedRevision: metaRef.current.revision,
        actualRevision: cached.revision,
      });
    }
  }, [options]);

  return { value, set, remove, getMeta };
}
