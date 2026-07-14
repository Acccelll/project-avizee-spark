/**
 * Retry com backoff exponencial + jitter. Consulta `isRetryable` do
 * FiscalError e respeita `AbortSignal` externo.
 */
import type { Result, FiscalError } from '../../core/types';
import { isRetryable } from '../../core/errors';

export interface RetryOptions {
  max: number;
  backoffMs: number[];
  signal?: AbortSignal;
}

export async function withRetry<T>(
  op: (attempt: number) => Promise<Result<T>>,
  opts: RetryOptions,
): Promise<Result<T>> {
  let last: Result<T> | undefined;
  for (let attempt = 1; attempt <= opts.max; attempt++) {
    if (opts.signal?.aborted) break;
    last = await op(attempt);
    if (last.ok) return last;
    if (!isRetryable(last.error as FiscalError)) return last;
    if (attempt >= opts.max) break;
    const wait = opts.backoffMs[attempt - 1] ?? opts.backoffMs[opts.backoffMs.length - 1] ?? 0;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait + Math.random() * 100));
  }
  return last!;
}