import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSyncedStorage, STORAGE_SCHEMA_VERSION } from '@/hooks/useSyncedStorage';

// ── localStorage mock ─────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get _store() { return store; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Builds the storage key the hook uses. */
function buildKey(namespace: string, key: string) {
  return `erp:${namespace}:${key}`;
}

/** Writes a versioned envelope directly to the mock store. */
function writeEnvelope<T>(storageKey: string, data: T, version = STORAGE_SCHEMA_VERSION) {
  localStorageMock._store[storageKey] = JSON.stringify({ v: version, data });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSyncedStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns defaultValue when localStorage is empty', () => {
    const { result } = renderHook(() =>
      useSyncedStorage('theme', 'light', { namespace: 'test' }),
    );
    expect(result.current.value).toBe('light');
  });

  it('reads existing versioned value from localStorage on mount', () => {
    const key = buildKey('test', 'theme');
    writeEnvelope(key, 'dark');

    const { result } = renderHook(() =>
      useSyncedStorage('theme', 'light', { namespace: 'test' }),
    );
    expect(result.current.value).toBe('dark');
  });

  it('discards entry with wrong schema version and returns defaultValue', () => {
    const key = buildKey('test', 'theme');
    writeEnvelope(key, 'dark', STORAGE_SCHEMA_VERSION + 99);

    const { result } = renderHook(() =>
      useSyncedStorage('theme', 'light', { namespace: 'test' }),
    );
    expect(result.current.value).toBe('light');
    // The stale entry should have been removed.
    expect(localStorageMock._store[key]).toBeUndefined();
  });

  it('discards entry with malformed JSON and returns defaultValue', () => {
    const key = buildKey('test', 'theme');
    localStorageMock._store[key] = '{ not valid json ';

    const { result } = renderHook(() =>
      useSyncedStorage('theme', 'light', { namespace: 'test' }),
    );
    expect(result.current.value).toBe('light');
  });

  it('set() updates state and writes versioned envelope to localStorage', () => {
    const { result } = renderHook(() =>
      useSyncedStorage('count', 0, { namespace: 'test' }),
    );

    act(() => {
      result.current.set(42);
    });

    expect(result.current.value).toBe(42);

    const raw = localStorageMock._store[buildKey('test', 'count')];
    expect(raw).toBeDefined();
    const envelope = JSON.parse(raw);
    expect(envelope.v).toBe(STORAGE_SCHEMA_VERSION);
    expect(envelope.data).toBe(42);
    expect(typeof envelope.updatedAt).toBe('number');
    expect(typeof envelope.revision).toBe('number');
  });

  it('set(null) removes entry and resets to defaultValue', () => {
    const key = buildKey('test', 'flag');
    writeEnvelope(key, true);

    const { result } = renderHook(() =>
      useSyncedStorage('flag', false, { namespace: 'test' }),
    );
    expect(result.current.value).toBe(true);

    act(() => {
      result.current.set(null);
    });

    expect(result.current.value).toBe(false);
    expect(localStorageMock._store[key]).toBeUndefined();
  });

  it('remove() removes entry and resets to defaultValue', () => {
    const key = buildKey('test', 'flag');
    writeEnvelope(key, true);

    const { result } = renderHook(() =>
      useSyncedStorage('flag', false, { namespace: 'test' }),
    );

    act(() => {
      result.current.remove();
    });

    expect(result.current.value).toBe(false);
    expect(localStorageMock._store[key]).toBeUndefined();
  });

  it('uses default namespace "erp" when namespace is not provided', () => {
    const { result } = renderHook(() => useSyncedStorage('x', 1));

    act(() => { result.current.set(7); });

    const raw = localStorageMock._store[buildKey('erp', 'x')];
    expect(raw).toBeDefined();
    expect(JSON.parse(raw).data).toBe(7);
  });

  it('syncs value when another tab fires a storage event with a new value', () => {
    const key = buildKey('test', 'theme');

    const { result } = renderHook(() =>
      useSyncedStorage('theme', 'light', { namespace: 'test' }),
    );
    expect(result.current.value).toBe('light');

    // Simulate another tab writing a new value and firing the storage event.
    const newEnvelope = JSON.stringify({ v: STORAGE_SCHEMA_VERSION, data: 'dark' });
    localStorageMock._store[key] = newEnvelope;

    act(() => {
      const event = new Event('storage') as StorageEvent;
      Object.defineProperty(event, 'key', { value: key });
      Object.defineProperty(event, 'newValue', { value: newEnvelope });
      window.dispatchEvent(event);
    });

    expect(result.current.value).toBe('dark');
  });

  it('resets to defaultValue when another tab removes the entry (newValue=null)', () => {
    const key = buildKey('test', 'theme');
    writeEnvelope(key, 'dark');

    const { result } = renderHook(() =>
      useSyncedStorage('theme', 'light', { namespace: 'test' }),
    );
    expect(result.current.value).toBe('dark');

    act(() => {
      const event = new Event('storage') as StorageEvent;
      Object.defineProperty(event, 'key', { value: key });
      Object.defineProperty(event, 'newValue', { value: null });
      window.dispatchEvent(event);
    });

    expect(result.current.value).toBe('light');
  });

  it('ignores storage events for a different key', () => {
    const { result } = renderHook(() =>
      useSyncedStorage('theme', 'light', { namespace: 'test' }),
    );

    const otherEnvelope = JSON.stringify({ v: STORAGE_SCHEMA_VERSION, data: 'dark' });

    act(() => {
      const event = new Event('storage') as StorageEvent;
      Object.defineProperty(event, 'key', { value: buildKey('test', 'other-key') });
      Object.defineProperty(event, 'newValue', { value: otherEnvelope });
      window.dispatchEvent(event);
    });

    // Should remain unchanged.
    expect(result.current.value).toBe('light');
  });

  it('re-reads from localStorage when key changes (e.g., user switch)', () => {
    const key1 = buildKey('user-a', 'pref');
    const key2 = buildKey('user-b', 'pref');
    writeEnvelope(key1, 'value-a');
    writeEnvelope(key2, 'value-b');

    const { result, rerender } = renderHook(
      ({ ns }: { ns: string }) =>
        useSyncedStorage('pref', 'default', { namespace: ns }),
      { initialProps: { ns: 'user-a' } },
    );
    expect(result.current.value).toBe('value-a');

    rerender({ ns: 'user-b' });
    expect(result.current.value).toBe('value-b');
  });

  it('handles objects and arrays as values', () => {
    const payload = { a: 1, b: [2, 3] };

    const { result } = renderHook(() =>
      useSyncedStorage<{ a: number; b: number[] }>('obj', { a: 0, b: [] }, { namespace: 'test' }),
    );

    act(() => { result.current.set(payload); });

    expect(result.current.value).toEqual(payload);
    const raw = localStorageMock._store[buildKey('test', 'obj')];
    expect(JSON.parse(raw).data).toEqual(payload);
  });
});
