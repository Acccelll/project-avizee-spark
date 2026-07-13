/**
 * Fila in-memory com retry/backoff e DLQ. Placeholder até plugarmos
 * pgmq/edge cron nas etapas futuras.
 */
export interface QueueJob<T = unknown> {
  id: string;
  kind: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  backoffMs: number[];
  createdAt: number;
  nextRunAt: number;
}

export type JobHandler<T = unknown> = (job: QueueJob<T>) => Promise<void>;

export class InMemoryQueue {
  private queue: QueueJob[] = [];
  private dlq: QueueJob[] = [];
  private handlers = new Map<string, JobHandler>();

  register(kind: string, handler: JobHandler): void {
    this.handlers.set(kind, handler);
  }

  enqueue<T>(kind: string, payload: T, opts: Partial<Pick<QueueJob, 'maxAttempts' | 'backoffMs'>> = {}): string {
    const job: QueueJob<T> = {
      id: crypto.randomUUID(),
      kind,
      payload,
      attempts: 0,
      maxAttempts: opts.maxAttempts ?? 3,
      backoffMs: opts.backoffMs ?? [500, 1500, 4000],
      createdAt: Date.now(),
      nextRunAt: Date.now(),
    };
    this.queue.push(job as QueueJob);
    return job.id;
  }

  async drain(): Promise<{ processed: number; deadLettered: number }> {
    const now = Date.now();
    const ready = this.queue.filter((j) => j.nextRunAt <= now);
    this.queue = this.queue.filter((j) => j.nextRunAt > now);
    let processed = 0;
    let deadLettered = 0;
    for (const job of ready) {
      const handler = this.handlers.get(job.kind);
      if (!handler) { this.dlq.push(job); deadLettered++; continue; }
      try {
        await handler(job);
        processed++;
      } catch {
        job.attempts++;
        if (job.attempts >= job.maxAttempts) { this.dlq.push(job); deadLettered++; }
        else {
          const idx = Math.min(job.attempts - 1, job.backoffMs.length - 1);
          job.nextRunAt = Date.now() + job.backoffMs[idx];
          this.queue.push(job);
        }
      }
    }
    return { processed, deadLettered };
  }

  stats() { return { pending: this.queue.length, dlq: this.dlq.length }; }
}
