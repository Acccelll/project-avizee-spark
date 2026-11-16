import { toLocalDateInput } from "@/lib/date";

/**
 * Date utilities used across forms and persistence flows.
 *
 * Datas "do dia" são sempre no horário local do usuário (ver `todayISO`).
 *
 * @remarks
 * `todayISO()` is a function (not a constant) on purpose: defining
 * `const today = todayISO()` at module scope
 * freezes the value to the moment the bundle is loaded, which causes
 * "stale today" bugs in long-lived sessions (e.g. user opens the app
 * before midnight and continues using it the next day).
 *
 * Always call `todayISO()` inside `openCreate`/`handleSubmit` instead of
 * relying on a module-level constant.
 *
 * @example
 * ```ts
 * import { todayISO } from "@/lib/dateUtils";
 *
 * function openCreate() {
 *   setForm({ ...emptyForm, data_emissao: todayISO() });
 * }
 * ```
 */
export function todayISO(): string {
  return toLocalDateInput(new Date());
}

/**
 * Returns an ISO date string (YYYY-MM-DD) `days` from today.
 * Negative numbers are accepted for past dates.
 */
export function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalDateInput(d);
}

/**
 * Data local (`YYYY-MM-DD`) de um `Date` construído no horário local
 * (ex.: `new Date()`, `new Date(ano, mes, dia)`, ou derivado deles com
 * `setDate`).
 *
 * Não use `d.toISOString().slice(0, 10)` para isso: `toISOString` converte
 * para UTC e, no Brasil, a partir das 21h devolve o dia seguinte.
 * (Já para um `Date` vindo de `new Date("YYYY-MM-DD")`, que o JS lê como
 * meia-noite UTC, `toISOString` é que preserva o dia.)
 */
export const toLocalISODate = toLocalDateInput;
