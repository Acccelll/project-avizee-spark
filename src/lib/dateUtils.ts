/**
 * Date utilities used across forms and persistence flows.
 *
 * @remarks
 * `todayISO()` is a function (not a constant) on purpose: defining
 * `const today = new Date().toISOString().slice(0, 10)` at module scope
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
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns an ISO date string (YYYY-MM-DD) `days` from today.
 * Negative numbers are accepted for past dates.
 */
export function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
