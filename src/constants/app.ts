/**
 * Constantes globais da aplicação.
 *
 * Valores configuráveis via variáveis `VITE_*` (expostas no bundle público
 * por design — para segredos reais use Edge Functions + Supabase secrets).
 */

export const ADMIN_EMAIL =
  (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) ?? "admin@avizee.com.br";

export const INVITE_ONLY =
  (import.meta.env.VITE_INVITE_ONLY as string | undefined) === "true";
