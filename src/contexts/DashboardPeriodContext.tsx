import { createContext, ReactNode, useContext, useMemo, useState } from "react";

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
  customStart: string;
  customEnd: string;
  setCustomStart: (value: string) => void;
  setCustomEnd: (value: string) => void;
  range: { dateFrom: string; dateTo: string };
}

const DashboardPeriodContext = createContext<DashboardPeriodContextValue | undefined>(undefined);

export function DashboardPeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<DashboardPeriod>("30d");
  const [customStart, setCustomStart] = useState<string>(formatLocalDate(new Date()));
  const [customEnd, setCustomEnd] = useState<string>(formatLocalDate(new Date()));

  const range = useMemo(() => {
    const now = new Date();
    const toIso = (d: Date) => formatLocalDate(d);

    if (period === "today") {
      const today = toIso(now);
      return { dateFrom: today, dateTo: today };
    }
    if (period === "week") {
      const first = new Date(now);
      first.setDate(now.getDate() - now.getDay());
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
    <DashboardPeriodContext.Provider value={{ period, setPeriod, customStart, customEnd, setCustomStart, setCustomEnd, range }}>
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
