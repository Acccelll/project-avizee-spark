import { describe, it, expect } from 'vitest';
import { FiscalCache } from '../infrastructure/cache/fiscalCache';
import { FiscalEventBus } from '../infrastructure/events/eventBus';
import { InMemoryQueue } from '../infrastructure/queue/inMemoryQueue';
import { bootstrapFiscal, resetFiscal } from '../core/bootstrap';

describe('FiscalCache', () => {
  it('armazena e expira', async () => {
    const c = new FiscalCache();
    c.set('k', 42, 20);
    expect(c.get<number>('k')).toBe(42);
    await new Promise((r) => setTimeout(r, 25));
    expect(c.get('k')).toBeNull();
  });

  it('invalida por prefixo', () => {
    const c = new FiscalCache();
    c.set('a:1', 1, 1000); c.set('a:2', 2, 1000); c.set('b:1', 3, 1000);
    c.invalidate('a:');
    expect(c.get('a:1')).toBeNull();
    expect(c.get('b:1')).toBe(3);
  });
});

describe('FiscalEventBus', () => {
  it('dispara handlers registrados', async () => {
    const bus = new FiscalEventBus();
    let calls = 0;
    bus.on('fiscal.endpoint.updated', () => { calls++; });
    await bus.emit('fiscal.endpoint.updated', { x: 1 });
    expect(calls).toBe(1);
  });
});

describe('InMemoryQueue', () => {
  it('processa job e reenfileira em falha até DLQ', async () => {
    const q = new InMemoryQueue();
    let attempts = 0;
    q.register('t', async () => { attempts++; throw new Error('boom'); });
    q.enqueue('t', {}, { maxAttempts: 2, backoffMs: [0, 0] });
    await q.drain();
    await q.drain();
    expect(attempts).toBe(2);
    expect(q.stats().dlq).toBe(1);
  });
});

describe('bootstrap', () => {
  it('devolve container singleton', () => {
    resetFiscal();
    const a = bootstrapFiscal();
    const b = bootstrapFiscal();
    expect(a).toBe(b);
    expect(a.endpoints).toBeDefined();
    expect(a.runtimeConfig).toBeDefined();
    expect(a.auditoria).toBeDefined();
  });
});
