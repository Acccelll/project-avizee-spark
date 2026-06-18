/**
 * Rate limit em memória por instância de Edge Function.
 *
 * Suficiente para conter abuso/loops de UI em funções que chamam APIs pagas
 * (Lovable AI Gateway, consultadanfe, social-sync). Não é distribuído — cada
 * instância tem seu próprio contador; sob alta carga isso é tolerável porque
 * o limite é grosseiro e o objetivo é prevenir runaway, não SLA fino.
 *
 * Uso:
 *   const rl = checkRateLimit(userId ?? ip, { limit: 30, windowSec: 60 });
 *   if (!rl.ok) return rateLimitResponse(rl, corsHeaders);
 */

interface Window {
  count: number;
  resetAt: number; // epoch ms
}

const buckets = new Map<string, Window>();

// Limpa buckets vencidos a cada 5 min para evitar vazamento de memória.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 5 * 60_000) return;
  lastSweep = now;
  for (const [k, w] of buckets) {
    if (w.resetAt < now) buckets.delete(k);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

export interface RateLimitOpts {
  limit: number;
  windowSec: number;
  scope?: string; // prefixo opcional para isolar funções
}

export function checkRateLimit(key: string, opts: RateLimitOpts): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const bucketKey = `${opts.scope ?? "default"}:${key}`;
  const existing = buckets.get(bucketKey);
  if (!existing || existing.resetAt < now) {
    const resetAt = now + opts.windowSec * 1000;
    buckets.set(bucketKey, { count: 1, resetAt });
    return { ok: true, remaining: opts.limit - 1, resetAt, retryAfterSec: 0 };
  }
  if (existing.count >= opts.limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return {
    ok: true,
    remaining: opts.limit - existing.count,
    resetAt: existing.resetAt,
    retryAfterSec: 0,
  };
}

export function rateLimitResponse(
  rl: RateLimitResult,
  corsHeaders: Record<string, string>,
  message = "Muitas requisições — tente novamente em instantes.",
) {
  return new Response(
    JSON.stringify({ error: message, retry_after_sec: rl.retryAfterSec }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(rl.retryAfterSec),
      },
    },
  );
}

/** Extrai chave de identificação preferindo userId, caindo em IP. */
export function rateLimitKey(req: Request, userId: string | null | undefined): string {
  if (userId) return `u:${userId}`;
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "anon";
  return `ip:${ip}`;
}