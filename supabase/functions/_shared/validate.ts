/**
 * Helpers compartilhados para validação de input e fetch resiliente em
 * edge functions. Padroniza:
 *   - validateJson: parse + validação Zod do body, retornando 400 já com
 *     corsHeaders quando o input é inválido.
 *   - fetchWithTimeout: envolve fetch com AbortController e timeout, lançando
 *     TimeoutError quando estoura. O caller decide se traduz para 504.
 *   - timeoutResponse: helper para 504 padronizado.
 */
import { z, ZodError, type ZodTypeAny } from "npm:zod@3.23.8";

export { z };

export class TimeoutError extends Error {
  constructor(public readonly url: string, public readonly ms: number) {
    super(`fetch timed out after ${ms}ms: ${url}`);
    this.name = "TimeoutError";
  }
}

export type ValidateResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

export async function validateJson<S extends ZodTypeAny>(
  req: Request,
  schema: S,
  corsHeaders: Record<string, string>,
): Promise<ValidateResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Body inválido: JSON esperado" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const err = parsed.error as ZodError;
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: "Validação falhou",
          fields: err.flatten().fieldErrors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * fetch envolvido em AbortController. Lança TimeoutError no estouro, qualquer
 * outro erro de rede é repassado para o caller (que pode tratar 5xx/retry).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  const ctrl = new AbortController();
  const externalSignal = init.signal as AbortSignal | undefined;
  if (externalSignal) {
    if (externalSignal.aborted) ctrl.abort();
    else externalSignal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      throw new TimeoutError(url, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function timeoutResponse(
  corsHeaders: Record<string, string>,
  detail = "Serviço externo demorou demais para responder",
): Response {
  return new Response(
    JSON.stringify({ error: "Gateway Timeout", detail }),
    {
      status: 504,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

export function isTimeoutError(err: unknown): err is TimeoutError {
  return err instanceof TimeoutError;
}