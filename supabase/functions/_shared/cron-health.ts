/**
 * Heartbeat helper para edge functions agendadas.
 *
 * Cada cron deve chamar `recordCronHealth(adminClient, "<job>", "ok"|"error", error?)`
 * no final do handler — alimenta a tabela `public.cron_health` consumida pelo
 * painel admin "Saúde do sistema".
 *
 * Erros do próprio heartbeat são silenciados (best-effort: nunca derrubar o cron
 * por causa do log de saúde).
 */

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export async function recordCronHealth(
  admin: AdminClient,
  job: string,
  status: "ok" | "error",
  error?: unknown,
): Promise<void> {
  try {
    const errMsg =
      error == null
        ? null
        : (error instanceof Error ? error.message : String(error)).slice(0, 500);
    await admin.rpc("touch_cron_health", {
      p_job: job,
      p_status: status,
      p_error: errMsg,
    });
  } catch (e) {
    console.warn(`[cron-health] falha registrando heartbeat de ${job}:`, e);
  }
}