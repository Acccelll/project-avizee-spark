import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export type DashboardPeriod = "today" | "week" | "month" | "30d" | "custom";

interface DashboardPeriodContextValue {
  period: DashboardPeriod;
  setPeriod: (period: DashboardPeriod) => void;
  /** Valor aplicado ao dashboard (alimenta `range`). */
  customStart: string;
  customEnd: string;
  /** Rascunho que o usuário está digitando no header. Não dispara queries. */
  customStartDraft: string;
  customEndDraft: string;
  setCustomStartDraft: (value: string) => void;
  setCustomEndDraft: (value: string) => void;
  /** Aplica o rascunho ao range (validando que start <= end). Retorna true se aplicado. */
  applyCustomRange: () => boolean;
  /** Estado derivado: true quando draft difere do aplicado. */
  customRangeDirty: boolean;
  /** True quando o range em rascunho é inválido (start > end ou datas malformadas). */
  customRangeInvalid: boolean;
  range: { dateFrom: string; dateTo: string };
}

const DashboardPeriodContext = createContext<DashboardPeriodContextValue | undefined>(undefined);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidIso = (s: string) => ISO_DATE_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());

export function DashboardPeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<DashboardPeriod>("30d");
  const today = formatLocalDate(new Date());
  const [customStart, setCustomStart] = useState<string>(today);
  const [customEnd, setCustomEnd] = useState<string>(today);
  const [customStartDraft, setCustomStartDraft] = useState<string>(today);
  const [customEndDraft, setCustomEndDraft] = useState<string>(today);

  const customRangeDirty = customStartDraft !== customStart || customEndDraft !== customEnd;
  const customRangeInvalid = useMemo(() => {
    if (!isValidIso(customStartDraft) || !isValidIso(customEndDraft)) return true;
    return customStartDraft > customEndDraft;
  }, [customStartDraft, customEndDraft]);

  const applyCustomRange = useCallback(() => {
    if (customRangeInvalid) return false;
    setCustomStart(customStartDraft);
    setCustomEnd(customEndDraft);
    return true;
  }, [customRangeInvalid, customStartDraft, customEndDraft]);

  const range = useMemo(() => {
    const now = new Date();
    const toIso = (d: Date) => formatLocalDate(d);

    if (period === "today") {
      const today = toIso(now);
      return { dateFrom: today, dateTo: today };
    }
    if (period === "week") {
      const first = new Date(now);
      // Start on Monday (ISO week convention – avoids Sunday-anchor confusion).
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      first.setDate(now.getDate() + diffToMonday);
      return { dateFrom: toIso(first), dateTo: toIso(now) };
    }
    if (period === "month") {
      return { dateFrom: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, dateTo: toIso(now) };
    }
    if (period === "custom") {
      return { dateFrom: customStart, dateTo: customEnd };
    }

    const past30 = new Date(now);
    past30.setDate(now.getDate() - 30);
    return { dateFrom: toIso(past30), dateTo: toIso(now) };
  }, [customEnd, customStart, period]);

  return (
    <DashboardPeriodContext.Provider value={{
      period,
      setPeriod,
      customStart,
      customEnd,
      customStartDraft,
      customEndDraft,
      setCustomStartDraft,
      setCustomEndDraft,
      applyCustomRange,
      customRangeDirty,
      customRangeInvalid,
      range,
    }}>
      {children}
    </DashboardPeriodContext.Provider>
  );
}

export function useDashboardPeriod() {
  const context = useContext(DashboardPeriodContext);
  if (!context) {
    throw new Error("useDashboardPeriod must be used within DashboardPeriodProvider");
  }
  return context;
}
