import { useCallback } from "react";
import {
  fetchDashboardEstoqueData,
  type DashboardEstoqueData,
} from "@/services/dashboard.service";

export function useDashboardEstoqueData() {
  const loadEstoqueData = useCallback(
    (): Promise<DashboardEstoqueData> => fetchDashboardEstoqueData(),
    [],
  );
  return { loadEstoqueData };
}
