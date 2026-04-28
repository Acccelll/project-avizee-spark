import type { Period } from '@/components/filters/periodTypes';

/**
 * Returns a forward-looking date range for financial filters.
 * "Hoje" = today only
 * "7d"   = today → today+7
 * "30d"  = today → today+30
 * "vencidos" = everything before today
 */
export function periodToFinancialRange(period: Period): { dateFrom: string; dateTo: string | null } {
  const now = new Date();
  const today = fmtDate(now);

  if (period === 'todos') {
    return { dateFrom: '2000-01-01', dateTo: null };
  }

  if (period === 'vencidos') {
    return { dateFrom: '2000-01-01', dateTo: null }; // dateTo handled by status filter
  }

  const daysMap: Record<string, number> = {
    hoje: 0,
    '7d': 7,
    '15d': 15,
    '30d': 30,
    '90d': 90,
  };

  if (period === 'year') {
    const endOfYear = new Date(now.getFullYear(), 11, 31);
    return { dateFrom: today, dateTo: fmtDate(endOfYear) };
  }

  const days = daysMap[period] ?? 30;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return { dateFrom: today, dateTo: fmtDate(end) };
}

function fmtDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns the date string (YYYY-MM-DD) for the start of the given period.
 * Uses plain date format so it works correctly with Supabase `date` columns.
 * NOTE: This is backward-looking. For financial (contas a pagar/receber), use periodToFinancialRange instead.
 */
export function periodToDateFrom(period: Period): string {
  const now = new Date();
  let d: Date;

  switch (period) {
    case 'hoje':
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7d':
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      break;
    case '15d':
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 15);
      break;
    case '30d':
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      break;
    case '90d':
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
      break;
    case 'year':
      d = new Date(now.getFullYear(), 0, 1);
      break;
    case 'vencidos':
      d = new Date(2000, 0, 1);
      break;
    case 'todos':
      d = new Date(2000, 0, 1);
      break;
    default:
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  }

  return fmtDate(d);
}

export function periodToDateTo(period: Period): string | null {
  if (period === 'hoje') {
    return fmtDate(new Date());
  }
  return null;
}

/**
 * Converte uma string `YYYY-MM` no intervalo de datas do mês fechado
 * (1º dia até último dia). Retorna `null` se a string não for válida.
 */
export function monthToRange(yyyyMm: string | null | undefined): { from: string; to: string } | null {
  if (!yyyyMm) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  if (month < 1 || month > 12) return null;
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0); // dia 0 do mês seguinte = último dia
  return { from: fmtDate(first), to: fmtDate(last) };
}

/** Retorna o YYYY-MM do mês corrente. */
export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Formata YYYY-MM como "Mmm/AAAA" (ex.: "Abr/2026"). */
export function formatMonthKey(yyyyMm: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!m) return yyyyMm;
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[Number(m[2]) - 1]}/${m[1]}`;
}
