/**
 * Circuit breaker em memória (por chave — tipicamente `documento:uf:servico`).
 * Estado persistido em `fiscal_circuit_state` será conectado em etapa posterior.
 */
export type BreakerState = 'closed' | 'open' | 'half-open';

interface Slot { state: BreakerState; failures: number; openedAt: number; }

export interface BreakerOptions { threshold: number; cooldownMs: number; }

export class CircuitBreaker {
  private slots = new Map<string, Slot>();
  constructor(private opts: BreakerOptions = { threshold: 5, cooldownMs: 30_000 }) {}

  canPass(key: string, now = Date.now()): boolean {
    const s = this.slots.get(key);
    if (!s || s.state === 'closed') return true;
    if (s.state === 'open' && now - s.openedAt >= this.opts.cooldownMs) {
      s.state = 'half-open';
      return true;
    }
    return s.state === 'half-open';
  }

  reportSuccess(key: string): void {
    this.slots.set(key, { state: 'closed', failures: 0, openedAt: 0 });
  }

  reportFailure(key: string, now = Date.now()): void {
    const cur = this.slots.get(key) ?? { state: 'closed' as BreakerState, failures: 0, openedAt: 0 };
    cur.failures += 1;
    if (cur.failures >= this.opts.threshold) {
      cur.state = 'open';
      cur.openedAt = now;
    }
    this.slots.set(key, cur);
  }

  stateOf(key: string): BreakerState { return this.slots.get(key)?.state ?? 'closed'; }
}