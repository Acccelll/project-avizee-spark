/**
 * Cache in-memory com TTL (single-tab). Reset em bootstrap.
 */
interface Entry<T> { value: T; expiresAt: number }

export class FiscalCache {
  private store = new Map<string, Entry<unknown>>();

  get<T>(key: string): T | null {
    const e = this.store.get(key) as Entry<T> | undefined;
    if (!e) return null;
    if (Date.now() > e.expiresAt) { this.store.delete(key); return null; }
    return e.value;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(prefix?: string): void {
    if (!prefix) { this.store.clear(); return; }
    for (const k of this.store.keys()) if (k.startsWith(prefix)) this.store.delete(k);
  }
}
