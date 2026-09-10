/**
 * Formatação e cálculos para pt-BR.
 */

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

export function formatCurrency(value: number): string {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export const formatMoney = formatCurrency;

const compactCurrencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Versão compacta para KPIs em telas estreitas: ex. `R$ 731,8 mil`, `R$ 1,2 mi`. */
export function formatCurrencyCompact(value: number): string {
  return compactCurrencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(Number.isFinite(value) ? value : 0);
}

/** Formata peso em kg no padrão pt-BR: ex. `6,00 kg`, `1.234,50 kg`. */
export function formatWeightKg(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kg`;
}

function normalizeDate(value: string | Date) {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

export function formatDate(date: string | Date): string {
  if (!date) return "-";
  return normalizeDate(date).toLocaleDateString("pt-BR");
}

/** Data + hora no padrão pt-BR: ex. `09/09/2026 14:32`. */
export function formatDateTime(date: string | Date): string {
  if (!date) return "-";
  return normalizeDate(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysSince(date: string | Date): number {
  return calculateDaysBetween(date, new Date());
}

export function calculateDaysBetween(startDate: string | Date, endDate: string | Date): number {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);

  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24));
}

/** Idade desde uma data, no formato compacto do spec de suporte: `18 min`, `1h`, `3h`, `2d`. */
export function formatIdade(date: string | Date, since: Date = new Date()): string {
  const start = date instanceof Date ? date : new Date(date);
  const minutos = Math.max(0, Math.floor((since.getTime() - start.getTime()) / 60_000));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h`;
  const dias = Math.floor(horas / 24);
  return `${dias}d`;
}

export function formatPercent(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}
