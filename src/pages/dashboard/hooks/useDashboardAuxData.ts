import { useCallback } from "react";
import type { DashboardDateRange } from "./types";
import {
  fetchDashboardAuxData,
  type DashboardAuxData,
} from "@/services/dashboard.service";

export function useDashboardAuxData(range: DashboardDateRange) {
  const loadAuxData = useCallback(
    (): Promise<DashboardAuxData> => fetchDashboardAuxData(range),
    [range],
  );
  return { loadAuxData };
}
