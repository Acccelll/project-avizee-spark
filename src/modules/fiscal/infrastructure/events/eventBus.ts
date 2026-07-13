/**
 * Barramento interno de eventos fiscais (in-process).
 * Persistência/relay para webhooks vem em etapa posterior.
 */
export type FiscalEventName =
  | 'fiscal.endpoint.updated'
  | 'fiscal.config.updated'
  | 'fiscal.certificado.registrado'
  | 'fiscal.certificado.expira_em_breve'
  | 'fiscal.auditoria.registrada'
  | 'fiscal.queue.job_enqueued'
  | 'fiscal.queue.job_failed';

export interface FiscalEvent<T = unknown> {
  name: FiscalEventName;
  correlationId?: string;
  empresaId?: string;
  timestamp: string;
  payload: T;
}

type Handler = (ev: FiscalEvent) => void | Promise<void>;

export class FiscalEventBus {
  private handlers = new Map<FiscalEventName, Set<Handler>>();

  on(name: FiscalEventName, handler: Handler): () => void {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(handler);
    return () => this.handlers.get(name)?.delete(handler);
  }

  async emit<T>(name: FiscalEventName, payload: T, meta: { correlationId?: string; empresaId?: string } = {}): Promise<void> {
    const ev: FiscalEvent<T> = { name, payload, timestamp: new Date().toISOString(), ...meta };
    const list = this.handlers.get(name);
    if (!list) return;
    await Promise.allSettled(Array.from(list).map((h) => h(ev as FiscalEvent)));
  }
}
